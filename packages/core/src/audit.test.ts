import { describe, expect, it } from "vitest";
import { auditPlan } from "./audit.js";
import { safePlan } from "./fixture.js";

describe("reversibility audit", () => {
  it("accepts a replay-safe plan with verified recovery", () => {
    const audit = auditPlan(safePlan, new Date("2026-07-29T00:00:00Z"));
    expect(audit.status).toBe("ready");
    expect(audit.coveragePercent).toBe(100);
    expect(audit.executionOrder).toEqual([
      "snapshot-db",
      "deploy-api",
      "migrate-schema",
    ]);
    expect(audit.rollbackOrder).toEqual([
      "migrate-schema",
      "deploy-api",
      "snapshot-db",
    ]);
  });

  it("blocks a mutating action without recovery or replay protection", () => {
    const unsafe = structuredClone(safePlan);
    unsafe.actions[1] = {
      ...unsafe.actions[1]!,
      idempotencyKey: undefined,
      recovery: undefined,
    } as (typeof unsafe.actions)[number];
    const audit = auditPlan(unsafe);
    expect(audit.status).toBe("blocked");
    expect(audit.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["missing-idempotency-key", "missing-recovery"]),
    );
  });

  it("blocks missing dependencies and dependency cycles", () => {
    const broken = structuredClone(safePlan);
    broken.actions[0]!.dependsOn = ["migrate-schema", "ghost-action"];
    const audit = auditPlan(broken);
    expect(audit.status).toBe("blocked");
    expect(audit.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["missing-dependency", "dependency-cycle"]),
    );
  });

  it("requires irreversible actions to be explicit, approved, and budgeted", () => {
    const unsafe = structuredClone(safePlan);
    unsafe.actions.push({
      id: "email-customers",
      label: "Email customers",
      system: "mailer",
      operation: "send release announcement",
      effect: "publish",
      reversibility: "irreversible",
      risk: "critical",
      dependsOn: ["migrate-schema"],
      blastRadius: { resources: 1, principals: 12000, scope: "public" },
      idempotencyKey: "release-42:email-customers",
    });
    const audit = auditPlan(unsafe);
    expect(audit.status).toBe("blocked");
    expect(audit.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "missing-approval",
        "undeclared-commit-point",
        "irreversible-budget-exceeded",
      ]),
    );
  });

  it("rejects truthy non-boolean approval controls", () => {
    const malformed = structuredClone(safePlan);
    (malformed.actions[1] as unknown as { approval: unknown }).approval = {
      required: "yes",
      approverRole: ["release-manager"],
    };

    expect(() => auditPlan(malformed)).toThrow("actions[1].approval.required");
    expect(() => auditPlan(malformed)).toThrow("actions[1].approval.approverRole");
  });
});
