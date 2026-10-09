import type { RiskFeatures } from "./types.js";

export function extractFeatures(input: unknown): RiskFeatures {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const nested = source.features;
  return {
    ...source,
    ...(nested && typeof nested === "object" && !Array.isArray(nested) ? nested : {}),
  };
}

export function booleanFeature(features: RiskFeatures, key: string): boolean {
  const value = features[key];
  return value === true || value === "true" || value === 1;
}

export function numberFeature(features: RiskFeatures, key: string): number | undefined {
  const value = features[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

export function textFeature(features: RiskFeatures, key: string): string {
  const value = features[key];
  return typeof value === "string" ? value : "";
}
