# Reversibility Contract 1.0

A contract describes a proposed sequence of agent actions before those actions
receive authority to run.

## Plan fields

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Must be `"1.0"` |
| `id` | Stable identifier for this proposed plan |
| `goal` | Human-readable intended outcome |
| `environment` | Target environment such as staging or production |
| `recoveryBudgetMinutes` | Maximum declared recovery duration |
| `maxIrreversibleActions` | Explicit irreversible-action allowance |
| `actions` | Non-empty action graph |

## Action fields

Each action has a unique `id`, human label, target `system`, forward
`operation`, `effect`, risk level, dependencies, and blast radius.

`reversibility` accepts four values:

- `idempotent`: repeating the action has no additional side effect;
- `reversible`: an inverse restores the prior state;
- `compensatable`: the original effect remains, but a new effect offsets it;
- `irreversible`: no declared operation can restore an equivalent safe state.

Mutable actions should use a run-scoped `idempotencyKey`. Recovery declarations
contain an operation, independent verification, expected duration, and
optionally a snapshot reference or original-action receipt binding.

## Dependency semantics

`dependsOn` defines the forward partial order. UndoProof topologically sorts
that graph for execution and reverses the order for recovery. Cycles and
unknown dependencies block the plan.

The contract is declarative. Strings such as `operation` and `verify` are
instructions for an integration adapter or human operator; UndoProof does not
execute them.
