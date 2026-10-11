import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { parseList } from "./parseList.js";
import { buildDataset } from "./buildDataset.js";
import { matchList } from "./matchList.js";
import { buildProfiles, compareMatch } from "./compare.js";

const ds = buildDataset("./data");
// the same attached-unit format as New Recruit, built from Astra Militarum units we have data for
const txt = `Prueba (135 Points)

Astra Militarum
Strike Force (135 Points)

ATTACHED UNITS

Attached unit 1

Tech-Priest Enginseer (45 Points)
  • Attached as: Leader (Character)
  • 1x Enginseer Axe
  • 1x Mechanicus pistol
  • 1x Servo-arm

Bullgryn Squad (90 Points)
  • Attached as: Bodyguard
  • 1x Bullgryn Bone 'ead
     ◦ 1x Brute shield
     ◦ 1x Bullgryn maul
     ◦ 1x Close combat weapon
  • 2x Bullgryn
     ◦ 2x Brute shield
     ◦ 2x Bullgryn maul
     ◦ 2x Close combat weapon

Exported with New Recruit v36.43, Data Version: v11
`;
const { list, warnings } = parseList(txt);
assert.deepEqual(warnings, []);
const rep = matchList(list, ds);
const { units } = buildProfiles(rep);
assert.equal(units.length, 1);                                  // leader + bodyguard = one unit
const [m] = units;
const separate = buildProfiles({ ...rep, units: rep.units.map((u) => ({ ...u, attachedGroup: null })) }).units;
const [priest, bull] = separate;
assert.equal(m.name, "Tech-Priest Enginseer + Bullgryn Squad");
assert.equal(m.points, 135);
assert.equal(m.models, priest.models + bull.models);
assert.equal(m.totalWounds, priest.totalWounds + bull.totalWounds);
assert.equal(m.weapons.length, priest.weapons.length + bull.weapons.length);
assert.equal(m.T, bull.T);                                      // toughness of the bodyguard
assert.equal(m.dmgReduce, bull.dmgReduce);                      // bodyguard ability still applies
assert.deepEqual(m.attachedLeaders, ["Tech-Priest Enginseer"]);

// it shows up as a single unit in the results, and the page is told about the leader
const r = compareMatch({ mode: "1v1", sideA: [rep], sideB: [rep] });
assert.equal(r.yourSide.units.length, 1);
assert.deepEqual(r.yourSide.units[0].lideres, ["Tech-Priest Enginseer"]);

// unattached lists are unchanged
const plain = parseList(readFileSync("./samples/astra-militarum-2000.txt", "utf8")).list;
assert.equal(buildProfiles(matchList(plain, ds)).units.length, 16);
console.log("Attached-unit checks passed.");
