import { describe, expect, it } from "vitest";
import { auditPlan } from "./audit.js";
import { compileRecoveryPack, simulateFailure } from "./compiler.js";
import { safePlan } from "./fixture.js";
import { verifyRecoveryPack } from "./verify.js";

describe("recovery compiler", () => {
  it("compiles and verifies a content-addressed reverse-order pack", () => {
    const audit = auditPlan(safePlan);
    const pack = compileRecoveryPack({
      plan: safePlan,
      audit,
      generatedAt: new Date("2026-07-29T00:00:00Z"),
    });
    expect(pack.rollbackSteps.map((step) => step.actionId)).toEqual([
      "migrate-schema",
      "deploy-api",
      "snapshot-db",
    ]);
    expect(pack.packHash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyRecoveryPack({ pack, plan: safePlan }).valid).toBe(true);
  });

  it("simulates only effects completed before the failed action", () => {
    const audit = auditPlan(safePlan);
    const simulation = simulateFailure({
      plan: safePlan,
      audit,
      failureAt: "migrate-schema",
    });
    expect(simulation.completedActions).toEqual(["snapshot-db", "deploy-api"]);
    expect(simulation.rollbackSteps.map((step) => step.actionId)).toEqual([
      "deploy-api",
      "snapshot-db",
    ]);
    expect(simulation.outcome).toBe("recoverable");
  });

  it("detects a tampered pack", () => {
    const audit = auditPlan(safePlan);
    const pack = compileRecoveryPack({ plan: safePlan, audit });
    const tampered = { ...pack, estimatedRecoveryMinutes: 1 };
    const result = verifyRecoveryPack({ pack: tampered, plan: safePlan });
    expect(result.valid).toBe(false);
    expect(result.checks.packHash).toBe(false);
    expect(result.checks.recoveryTime).toBe(false);
  });
});
