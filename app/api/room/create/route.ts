import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/room";
import type { CreateRoomReq } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateRoomReq;
    if (!body.playerName?.trim()) {
      return NextResponse.json({ error: "请填写昵称" }, { status: 400 });
    }
    if (!body.initialChips || body.initialChips <= 0) {
      return NextResponse.json({ error: "初始筹码必须大于 0" }, { status: 400 });
    }
    if (!body.chipUnit || body.chipUnit <= 0) {
      return NextResponse.json({ error: "筹码面值必须大于 0" }, { status: 400 });
    }
    const result = await createRoom({
      name: body.name?.trim() || "",
      chipUnit: body.chipUnit,
      playerName: body.playerName.trim(),
      initialChips: body.initialChips,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "创建房间失败" },
      { status: 500 }
    );
  }
}
