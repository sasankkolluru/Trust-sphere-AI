import mongoose from "mongoose";
import { Redis } from "ioredis";

const mongoUri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/trustsphere";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redis.on("error", (error: Error) => {
  console.error(`Redis connection error: ${error.message}`);
});

export async function connectInfrastructure(): Promise<void> {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2_000 });
  await redis.connect();
}

export async function checkInfrastructure(): Promise<{
  mongodb: "up" | "down";
  redis: "up" | "down";
}> {
  const mongodb = mongoose.connection.readyState === 1 ? "up" : "down";
  let redisStatus: "up" | "down";

  try {
    redisStatus = (await redis.ping()) === "PONG" ? "up" : "down";
  } catch {
    redisStatus = "down";
  }

  return { mongodb, redis: redisStatus };
}

export async function closeInfrastructure(): Promise<void> {
  await Promise.allSettled([mongoose.disconnect(), redis.quit()]);
}
