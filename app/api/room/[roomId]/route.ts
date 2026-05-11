import { NextRequest, NextResponse } from "next/server";
import { readRoom } from "@/lib/room";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const state = await readRoom(roomId);
  if (!state) {
    return NextResponse.json({ error: "房间不存在或已过期" }, { status: 404 });
  }
  return NextResponse.json({ state });
}
