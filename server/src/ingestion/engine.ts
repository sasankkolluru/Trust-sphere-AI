import { createHash } from "node:crypto";
import { IngestionRecordModel } from "../models/index.js";
import { ingestionAdapters } from "./adapters.js";
import { enqueueAnalysis } from "./queue.js";
import type { IngestionRequest } from "./types.js";

export async function ingest(request: IngestionRequest): Promise<Record<string, unknown>> {
  const adapter = ingestionAdapters.find((candidate) => candidate.supports(request));
  if (!adapter) {
    throw new Error(`Unsupported ingestion source type: ${request.sourceType}`);
  }
  let extraction;
  try {
    extraction = await adapter.extract(request);
  } catch (caught) {
    extraction = {
      extraction: { text: "", fields: {}, confidence: 0 },
      errors: [{
        code: "ADAPTER_FAILED",
        message: caught instanceof Error ? caught.message : "Adapter failed.",
        recoverable: false,
      }],
      status: "failed" as const,
    };
  }
  const fingerprint = createHash("sha256")
    .update(`${request.sourceType}:${request.source}:${extraction.extraction.text}`)
    .digest("hex");
  const detectedDomain =
    request.domain ??
    (request.sourceType === "url"
      ? (() => {
          try {
            return new URL(request.source).hostname;
          } catch {
            return "unknown";
          }
        })()
      : typeof extraction.extraction.fields.json === "object" &&
          extraction.extraction.fields.json !== null &&
          "domain" in extraction.extraction.fields.json
        ? String(extraction.extraction.fields.json.domain)
        : /(?:finance|payment|bank|investment)/i.test(extraction.extraction.text)
          ? "financial"
          : /(?:job|career|employment|salary)/i.test(extraction.extraction.text)
            ? "employment"
            : "general");
  const existing = await IngestionRecordModel.findOne({ fingerprint }).lean();
  if (existing) return { data: existing, duplicate: true, queued: false };
  const record = await IngestionRecordModel.create({
    source: request.source,
    sourceType: request.sourceType,
    domain: detectedDomain,
    extractedFields: extraction.extraction.fields,
    extractedText: extraction.extraction.text,
    confidence: extraction.extraction.confidence,
    extractionStatus: extraction.status,
    extractionErrors: extraction.errors,
    fingerprint,
    metadata: request.metadata,
  });
  const queueJob = extraction.status !== "failed" ? enqueueAnalysis(String(record._id)) : undefined;
  return {
    data: record,
    duplicate: false,
    queued: Boolean(queueJob),
    queue: queueJob,
  };
}
