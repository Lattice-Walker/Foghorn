/**
 * Enforces G5 (docs/rules.md §10): the brute-force exact-cover solver must be
 * unreachable from the technique-solving and rating path.
 *
 * This is the module boundary the rule asks for, checked rather than trusted —
 * a single import here would silently turn "provably solvable by techniques"
 * into "solvable by search", and no other test would notice.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ENGINE = fileURLToPath(new URL("..", import.meta.url));

/** Only these may reach into the quarantine. Authoring, not proving. */
const ALLOWED = new Set(["generate.ts"]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "exact-cover" || entry === "__tests__") continue;
      out.push(...sourceFiles(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("exact-cover quarantine (G5)", () => {
  const files = sourceFiles(ENGINE);

  it("finds engine sources to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("keeps brute force out of everything but the allowlist", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(ENGINE, file);
      if (ALLOWED.has(rel)) continue;
      if (/from\s+["'][^"']*exact-cover/.test(readFileSync(file, "utf8"))) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("names only files that exist in the allowlist", () => {
    const names = new Set(files.map((f) => relative(ENGINE, f)));
    for (const allowed of ALLOWED) expect(names).toContain(allowed);
  });
});
