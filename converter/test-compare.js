import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { parseList } from "./parseList.js";
import { buildDataset } from "./buildDataset.js";
import { matchList } from "./matchList.js";
import { woundNeeded, parseDice, weaponDamage, compareMatch, buildProfiles, DEFAULT_CONFIG } from "./compare.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// --- rules maths on synthetic profiles (hand-checked) ---
assert.deepEqual([[8, 4], [5, 4], [4, 4], [3, 4], [2, 4], [4, 9], [3, 12], [3, 5]].map(([s, t]) => woundNeeded(s, t)), [2, 3, 4, 5, 6, 6, 6, 5]); // half the toughness or less needs 6+
close(parseDice("D6").reduce((a, o) => a + o.v * o.p, 0), 3.5);
close(parseDice("2D6+1").reduce((a, o) => a + o.v * o.p, 0), 8);
assert.equal(parseDice("banana"), null);

const kw = (...k) => new Set(k);
const chimera = { T: 9, save: 3, invuln: null, W: 11, keywords: kw("vehicle") };
// meltagun-like: A1, 3+ to hit (2/3), S9 vs T9 = 4+ (1/2), AP-4 vs 3+ = no save, D6 -> 3.5
close(weaponDamage({ type: "ranged", attacks: "1", skill: "3+", strength: "9", ap: "-4", damage: "D6", keywords: "" }, 1, chimera).dmg, (2 / 3) * (1 / 2) * 1 * 3.5);
// lasgun-like: A1, 4+ (1/2), S3 vs T9 = 6+ (1/6), AP0 vs 3+ -> fails 1/3, D1
close(weaponDamage({ type: "ranged", attacks: "1", skill: "4+", strength: "3", ap: "0", damage: "1", keywords: "" }, 2, chimera).dmg, 2 * (1 / 2) * (1 / 6) * (1 / 3));
// invulnerable 4++ beats a bad modified save: AP-4 vs 3+ gives 7+, invuln 4+ saves half
close(weaponDamage({ type: "ranged", attacks: "1", skill: "3+", strength: "9", ap: "-4", damage: "1", keywords: "" }, 1, { ...chimera, invuln: 4 }).dmg, (2 / 3) * (1 / 2) * (1 / 2) * 1);
// damage is capped by model wounds: D6 against 1-wound models counts as 1
close(weaponDamage({ type: "ranged", attacks: "1", skill: "3+", strength: "9", ap: "-4", damage: "D6", keywords: "" }, 1, { ...chimera, T: 3, W: 1, save: 6 }).dmg, (2 / 3) * (5 / 6) * 1 * 1);
// torrent auto-hits; one shot is excluded; anti only applies to the right keyword
close(weaponDamage({ type: "ranged", attacks: "1", skill: "N/A", strength: "3", ap: "0", damage: "1", keywords: "Torrent" }, 1, { ...chimera, T: 3, save: 7 }).dmg, 1 * (1 / 2) * 1);
assert.equal(weaponDamage({ type: "ranged", attacks: "1", skill: "3+", strength: "9", ap: "-4", damage: "1", keywords: "One Shot" }, 1, chimera).dmg, 0);
const anti = { type: "ranged", attacks: "1", skill: "3+", strength: "4", ap: "0", damage: "1", keywords: "Anti-Vehicle 4+" };
assert.ok(weaponDamage(anti, 1, chimera).dmg > weaponDamage(anti, 1, { ...chimera, keywords: kw("infantry") }).dmg);


// --- abilities in the maths (hand-checked) ---
const meltaV = { type: "ranged", attacks: "1", skill: "3+", strength: "9", ap: "-4", damage: "D6", keywords: "" };
const base = { ...chimera };
const noFnp = weaponDamage(meltaV, 1, base).dmg;
close(weaponDamage(meltaV, 1, { ...base, fnp: 5 }).dmg, noFnp * (4 / 6));            // Feel No Pain 5+ ignores 1/3 of damage
close(weaponDamage(meltaV, 1, { ...base, dmgReduce: 1 }).dmg, (2 / 3) * (1 / 2) * 1 * ((1 + 1 + 2 + 3 + 4 + 5) / 6)); // D6-1, never below 1
close(weaponDamage(meltaV, 1, { ...base, hitPenalty: 1 }).dmg, (1 / 2) * (1 / 2) * 1 * 3.5); // 3+ becomes 4+ to hit
const woundFx = [{ roll: "wound", kind: "reroll", type: null, weapon: null, vs: ["vehicle"] }];
close(weaponDamage(meltaV, 1, base, { weapon: "Meltagun", offense: woundFx }).dmg, (2 / 3) * (1 - (1 / 2) ** 2) * 1 * 3.5);
close(weaponDamage(meltaV, 1, { ...base, keywords: kw("infantry") }, { weapon: "Meltagun", offense: woundFx }).dmg, (2 / 3) * (1 / 2) * 1 * 3.5); // wrong target keyword: no effect
const cannonFx = [{ roll: "wound", kind: "plus1", type: "ranged", weapon: "vanquisher battle cannon", vs: null }];
assert.ok(weaponDamage(meltaV, 1, base, { weapon: "Vanquisher battle cannon", offense: cannonFx }).dmg > noFnp);
close(weaponDamage(meltaV, 1, base, { weapon: "Meltagun", offense: cannonFx }).dmg, noFnp); // other weapon: no effect

