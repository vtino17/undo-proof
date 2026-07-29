# UndoProof

**Reversibility contract linter and deterministic recovery compiler for AI agents.**

AI agents can now deploy services, mutate databases, publish content, and charge
customers. Forward execution is usually planned in detail; recovery is often an
informal promise left for after an incident.

UndoProof makes recovery a precondition. It audits a machine-readable action
plan, rejects unsafe side effects, simulates failures at any step, and compiles
a content-addressed recovery pack in reverse dependency order.

## The core idea

Every side effect must declare:

- what it changes and how large the blast radius is;
- whether it is idempotent, reversible, compensatable, or irreversible;
- how replay is prevented;
- which inverse or compensation operation restores safety;
- how recovery is verified;
- which snapshot, receipt, approval, or commit point it depends on.

UndoProof never executes forward or recovery operations. It provides a
deterministic gate that agent runtimes and CI pipelines can run before granting
authority.

## Why this is different

| Capability | UndoProof | Agent trace | Approval prompt | IaC plan |
| --- | --- | --- | --- | --- |
| Reversibility taxonomy | Yes | Observed only | Usually binary | Resource-specific |
| Dependency-aware rollback order | Yes | No | No | Provider-specific |
| Failure injection before execution | Yes | Replay only | No | Partial |
| Idempotency and receipt checks | Yes | Logged after | No | Varies |
| Recovery-time budget | Yes | No | No | No |
| Safety weakening diff | Yes | No | No | Plan diff only |
| Content-addressed recovery pack | Yes | No | No | State-dependent |

No search can prove that an idea is globally unique. The distinctive scope here
is the combination of reversibility contracts, replay safety, failure
simulation, dependency-aware recovery compilation, and policy-regression diff.

## Included

- `@undoproof/core`: audit rules, graph analysis, simulation, compiler, diff,
  and receipt verification;
- `undo-proof` CLI for local use and CI gates;
- React Studio for editing contracts and rehearsing failure paths locally;
- safe, unsafe, and deliberately weakened production examples;
- contract, policy, recovery-pack, integration, and threat-model documentation.

## Quick start

Requirements: Node.js 20+ and pnpm 10.

```bash
git clone https://github.com/vtino17/undo-proof.git
cd undo-proof
corepack enable
pnpm install
pnpm check
```

Audit the safe release:

```bash
pnpm proof audit examples/safe-release.json
```

Compile and verify its recovery pack:

```bash
pnpm proof compile examples/safe-release.json \
  --output .undo-proof/recovery.md \
  --receipt .undo-proof/recovery.pack.json

pnpm proof verify .undo-proof/recovery.pack.json \
  --plan examples/safe-release.json
```

Inject a failure before the database migration:

```bash
pnpm proof simulate examples/safe-release.json \
  --fail-at migrate-schema
```

Inspect a deliberately unsafe plan:

```bash
pnpm proof audit examples/unsafe-production-delete.json
```

Launch the local Studio:

```bash
pnpm dev
```

## CI exit codes

| Exit | Meaning |
| ---: | --- |
| `0` | Ready, recoverable, or valid |
| `2` | Plan is blocked |
| `3` | Plan has warnings |
| `4` | Partial recovery or weakened policy |
| `5` | Recovery pack verification failed |

## What the audit blocks

- missing and cyclic dependencies;
- mutable actions without idempotency keys;
- reversible or compensatable actions without recovery operations;
- destructive or critical actions without snapshot references;
- high-impact actions without a named approval role;
- undeclared irreversible commit points;
- irreversible-action and recovery-time budget violations.

Warnings cover weaker but non-fatal declarations such as compensation not bound
to the original action receipt.

## Research motivation

OWASP recommends human approval for high-impact operations when addressing
excessive agency. Recent work formalizes agent actions as idempotent,
reversible, compensable, or irreversible. Separate checkpoint research shows
that naive agent rollback can replay payments or resurrect previously consumed
authority.

- [OWASP LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
- [Revisable by Design: A Theory of Streaming LLM Agent Execution](https://arxiv.org/abs/2604.23283)
- [ACRFence: Preventing Semantic Rollback Attacks in Agent Checkpoint-Restore](https://arxiv.org/abs/2603.20625)
- [NIST AI Agent Standards Initiative](https://www.nist.gov/artificial-intelligence/ai-agent-standards-initiative)

These sources motivate the project; they do not certify or endorse it.

## Documentation

- [Reversibility contract](docs/CONTRACT.md)
- [Audit policy](docs/POLICY.md)
- [Recovery pack](docs/RECOVERY-PACK.md)
- [Runtime integration](docs/INTEGRATION.md)
- [Threat model](docs/THREAT-MODEL.md)

## Repository layout

```text
packages/core/     Deterministic audit and recovery algorithms
packages/cli/      Developer and CI interface
apps/studio/       Local visual failure-rehearsal workbench
examples/          Safe, unsafe, and weakened plans
docs/              Protocol and security guidance
```

## Status

UndoProof is an experimental reference implementation. A valid contract proves
that declared recovery controls are structurally complete; it does not prove
that an external system will honor them or that an operator described the
forward action truthfully.

## License

[MIT](LICENSE)
