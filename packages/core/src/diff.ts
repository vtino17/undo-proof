import { canonicalJson } from "./canonical.js";
import type {
  AgentAction,
  PlanDiff,
  Reversibility,
} from "./types.js";
import { assertPlan } from "./validation.js";

const reversibilityRank: Record<Reversibility, number> = {
  idempotent: 3,
  reversible: 2,
  compensatable: 1,
  irreversible: 0,
};

export function diffPlans(fromValue: unknown, toValue: unknown): PlanDiff {
  assertPlan(fromValue);
  assertPlan(toValue);
  const from = fromValue;
  const to = toValue;
  const oldActions = new Map(from.actions.map((action) => [action.id, action]));
  const newActions = new Map(to.actions.map((action) => [action.id, action]));
  const added = [...newActions.keys()].filter((id) => !oldActions.has(id)).sort();
  const removed = [...oldActions.keys()].filter((id) => !newActions.has(id)).sort();
  const modified = [...oldActions.keys()]
    .filter(
      (id) =>
        newActions.has(id) &&
        canonicalJson(oldActions.get(id)) !== canonicalJson(newActions.get(id)),
    )
    .sort();
  const weakenedControls: string[] = [];
  if (to.recoveryBudgetMinutes > from.recoveryBudgetMinutes) {
    weakenedControls.push(
      `Recovery budget increased from ${from.recoveryBudgetMinutes} to ${to.recoveryBudgetMinutes} minutes.`,
    );
  }
  if (to.maxIrreversibleActions > from.maxIrreversibleActions) {
    weakenedControls.push(
      `Irreversible action allowance increased from ${from.maxIrreversibleActions} to ${to.maxIrreversibleActions}.`,
    );
  }
  for (const id of modified) {
    const previous = oldActions.get(id) as AgentAction;
    const next = newActions.get(id) as AgentAction;
    if (
      reversibilityRank[next.reversibility] <
      reversibilityRank[previous.reversibility]
    ) {
      weakenedControls.push(
        `Action "${id}" changed from ${previous.reversibility} to ${next.reversibility}.`,
      );
    }
    if (previous.idempotencyKey && !next.idempotencyKey) {
      weakenedControls.push(`Action "${id}" lost its idempotency key.`);
    }
    if (previous.recovery?.backupRef && !next.recovery?.backupRef) {
      weakenedControls.push(`Action "${id}" lost its backup reference.`);
    }
    if (previous.approval?.required && !next.approval?.required) {
      weakenedControls.push(`Action "${id}" no longer requires approval.`);
    }
  }
  return {
    from: from.id,
    to: to.id,
    added,
    removed,
    modified,
    weakenedControls,
  };
}
