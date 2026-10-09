import { extractFeatures } from "./features.js";
import { riskRules } from "./rules.js";
import type {
  RiskEngineConfig,
  RiskEngineResult,
  RiskRule,
  RiskRuleResult,
  RiskSeverity,
} from "./types.js";

const defaultMultipliers: Record<RiskSeverity, number> = {
  low: 0.5,
  medium: 1,
  high: 1.25,
  critical: 1.5,
};

const defaultThresholds = { low: 20, medium: 40, high: 70, critical: 90 };

export function evaluateRisk(input: unknown, config: RiskEngineConfig = {}): RiskEngineResult {
  const rules = config.rules ?? riskRules;
  const multipliers = { ...defaultMultipliers, ...config.severityMultipliers };
  const thresholds = { ...defaultThresholds, ...config.riskLevelThresholds };
  const features = extractFeatures(input);
  const results: RiskRuleResult[] = rules.map((rule) => {
    const triggered = rule.evaluate(features);
    return {
      ruleId: rule.id,
      triggered,
      severity: rule.severity,
      contribution: triggered ? rule.weight * multipliers[rule.severity] : 0,
      explanation: triggered ? rule.explanation : `${rule.name} was not triggered.`,
    };
  });
  const maximum = rules.reduce((sum, rule) => sum + rule.weight * multipliers[rule.severity], 0);
  const rawScore = results.reduce((sum, result) => sum + result.contribution, 0);
  const riskScore = maximum === 0 ? 0 : Math.round(Math.min(100, (rawScore / maximum) * 100));
  const riskLevel =
    riskScore >= thresholds.critical
      ? "critical"
      : riskScore >= thresholds.high
        ? "high"
        : riskScore >= thresholds.medium
          ? "medium"
          : "low";
  return {
    results,
    riskScore,
    trustScore: 100 - riskScore,
    riskLevel,
  };
}

export type { RiskEngineConfig, RiskEngineResult, RiskRule, RiskRuleResult, RiskSeverity };
