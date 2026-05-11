import { NextRequest, NextResponse } from "next/server";
import { joinRoom, readRoom } from "@/lib/room";
import type { JoinRoomReq } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as JoinRoomReq;
    const roomId = body.roomId?.trim().toUpperCase();
    if (!roomId) {
      return NextResponse.json({ error: "请填写房间号" }, { status: 400 });
    }
    if (!body.playerName?.trim()) {
      return NextResponse.json({ error: "请填写昵称" }, { status: 400 });
    }
    if (!body.initialChips || body.initialChips <= 0) {
      return NextResponse.json({ error: "初始筹码必须大于 0" }, { status: 400 });
    }
    // 快速校验
    const exists = await readRoom(roomId);
    if (!exists) {
      return NextResponse.json({ error: "房间不存在或已过期" }, { status: 404 });
    }
    const result = await joinRoom({
      roomId,
      playerName: body.playerName.trim(),
      initialChips: body.initialChips,
    });
    return NextResponse.json({ roomId, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "加入房间失败" },
      { status: 500 }
    );
  }
}
