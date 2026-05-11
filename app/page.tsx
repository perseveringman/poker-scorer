"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { apiCreateRoom, apiJoinRoom } from "@/lib/api";
import {
  saveIdentity,
  saveLastName,
  getLastName,
} from "@/lib/session";

type Mode = "create" | "join";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [roomId, setRoomId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [chipUnit, setChipUnit] = useState(1);
  const [initialChips, setInitialChips] = useState(1000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlayerName(getLastName());
  }, []);

  const submit = async () => {
    setError(null);
    if (!playerName.trim()) return setError("请输入昵称");
    setSubmitting(true);
    try {
      if (mode === "create") {
        if (chipUnit <= 0) throw new Error("筹码面值必须大于 0");
        if (initialChips <= 0) throw new Error("初始筹码必须大于 0");
        const { roomId, playerId } = await apiCreateRoom({
          name: roomName.trim(),
          chipUnit,
          playerName: playerName.trim(),
          initialChips,
        });
        saveIdentity(roomId, playerId, playerName.trim());
        saveLastName(playerName.trim());
        router.push(`/room/${roomId}`);
      } else {
        if (!roomId.trim()) throw new Error("请输入房间号");
        if (initialChips <= 0) throw new Error("初始筹码必须大于 0");
        const normalized = roomId.trim().toUpperCase();
        const res = await apiJoinRoom({
          roomId: normalized,
          playerName: playerName.trim(),
          initialChips,
        });
        saveIdentity(res.roomId, res.playerId, playerName.trim());
        saveLastName(playerName.trim());
        router.push(`/room/${res.roomId}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-felt-dark">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🃏</div>
          <h1 className="text-3xl font-bold text-white">德州扑克计分</h1>
          <p className="text-slate-400 text-sm mt-2">
            线下朋友局 · 实时同步 · 自动结算
          </p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-xl">
          <div className="flex gap-2 mb-6 p-1 bg-slate-900 rounded-lg">
            <button
              onClick={() => setMode("create")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                mode === "create"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              创建房间
            </button>
            <button
              onClick={() => setMode("join")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                mode === "join"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              加入房间
            </button>
          </div>

          <div className="space-y-4">
            {mode === "join" && (
              <Field label="房间号">
                <input
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="6 位字母数字"
                  maxLength={6}
                  className="input tracking-widest text-center text-lg font-mono"
                />
              </Field>
            )}

            <Field label="你的昵称">
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="例如：老王"
                maxLength={12}
                className="input"
              />
            </Field>

            {mode === "create" && (
              <>
                <Field label="房间名称（可选）">
                  <input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="周五夜局"
                    maxLength={20}
                    className="input"
                  />
                </Field>
                <Field label="筹码面值（1 筹码 = 多少元）">
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={chipUnit}
                    onChange={(e) => setChipUnit(Number(e.target.value))}
                    className="input"
                  />
                </Field>
              </>
            )}

            <Field label="你的初始买入筹码">
              <input
                type="number"
                min={1}
                step={1}
                value={initialChips}
                onChange={(e) => setInitialChips(Number(e.target.value))}
                className="input"
              />
            </Field>

            {error && (
              <div className="text-rose-400 text-sm bg-rose-950/40 px-3 py-2 rounded-md">
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white font-semibold py-3 rounded-lg transition"
            >
              {submitting
                ? "处理中..."
                : mode === "create"
                ? "创建并进入房间"
                : "加入房间"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          房间 6 小时无操作自动销毁 · 数据仅暂存内存
        </p>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 10px 12px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          color: white;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus {
          border-color: #10b981;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-300 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
