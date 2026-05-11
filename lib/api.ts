import type { ActionReq, RoomState } from "./types";

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `请求失败 (${res.status})`);
  }
  return data as T;
}

export async function apiCreateRoom(body: {
  name: string;
  chipUnit: number;
  playerName: string;
  initialChips: number;
}) {
  const res = await fetch("/api/room/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<{ roomId: string; playerId: string }>(res);
}

export async function apiJoinRoom(body: {
  roomId: string;
  playerName: string;
  initialChips: number;
}) {
  const res = await fetch("/api/room/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<{ roomId: string; playerId: string }>(res);
}

export async function apiGetRoom(roomId: string) {
  const res = await fetch(`/api/room/${roomId}`, { cache: "no-store" });
  return handle<{ state: RoomState }>(res);
}

export async function apiAction(body: ActionReq) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<{ ok: true }>(res);
}
