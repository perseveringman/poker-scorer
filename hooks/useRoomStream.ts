"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomState, ServerEvent } from "@/lib/types";

type Status = "connecting" | "connected" | "disconnected" | "error";

export function useRoomStream(roomId: string | undefined) {
  const [state, setState] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setStatus("connecting");
      const es = new EventSource(`/api/subscribe/${roomId}`);
      esRef.current = es;

      es.onopen = () => {
        if (cancelled) return;
        setStatus("connected");
        setError(null);
      };

      es.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(ev.data) as ServerEvent;
          switch (msg.type) {
            case "snapshot":
            case "patch":
              setState(msg.state);
              break;
            case "error":
              setError(msg.message);
              setStatus("error");
              break;
            case "ping":
              // 心跳，忽略
              break;
          }
        } catch {
          /* ignore malformed event */
        }
      };

      es.onerror = () => {
        if (cancelled) return;
        setStatus("disconnected");
        es.close();
        esRef.current = null;
        // 1 秒后重连
        reconnectTimer.current = setTimeout(connect, 1000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [roomId]);

  return { state, status, error };
}
