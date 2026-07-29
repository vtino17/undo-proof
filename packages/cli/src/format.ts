import type {
  PackVerification,
  PlanAudit,
  PlanDiff,
  RecoveryPack,
  SimulationResult,
} from "@undoproof/core";

const status = {
  ready: "✓ READY",
  warning: "◇ WARNING",
  blocked: "✕ BLOCKED",
} as const;

export function formatAudit(audit: PlanAudit): string {
  const lines = [
    `${status[audit.status]}  ${audit.planId}`,
    `Score          ${audit.score}/100`,
    `Coverage       ${audit.coveragePercent}%`,
    `Recovery time  ${audit.estimatedRecoveryMinutes} min`,
    `Irreversible   ${audit.irreversibleCount}`,
    "",
  ];
  for (const action of audit.actions) {
    const marks = [
      action.recoveryCovered ? "recovery" : "no-recovery",
      action.replaySafe ? "replay-safe" : "replay-risk",
      action.approvalCovered ? "approval-ok" : "approval-missing",
    ];
    lines.push(`${action.ready ? "✓" : "✕"} ${action.actionId.padEnd(24)} ${marks.join(" · ")}`);
  }
  if (audit.issues.length > 0) {
    lines.push("", "Issues");
    for (const entry of audit.issues) {
      lines.push(
        `${entry.severity === "blocked" ? "!" : "·"} ${entry.code}${entry.actionId ? ` [${entry.actionId}]` : ""}: ${entry.message}`,
      );
    }
  }
  return lines.join("\n");
}

export function formatPack(pack: RecoveryPack): string {
  return [
    `✓ Recovery pack compiled`,
    `Plan           ${pack.planId}`,
    `Rollback steps ${pack.rollbackSteps.length}`,
    `Recovery time  ${pack.estimatedRecoveryMinutes} min`,
    `Hash           ${pack.packHash}`,
  ].join("\n");
}

export function formatSimulation(result: SimulationResult): string {
  return [
    `${result.outcome === "recoverable" ? "✓" : result.outcome === "partial" ? "◇" : "·"} ${result.outcome.toUpperCase()} after failure at ${result.failureAt}`,
    `Completed      ${result.completedActions.join(", ") || "none"}`,
    `Rollback       ${result.rollbackSteps.map((step) => step.actionId).join(" → ") || "none"}`,
    `Unrecoverable  ${result.unrecoverableActions.join(", ") || "none"}`,
    `Recovery time  ${result.estimatedRecoveryMinutes} min`,
  ].join("\n");
}

export function formatVerification(result: PackVerification): string {
  return [
    result.valid ? "✓ VALID recovery pack" : "✕ INVALID recovery pack",
    ...Object.entries(result.checks).map(
      ([name, passed]) => `${passed ? "PASS" : "FAIL"}  ${name}`,
    ),
    ...result.errors.map((error) => `! ${error}`),
  ].join("\n");
}

export function formatDiff(diff: PlanDiff): string {
  return [
    `Plan diff      ${diff.from} → ${diff.to}`,
    `Added          ${diff.added.join(", ") || "none"}`,
    `Removed        ${diff.removed.join(", ") || "none"}`,
    `Modified       ${diff.modified.join(", ") || "none"}`,
    `Weakened       ${diff.weakenedControls.length}`,
    ...diff.weakenedControls.map((entry) => `! ${entry}`),
  ].join("\n");
}
