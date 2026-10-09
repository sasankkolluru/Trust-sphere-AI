import type { RiskEngineConfig, RiskEngineResult, RiskRule, RiskFeatures } from "../risk-engine/index.js";

export type DomainInputType = "url" | "text" | "json" | "csv" | "pdf" | "image";

export type DomainValidationResult = {
  valid: boolean;
  errors: string[];
};

export type DomainAnalysisOutput = {
  domain: string;
  features: RiskFeatures;
  risk: RiskEngineResult;
  output: Record<string, unknown>;
};

export interface DomainPlugin {
  readonly name: string;
  readonly displayName: string;
  readonly acceptedInputs: readonly DomainInputType[];
  readonly rules: readonly RiskRule[];
  readonly scoring: RiskEngineConfig;
  readonly outputSchema: Readonly<Record<string, string>>;
  validate(input: unknown, inputType?: DomainInputType): DomainValidationResult;
  extractFeatures(input: unknown): RiskFeatures;
  analyze(input: unknown, inputType?: DomainInputType): DomainAnalysisOutput;
}
