import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateRisk } from "./engine.js";
import { riskRules } from "./rules.js";

const cases: Array<[string, Record<string, unknown>]> = [
  ["NEW_DOMAIN", { newDomain: true }],
  ["MISSING_CONTACT_INFORMATION", { missingContactInformation: true }],
  ["SUSPICIOUS_PAYMENT_REQUEST", { suspiciousPaymentRequest: true }],
  ["EXCESSIVE_DISCOUNT", { discountPercent: 70 }],
  ["DUPLICATE_REVIEW", { duplicateReview: true }],
  ["ABNORMAL_REVIEW_FREQUENCY", { reviewsPerHour: 20 }],
  ["SUSPICIOUS_EMAIL", { emailRisk: "disposable" }],
  ["INCONSISTENT_BUSINESS_INFORMATION", { businessInformationMismatch: true }],
];

describe("risk rules", () => {
  for (const [ruleId, features] of cases) {
    it(`${ruleId} triggers deterministically`, () => {
      const result = evaluateRisk(features);
      const rule = result.results.find((entry) => entry.ruleId === ruleId);
      assert.ok(rule);
      assert.equal(rule.triggered, true);
      assert.ok(rule.contribution > 0);
      assert.ok(rule.explanation.length > 0);
    });

    it(`${ruleId} does not trigger for empty features`, () => {
      const rule = evaluateRisk({}).results.find((entry) => entry.ruleId === ruleId);
      assert.ok(rule);
      assert.equal(rule.triggered, false);
      assert.equal(rule.contribution, 0);
    });
  }
});

describe("configurable scoring", () => {
  it("uses configured rule weights and thresholds", () => {
    const result = evaluateRisk(
      { suspiciousPaymentRequest: true },
      {
        rules: riskRules.filter((rule) => rule.id === "SUSPICIOUS_PAYMENT_REQUEST"),
        severityMultipliers: { critical: 1 },
        riskLevelThresholds: { low: 10, medium: 30, high: 60, critical: 80 },
      },
    );
    assert.equal(result.riskScore, 100);
    assert.equal(result.trustScore, 0);
    assert.equal(result.riskLevel, "critical");
  });
});
