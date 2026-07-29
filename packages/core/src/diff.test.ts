import { describe, expect, it } from "vitest";
import { diffPlans } from "./diff.js";
import { safePlan } from "./fixture.js";

describe("plan diff", () => {
  it("flags weakened reversibility controls", () => {
    const weaker = structuredClone(safePlan);
    weaker.id = "release-42-weaker";
    weaker.recoveryBudgetMinutes = 60;
    weaker.maxIrreversibleActions = 2;
    weaker.actions[1] = {
      ...weaker.actions[1]!,
      reversibility: "compensatable",
      idempotencyKey: undefined,
      approval: { required: false },
      recovery: {
        operation: "issue apology",
        verify: "apology is visible",
        expectedMinutes: 15,
      },
    } as (typeof weaker.actions)[number];
    const diff = diffPlans(safePlan, weaker);
    expect(diff.weakenedControls).toHaveLength(6);
  });
});
