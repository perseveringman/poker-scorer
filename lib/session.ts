// localStorage 里保存当前用户在每个房间的身份（playerId）
const KEY = "poker-scorer:identity";

interface Identity {
  [roomId: string]: { playerId: string; playerName: string };
}

function read(): Identity {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Identity) : {};
  } catch {
    return {};
  }
}

function write(data: Identity) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

export function saveIdentity(roomId: string, playerId: string, playerName: string) {
  const data = read();
  data[roomId] = { playerId, playerName };
  write(data);
}

export function getIdentity(roomId: string) {
  return read()[roomId];
}

export function clearIdentity(roomId: string) {
  const data = read();
  delete data[roomId];
  write(data);
}

// 记住最近一次使用的昵称
export function saveLastName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("poker-scorer:lastName", name);
}
export function getLastName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("poker-scorer:lastName") ?? "";
}
