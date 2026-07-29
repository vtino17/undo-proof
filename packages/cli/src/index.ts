#!/usr/bin/env node
import {
  auditPlan,
  compileRecoveryPack,
  diffPlans,
  simulateFailure,
  verifyRecoveryPack,
} from "@undoproof/core";
import type {
  RecoveryPack,
  ReversibilityPlan,
} from "@undoproof/core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  formatAudit,
  formatDiff,
  formatPack,
  formatSimulation,
  formatVerification,
} from "./format.js";
import { starterPlan } from "./template.js";

const help = `UndoProof — reversibility linter and recovery compiler for AI agents

Usage:
  undo-proof audit <plan.json> [--json]
  undo-proof compile <plan.json> --output <recovery.md> --receipt <pack.json> [--json]
  undo-proof simulate <plan.json> --fail-at <action-id> [--json]
  undo-proof verify <pack.json> [--plan <plan.json>] [--json]
  undo-proof diff <old.json> <new.json> [--json]
  undo-proof init [reversibility.plan.json]

UndoProof never executes forward or recovery operations.`;

interface Parsed {
  command: string | undefined;
  positionals: string[];
  flags: Map<string, string>;
}

function parseArgs(args: string[]): Parsed {
  const [command, ...rest] = args;
  const positionals: string[] = [];
  const flags = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index]!;
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const next = rest[index + 1];
    const flagValue = next && !next.startsWith("--") ? next : "true";
    flags.set(value.slice(2), flagValue);
    if (flagValue !== "true") index += 1;
  }
  return { command, positionals, flags };
}

async function readJson<T>(path: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    throw new Error(
      `Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function requireFiles(parsed: Parsed, count: number): string[] {
  if (parsed.positionals.length < count) {
    throw new Error(`Expected ${count} file argument(s).\n\n${help}`);
  }
  return parsed.positionals;
}

async function writeNew(path: string, content: string): Promise<void> {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content, { encoding: "utf8", flag: "wx" });
}

function print(value: unknown, formatted: string, json: boolean): void {
  process.stdout.write(
    json ? `${JSON.stringify(value, null, 2)}\n` : `${formatted}\n`,
  );
}

async function auditCommand(parsed: Parsed): Promise<number> {
  const [path] = requireFiles(parsed, 1) as [string];
  const plan = await readJson<ReversibilityPlan>(path);
  const audit = auditPlan(plan);
  print(audit, formatAudit(audit), parsed.flags.has("json"));
  return audit.status === "ready" ? 0 : audit.status === "warning" ? 3 : 2;
}

async function compileCommand(parsed: Parsed): Promise<number> {
  const [path] = requireFiles(parsed, 1) as [string];
  const output = parsed.flags.get("output");
  const receipt = parsed.flags.get("receipt");
  if (!output || output === "true" || !receipt || receipt === "true") {
    throw new Error("compile requires --output <recovery.md> and --receipt <pack.json>.");
  }
  const plan = await readJson<ReversibilityPlan>(path);
  const audit = auditPlan(plan);
  const pack = compileRecoveryPack({ plan, audit });
  await writeNew(output, pack.content);
  await writeNew(receipt, `${JSON.stringify(pack, null, 2)}\n`);
  print(
    pack,
    `${formatPack(pack)}\nMarkdown       ${output}\nReceipt        ${receipt}`,
    parsed.flags.has("json"),
  );
  return 0;
}

async function simulateCommand(parsed: Parsed): Promise<number> {
  const [path] = requireFiles(parsed, 1) as [string];
  const failureAt = parsed.flags.get("fail-at");
  if (!failureAt || failureAt === "true") {
    throw new Error("simulate requires --fail-at <action-id>.");
  }
  const plan = await readJson<ReversibilityPlan>(path);
  const audit = auditPlan(plan);
  const result = simulateFailure({ plan, audit, failureAt });
  print(result, formatSimulation(result), parsed.flags.has("json"));
  return result.outcome === "partial" ? 4 : 0;
}

async function verifyCommand(parsed: Parsed): Promise<number> {
  const [path] = requireFiles(parsed, 1) as [string];
  const planPath = parsed.flags.get("plan");
  const [pack, plan] = await Promise.all([
    readJson<RecoveryPack>(path),
    planPath && planPath !== "true"
      ? readJson<ReversibilityPlan>(planPath)
      : Promise.resolve(undefined),
  ]);
  const result = verifyRecoveryPack({
    pack,
    ...(plan ? { plan } : {}),
  });
  print(result, formatVerification(result), parsed.flags.has("json"));
  return result.valid ? 0 : 5;
}

async function diffCommand(parsed: Parsed): Promise<number> {
  const [oldPath, newPath] = requireFiles(parsed, 2) as [string, string];
  const [oldPlan, newPlan] = await Promise.all([
    readJson<ReversibilityPlan>(oldPath),
    readJson<ReversibilityPlan>(newPath),
  ]);
  const diff = diffPlans(oldPlan, newPlan);
  print(diff, formatDiff(diff), parsed.flags.has("json"));
  return diff.weakenedControls.length > 0 ? 4 : 0;
}

async function initCommand(parsed: Parsed): Promise<number> {
  const output = parsed.positionals[0] ?? "reversibility.plan.json";
  await writeNew(output, `${JSON.stringify(starterPlan, null, 2)}\n`);
  process.stdout.write(`✓ Starter plan written to ${output}\n`);
  return 0;
}

export async function run(args = process.argv.slice(2)): Promise<number> {
  const parsed = parseArgs(args);
  if (
    !parsed.command ||
    parsed.command === "help" ||
    parsed.command === "--help" ||
    parsed.command === "-h" ||
    parsed.flags.has("help")
  ) {
    process.stdout.write(`${help}\n`);
    return 0;
  }
  if (parsed.command === "audit") return auditCommand(parsed);
  if (parsed.command === "compile") return compileCommand(parsed);
  if (parsed.command === "simulate") return simulateCommand(parsed);
  if (parsed.command === "verify") return verifyCommand(parsed);
  if (parsed.command === "diff") return diffCommand(parsed);
  if (parsed.command === "init") return initCommand(parsed);
  throw new Error(`Unknown command: ${parsed.command}\n\n${help}`);
}

const entrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (entrypoint) {
  run()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `Error: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
