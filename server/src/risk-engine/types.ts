export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskLevel = RiskSeverity;

export type RiskFeatures = Record<string, unknown>;

export type RiskRuleResult = {
  ruleId: string;
  triggered: boolean;
  severity: RiskSeverity;
  contribution: number;
  explanation: string;
};

export interface RiskRule {
  id: string;
  name: string;
  description: string;
  domain: string;
  severity: RiskSeverity;
  weight: number;
  evaluate(features: RiskFeatures): boolean;
  explanation: string;
}

export type RiskEngineConfig = {
  rules?: RiskRule[];
  severityMultipliers?: Partial<Record<RiskSeverity, number>>;
  riskLevelThresholds?: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
};

export type RiskEngineResult = {
  results: RiskRuleResult[];
  riskScore: number;
  trustScore: number;
  riskLevel: "low" | "medium" | "high" | "critical" | "unknown";
};
