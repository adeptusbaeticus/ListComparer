import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { parseList } from "./parseList.js";
import { buildDataset } from "./buildDataset.js";
import { matchList } from "./matchList.js";
import { runChecks } from "./checks.js";

const ds = buildDataset("./data");
const sample = readFileSync("./samples/astra-militarum-2000.txt", "utf8");
const { list } = parseList(sample);
const rep = matchList(list, ds);
const unit = (n, i = 0) => rep.units.filter((u) => u.name === n)[i];

assert.ok(ds.unitCount > 100);
assert.equal(rep.summary.units, 16);
assert.equal(rep.summary.unitsMatched, 16);
assert.deepEqual(rep.summary.unitsUnmatched, []);
assert.deepEqual(rep.summary.modelGroupsWithoutStats, []);
assert.deepEqual(rep.summary.linesWithoutWeaponProfile, ["Brute shield", "Melta mine", "Vox-caster"]);

// stat lines
assert.deepEqual(
  ["T", "W", "Sv"].map((k) => unit("Chimera").models[0].stats[k]), ["9", "11", "3+"]);
assert.equal(unit("Rogal Dorn Commander").models[0].stats.W, "18");
assert.equal(unit("Kasrkin").models[1].stats.T, "3");
assert.equal(unit("Bullgryn Squad").models[1].stats.W, "3");

// weapon profiles
const plasma = unit("Kasrkin").weapons.find((w) => w.name === "Plasma gun");
assert.deepEqual(plasma.variants.map((v) => v.mode).sort(), ["standard", "supercharge"]);
const melta = unit("Kasrkin").weapons.find((w) => w.name === "Meltagun").variants[0];
assert.equal(melta.strength, "9"); assert.equal(melta.ap, "-4"); assert.equal(melta.damage, "D6");
const hk = unit("Chimera").weapons.find((w) => w.name === "Hunter-killer missile").variants[0];
assert.equal(hk.keywords, "One Shot");

// safety checks accept this data, and reject broken data
assert.deepEqual(runChecks(ds, null, sample), []);
assert.ok(runChecks({ units: ds.units.slice(0, 10) }, ds, sample).length > 0);

console.log("All checks passed.");
console.log(`${ds.unitCount} units in dataset, ${rep.summary.unitsMatched}/16 list units matched, ${rep.summary.weaponLinesMatched} weapon lines matched.`);
