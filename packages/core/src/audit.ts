import { analyzeGraph } from "./graph.js";
import type {
  AgentAction,
  AuditIssue,
  PlanAudit,
} from "./types.js";
import { assertPlan, isMutation } from "./validation.js";

function issue(
  code: string,
  severity: AuditIssue["severity"],
  message: string,
  actionId?: string,
): AuditIssue {
  return { code, severity, message, ...(actionId ? { actionId } : {}) };
}

function needsApproval(action: AgentAction): boolean {
  return (
    action.reversibility === "irreversible" ||
    action.risk === "critical" ||
    action.blastRadius.scope === "public" ||
    action.blastRadius.principals >= 1000
  );
}

function recoveryCovered(action: AgentAction): boolean {
  if (!isMutation(action) || action.reversibility === "idempotent") return true;
  if (action.reversibility === "irreversible") return false;
  return Boolean(action.recovery?.operation && action.recovery.verify);
}

export function auditPlan(
  value: unknown,
  now = new Date(),
): PlanAudit {
  assertPlan(value);
  const plan = value;
  const graph = analyzeGraph(plan.actions);
  const globalIssues: AuditIssue[] = [];

  for (const missing of graph.missing) {
    globalIssues.push(
      issue(
        "missing-dependency",
        "blocked",
        `Action "${missing.actionId}" depends on unknown action "${missing.dependencyId}".`,
        missing.actionId,
      ),
    );
  }
  if (graph.cycle.length > 0) {
    globalIssues.push(
      issue(
        "dependency-cycle",
        "blocked",
        `Dependency cycle detected: ${graph.cycle.join(" → ")}.`,
      ),
    );
  }

  const actionAudits = plan.actions.map((action) => {
    const issues: AuditIssue[] = [];
    const covered = recoveryCovered(action);
    const replaySafe = !isMutation(action) || Boolean(action.idempotencyKey);
    const approvalCovered =
      !needsApproval(action) ||
      Boolean(action.approval?.required && action.approval.approverRole);

    if (
      isMutation(action) &&
      !action.idempotencyKey
    ) {
      issues.push(
        issue(
          "missing-idempotency-key",
          action.risk === "low" ? "warning" : "blocked",
          "Mutating actions need an idempotency key to prevent replay.",
          action.id,
        ),
      );
    }
    if (
      (action.reversibility === "reversible" ||
        action.reversibility === "compensatable") &&
      !action.recovery
    ) {
      issues.push(
        issue(
          "missing-recovery",
          "blocked",
          `${action.reversibility} action has no recovery operation.`,
          action.id,
        ),
      );
    }
    if (
      action.recovery &&
      (action.effect === "delete" || action.risk === "critical") &&
      !action.recovery.backupRef
    ) {
      issues.push(
        issue(
          "missing-backup",
          "blocked",
          "Destructive or critical recovery requires a snapshot or backup reference.",
          action.id,
        ),
      );
    }
    if (needsApproval(action) && !approvalCovered) {
      issues.push(
        issue(
          "missing-approval",
          "blocked",
          "Irreversible, critical, public, or large-blast-radius actions require a named approver role.",
          action.id,
        ),
      );
    }
    if (action.reversibility === "irreversible" && !action.commitPoint) {
      issues.push(
        issue(
          "undeclared-commit-point",
          "blocked",
          "Irreversible action must be explicitly marked as a commit point.",
          action.id,
        ),
      );
    }
    if (
      action.reversibility === "compensatable" &&
      action.recovery &&
      !action.recovery.usesReceipt
    ) {
      issues.push(
        issue(
          "missing-receipt-binding",
          "warning",
          "Compensation should bind to the original action receipt.",
          action.id,
        ),
      );
    }
    if (
      action.blastRadius.scope === "public" &&
      action.blastRadius.principals === 0
    ) {
      issues.push(
        issue(
          "unknown-public-audience",
          "warning",
          "Public action declares zero affected principals.",
          action.id,
        ),
      );
    }
    return {
      actionId: action.id,
      ready: !issues.some((entry) => entry.severity === "blocked"),
      recoveryCovered: covered,
      replaySafe,
      approvalCovered,
      issues,
    };
  });

  const irreversibleCount = plan.actions.filter(
    (action) => action.reversibility === "irreversible",
  ).length;
  if (irreversibleCount > plan.maxIrreversibleActions) {
    globalIssues.push(
      issue(
        "irreversible-budget-exceeded",
        "blocked",
        `${irreversibleCount} irreversible actions exceed the allowed maximum of ${plan.maxIrreversibleActions}.`,
      ),
    );
  }
  const estimatedRecoveryMinutes = plan.actions.reduce(
    (sum, action) => sum + (action.recovery?.expectedMinutes ?? 0),
    0,
  );
  if (estimatedRecoveryMinutes > plan.recoveryBudgetMinutes) {
    globalIssues.push(
      issue(
        "recovery-budget-exceeded",
        "blocked",
        `Estimated recovery takes ${estimatedRecoveryMinutes} minutes, above the ${plan.recoveryBudgetMinutes}-minute budget.`,
      ),
    );
  }

  const allIssues = [...globalIssues, ...actionAudits.flatMap((entry) => entry.issues)];
  const mutationCount = plan.actions.filter(isMutation).length;
  const coveredCount = plan.actions.filter(
    (action) => isMutation(action) && recoveryCovered(action),
  ).length;
  const coveragePercent =
    mutationCount === 0 ? 100 : Math.round((coveredCount / mutationCount) * 100);
  const blocked = allIssues.filter((entry) => entry.severity === "blocked").length;
  const warnings = allIssues.length - blocked;
  const score = Math.max(
    0,
    Math.min(
      100,
      coveragePercent - blocked * 12 - warnings * 3 - irreversibleCount * 5,
    ),
  );
  return {
    planId: plan.id,
    status: blocked > 0 ? "blocked" : warnings > 0 ? "warning" : "ready",
    score,
    coveragePercent,
    estimatedRecoveryMinutes,
    irreversibleCount,
    executionOrder: graph.order,
    rollbackOrder: [...graph.order].reverse(),
    issues: allIssues,
    actions: actionAudits,
    auditedAt: now.toISOString(),
  };
}
