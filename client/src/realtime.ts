import { io, type Socket } from "socket.io-client";

export type RealtimeEvent = {
  name: string;
  payload: Record<string, unknown>;
  receivedAt: string;
};

type EventName =
  | "analysis:created"
  | "analysis:started"
  | "analysis:progress"
  | "analysis:completed"
  | "analysis:failed"
  | "risk:changed"
  | "alert:created"
  | "notification:new"
  | "entity:updated"
  | "dashboard:update";

const eventNames: EventName[] = [
  "analysis:created",
  "analysis:started",
  "analysis:progress",
  "analysis:completed",
  "analysis:failed",
  "risk:changed",
  "alert:created",
  "notification:new",
  "entity:updated",
  "dashboard:update",
];

const url = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
let socket: Socket | null = null;
const subscribedRooms = new Set<string>();

export function connectRealtime(onEvent: (event: RealtimeEvent) => void): () => void {
  const token =
    window.localStorage.getItem("trustsphere.socketToken") ?? import.meta.env.VITE_SOCKET_TOKEN;
  if (!token) return () => undefined;

  socket ??= io(url, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });
  if (!socket.hasListeners("connect")) {
    socket.on("connect", () => {
      subscribedRooms.forEach((room) => socket?.emit("room:join", room));
    });
  }
  const handlers = eventNames.map((name) => {
    const handler = (payload: Record<string, unknown>) =>
      onEvent({ name, payload, receivedAt: new Date().toISOString() });
    socket?.on(name, handler);
    return { name, handler };
  });
  return () => {
    handlers.forEach(({ name, handler }) => socket?.off(name, handler));
  };
}

export function joinRealtimeRoom(room: string): void {
  if (!/^(analysis|entity):[a-f\d]{24}$/i.test(room)) return;
  subscribedRooms.add(room);
  socket?.emit("room:join", room);
}

export function disconnectRealtime(): void {
  socket?.disconnect();
  socket = null;
  subscribedRooms.clear();
}
