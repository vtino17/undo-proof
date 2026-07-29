import type { ReversibilityPlan } from "@undoproof/core";

export const starterPlan: ReversibilityPlan = {
  schemaVersion: "1.0",
  id: "change-plan",
  goal: "Describe the intended outcome",
  environment: "staging",
  recoveryBudgetMinutes: 30,
  maxIrreversibleActions: 0,
  actions: [
    {
      id: "change-resource",
      label: "Change resource",
      system: "example-system",
      operation: "describe the forward operation",
      effect: "update",
      reversibility: "reversible",
      risk: "medium",
      dependsOn: [],
      blastRadius: {
        resources: 1,
        principals: 0,
        scope: "local",
      },
      idempotencyKey: "change-plan:change-resource",
      recovery: {
        operation: "describe the inverse operation",
        verify: "describe the recovery verification",
        expectedMinutes: 5,
        backupRef: "snapshot://replace-me",
      },
    },
  ],
};
