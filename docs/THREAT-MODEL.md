# Threat Model

## Protected assets

- production data and services;
- backup and snapshot integrity;
- human approval boundaries;
- idempotency guarantees;
- recovery plans and action receipts.

## Addressed failure modes

- agent proposes a destructive action without a backup;
- retries duplicate a mutable or financial side effect;
- recovery steps run in dependency-unsafe order;
- a plan silently increases irreversible authority;
- compensation cannot identify the original action;
- declared recovery exceeds the operator's incident budget;
- a recovery receipt is changed after approval.

## Trust boundaries

UndoProof trusts the plan author to describe external operations honestly.
Hashing protects integrity after declaration, not truth at declaration.

Recovery assets must be isolated from the forward executor. A production agent
that can delete both the primary resource and its backup defeats the recovery
model.

## Out of scope

UndoProof does not:

- execute or sandbox actions;
- authenticate approvers;
- create backups;
- prove external commands are correct;
- detect prompt injection;
- guarantee a compensation is legally or financially equivalent;
- replace tested disaster recovery.

Integrations should combine UndoProof with least-privilege credentials,
independent backups, runtime policy enforcement, observability, and human
approval for high-impact commit points.
