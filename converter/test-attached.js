import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
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
// --- a leader with "this model" damage halving: only the leader's share of the unit is protected ---
import { unitDamage, weaponDamage } from "./compare.js";
const ds2 = structuredClone(ds);
ds2.units.find((u) => u.name === "Tech-Priest Enginseer").abilities.push({ name: "Refuse to Yield", text: "Each time an attack is allocated to this model, halve the Damage characteristic of that attack." });
const prot = buildProfiles(matchList(list, ds2)).units[0];
assert.equal(prot.segments.length, 2);
assert.equal(prot.segments[0].def.halve, true);        // the leader
assert.equal(prot.segments[1].def.halve, false);       // the bodyguard
close(prot.segments[0].share + prot.segments[1].share, 1);
close(prot.segments[0].share, priest.totalWounds / (priest.totalWounds + bull.totalWounds));
assert.ok(prot.fx.applied.some((x) => x.name === "Refuse to Yield" && /solo afecta al líder/.test(x.efecto)));
const meltaV = { type: "ranged", attacks: "1", skill: "3+", strength: "9", ap: "-4", damage: "D6", keywords: "" };
const att = { weapons: [{ name: "Meltagun", count: 6, variants: [meltaV] }], fx: { offense: [] } };
const plainDmg = unitDamage(att, m), halvedDmg = unitDamage(att, prot);
assert.ok(halvedDmg < plainDmg, "halving the leader's damage must reduce the damage taken");
const expected = prot.segments.reduce((n, s) => n + s.share * weaponDamage(meltaV, 6, s.def, { weapon: "Meltagun" }).dmg, 0);
close(halvedDmg, expected);
// the effect is only a fraction of the unit, not all of it
assert.ok(halvedDmg > prot.segments[1].share * plainDmg);

console.log("Attached-unit checks passed.");
