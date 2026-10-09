import mongoose, { type Model, type Schema as MongooseSchema } from "mongoose";

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const json = { type: Schema.Types.Mixed, default: {} };

const base = { timestamps: true, versionKey: false } as const;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    role: { type: String, enum: ["user", "analyst", "admin"], default: "user", index: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  },
  base,
);

const entitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, index: true },
    identifier: { type: String, required: true, trim: true, index: true },
    metadata: json,
    owner: { type: ObjectId, ref: "User", index: true },
  },
  base,
);
entitySchema.index({ type: 1, identifier: 1 }, { unique: true });

const riskFactorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, unique: true, index: true },
    description: String,
    weight: { type: Number, min: 0, max: 1, default: 1 },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    rules: { type: [Schema.Types.Mixed], default: [] },
    enabled: { type: Boolean, default: true, index: true },
  },
  base,
);

const analysisSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", index: true },
    entity: { type: ObjectId, ref: "Entity", required: true, index: true },
    domain: { type: String, required: true, trim: true, index: true },
    input: { type: Schema.Types.Mixed, required: true },
    inputType: { type: String, enum: ["url", "text", "json", "csv", "pdf", "image", "document"], default: "text" },
    extractedData: json,
    rulesExecuted: { type: [Schema.Types.Mixed], default: [] },
    mlResults: json,
    nlpResults: json,
    anomalyResults: json,
    trustScore: { type: Number, min: 0, max: 100 },
    riskScore: { type: Number, min: 0, max: 100 },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical", "unknown"],
      default: "unknown",
      index: true,
    },
    riskLevelLabel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    },
    explanations: { type: [String], default: [] },
    explainability: json,
    recommendations: { type: [String], default: [] },
    modelVersion: String,
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      index: true,
    },
  },
  base,
);
analysisSchema.index({ entity: 1, createdAt: -1 });
analysisSchema.index({ domain: 1, createdAt: -1 });
analysisSchema.index({ user: 1, createdAt: -1 });

const analysisResultSchema = new Schema(
  {
    analysis: { type: ObjectId, ref: "Analysis", required: true, index: true },
    kind: { type: String, required: true, index: true },
    value: json,
    score: { type: Number, min: 0, max: 100 },
    explanation: String,
  },
  base,
);
analysisResultSchema.index({ analysis: 1, kind: 1 });

const notificationSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["info", "warning", "risk", "system"],
      default: "info",
      index: true,
    },
    read: { type: Boolean, default: false, index: true },
    data: json,
  },
  base,
);
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

const auditLogSchema = new Schema(
  {
    actor: { type: ObjectId, ref: "User", index: true },
    action: { type: String, required: true, index: true },
    resourceType: String,
    resourceId: ObjectId,
    details: json,
    ipAddress: String,
  },
  { ...base, timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

const alertSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", index: true },
    entity: { type: ObjectId, ref: "Entity", index: true },
    analysis: { type: ObjectId, ref: "Analysis", index: true },
    title: { type: String, required: true },
    message: String,
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "acknowledged", "resolved"],
      default: "open",
      index: true,
    },
    metadata: json,
  },
  base,
);
alertSchema.index({ status: 1, severity: 1, createdAt: -1 });

const domainConfigurationSchema = new Schema(
  {
    domain: { type: String, required: true, unique: true, index: true },
    displayName: String,
    enabled: { type: Boolean, default: true, index: true },
    rules: { type: [Schema.Types.Mixed], default: [] },
    riskFactors: { type: [ObjectId], ref: "RiskFactor", default: [] },
    settings: json,
    modelVersion: String,
  },
  base,
);

const ingestionRecordSchema = new Schema(
  {
    source: { type: String, required: true, trim: true, index: true },
    sourceType: { type: String, enum: ["url", "text", "json", "csv", "pdf", "image"], required: true, index: true },
    domain: { type: String, trim: true, index: true },
    extractedText: { type: String, default: "" },
    extractedFields: { type: Schema.Types.Mixed, default: {} },
    confidence: { type: Number, min: 0, max: 1, required: true },
    extractionStatus: { type: String, enum: ["completed", "partial", "failed"], required: true, index: true },
    extractionErrors: { type: [Schema.Types.Mixed], default: [] },
    fingerprint: { type: String, required: true, unique: true, index: true },
    metadata: json,
  },
  base,
);
ingestionRecordSchema.index({ sourceType: 1, createdAt: -1 });

function model(name: string, schema: MongooseSchema): Model<unknown> {
  return (mongoose.models[name] ?? mongoose.model(name, schema)) as Model<unknown>;
}

export const UserModel = model("User", userSchema);
export const EntityModel = model("Entity", entitySchema);
export const RiskFactorModel = model("RiskFactor", riskFactorSchema);
export const AnalysisModel = model("Analysis", analysisSchema);
export const AnalysisResultModel = model("AnalysisResult", analysisResultSchema);
export const NotificationModel = model("Notification", notificationSchema);
export const AuditLogModel = model("AuditLog", auditLogSchema);
export const AlertModel = model("Alert", alertSchema);
export const DomainConfigurationModel = model("DomainConfiguration", domainConfigurationSchema);
export const IngestionRecordModel = model("IngestionRecord", ingestionRecordSchema);
