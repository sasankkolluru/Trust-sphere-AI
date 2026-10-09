import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  checkInfrastructure,
  closeInfrastructure,
  connectInfrastructure,
} from "./infrastructure.js";
import { createApiRouter } from "./routes/api.js";
import { configureRealtime } from "./realtime.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });
configureRealtime(io);
const port = Number(process.env.SERVER_PORT ?? 4000);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ service: "trustsphere-api", status: "ok" });
});

async function checkAiService(): Promise<"up" | "down"> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);

  try {
    const result = await fetch(`${process.env.AI_SERVICE_URL ?? "http://localhost:8000"}/health`, {
      signal: controller.signal,
    });
    return result.ok ? "up" : "down";
  } catch {
    return "down";
  } finally {
    clearTimeout(timeout);
  }
}

app.get("/health", (_request, response) => {
  void Promise.all([checkInfrastructure(), checkAiService()]).then(
    ([infrastructure, aiService]) => {
      const healthy = [...Object.values(infrastructure), aiService].every(
        (status) => status === "up",
      );
      response.status(healthy ? 200 : 503).json({
        service: "trustsphere-api",
        status: healthy ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        aiServiceUrl: process.env.AI_SERVICE_URL ?? "http://localhost:8000",
        infrastructure,
        aiService,
      });
    },
  );
});

app.use("/api/v1", createApiRouter(io));

app.use((_request, response) => {
  response.status(404).json({
    error: "NOT_FOUND",
    message: "The requested resource was not found.",
  });
});

async function start(): Promise<void> {
  try {
    await connectInfrastructure();
    console.log("MongoDB and Redis connected");
  } catch (error) {
    console.error("Infrastructure connection failed; API will start in degraded mode.", error);
  }

  httpServer.listen(port, () => {
    console.log(`TrustSphere API listening on http://localhost:${port}`);
  });
}

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received; shutting down`);
  io.close();
  await closeInfrastructure();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void start();
