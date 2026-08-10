import type {
  AgentAction,
  Effect,
  Reversibility,
  ReversibilityPlan,
  RiskLevel,
  Scope,
} from "./types.js";

export interface ValidationIssue {
  path: string;
  message: string;
}

const effects = new Set<Effect>([
  "read",
  "create",
  "update",
  "delete",
  "publish",
  "charge",
]);
const reversibilities = new Set<Reversibility>([
  "idempotent",
  "reversible",
  "compensatable",
  "irreversible",
]);
const risks = new Set<RiskLevel>(["low", "medium", "high", "critical"]);
const scopes = new Set<Scope>(["local", "team", "organization", "public"]);

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validateAction(value: unknown, index: number): ValidationIssue[] {
  const path = `actions[${index}]`;
  if (!object(value)) return [{ path, message: "Action must be an object." }];
  const issues: ValidationIssue[] = [];
  for (const field of ["id", "label", "system", "operation"] as const) {
    if (!text(value[field])) {
      issues.push({ path: `${path}.${field}`, message: "Must be a non-empty string." });
    }
  }
  if (!effects.has(value.effect as Effect)) {
    issues.push({ path: `${path}.effect`, message: "Unknown effect." });
  }
  if (!reversibilities.has(value.reversibility as Reversibility)) {
    issues.push({ path: `${path}.reversibility`, message: "Unknown reversibility class." });
  }
  if (!risks.has(value.risk as RiskLevel)) {
    issues.push({ path: `${path}.risk`, message: "Unknown risk level." });
  }
  if (!Array.isArray(value.dependsOn) || !value.dependsOn.every(text)) {
    issues.push({ path: `${path}.dependsOn`, message: "Must be an array of action IDs." });
  }
  if (!object(value.blastRadius)) {
    issues.push({ path: `${path}.blastRadius`, message: "Blast radius is required." });
  } else {
    if (!nonNegative(value.blastRadius.resources)) {
      issues.push({ path: `${path}.blastRadius.resources`, message: "Must be non-negative." });
    }
    if (!nonNegative(value.blastRadius.principals)) {
      issues.push({ path: `${path}.blastRadius.principals`, message: "Must be non-negative." });
    }
    if (!scopes.has(value.blastRadius.scope as Scope)) {
      issues.push({ path: `${path}.blastRadius.scope`, message: "Unknown scope." });
    }
  }
  if (value.recovery !== undefined) {
    if (!object(value.recovery)) {
      issues.push({ path: `${path}.recovery`, message: "Must be an object." });
    } else {
      if (!text(value.recovery.operation)) {
        issues.push({ path: `${path}.recovery.operation`, message: "Operation is required." });
      }
      if (!text(value.recovery.verify)) {
        issues.push({ path: `${path}.recovery.verify`, message: "Verification is required." });
      }
      if (!nonNegative(value.recovery.expectedMinutes)) {
        issues.push({ path: `${path}.recovery.expectedMinutes`, message: "Must be non-negative." });
      }
      for (const field of ["backupRef", "usesReceipt"] as const) {
        if (value.recovery[field] !== undefined && !text(value.recovery[field])) {
          issues.push({ path: `${path}.recovery.${field}`, message: "Must be a non-empty string." });
        }
      }
    }
  }
  if (value.approval !== undefined) {
    if (!object(value.approval)) {
      issues.push({ path: `${path}.approval`, message: "Must be an object." });
    } else {
      if (typeof value.approval.required !== "boolean") {
        issues.push({ path: `${path}.approval.required`, message: "Must be boolean." });
      }
      for (const field of ["approverRole", "ticket"] as const) {
        if (value.approval[field] !== undefined && !text(value.approval[field])) {
          issues.push({ path: `${path}.approval.${field}`, message: "Must be a non-empty string." });
        }
      }
    }
  }
  if (value.idempotencyKey !== undefined && !text(value.idempotencyKey)) {
    issues.push({ path: `${path}.idempotencyKey`, message: "Must be a non-empty string." });
  }
  if (value.preconditions !== undefined && (!Array.isArray(value.preconditions) || !value.preconditions.every(text))) {
    issues.push({ path: `${path}.preconditions`, message: "Must be an array of non-empty strings." });
  }
  if (value.commitPoint !== undefined && typeof value.commitPoint !== "boolean") {
    issues.push({ path: `${path}.commitPoint`, message: "Must be boolean." });
  }
  return issues;
}

export function validatePlan(value: unknown): ValidationIssue[] {
  if (!object(value)) return [{ path: "$", message: "Plan must be an object." }];
  const issues: ValidationIssue[] = [];
  if (value.schemaVersion !== "1.0") {
    issues.push({ path: "schemaVersion", message: 'Must equal "1.0".' });
  }
  for (const field of ["id", "goal", "environment"] as const) {
    if (!text(value[field])) {
      issues.push({ path: field, message: "Must be a non-empty string." });
    }
  }
  if (!nonNegative(value.recoveryBudgetMinutes) || value.recoveryBudgetMinutes === 0) {
    issues.push({ path: "recoveryBudgetMinutes", message: "Must be greater than zero." });
  }
  if (!Number.isInteger(value.maxIrreversibleActions) || (value.maxIrreversibleActions as number) < 0) {
    issues.push({ path: "maxIrreversibleActions", message: "Must be a non-negative integer." });
  }
  if (!Array.isArray(value.actions) || value.actions.length === 0) {
    issues.push({ path: "actions", message: "At least one action is required." });
    return issues;
  }
  value.actions.forEach((action, index) => issues.push(...validateAction(action, index)));
  const ids = value.actions
    .filter(object)
    .map((action) => action.id)
    .filter(text);
  if (new Set(ids).size !== ids.length) {
    issues.push({ path: "actions", message: "Action IDs must be unique." });
  }
  return issues;
}

export function assertPlan(value: unknown): asserts value is ReversibilityPlan {
  const issues = validatePlan(value);
  if (issues.length > 0) {
    throw new Error(
      `Invalid reversibility plan:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n")}`,
    );
  }
}

export function isMutation(action: AgentAction): boolean {
  return action.effect !== "read";
}
