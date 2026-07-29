export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Effect =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "publish"
  | "charge";
export type Reversibility =
  | "idempotent"
  | "reversible"
  | "compensatable"
  | "irreversible";
export type Scope = "local" | "team" | "organization" | "public";

export interface BlastRadius {
  resources: number;
  principals: number;
  scope: Scope;
}

export interface RecoverySpec {
  operation: string;
  verify: string;
  expectedMinutes: number;
  backupRef?: string;
  usesReceipt?: string;
}

export interface ApprovalSpec {
  required: boolean;
  approverRole?: string;
  ticket?: string;
}

export interface AgentAction {
  id: string;
  label: string;
  system: string;
  operation: string;
  effect: Effect;
  reversibility: Reversibility;
  risk: RiskLevel;
  dependsOn: string[];
  blastRadius: BlastRadius;
  idempotencyKey?: string;
  preconditions?: string[];
  recovery?: RecoverySpec;
  approval?: ApprovalSpec;
  commitPoint?: boolean;
}

export interface ReversibilityPlan {
  schemaVersion: "1.0";
  id: string;
  goal: string;
  environment: string;
  recoveryBudgetMinutes: number;
  maxIrreversibleActions: number;
  actions: AgentAction[];
}

export type IssueSeverity = "warning" | "blocked";

export interface AuditIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  actionId?: string;
}

export interface ActionAudit {
  actionId: string;
  ready: boolean;
  recoveryCovered: boolean;
  replaySafe: boolean;
  approvalCovered: boolean;
  issues: AuditIssue[];
}

export interface PlanAudit {
  planId: string;
  status: "ready" | "warning" | "blocked";
  score: number;
  coveragePercent: number;
  estimatedRecoveryMinutes: number;
  irreversibleCount: number;
  executionOrder: string[];
  rollbackOrder: string[];
  issues: AuditIssue[];
  actions: ActionAudit[];
  auditedAt: string;
}

export interface RecoveryStep {
  order: number;
  actionId: string;
  actionLabel: string;
  system: string;
  recoveryOperation: string;
  verify: string;
  expectedMinutes: number;
  backupRef?: string;
  usesReceipt?: string;
}

export interface RecoveryPack {
  packVersion: "1.0";
  planId: string;
  planHash: string;
  generatedAt: string;
  executionOrder: string[];
  rollbackSteps: RecoveryStep[];
  irreversibleActions: string[];
  estimatedRecoveryMinutes: number;
  content: string;
  packHash: string;
}

export interface SimulationResult {
  planId: string;
  failureAt: string;
  completedActions: string[];
  rollbackSteps: RecoveryStep[];
  unrecoverableActions: string[];
  estimatedRecoveryMinutes: number;
  outcome: "recoverable" | "partial" | "no-effects";
}

export interface PackVerification {
  valid: boolean;
  checks: {
    packHash: boolean;
    planHash: boolean;
    order: boolean;
    recoveryTime: boolean;
  };
  errors: string[];
}

export interface PlanDiff {
  from: string;
  to: string;
  added: string[];
  removed: string[];
  modified: string[];
  weakenedControls: string[];
}
