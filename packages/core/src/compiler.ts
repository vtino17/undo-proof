import { canonicalJson, hashValue, sha256 } from "./canonical.js";
import type {
  AgentAction,
  PlanAudit,
  RecoveryPack,
  RecoveryStep,
  ReversibilityPlan,
  SimulationResult,
} from "./types.js";
import { assertPlan, isMutation } from "./validation.js";

function buildSteps(
  plan: ReversibilityPlan,
  rollbackOrder: string[],
  included: Set<string>,
): RecoveryStep[] {
  const byId = new Map(plan.actions.map((action) => [action.id, action]));
  const steps: RecoveryStep[] = [];
  for (const id of rollbackOrder) {
    const action = byId.get(id);
    if (
      !action ||
      !included.has(id) ||
      !action.recovery ||
      action.reversibility === "irreversible"
    ) {
      continue;
    }
    steps.push({
      order: steps.length + 1,
      actionId: action.id,
      actionLabel: action.label,
      system: action.system,
      recoveryOperation: action.recovery.operation,
      verify: action.recovery.verify,
      expectedMinutes: action.recovery.expectedMinutes,
      ...(action.recovery.backupRef
        ? { backupRef: action.recovery.backupRef }
        : {}),
      ...(action.recovery.usesReceipt
        ? { usesReceipt: action.recovery.usesReceipt }
        : {}),
    });
  }
  return steps;
}

function renderPack(
  plan: ReversibilityPlan,
  planHash: string,
  steps: RecoveryStep[],
  irreversibleActions: AgentAction[],
): string {
  const lines = [
    "# UndoProof Recovery Pack",
    "",
    `Plan: ${plan.id}`,
    `Goal: ${plan.goal}`,
    `Environment: ${plan.environment}`,
    `Plan SHA-256: ${planHash}`,
    "",
    "## Rollback order",
    "",
  ];
  if (steps.length === 0) lines.push("No recovery operations are required.");
  for (const step of steps) {
    lines.push(
      `${step.order}. **${step.actionLabel}** (\`${step.actionId}\`, ${step.system})`,
      `   - Recover: ${step.recoveryOperation}`,
      `   - Verify: ${step.verify}`,
      `   - Expected time: ${step.expectedMinutes} minutes`,
      ...(step.backupRef ? [`   - Backup: ${step.backupRef}`] : []),
      ...(step.usesReceipt ? [`   - Receipt: ${step.usesReceipt}`] : []),
    );
  }
  if (irreversibleActions.length > 0) {
    lines.push("", "## Irreversible commit points", "");
    for (const action of irreversibleActions) {
      lines.push(`- **${action.label}** (\`${action.id}\`): ${action.operation}`);
    }
  }
  lines.push(
    "",
    "## Operator rule",
    "",
    "Execute this pack from top to bottom. Stop on the first failed verification and escalate to the declared system owner.",
    "",
  );
  return lines.join("\n");
}

export function compileRecoveryPack(input: {
  plan: unknown;
  audit: PlanAudit;
  generatedAt?: Date;
}): RecoveryPack {
  assertPlan(input.plan);
  const plan = input.plan;
  if (input.audit.planId !== plan.id) {
    throw new Error("Audit does not belong to this plan.");
  }
  if (input.audit.status === "blocked") {
    throw new Error("Cannot compile a recovery pack from a blocked plan.");
  }
  const all = new Set(plan.actions.map((action) => action.id));
  const steps = buildSteps(plan, input.audit.rollbackOrder, all);
  const irreversible = plan.actions.filter(
    (action) => action.reversibility === "irreversible",
  );
  const planHash = hashValue(plan);
  const content = renderPack(plan, planHash, steps, irreversible);
  const base = {
    packVersion: "1.0" as const,
    planId: plan.id,
    planHash,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    executionOrder: input.audit.executionOrder,
    rollbackSteps: steps,
    irreversibleActions: irreversible.map((action) => action.id),
    estimatedRecoveryMinutes: steps.reduce(
      (sum, step) => sum + step.expectedMinutes,
      0,
    ),
    content,
  };
  return { ...base, packHash: sha256(canonicalJson(base)) };
}

export function simulateFailure(input: {
  plan: unknown;
  audit: PlanAudit;
  failureAt: string;
}): SimulationResult {
  assertPlan(input.plan);
  const plan = input.plan;
  const failureIndex = input.audit.executionOrder.indexOf(input.failureAt);
  if (failureIndex < 0) throw new Error(`Unknown failure action "${input.failureAt}".`);
  const completedActions = input.audit.executionOrder.slice(0, failureIndex);
  const completed = new Set(completedActions);
  const steps = buildSteps(plan, input.audit.rollbackOrder, completed);
  const byId = new Map(plan.actions.map((action) => [action.id, action]));
  const unrecoverableActions = completedActions.filter((id) => {
    const action = byId.get(id);
    return Boolean(
      action &&
        isMutation(action) &&
        action.reversibility === "irreversible",
    );
  });
  return {
    planId: plan.id,
    failureAt: input.failureAt,
    completedActions,
    rollbackSteps: steps,
    unrecoverableActions,
    estimatedRecoveryMinutes: steps.reduce(
      (sum, step) => sum + step.expectedMinutes,
      0,
    ),
    outcome:
      completedActions.length === 0
        ? "no-effects"
        : unrecoverableActions.length > 0
          ? "partial"
          : "recoverable",
  };
}
