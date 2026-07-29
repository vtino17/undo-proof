# Recovery Pack

A recovery pack is produced only when the audited plan is not blocked.

The JSON receipt contains:

- the exact plan SHA-256;
- forward execution order;
- dependency-safe rollback steps;
- irreversible commit points;
- total declared recovery time;
- rendered Markdown runbook;
- a SHA-256 covering every receipt field except itself.

Each rollback step includes the original action identity, target system,
recovery operation, verification, expected duration, and optional backup or
receipt binding.

`undo-proof verify` recomputes the receipt hash, plan hash, step numbering, and
recovery duration. This catches accidental or malicious edits after approval.

The Markdown runbook tells an operator to stop on the first failed verification.
Continuing after a failed inverse can compound damage and invalidate later
recovery assumptions.
