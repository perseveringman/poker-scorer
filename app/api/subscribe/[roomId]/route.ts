import { NextRequest } from "next/server";
import { readRoom, getVersion } from "@/lib/room";
import type { ServerEvent } from "@/lib/types";

// 在 Node runtime 上运行（Edge runtime 对 setInterval/长时间 stream 有限制）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel 免费版函数最大执行时间 10 秒，Hobby 可配置更高；我们用 maxDuration 延长 SSE 保活
export const maxDuration = 60;

// 服务端按版本号轮询 Redis 的间隔
const POLL_INTERVAL_MS = 800;
// 单次连接最长保持时间（超过后客户端自动重连）
const CONNECTION_TTL_MS = 55 * 1000;
// 心跳间隔（防止中间代理断连）
const HEARTBEAT_MS = 15 * 1000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* noop */
        }
      };

      const send = (event: ServerEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      // 客户端断开时清理
      req.signal.addEventListener("abort", () => close());

      // 初始快照
      let lastVersion = -1;
      try {
        const [state, version] = await Promise.all([
          readRoom(roomId),
          getVersion(roomId),
        ]);
        if (!state) {
          send({ type: "error", message: "房间不存在或已过期" });
          close();
          return;
        }
        lastVersion = version;
        send({ type: "snapshot", state });
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
        close();
        return;
      }

      // 心跳 + 版本轮询合并到同一 loop
      const startedAt = Date.now();
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }
        // 连接时长到上限，优雅关闭让客户端重连
        if (Date.now() - startedAt > CONNECTION_TTL_MS) {
          clearInterval(interval);
          close();
          return;
        }
        try {
          const version = await getVersion(roomId);
          if (version !== lastVersion) {
            lastVersion = version;
            const state = await readRoom(roomId);
            if (state) send({ type: "patch", state });
          }
        } catch {
          // 忽略单次失败，下次再试
        }
      }, POLL_INTERVAL_MS);

      // 心跳（独立于业务轮询，保证 TCP 活跃）
      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);
          return;
        }
        send({ type: "ping", ts: Date.now() });
      }, HEARTBEAT_MS);

      // 托管清理
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
