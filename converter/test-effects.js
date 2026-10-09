import assert from "node:assert/strict";
import { extractEffects } from "./effects.js";

const ab = (name, text) => ({ name, text });
const one = (name, text) => extractEffects([ab(name, text)]);

// recognised, self-contained abilities (texts copied from the data)
assert.equal(one("Grizzled", "Models in this unit have the Feel No Pain 6+ ability and you can re-roll failed Out of Action tests taken for this unit.").fnp, 6);
assert.equal(one("Wall of Muscle", "Each time an attack is allocated to a model in this unit, subtract 1 from the Damage characteristic of that attack.").dmgReduce, 1);
assert.equal(one("Armoured Frontis", "Each time an attack is allocated to this model, subtract 1 from the Damage characteristic of that attack.").dmgReduce, 1);
assert.equal(one("Agile Dogfighter", "Each time an attack targets this model, subtract 1 from the Hit roll.").hitPenalty, 1);
const mh = one("Mobile Hunter-killers", "Each time a model in this unit makes an attack that targets a **^^Monster^^** or **^^Vehicle^^** unit, you can re-roll the Wound roll.").offense[0];
assert.deepEqual(mh, { roll: "wound", kind: "reroll", type: null, weapon: null, vs: ["monster", "vehicle"] });
const tk = one("Tank-killer", "Each time this model makes a ranged attack with its vanquisher battle cannon that targets a **^^Monster^^** or **^^Vehicle^^** unit, you can re-roll the Wound roll.").offense[0];
assert.equal(tk.weapon, "vanquisher battle cannon"); assert.equal(tk.type, "ranged");
assert.equal(one("Tank Hunter", "Each time this model makes a ranged attack that targets a Vehicle unit, add 1 to the Wound roll").offense[0].kind, "plus1");
assert.equal(one("Storm Troopers", "Each time a model in this unit makes an attack, re-roll a Wound roll of 1. If the target of that attack is an enemy unit within range of an objective marker, you can re-roll the Wound roll instead.").offense[0].kind, "ones");

// conditional, leader, aura or situational abilities must NOT be applied
for (const [n, t] of [
  ["Ogryn Bodyguard", "While one or more Officer models are in the same unit as this model, those Officer models have the Feel No Pain 4+ ability"],
  ["Malign Wardings", "While this model is leading a unit, models in that unit have the Feel No Pain 4+ ability against Psychic Attacks."],
  ["Psychic Blank", "This model has Feel No Pain 4+ against psychic attacks and mortal wounds."],
  ["Medicae Medi-packs", "Whilst this unit contains one or more Medicae Servitors, models in this unit have the Feel No Pain 5+ ability."],
  ["Urban Warfare", "Each time a ranged attack targets this model, if this model has the Benefit of Cover against that attack, subtract 1 from the Damage characteristic of that attack."],
  ["Damaged", "While this model has 1-4 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll."],
  ["Flak Battery", "Each time this model makes an attack that targets a unit that can Fly, you can re-roll the Hit roll."],
  ["Jungle Fighters", "Each time a model in this unit makes a melee attack, if this unit made a Charge move or was charged this turn, add 1 to the Wound roll."],
]) {
  const r = one(n, t);
  assert.equal(r.applied.length, 0, `${n} must not be applied`);
  assert.equal(r.notApplied, 1);
}
console.log("Effects checks passed.");
