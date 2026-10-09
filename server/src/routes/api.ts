import { Router, type Request, type Response } from "express";
import type { Model } from "mongoose";
import type { Server } from "socket.io";
import { z } from "zod";
import {
  AnalysisModel,
  AlertModel,
  AuditLogModel,
  DomainConfigurationModel,
  EntityModel,
  NotificationModel,
  UserModel,
} from "../models/index.js";
import { ingest } from "../ingestion/engine.js";
import { getDomainPlugin, listDomainPlugins } from "../domain-plugins/index.js";
import { analysisRoom, emitToUser, entityRoom, roleRoom } from "../realtime.js";
import { evaluateRisk, scoreTrustAndRisk } from "../risk-engine/index.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  search: z.string().optional(),
});

function numericValue(source: Record<string, unknown> | undefined, ...keys: string[]): number | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function stringArrayValue(source: Record<string, unknown> | undefined, ...keys: string[]): string[] {
  if (!source) return [];
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function list(model: Model<unknown>, searchable: string[] = []) {
  return async (req: Request, res: Response): Promise<void> => {
    const query = pageQuery.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: "INVALID_QUERY", details: query.error.flatten() });
      return;
    }
    const { page, limit, sort, search } = query.data;
    const filter: Record<string, unknown> = {};
    if (search && searchable.length)
      filter.$or = searchable.map((field) => ({ [field]: { $regex: search, $options: "i" } }));
    for (const [key, value] of Object.entries(req.query)) {
      if (!["page", "limit", "sort", "search"].includes(key) && typeof value === "string")
        filter[key] = value;
    }
    try {
      const [data, total] = await Promise.all([
        model
          .find(filter)
          .sort(sort || { createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        model.countDocuments(filter),
      ]);
      res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
      res.status(500).json({
        error: "DATABASE_ERROR",
        message: error instanceof Error ? error.message : "Database error",
      });
    }
  };
}

function create(model: Model<unknown>, schema: z.ZodTypeAny) {
  return async (req: Request, res: Response): Promise<void> => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
      return;
    }
    try {
      res.status(201).json({ data: await model.create(parsed.data) });
    } catch (error) {
      res.status(400).json({
        error: "CREATE_FAILED",
        message: error instanceof Error ? error.message : "Create failed",
      });
    }
  };
}

function byId(model: Model<unknown>) {
  return async (req: Request, res: Response): Promise<void> => {
    if (!objectId.safeParse(req.params.id).success) {
      res.status(400).json({ error: "INVALID_ID" });
      return;
    }
    try {
      const data = await model.findById(req.params.id).lean();
      if (!data) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      res.json({ data });
    } catch {
      res.status(500).json({ error: "DATABASE_ERROR" });
    }
  };
}

const userInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["user", "analyst", "admin"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
const entityInput = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  identifier: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  owner: objectId.optional(),
});
const analysisInput = z.object({
  user: objectId.optional(),
  entity: objectId,
  domain: z.string().min(1),
  input: z.unknown(),
  inputType: z.enum(["url", "text", "json", "csv", "pdf", "image", "document"]).optional(),
  extractedData: z.record(z.unknown()).optional(),
  rulesExecuted: z.array(z.unknown()).optional(),
  mlResults: z.record(z.unknown()).optional(),
  nlpResults: z.record(z.unknown()).optional(),
  anomalyResults: z.record(z.unknown()).optional(),
  trustScore: z.number().min(0).max(100).optional(),
  riskScore: z.number().min(0).max(100).optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical", "unknown"]).optional(),
  explanations: z.array(z.string()).optional(),
  explainability: z.record(z.unknown()).optional(),
  recommendations: z.array(z.string()).optional(),
  modelVersion: z.string().optional(),
});
const notificationInput = z.object({
  user: objectId,
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(["info", "warning", "risk", "system"]).optional(),
  data: z.record(z.unknown()).optional(),
});
const auditInput = z.object({
  actor: objectId.optional(),
  action: z.string().min(1),
  resourceType: z.string().optional(),
  resourceId: objectId.optional(),
  details: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
});
const ingestionInput = z.object({
  source: z.string().min(1).max(2_000),
  sourceType: z.enum(["url", "text", "json", "csv", "pdf", "image"]),
  content: z.unknown().optional(),
  domain: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export function createApiRouter(io: Server): Router {
  const router = Router();
  router.get("/domains", (_req: Request, res: Response): void => {
    res.json({
      data: listDomainPlugins().map((plugin) => ({
        name: plugin.name,
        displayName: plugin.displayName,
        acceptedInputs: plugin.acceptedInputs,
        outputSchema: plugin.outputSchema,
        rules: plugin.rules.map(({ id, name, description, domain, severity, weight }) => ({
          id,
          name,
          description,
          domain,
          severity,
          weight,
        })),
        scoring: plugin.scoring,
      })),
    });
  });
  router.get("/users", list(UserModel, ["name", "email"]));
  router.post("/users", create(UserModel, userInput));
  router.get("/users/:id", byId(UserModel));
  router.get("/entities", list(EntityModel, ["name", "identifier", "type"]));
  router.post("/entities", async (req: Request, res: Response): Promise<void> => {
    const parsed = entityInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
      return;
    }
    try {
      const entity = await EntityModel.create(parsed.data);
      const payload = {
        entityId: String(entity._id),
        name: parsed.data.name,
        entityType: parsed.data.type,
      };
      io.to(entityRoom(payload.entityId)).emit("entity:updated", payload);
      io.to(roleRoom("admin")).emit("entity:updated", payload);
      io.to(roleRoom("admin")).emit("dashboard:update", { type: "entity.updated", ...payload });
      res.status(201).json({ data: entity });
    } catch (error) {
      res.status(400).json({
        error: "CREATE_FAILED",
        message: error instanceof Error ? error.message : "Create failed",
      });
    }
  });
  router.get("/entities/:id", byId(EntityModel));
  router.get("/analyses", list(AnalysisModel, ["domain", "riskLevel", "status"]));
  router.get("/analyses/history", list(AnalysisModel, ["domain", "riskLevel", "status"]));
  router.post("/analyses", async (req: Request, res: Response): Promise<void> => {
    const parsed = analysisInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
      return;
    }
    let lifecyclePayload:
      { analysisId: string; entityId: string; userId?: string; domain: string } | undefined;
    try {
      const plugin = getDomainPlugin(parsed.data.domain);
      const pluginInputType =
        parsed.data.inputType === "document" ? "pdf" : parsed.data.inputType;
      if (plugin) {
        const validation = plugin.validate(parsed.data.input, pluginInputType);
        if (!validation.valid) {
          res.status(400).json({
            error: "DOMAIN_INPUT_INVALID",
            domain: plugin.name,
            details: validation.errors,
          });
          return;
        }
      }
      const pluginAnalysis = plugin?.analyze(parsed.data.input, pluginInputType);
      const risk = pluginAnalysis?.risk ?? evaluateRisk(parsed.data.input);
      const source = parsed.data.input;
      const featureSource =
        source && typeof source === "object" && !Array.isArray(source)
          ? (source as Record<string, unknown>)
          : {};
      const scoring = scoreTrustAndRisk({
        ruleScore: risk.riskScore,
        mlProbability: numericValue(parsed.data.mlResults, "probability", "riskProbability")
          ?? numericValue(featureSource, "mlProbability"),
        nlpRisk: numericValue(parsed.data.nlpResults, "riskScore", "score")
          ?? numericValue(featureSource, "nlpRisk"),
        anomalyScore: numericValue(parsed.data.anomalyResults, "score", "anomalyScore")
          ?? numericValue(featureSource, "anomalyScore"),
        dataQuality: numericValue(featureSource, "dataQuality"),
        sourceReliability: numericValue(featureSource, "sourceReliability"),
        triggeredRules: risk.results,
        nlpIndicators: stringArrayValue(parsed.data.nlpResults, "indicators", "textRiskIndicators"),
        anomalyIndicators: stringArrayValue(parsed.data.anomalyResults, "indicators"),
      });
      const analysis = await AnalysisModel.create({
        ...parsed.data,
        extractedData: pluginAnalysis?.features ?? parsed.data.extractedData,
        rulesExecuted: risk.results,
        riskScore: scoring.riskScore,
        trustScore: scoring.trustScore,
        riskLevel: scoring.riskLevel,
        riskLevelLabel: scoring.riskLevelLabel,
        explainability: scoring.explainability,
        recommendations: scoring.explainability.recommendations,
        explanations: scoring.explainability.negativeSignals,
      });
      const payload = {
        analysisId: String(analysis._id),
        entityId: parsed.data.entity,
        userId: parsed.data.user,
        domain: parsed.data.domain,
      };
      lifecyclePayload = payload;
      io.to(entityRoom(payload.entityId)).emit("analysis:created", payload);
      io.to(roleRoom("admin")).emit("analysis:created", payload);
      if (payload.userId) emitToUser(io, payload.userId, "analysis:created", payload);

      await AnalysisModel.updateOne({ _id: analysis._id }, { $set: { status: "processing" } });
      io.to(analysisRoom(payload.analysisId)).emit("analysis:started", {
        ...payload,
        status: "processing",
      });
      const started = { ...payload, status: "processing" };
      if (payload.userId) emitToUser(io, payload.userId, "analysis:started", started);
      const initialProgress = {
        ...payload,
        progress: 25,
        stage: "queued",
      };
      io.to(roleRoom("admin")).emit("analysis:progress", initialProgress);
      if (payload.userId) emitToUser(io, payload.userId, "analysis:progress", initialProgress);

      const completed = (await AnalysisModel.findByIdAndUpdate(
        analysis._id,
        { $set: { status: "completed" } },
        { new: true },
      ).lean()) as { riskLevel?: string; trustScore?: number; riskScore?: number } | null;
      if (!completed) throw new Error("Analysis disappeared before completion");
      const finalProgress = { ...payload, progress: 75, stage: "risk-scoring" };
      io.to(roleRoom("admin")).emit("analysis:progress", finalProgress);
      if (payload.userId) emitToUser(io, payload.userId, "analysis:progress", finalProgress);
      const result = {
        ...payload,
        status: "completed",
        progress: 100,
        riskLevel: completed.riskLevel,
        trustScore: completed.trustScore,
        riskScore: completed.riskScore,
      };
      io.to(analysisRoom(payload.analysisId)).emit("analysis:completed", result);
      io.to(roleRoom("admin")).emit("analysis:completed", result);
      if (payload.userId) emitToUser(io, payload.userId, "analysis:completed", result);
      io.to(entityRoom(payload.entityId)).emit("risk:changed", result);
      io.to(roleRoom("admin")).emit("dashboard:update", { type: "analysis.completed", ...result });
      res.status(201).json({ data: completed });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Create failed";
      if (lifecyclePayload) {
        await AnalysisModel.updateOne(
          { _id: lifecyclePayload.analysisId },
          { $set: { status: "failed" } },
        );
        io.to(analysisRoom(lifecyclePayload.analysisId)).emit("analysis:failed", {
          ...lifecyclePayload,
          status: "failed",
          message,
        });
        io.to(roleRoom("admin")).emit("analysis:failed", {
          ...lifecyclePayload,
          status: "failed",
          message,
        });
        if (lifecyclePayload.userId)
          emitToUser(io, lifecyclePayload.userId, "analysis:failed", {
            ...lifecyclePayload,
            status: "failed",
            message,
          });
      }
      res.status(400).json({ error: "CREATE_FAILED", message });
    }
  });
  router.get("/analyses/:id", byId(AnalysisModel));
  router.get("/notifications", list(NotificationModel, ["title", "message", "type"]));
  router.post("/notifications", async (req: Request, res: Response): Promise<void> => {
    const parsed = notificationInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
      return;
    }
    try {
      const notification = await NotificationModel.create(parsed.data);
      const payload = notification.toObject();
      emitToUser(io, parsed.data.user, "notification:new", payload);
      res.status(201).json({ data: notification });
    } catch (error) {
      res.status(400).json({
        error: "CREATE_FAILED",
        message: error instanceof Error ? error.message : "Create failed",
      });
    }
  });
  router.get("/notifications/:id", byId(NotificationModel));
  router.get("/audit-logs", list(AuditLogModel, ["action", "resourceType"]));
  router.post("/audit-logs", create(AuditLogModel, auditInput));
  router.get("/audit-logs/:id", byId(AuditLogModel));
  router.post("/alerts", async (req: Request, res: Response): Promise<void> => {
    try {
      const alert = await AlertModel.create(req.body);
      const payload = alert.toObject();
      const alertEntity = typeof req.body?.entity === "string" ? req.body.entity : undefined;
      if (alertEntity) io.to(entityRoom(alertEntity)).emit("alert:created", payload);
      io.to(roleRoom("admin")).emit("alert:created", payload);
      io.to(roleRoom("admin")).emit("dashboard:update", { type: "alert.created", ...payload });
      res.status(201).json({ data: alert });
    } catch (error) {
      res.status(400).json({
        error: "CREATE_FAILED",
        message: error instanceof Error ? error.message : "Create failed",
      });
    }
  });
  router.get("/domain-configurations", list(DomainConfigurationModel, ["domain", "displayName"]));
  router.post("/ingestions", async (req: Request, res: Response): Promise<void> => {
    const parsed = ingestionInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
      return;
    }
    try {
      res.status(201).json(await ingest(parsed.data));
    } catch (error) {
      res.status(500).json({
        error: "INGESTION_FAILED",
        message: error instanceof Error ? error.message : "Ingestion failed",
      });
    }
  });
  return router;
}
