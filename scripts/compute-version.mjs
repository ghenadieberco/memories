#!/usr/bin/env node
/*
 * Derives the app version from git history (FR-VER-1, D28).
 *
 * The version is never stored — it is a pure function of the repository, so
 * there is no bump commit to write back and no chance of the number drifting
 * from the code it labels. Prints the version to stdout; every other message
 * goes to stderr so `$(node scripts/compute-version.mjs)` stays clean.
 *
 * The baseline is the commit that last *changed* `version.config.json`, and
 * that commit is exactly `base`. This is what makes the scheme self-consistent:
 * editing the file to declare 2.0.0 makes that very commit 2.0.0, with nothing
 * else to keep in sync — no tags, no stored SHA (D28).
 *
 * Commits after the baseline replay conventional-commit rules, oldest first:
 *
 *   feat:                        -> minor++ (patch = 0)
 *   `!` or BREAKING CHANGE:      -> major++ (minor = patch = 0)
 *   anything else, prefix or not -> patch++
 *
 * "Anything else" is deliberate: the owner's rule is that every commit moves
 * the number (D28), so an unprefixed commit is a patch rather than a no-op.
 * Merge commits are skipped — their contents are counted through the branch
 * commits themselves, so counting both would double-bump.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_FILE = "version.config.json";

/** ASCII unit/record separators — safe against any character a message holds. */
const FIELD_SEP = "\x1f";
const RECORD_SEP = "\x1e";

function git(...args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function readBase() {
  const raw = JSON.parse(readFileSync(path.join(ROOT, CONFIG_FILE), "utf8"));
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(raw.base ?? "");
  if (!match) {
    throw new Error(
      `${CONFIG_FILE}: "base" must be a MAJOR.MINOR.PATCH string, got ${JSON.stringify(raw.base)}`,
    );
  }
  return match.slice(1, 4).map(Number);
}

/**
 * Commits since the baseline, oldest first, as `{ subject, body }`.
 *
 * An empty baseline means `version.config.json` has no commit touching it yet
 * — true only while this feature is itself uncommitted. Fall back to the base
 * version rather than replaying the entire history, which would otherwise
 * report a wildly different number for one commit's worth of time.
 */
function commitsSinceBaseline() {
  // A shallow clone is the dangerous failure: history is truncated, so the
  // baseline lookup finds the grafted tip and reports a stale version that
  // looks entirely plausible. Refuse rather than mislabel a deploy.
  if (git("rev-parse", "--is-shallow-repository") === "true") {
    throw new Error(
      "shallow clone — the full history is required to replay commits",
    );
  }

  const baseline = git("log", "-1", "--format=%H", "--", CONFIG_FILE);
  if (!baseline) {
    process.stderr.write(
      `warning: ${CONFIG_FILE} is not committed yet — reporting the base version.\n`,
    );
    return [];
  }

  // `--topo-order` replays in ancestry order, so a commit never lands before
  // its parent. Default date order is not enough: commits made in the same
  // second can sort arbitrarily, and if a merged branch's `feat:` sorts ahead
  // of a `BREAKING CHANGE:` the major bump resets the minor it just added, so
  // the same history yields two different versions.
  const log = git(
    "log",
    "--no-merges",
    "--topo-order",
    "--reverse",
    `--format=%s${FIELD_SEP}%b${RECORD_SEP}`,
    `${baseline}..HEAD`,
  );

  return log
    .split(RECORD_SEP)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [subject = "", body = ""] = record.split(FIELD_SEP);
      return { subject: subject.trim(), body: body.trim() };
    });
}

/** `feat!:`, `refactor(api)!:` and a `BREAKING CHANGE:` footer all mean major. */
function bumpFor({ subject, body }) {
  if (/^[a-zA-Z]+(\([^)]*\))?!:/.test(subject)) return "major";
  if (/^BREAKING[ -]CHANGE:/m.test(body)) return "major";
  if (/^feat(\([^)]*\))?:/.test(subject)) return "minor";
  return "patch";
}

function computeVersion() {
  let [major, minor, patch] = readBase();

  for (const commit of commitsSinceBaseline()) {
    switch (bumpFor(commit)) {
      case "major":
        major += 1;
        minor = 0;
        patch = 0;
        break;
      case "minor":
        minor += 1;
        patch = 0;
        break;
      default:
        patch += 1;
    }
  }

  return `${major}.${minor}.${patch}`;
}

try {
  process.stdout.write(`${computeVersion()}\n`);
} catch (error) {
  process.stderr.write(
    `Could not derive the app version: ${error instanceof Error ? error.message : error}\n` +
      "Needs a git checkout with full history — in CI, set `fetch-depth: 0`.\n",
  );
  process.exit(1);
}
