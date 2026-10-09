import { createHmac, timingSafeEqual } from "node:crypto";
import type { Server, Socket } from "socket.io";

export type SocketUser = { id: string; role: "user" | "analyst" | "admin" };

type SocketData = { user: SocketUser };

const secret = process.env.SOCKET_AUTH_SECRET ?? "trustsphere-development-secret";
const roles = new Set<SocketUser["role"]>(["user", "analyst", "admin"]);

export function createSocketToken(user: SocketUser): string {
  const payload = `${user.id}.${user.role}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function verifySocketToken(token: unknown): SocketUser | null {
  if (typeof token !== "string") return null;
  const [id, role, signature] = token.split(".");
  if (!id || !role || !signature || !roles.has(role as SocketUser["role"])) return null;
  const expected = createHmac("sha256", secret).update(`${id}.${role}`).digest("hex");
  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }
  return { id, role: role as SocketUser["role"] };
}

export function configureRealtime(io: Server): void {
  io.use((socket, next) => {
    const user = verifySocketToken(socket.handshake.auth?.token);
    if (!user) {
      next(new Error("SOCKET_AUTH_INVALID"));
      return;
    }
    (socket.data as SocketData).user = user;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const { user } = socket.data as SocketData;
    socket.join(userRoom(user.id));
    socket.join(roleRoom(user.role));
    socket.emit("system:connected", { socketId: socket.id, user });
    socket.on("room:join", (room: unknown) => {
      if (
        typeof room === "string" &&
        room.length <= 100 &&
        /^(analysis|entity):[a-f\d]{24}$/i.test(room)
      ) {
        socket.join(room);
      }
    });
    socket.on("room:leave", (room: unknown) => {
      if (typeof room === "string" && /^(analysis|entity):[a-f\d]{24}$/i.test(room)) {
        void socket.leave(room);
      }
    });
    socket.on("disconnect", (reason) => {
      console.log(`Socket ${socket.id} disconnected: ${reason}`);
    });
  });
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function roleRoom(role: SocketUser["role"]): string {
  return `role:${role}`;
}

export function entityRoom(entityId: string): string {
  return `entity:${entityId}`;
}

export function analysisRoom(analysisId: string): string {
  return `analysis:${analysisId}`;
}

export function emitToUser(io: Server, userId: string, event: string, payload: unknown): void {
  io.to(userRoom(userId)).emit(event, payload);
}
