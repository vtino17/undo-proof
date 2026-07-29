import {
  auditPlan,
  compileRecoveryPack,
  simulateFailure,
  validatePlan,
} from "@undoproof/core";
import type {
  PlanAudit,
  RecoveryPack,
  ReversibilityPlan,
  SimulationResult,
} from "@undoproof/core";
import { useMemo, useState } from "react";
import { samplePlan } from "./sample.js";

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface Evaluation {
  plan?: ReversibilityPlan;
  audit?: PlanAudit;
  error?: string;
}

function evaluate(text: string): Evaluation {
  try {
    const value: unknown = JSON.parse(text);
    const issues = validatePlan(value);
    if (issues.length > 0) {
      return {
        error: issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("\n"),
      };
    }
    const plan = value as ReversibilityPlan;
    return { plan, audit: auditPlan(plan) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function App() {
  const [source, setSource] = useState(pretty(samplePlan));
  const [failureAt, setFailureAt] = useState("migrate-schema");
  const evaluation = useMemo(() => evaluate(source), [source]);
  const { plan, audit } = evaluation;

  const pack = useMemo<RecoveryPack | undefined>(() => {
    if (!plan || !audit || audit.status === "blocked") return undefined;
    return compileRecoveryPack({ plan, audit });
  }, [plan, audit]);

  const simulation = useMemo<SimulationResult | undefined>(() => {
    if (!plan || !audit || !audit.executionOrder.includes(failureAt)) {
      return undefined;
    }
    return simulateFailure({ plan, audit, failureAt });
  }, [plan, audit, failureAt]);

  const actionById = new Map(plan?.actions.map((action) => [action.id, action]));

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#">
          <span className="brand-mark">UP</span>
          <span>
            UndoProof
            <small>Reversibility Studio</small>
          </span>
        </a>
        <div className="local-state">
          <span />
          Runs entirely in your browser
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">RECOVERY BEFORE AUTONOMY</p>
          <h1>
            If an agent can do it,
            <br />
            prove it can <em>undo it.</em>
          </h1>
        </div>
        <p className="hero-copy">
          Turn side effects into a machine-checkable reversibility contract.
          Catch missing snapshots, replay hazards, and irreversible commit
          points before execution begins.
        </p>
      </section>

      <section className="metrics">
        <article>
          <span>Readiness</span>
          <strong className={audit?.status ?? "unknown"}>
            {audit?.status.toUpperCase() ?? "INVALID"}
          </strong>
        </article>
        <article>
          <span>Recovery coverage</span>
          <strong>{audit?.coveragePercent ?? 0}<small>%</small></strong>
        </article>
        <article>
          <span>Recovery estimate</span>
          <strong>{audit?.estimatedRecoveryMinutes ?? 0}<small> min</small></strong>
        </article>
        <article>
          <span>Safety score</span>
          <strong>{audit?.score ?? 0}<small>/100</small></strong>
        </article>
      </section>

      <section className="workspace">
        <aside className="editor-panel">
          <div className="panel-heading">
            <div>
              <span className="index">01</span>
              <h2>Reversibility contract</h2>
            </div>
            <button onClick={() => setSource(pretty(samplePlan))}>Reset</button>
          </div>
          <textarea
            aria-label="Reversibility plan JSON"
            spellCheck={false}
            value={source}
            onChange={(event) => setSource(event.target.value)}
          />
          {evaluation.error && <pre className="parse-error">{evaluation.error}</pre>}
        </aside>

        <div className="audit-panel">
          <div className="panel-heading">
            <div>
              <span className="index">02</span>
              <h2>Forward action chain</h2>
            </div>
            <span className="count">{plan?.actions.length ?? 0} actions</span>
          </div>

          <div className="action-chain">
            {audit?.executionOrder.map((id, index) => {
              const action = actionById.get(id);
              const result = audit.actions.find((entry) => entry.actionId === id);
              if (!action) return null;
              return (
                <article className="action-card" key={id}>
                  <div className="action-order">{String(index + 1).padStart(2, "0")}</div>
                  <div className="action-main">
                    <div className="action-title">
                      <div>
                        <span>{action.system}</span>
                        <h3>{action.label}</h3>
                      </div>
                      <span className={`risk ${action.risk}`}>{action.risk}</span>
                    </div>
                    <p>{action.operation}</p>
                    <div className="tags">
                      <span>{action.reversibility}</span>
                      <span>{action.effect}</span>
                      <span>{action.blastRadius.scope}</span>
                      <span>{action.blastRadius.principals.toLocaleString()} people</span>
                    </div>
                  </div>
                  <div className={`proof-state ${result?.ready ? "passed" : "failed"}`}>
                    {result?.ready ? "PROVED" : "BLOCKED"}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="issues">
            <div className="subheading">
              <h3>Gate findings</h3>
              <span>{audit?.issues.length ?? 0}</span>
            </div>
            {audit?.issues.length === 0 && (
              <p className="empty">Every declared side effect has passed its recovery gate.</p>
            )}
            {audit?.issues.map((issue, index) => (
              <article key={`${issue.code}-${issue.actionId ?? index}`}>
                <span className={issue.severity}>{issue.severity}</span>
                <div>
                  <strong>{issue.code}</strong>
                  <p>{issue.message}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="recovery-lab">
        <div className="recovery-head">
          <div>
            <p className="eyebrow">FAILURE REHEARSAL</p>
            <h2>Walk the system backward.</h2>
          </div>
          <label>
            Inject failure at
            <select
              value={failureAt}
              onChange={(event) => setFailureAt(event.target.value)}
            >
              {audit?.executionOrder.map((id) => (
                <option value={id} key={id}>{id}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="recovery-grid">
          <div className="simulation">
            <span className={`outcome ${simulation?.outcome ?? "unknown"}`}>
              {simulation?.outcome ?? "unavailable"}
            </span>
            <h3>Simulated outcome</h3>
            <dl>
              <div>
                <dt>Completed effects</dt>
                <dd>{simulation?.completedActions.length ?? 0}</dd>
              </div>
              <div>
                <dt>Rollback steps</dt>
                <dd>{simulation?.rollbackSteps.length ?? 0}</dd>
              </div>
              <div>
                <dt>Unrecoverable</dt>
                <dd>{simulation?.unrecoverableActions.length ?? 0}</dd>
              </div>
            </dl>
          </div>
          <div className="rollback-track">
            <div className="subheading">
              <h3>Recovery sequence</h3>
              <span>reverse dependency order</span>
            </div>
            {simulation?.rollbackSteps.map((step) => (
              <article key={step.actionId}>
                <span>{String(step.order).padStart(2, "0")}</span>
                <div>
                  <strong>{step.actionLabel}</strong>
                  <p>{step.recoveryOperation}</p>
                  <small>Verify: {step.verify}</small>
                </div>
                <b>{step.expectedMinutes}m</b>
              </article>
            ))}
            {simulation?.rollbackSteps.length === 0 && (
              <p className="empty">No completed effects need recovery at this point.</p>
            )}
          </div>
        </div>

        <div className="export-bar">
          <div>
            <strong>Recovery pack</strong>
            <span>
              {pack
                ? `${pack.rollbackSteps.length} verified steps · ${pack.packHash.slice(0, 12)}…`
                : "Resolve blocked findings before compiling"}
            </span>
          </div>
          <div>
            <button
              disabled={!pack}
              onClick={() => pack && download("recovery.md", pack.content, "text/markdown")}
            >
              Download runbook
            </button>
            <button
              className="primary"
              disabled={!pack}
              onClick={() =>
                pack &&
                download(
                  "recovery.pack.json",
                  pretty(pack),
                  "application/json",
                )
              }
            >
              Download receipt
            </button>
          </div>
        </div>
      </section>

      <footer>
        <span>UNDOPROOF / REVERSIBILITY CONTRACT 1.0</span>
        <span>No execution · no model · no upload</span>
      </footer>
    </main>
  );
}
