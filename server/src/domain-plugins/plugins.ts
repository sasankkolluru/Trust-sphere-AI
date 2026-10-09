import { createPluginAnalysis, booleanFeature, numberFeature, recordInput, rule, textFeature, validateObject } from "./common.js";
import type { DomainInputType, DomainPlugin } from "./types.js";
import type { RiskRule } from "../risk-engine/index.js";

const jsonInputs: readonly DomainInputType[] = ["json", "text", "url", "csv", "pdf"];

const eCommerceRules = [
  rule("ECOMMERCE_MISSING_SELLER", "Missing seller identity", "Seller identity is absent.", "high", 25, (f) => !textFeature(f, "seller", "sellerName"), "Seller identity could not be verified."),
  rule("ECOMMERCE_EXCESSIVE_DISCOUNT", "Excessive discount", "Product discount is unusually high.", "high", 20, (f) => (numberFeature(f, "discountPercent", "discount") ?? 0) >= 70, "The product has an unusually high discount."),
  rule("ECOMMERCE_DUPLICATE_REVIEWS", "Duplicate reviews", "Reviews contain duplicate content.", "high", 25, (f) => booleanFeature(f, "duplicateReviews", "duplicateReview"), "High review similarity was detected."),
  rule("ECOMMERCE_SUSPICIOUS_PAYMENT", "Suspicious payment request", "Payment instructions contain suspicious signals.", "critical", 30, (f) => booleanFeature(f, "suspiciousPaymentRequest"), "Suspicious payment language was detected."),
] as const;

const recruitmentRules = [
  rule("RECRUITMENT_MISSING_COMPANY", "Missing company identity", "The employer is not identified.", "high", 25, (f) => !textFeature(f, "company", "companyName"), "Business identity could not be verified."),
  rule("RECRUITMENT_UNREALISTIC_SALARY", "Unrealistic salary", "Salary claims are outside expected bounds.", "high", 20, (f) => (numberFeature(f, "salary", "salaryAmount") ?? 0) >= 500000, "The advertised salary appears unusually high."),
  rule("RECRUITMENT_UPFRONT_FEE", "Application fee", "The application process requests payment.", "critical", 35, (f) => booleanFeature(f, "applicationFee", "upfrontPayment"), "The application process appears to request an upfront payment."),
  rule("RECRUITMENT_MISSING_CONTACT", "Missing recruiter contact", "No verifiable recruiter contact is supplied.", "medium", 15, (f) => !textFeature(f, "contact", "contactEmail"), "Official recruiter contact information could not be verified."),
] as const;

const socialRules = [
  rule("SOCIAL_LOW_ENGAGEMENT", "Low engagement", "Engagement is unusually low for the audience size.", "medium", 15, (f) => (numberFeature(f, "engagementRate") ?? 1) < 0.01, "Engagement is unusually low relative to the audience."),
  rule("SOCIAL_FOLLOWER_SPIKE", "Follower spike", "Follower growth is unusually abrupt.", "high", 25, (f) => booleanFeature(f, "followerSpike") || (numberFeature(f, "followerGrowthPercent") ?? 0) >= 100, "Follower growth shows an unusual spike."),
  rule("SOCIAL_DUPLICATE_CONTENT", "Duplicate content", "Posts repeat substantially similar content.", "high", 25, (f) => booleanFeature(f, "duplicatePosts", "duplicateContent"), "Posts contain high similarity or repeated content."),
  rule("SOCIAL_SUSPICIOUS_CONTENT", "Suspicious content", "Content contains suspicious language.", "high", 25, (f) => booleanFeature(f, "suspiciousContent"), "Content contains suspicious language indicators."),
] as const;

const websiteRules = [
  rule("WEBSITE_NEW_DOMAIN", "New domain", "The domain has limited history.", "medium", 20, (f) => booleanFeature(f, "newDomain") || (numberFeature(f, "domainAgeDays") ?? Infinity) < 90, "The domain appears newly registered."),
  rule("WEBSITE_MISSING_CONTACT", "Missing contact information", "Expected contact details are absent.", "medium", 15, (f) => booleanFeature(f, "missingContact", "missingContactInformation"), "Official contact information could not be verified."),
  rule("WEBSITE_NO_SSL", "Missing SSL", "The website does not provide SSL protection.", "high", 25, (f) => f.ssl === false || f.ssl === "false", "The website does not appear to use SSL."),
  rule("WEBSITE_IDENTITY_MISMATCH", "Business identity mismatch", "Business information disagrees across sources.", "high", 30, (f) => booleanFeature(f, "businessInformationMismatch", "inconsistentBusinessInformation"), "Business identity information could not be verified consistently."),
] as const;

function plugin(
  name: string,
  displayName: string,
  requiredFields: readonly string[],
  acceptedInputs: readonly DomainInputType[],
  rules: readonly RiskRule[],
  outputSchema: Readonly<Record<string, string>>,
): DomainPlugin {
  return {
    name,
    displayName,
    acceptedInputs,
    rules: rules.map((currentRule) => ({ ...currentRule, domain: name })),
    scoring: {
      riskLevelThresholds: { low: 20, medium: 40, high: 70, critical: 90 },
    },
    outputSchema,
    validate(input, inputType) {
      return validateObject(input, inputType, acceptedInputs, requiredFields);
    },
    extractFeatures(input) {
      return recordInput(input);
    },
    analyze(input, inputType) {
      return createPluginAnalysis(this, input, inputType, this.extractFeatures);
    },
  };
}

export const ECommercePlugin = plugin(
  "ecommerce",
  "E-commerce",
  ["product", "seller", "price", "website"],
  jsonInputs,
  eCommerceRules,
  { product: "string", seller: "string", reviews: "array", price: "number", website: "string", risk: "RiskEngineResult" },
);

export const RecruitmentPlugin = plugin(
  "recruitment",
  "Recruitment",
  ["job", "company", "salary", "contact", "applicationProcess"],
  ["json", "text", "url", "csv", "pdf"],
  recruitmentRules,
  { job: "string", company: "string", salary: "number", contact: "string", applicationProcess: "string", risk: "RiskEngineResult" },
);

export const SocialMediaPlugin = plugin(
  "social-media",
  "Social Media",
  ["account", "followers", "engagement", "posts", "content"],
  ["json", "text", "csv", "url"],
  socialRules,
  { account: "string", followers: "number", engagement: "number", posts: "array", content: "string", risk: "RiskEngineResult" },
);

export const WebsiteBusinessPlugin = plugin(
  "website-business",
  "Website/Business",
  ["domain", "company", "contact", "ssl", "businessInformation"],
  ["url", "json", "text", "pdf"],
  websiteRules,
  { domain: "string", company: "string", contact: "string", ssl: "boolean", businessInformation: "object", risk: "RiskEngineResult" },
);
