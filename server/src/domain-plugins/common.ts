import { evaluateRisk } from "../risk-engine/index.js";
import type { RiskFeatures, RiskRule } from "../risk-engine/index.js";
import type { DomainAnalysisOutput, DomainInputType, DomainPlugin, DomainValidationResult } from "./types.js";

export function recordInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

export function validateObject(
  input: unknown,
  inputType: DomainInputType | undefined,
  acceptedInputs: readonly DomainInputType[],
  requiredFields: readonly string[],
): DomainValidationResult {
  const errors: string[] = [];
  if (inputType && !acceptedInputs.includes(inputType)) {
    errors.push(`Input type "${inputType}" is not accepted by this domain.`);
  }
  const record = recordInput(input);
  for (const field of requiredFields) {
    const value = record[field];
    if (value === undefined || value === null || value === "") errors.push(`Missing required field: ${field}`);
  }
  if (input === null || input === undefined) errors.push("Input is required.");
  return { valid: errors.length === 0, errors };
}

export function createPluginAnalysis(
  plugin: Pick<DomainPlugin, "name" | "rules" | "scoring" | "outputSchema">,
  input: unknown,
  inputType?: DomainInputType,
  extractFeatures: (input: unknown) => RiskFeatures = recordInput,
): DomainAnalysisOutput {
  const features = extractFeatures(input);
  const risk = evaluateRisk(features, { ...plugin.scoring, rules: [...plugin.rules] });
  return {
    domain: plugin.name,
    features,
    risk,
    output: {
      schema: plugin.outputSchema,
      inputType: inputType ?? "json",
      features,
      risk,
    },
  };
}

export function rule(
  id: string,
  name: string,
  description: string,
  severity: RiskRule["severity"],
  weight: number,
  predicate: (features: RiskFeatures) => boolean,
  explanation: string,
): RiskRule {
  return { id, name, description, domain: "domain-plugin", severity, weight, evaluate: predicate, explanation };
}

export function booleanFeature(features: RiskFeatures, ...keys: string[]): boolean {
  return keys.some((key) => features[key] === true || features[key] === "true" || features[key] === 1);
}

export function numberFeature(features: RiskFeatures, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = features[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

export function textFeature(features: RiskFeatures, ...keys: string[]): string {
  for (const key of keys) if (typeof features[key] === "string") return features[key] as string;
  return "";
}
