// checks.js: safety checks run before a new dataset is published.
// CLI: node checks.js <new-dataset.json> [<previous-dataset.json>]
// Exits with code 1 (so the update job stops and the old data stays live) if anything looks wrong.

import { readFileSync, existsSync } from "node:fs";
import { parseList } from "./parseList.js";
import { matchList } from "./matchList.js";

export function runChecks(dataset, previous, sampleText) {
  const errors = [];

  if (!dataset.units || dataset.units.length < 50) errors.push(`Too few units (${dataset.units?.length ?? 0})`);

  // The unit count must not drop sharply compared with the last published dataset.
  if (previous?.units?.length) {
    const drop = 1 - dataset.units.length / previous.units.length;
    if (drop > 0.1) errors.push(`Unit count fell ${(drop * 100).toFixed(0)}% (${previous.units.length} -> ${dataset.units.length})`);
  }

  // Every unit should still have at least one stat line.
  const noStats = dataset.units.filter((u) => u.models.length === 0).map((u) => u.name);
  if (noStats.length > 0) errors.push(`${noStats.length} unit(s) have no stat line, e.g. ${noStats.slice(0, 3).join(", ")}`);

  // The known-good sample list must still parse and match every unit.
  if (sampleText) {
    const { list, warnings } = parseList(sampleText);
    if (warnings.length) errors.push(`Sample list parse warnings: ${warnings.join("; ")}`);
    const rep = matchList(list, dataset);
    if (rep.summary.unitsUnmatched.length) errors.push(`Sample list units not matched: ${rep.summary.unitsUnmatched.join(", ")}`);
    if (rep.summary.modelGroupsWithoutStats.length) errors.push(`Sample list models without stats: ${rep.summary.modelGroupsWithoutStats.join(", ")}`);
  }
  return errors;
}

if (process.argv[1] && process.argv[1].endsWith("checks.js") && process.argv.length >= 3) {
  const ds = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const prev = process.argv[3] && existsSync(process.argv[3]) ? JSON.parse(readFileSync(process.argv[3], "utf8")) : null;
  const samplePath = new URL("./samples/astra-militarum-2000.txt", import.meta.url);
  const errors = runChecks(ds, prev, existsSync(samplePath) ? readFileSync(samplePath, "utf8") : null);
  if (errors.length) { console.error("CHECKS FAILED:\n- " + errors.join("\n- ")); process.exit(1); }
  console.log(`Checks passed: ${ds.units.length} units.`);
}
