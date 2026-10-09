// effects.js: reads the free-text unit abilities from the data and turns the SAFE, self-contained ones
// into numbers the engine can use. Anything conditional, attached to leaders, an aura, or phrased in an
// unexpected way is NOT applied (and is counted as "notApplied"), so nothing is invented.
// The `efecto` labels are shown to the user, so they are in Spanish; ability names stay in English.

const clean = (s) => String(s || "").replace(/\*\*|\^\^/g, "").replace(/\s+/g, " ").trim();
const keywordList = (s) => s.split(/\s*,\s*|\s+or\s+|\s+and\s+/i).map((x) => x.trim().toLowerCase()).filter(Boolean);
const OFFENSE = "^each time (?:this model|a model in this unit) makes (?:an? )?(ranged |melee )?attack(?: with its ([^,]+?))? that targets (?:an? )?(.+?) unit, ";

export function extractEffects(abilities) {
  const fx = { fnp: null, dmgReduce: 0, hitPenalty: 0, offense: [], applied: [], notApplied: 0 };
  const apply = (name, efecto) => fx.applied.push({ name, efecto });

  for (const a of abilities || []) {
    const t = clean(a.text);
    let m;
    if ((m = t.match(/^(?:models in this unit|this model) (?:have|has) (?:the )?feel no pain (\d)\+(?: ability)?(?!\s+against)/i))) {
      const n = +m[1];
      fx.fnp = fx.fnp ? Math.min(fx.fnp, n) : n;
      apply(a.name, `Feel No Pain ${n}+`);
    } else if ((m = t.match(/^each time an attack is allocated to (?:a model in this unit|this model), subtract (\d) from the damage characteristic of that attack\.?$/i))) {
      fx.dmgReduce = Math.max(fx.dmgReduce, +m[1]);
      apply(a.name, `−${m[1]} al daño de cada ataque recibido`);
    } else if (/^each time an attack targets this model, subtract 1 from the hit roll\.?$/i.test(t)) {
      fx.hitPenalty = 1;
      apply(a.name, "−1 para impactar a esta unidad");
    } else if ((m = t.match(new RegExp(OFFENSE + "(you can re-roll|add 1 to) the (hit|wound) roll\\.?$", "i")))) {
      const reroll = /re-roll/i.test(m[4]), roll = m[5].toLowerCase();
      fx.offense.push({ roll, kind: reroll ? "reroll" : "plus1", type: m[1] ? m[1].trim().toLowerCase() : null, weapon: m[2] ? m[2].toLowerCase() : null, vs: keywordList(m[3]) });
      apply(a.name, `${reroll ? "repite" : "+1 a"} la tirada para ${roll === "hit" ? "impactar" : "herir"} contra ${m[3]}${m[2] ? ` (solo ${m[2]})` : ""}`);
    } else if ((m = t.match(/^each time a model in this unit makes an attack, re-roll a (hit|wound) roll of 1\b/i))) {
      const roll = m[1].toLowerCase();
      fx.offense.push({ roll, kind: "ones", type: null, weapon: null, vs: null });
      apply(a.name, `repite los 1 al ${roll === "hit" ? "impactar" : "herir"}`);
    } else {
      fx.notApplied++;
    }
  }
  return fx;
}