// --- full engine on the sample list ---
const ds = buildDataset("./data");
const { list } = parseList(readFileSync("./samples/astra-militarum-2000.txt", "utf8"));
const rep = matchList(list, ds);
// a second, infantry-heavy list made from the sample's own units
const infantryUnits = ["Catachan Jungle Fighters", "Kasrkin", "Bullgryn Squad", "Chimera", "Hellhound", "Hippogriff AFV"];
const rep2 = { ...rep, units: rep.units.filter((u) => infantryUnits.includes(u.name)) };

// --- real data: the unit's own abilities reach the engine (needs the matched sample list, built below) ---
const profs = buildProfiles(rep).units;
const bull = profs.find((u) => u.name === "Bullgryn Squad");
assert.ok(bull.dmgReduce >= 1, "Bullgryn Squad should have its damage reduction applied");
assert.equal(profs.find((u) => u.name === "Chimera").dmgReduce, 0);
assert.equal(profs.find((u) => u.name === "Leman Russ Vanquisher").fx.offense.some((e) => e.weapon === "vanquisher battle cannon"), true);


const r = compareMatch({ mode: "1v1", sideA: [rep], sideB: [rep2] });
const find = (arr, name) => arr.find((u) => u.name === name);
const labelOf = (unit, enemy) => ["good", "regular", "bad"].find((l) => unit[l].some((x) => x.name === enemy));

// sanity: all outputs are finite and every enemy unit lands in exactly one bucket
for (const u of r.yourSide.units) {
  assert.equal(u.good.length + u.regular.length + u.bad.length, new Set(rep2.units.map((x) => x.name + x.points)).size);
  assert.equal(u.pct.good + u.pct.regular + u.pct.bad >= 98 && u.pct.good + u.pct.regular + u.pct.bad <= 102, true);
}
// direction checks that any sane engine must satisfy
assert.equal(labelOf(find(r.yourSide.units, "Leman Russ Exterminator"), "Catachan Jungle Fighters"), "good");
assert.equal(labelOf(find(r.opponentSide.units, "Catachan Jungle Fighters"), "Rogal Dorn Commander"), "bad");

// "struggles": a weak list (lasguns and a priest) cannot handle the Dorns and tanks; the big list has no such problem with it
const weak = { ...rep, units: rep.units.filter((u) => ["Catachan Jungle Fighters", "Tech-Priest Enginseer"].includes(u.name)) };
const strong = { ...rep, units: rep.units.filter((u) => ["Rogal Dorn Commander", "Leman Russ Battle Tank"].includes(u.name)) };
const lopsided = compareMatch({ mode: "1v1", sideA: [weak], sideB: [strong] });
const trouble = lopsided.yourSide.struggles.map((x) => x.name);
assert.ok(trouble.includes("Rogal Dorn Commander") && trouble.includes("Leman Russ Battle Tank"));
assert.ok(lopsided.yourSide.struggles.every((x) => x.pressurePct < 75));
assert.deepEqual(lopsided.opponentSide.struggles, []); // the strong list handles lasguns and a priest easily

// a list against itself is symmetric
const mirror = compareMatch({ mode: "1v1", sideA: [rep], sideB: [rep] });
const sameUnit = (a, b) => a.name === b.name && a.points === b.points;
for (const u of mirror.yourSide.units) {
  for (const [mine, theirs] of [["good", "bad"], ["bad", "good"], ["regular", "regular"]]) {
    for (const e of u[mine]) {
      const other = mirror.yourSide.units.find((x) => sameUnit(x, e));
      assert.ok(other[theirs].some((x) => sameUnit(x, u)), `${u.name} ${mine} vs ${e.name} should be ${theirs} the other way`);
    }
  }
}

// 2v2 combines each side's two lists; wrong list counts and the team placeholder are rejected
const two = compareMatch({ mode: "2v2", sideA: [rep, rep2], sideB: [rep2, rep] });
assert.equal(two.yourSide.units.reduce((n, u) => n + u.count, 0), rep.units.length + rep2.units.length);
assert.throws(() => compareMatch({ mode: "2v2", sideA: [rep], sideB: [rep] }));
assert.throws(() => compareMatch({ mode: "team", sideA: [], sideB: [] }), /not implemented/);

console.log("All checks passed.");
