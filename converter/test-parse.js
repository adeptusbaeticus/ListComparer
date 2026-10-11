import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { parseList } from "./parseList.js";

const txt = readFileSync("./samples/space-wolves-1000.txt", "utf8");
const { list, warnings } = parseList(txt);
assert.deepEqual(warnings, []);               // no "unrecognised line" for the New Recruit trailer, "Attached unit N" or "Attached as:"
assert.equal(list.name, "[Gran Liga 2026/27 - Fase I] pedro96017's list");
assert.equal(list.totalPoints, 1000);
assert.equal(list.units.length, 7);
assert.equal(list.unitPointsSum, 1000);

const logan = list.units[0], term1 = list.units[1], arjac = list.units[2];
assert.deepEqual([logan.attachedGroup, logan.attachedAs, logan.warlord], [1, "Leader (Character)", true]);
assert.deepEqual([term1.attachedGroup, term1.attachedAs], [1, "Bodyguard"]);
assert.equal(arjac.attachedGroup, 2);
assert.equal(list.units[4].attachedGroup, null);  // units outside the attached section
assert.equal(list.units[4].attachedAs, null);
assert.deepEqual(term1.enhancements, ["Thirst for Glory"]);

// the trailer can change version and still be ignored, and it also works in the middle of a paste
for (const t of ["Exported with New Recruit v99.1, Data Version: v12", "Exported with New Recruit v1, Data Version: v3\n"]) {
  const r = parseList(txt.replace("Exported with New Recruit v36.43, Data Version: v11", t));
  assert.deepEqual(r.warnings, []);
  assert.equal(r.list.units.length, 7);
}
// a list without the trailer is just as fine
assert.deepEqual(parseList(txt.replace(/Exported with.*$/m, "")).warnings, []);
console.log("Parser checks (trailer + attached units) passed.");
