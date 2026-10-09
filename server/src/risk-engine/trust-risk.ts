import type { RiskLevel, RiskRuleResult } from "./types.js";

export type TrustRiskInputs = {
  ruleScore: number;
  mlProbability?: number;
  nlpRisk?: number;
  anomalyScore?: number;
  dataQuality?: number;
  sourceReliability?: number;
  triggeredRules?: RiskRuleResult[];
  nlpIndicators?: string[];
  anomalyIndicators?: string[];
};

export type TrustRiskExplainability = {
  overallScore: number;
  positiveSignals: string[];
  negativeSignals: string[];
  triggeredRules: RiskRuleResult[];
  mlContribution: number;
  nlpIndicators: string[];
  anomalyIndicators: string[];
  dataQuality: number;
  sourceReliability: number;
  recommendations: string[];
  language: string;
};

export type TrustRiskResult = {
  trustScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  riskLevelLabel: Uppercase<RiskLevel>;
  explainability: TrustRiskExplainability;
};

const DEFAULTS = {
  mlProbability: 0,
  nlpRisk: 0,
  anomalyScore: 0,
  dataQuality: 0.5,
  sourceReliability: 0.5,
} as const;

function bounded(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function probability(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return bounded(value > 1 ? value / 100 : value, fallback);
}

function score(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, value));
}

function levelFor(scoreValue: number): RiskLevel {
  if (scoreValue >= 90) return "critical";
  if (scoreValue >= 70) return "high";
  if (scoreValue >= 40) return "medium";
  return "low";
}

function recommendations(
  negativeSignals: string[],
  triggeredRules: RiskRuleResult[],
  nlpIndicators: string[],
  anomalyIndicators: string[],
): string[] {
  const result = new Set<string>();
  if (triggeredRules.length || nlpIndicators.length || anomalyIndicators.length) {
    result.add("Do not make payment until the identity and offer are independently verified.");
    result.add("Verify the business independently using official contact information.");
  }
  if (triggeredRules.some((rule) => rule.ruleId === "MISSING_CONTACT_INFORMATION")) {
    result.add("Check official contact information before sharing personal or financial details.");
  }
  if (negativeSignals.some((signal) => signal.toLowerCase().includes("data quality"))) {
    result.add("Obtain additional trusted source data before making a decision.");
  }
  if (!result.size) result.add("Continue monitoring the entity and verify material claims.");
  return [...result];
}

export function scoreTrustAndRisk(inputs: TrustRiskInputs): TrustRiskResult {
  const ruleScore = score(inputs.ruleScore, 0);
  const mlProbability = probability(inputs.mlProbability, DEFAULTS.mlProbability);
  const nlpRisk = probability(inputs.nlpRisk, DEFAULTS.nlpRisk);
  const anomalyScore = probability(inputs.anomalyScore, DEFAULTS.anomalyScore);
  const dataQuality = probability(inputs.dataQuality, DEFAULTS.dataQuality);
  const sourceReliability = probability(inputs.sourceReliability, DEFAULTS.sourceReliability);
  const triggeredRules = (inputs.triggeredRules ?? []).filter((rule) => rule.triggered);
  const nlpIndicators = [...(inputs.nlpIndicators ?? [])];
  const anomalyIndicators = [...(inputs.anomalyIndicators ?? [])];

  const riskScore = Math.round(
    Math.min(
      100,
      ruleScore * 0.35 +
        mlProbability * 100 * 0.2 +
        nlpRisk * 100 * 0.15 +
        anomalyScore * 100 * 0.15 +
        (1 - dataQuality) * 100 * 0.1 +
        (1 - sourceReliability) * 100 * 0.05,
    ),
  );
  const trustScore = 100 - riskScore;
  const negativeSignals = [
    ...triggeredRules.map((rule) => rule.explanation),
    ...nlpIndicators.map((indicator) => `NLP risk indicator: ${indicator}`),
    ...anomalyIndicators.map((indicator) => `Anomaly indicator: ${indicator}`),
  ];
  if (dataQuality < 0.5) negativeSignals.push("Data quality is limited.");
  if (sourceReliability < 0.5) negativeSignals.push("Source reliability is limited.");

  const positiveSignals: string[] = [];
  if (!triggeredRules.length) positiveSignals.push("No configured risk rules were triggered.");
  if (dataQuality >= 0.75) positiveSignals.push("Data quality is strong.");
  if (sourceReliability >= 0.75) positiveSignals.push("Source reliability is strong.");
  if (mlProbability < 0.25 && nlpRisk < 0.25 && anomalyScore < 0.25) {
    positiveSignals.push("ML, NLP, and anomaly signals are currently low.");
  }

  const explainability: TrustRiskExplainability = {
    overallScore: riskScore,
    positiveSignals,
    negativeSignals,
    triggeredRules,
    mlContribution: Math.round(mlProbability * 100 * 0.2 * 100) / 100,
    nlpIndicators,
    anomalyIndicators,
    dataQuality: Math.round(dataQuality * 100) / 100,
    sourceReliability: Math.round(sourceReliability * 100) / 100,
    recommendations: recommendations(negativeSignals, triggeredRules, nlpIndicators, anomalyIndicators),
    language: "Risk indicators suggest possible concerns; this score is not a guaranteed fact.",
  };

  const riskLevel = levelFor(riskScore);
  return {
    trustScore,
    riskScore,
    riskLevel,
    riskLevelLabel: riskLevel.toUpperCase() as Uppercase<RiskLevel>,
    explainability,
  };
}
