import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreTrustAndRisk } from "./trust-risk.js";

describe("trust and risk scoring", () => {
  it("is deterministic and bounded", () => {
    const input = {
      ruleScore: 60,
      mlProbability: 0.8,
      nlpRisk: 0.7,
      anomalyScore: 0.4,
      dataQuality: 0.8,
      sourceReliability: 0.9,
    };
    const first = scoreTrustAndRisk(input);
    const second = scoreTrustAndRisk(input);
    assert.deepEqual(first, second);
    assert.equal(first.trustScore + first.riskScore, 100);
    assert.ok(first.riskScore >= 0 && first.riskScore <= 100);
  });

  it("combines explanations and recommendations without certainty claims", () => {
    const result = scoreTrustAndRisk({
      ruleScore: 80,
      mlProbability: 0.9,
      nlpRisk: 0.8,
      anomalyScore: 0.7,
      dataQuality: 0.2,
      sourceReliability: 0.2,
      triggeredRules: [
        {
          ruleId: "NEW_DOMAIN",
          triggered: true,
          severity: "medium",
          contribution: 18,
          explanation: "Newly registered domain.",
        },
      ],
      nlpIndicators: ["Suspicious payment language"],
      anomalyIndicators: ["High review similarity"],
    });
    assert.equal(result.riskLevel, "high");
    assert.ok(result.explainability.positiveSignals.length === 0);
    assert.match(result.explainability.language, /not a guaranteed fact/);
    assert.ok(result.explainability.recommendations.length >= 2);
  });
});
