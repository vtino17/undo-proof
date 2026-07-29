# Runtime Integration

UndoProof is designed as a pre-authority gate.

```text
agent proposes actions
        ↓
runtime emits reversibility contract
        ↓
UndoProof audit + optional human review
        ↓
recovery pack stored outside agent credentials
        ↓
runtime receives scoped execution authority
        ↓
receipts bind completed actions to recovery operations
```

## Recommended lifecycle

1. Generate the contract before obtaining production credentials.
2. Audit it in CI or an isolated control plane.
3. Review critical and irreversible commit points.
4. Store backups and the recovery pack under credentials the acting agent
   cannot delete.
5. Assign a unique idempotency key to every mutable action.
6. Record completion receipts as actions commit.
7. On failure, simulate from the failed action and execute only recovery steps
   for completed actions.
8. Verify each recovery result before continuing.

Adapters may translate structured operations into Terraform, Kubernetes,
database, GitHub, payment, or messaging commands. Adapters should preserve the
contract and receipt hashes and must not ask the language model to invent
recovery logic during an incident.
