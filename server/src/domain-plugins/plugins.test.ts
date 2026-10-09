import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDomainPlugin, listDomainPlugins } from "./index.js";

describe("domain plugins", () => {
  it("registers the four initial domains", () => {
    assert.deepEqual(listDomainPlugins().map((plugin) => plugin.name), [
      "ecommerce",
      "recruitment",
      "social-media",
      "website-business",
    ]);
  });

  it("validates and analyzes each domain with its own rules", () => {
    const inputs = {
      ecommerce: { product: "Phone", seller: "Seller", price: 100, website: "https://shop.example" },
      recruitment: { job: "Engineer", company: "Acme", salary: 90000, contact: "jobs@acme.example", applicationProcess: "Portal" },
      "social-media": { account: "brand", followers: 1000, engagement: 0.04, posts: [], content: "Product update" },
      "website-business": { domain: "example.com", company: "Acme", contact: "hello@example.com", ssl: true, businessInformation: { registration: "verified" } },
    };
    for (const [name, input] of Object.entries(inputs)) {
      const plugin = getDomainPlugin(name);
      assert.ok(plugin);
      assert.equal(plugin.validate(input, "json").valid, true);
      const output = plugin.analyze(input, "json");
      assert.equal(output.domain, name);
      assert.ok("riskScore" in output.risk);
      assert.ok(Object.keys(plugin.outputSchema).length > 0);
      assert.ok(plugin.rules.every((rule) => rule.domain === name));
    }
  });

  it("triggers domain-specific risk rules", () => {
    const plugin = getDomainPlugin("recruitment");
    assert.ok(plugin);
    const result = plugin.analyze(
      { job: "Engineer", company: "Acme", salary: 90000, contact: "jobs@acme.example", applicationProcess: "Pay an upfront fee" , upfrontPayment: true },
      "json",
    );
    assert.ok(result.risk.results.some((rule) => rule.ruleId === "RECRUITMENT_UPFRONT_FEE" && rule.triggered));
  });
});
