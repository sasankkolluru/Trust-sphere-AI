import { booleanFeature, numberFeature, textFeature } from "./features.js";
import type { RiskRule } from "./types.js";

export const riskRules: RiskRule[] = [
  {
    id: "NEW_DOMAIN",
    name: "New domain",
    description: "The domain was registered recently.",
    domain: "web",
    severity: "medium",
    weight: 18,
    evaluate: (features) =>
      booleanFeature(features, "newDomain") ||
      (numberFeature(features, "domainAgeDays") ?? Infinity) < 90,
    explanation: "The domain is new or has less than 90 days of history.",
  },
  {
    id: "MISSING_CONTACT_INFORMATION",
    name: "Missing contact information",
    description: "Expected contact details are absent.",
    domain: "web",
    severity: "medium",
    weight: 12,
    evaluate: (features) =>
      booleanFeature(features, "missingContactInformation") ||
      booleanFeature(features, "missingContact"),
    explanation: "The entity does not provide expected contact information.",
  },
  {
    id: "SUSPICIOUS_PAYMENT_REQUEST",
    name: "Suspicious payment request",
    description: "Payment instructions contain suspicious signals.",
    domain: "payments",
    severity: "critical",
    weight: 32,
    evaluate: (features) => booleanFeature(features, "suspiciousPaymentRequest"),
    explanation: "The payment request matches a suspicious payment pattern.",
  },
  {
    id: "EXCESSIVE_DISCOUNT",
    name: "Excessive discount",
    description: "The discount is unusually large.",
    domain: "commerce",
    severity: "high",
    weight: 20,
    evaluate: (features) =>
      booleanFeature(features, "excessiveDiscount") ||
      (numberFeature(features, "discountPercent") ?? 0) >= 70,
    explanation: "The offer contains an unusually high discount.",
  },
  {
    id: "DUPLICATE_REVIEW",
    name: "Duplicate review",
    description: "A review duplicates another review.",
    domain: "reviews",
    severity: "high",
    weight: 22,
    evaluate: (features) => booleanFeature(features, "duplicateReview"),
    explanation: "A duplicate review pattern was detected.",
  },
  {
    id: "ABNORMAL_REVIEW_FREQUENCY",
    name: "Abnormal review frequency",
    description: "Review activity is outside the expected range.",
    domain: "reviews",
    severity: "high",
    weight: 24,
    evaluate: (features) =>
      booleanFeature(features, "abnormalReviewFrequency") ||
      (numberFeature(features, "reviewsPerHour") ?? 0) >= 20,
    explanation: "Review frequency is abnormally high.",
  },
  {
    id: "SUSPICIOUS_EMAIL",
    name: "Suspicious email",
    description: "The email address has suspicious characteristics.",
    domain: "identity",
    severity: "high",
    weight: 24,
    evaluate: (features) =>
      booleanFeature(features, "suspiciousEmail") ||
      ["disposable", "mismatch", "invalid"].includes(
        textFeature(features, "emailRisk").toLowerCase(),
      ),
    explanation: "The email address presents a suspicious identity signal.",
  },
  {
    id: "INCONSISTENT_BUSINESS_INFORMATION",
    name: "Inconsistent business information",
    description: "Business details disagree across sources.",
    domain: "identity",
    severity: "high",
    weight: 26,
    evaluate: (features) =>
      booleanFeature(features, "inconsistentBusinessInformation") ||
      booleanFeature(features, "businessInformationMismatch"),
    explanation: "Business information is inconsistent across supplied sources.",
  },
];
