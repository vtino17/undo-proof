# Audit Policy

UndoProof applies deterministic, model-free policy rules.

## Blocking rules

1. Every dependency must resolve and the action graph must be acyclic.
2. Medium, high, and critical mutations require an idempotency key.
3. Reversible and compensatable mutations require a recovery operation and
   independent verification.
4. Deletes and critical actions require a backup or snapshot reference.
5. Irreversible, critical, public, or 1,000-plus-principal actions require a
   named approver role.
6. Irreversible actions must declare `commitPoint: true`.
7. Irreversible count must not exceed `maxIrreversibleActions`.
8. Total declared recovery time must fit `recoveryBudgetMinutes`.

Low-risk mutation without an idempotency key is a warning. Compensation that is
not bound to its original action receipt is also a warning.

## Score and coverage

Recovery coverage is the percentage of mutations that are idempotent or have a
declared inverse/compensation. The score begins at coverage and deducts points
for blocking issues, warnings, and irreversible actions.

The score is informational. The `ready`, `warning`, and `blocked` status is the
policy gate.

## Policy regression

`undo-proof diff` flags:

- a larger recovery-time budget;
- a larger irreversible-action allowance;
- weaker reversibility classification;
- removed idempotency keys;
- removed backup references;
- removed approval requirements.
