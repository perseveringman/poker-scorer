import { NextRequest, NextResponse } from "next/server";
import { applyAction } from "@/lib/room";
import type { ActionReq } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ActionReq;
    if (!body.roomId || !body.operatorId || !body.type) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }
    await applyAction(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "操作失败" },
      { status: 400 }
    );
  }
}
