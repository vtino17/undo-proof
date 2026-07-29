import { describe, expect, it } from "vitest";
import { formatAudit, formatSimulation } from "./format.js";

describe("CLI formatting", () => {
  it("renders a blocked audit with recovery metrics", () => {
    const text = formatAudit({
      planId: "unsafe",
      status: "blocked",
      score: 12,
      coveragePercent: 50,
      estimatedRecoveryMinutes: 45,
      irreversibleCount: 1,
      executionOrder: ["delete-db"],
      rollbackOrder: ["delete-db"],
      auditedAt: "2026-07-29T00:00:00Z",
      issues: [
        {
          code: "missing-backup",
          severity: "blocked",
          message: "Backup required.",
          actionId: "delete-db",
        },
      ],
      actions: [
        {
          actionId: "delete-db",
          ready: false,
          recoveryCovered: false,
          replaySafe: false,
          approvalCovered: false,
          issues: [],
        },
      ],
    });
    expect(text).toContain("✕ BLOCKED");
    expect(text).toContain("50%");
    expect(text).toContain("missing-backup");
  });

  it("renders a partial failure simulation", () => {
    const text = formatSimulation({
      planId: "release",
      failureAt: "notify",
      completedActions: ["charge"],
      rollbackSteps: [],
      unrecoverableActions: ["charge"],
      estimatedRecoveryMinutes: 0,
      outcome: "partial",
    });
    expect(text).toContain("PARTIAL");
    expect(text).toContain("charge");
  });
});
