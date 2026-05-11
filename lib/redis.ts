import { Redis } from "@upstash/redis";

// Upstash Redis REST 客户端
// 环境变量：
//   - KV_REST_API_URL / KV_REST_API_TOKEN（Vercel Marketplace 集成 Upstash 后自动注入）
//   - 或 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN（Upstash 官方变量名）
function getRedis(): Redis {
  const url =
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Upstash Redis 未配置。请在 Vercel 集成 Upstash 或在 .env.local 中设置 KV_REST_API_URL / KV_REST_API_TOKEN"
    );
  }
  return new Redis({ url, token });
}

export const redis = getRedis();

// Redis key 约定
export const keys = {
  room: (id: string) => `room:${id}`,
  version: (id: string) => `room:${id}:v`,      // 状态版本号，用于 SSE 比对
  lock: (id: string) => `room:${id}:lock`,
} as const;

// 房间默认过期时间：6 小时无操作自动清理
export const ROOM_TTL_SECONDS = 6 * 60 * 60;
