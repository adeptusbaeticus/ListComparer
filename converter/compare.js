// compare.js
// General matchup engine. For every unit it answers: good / regular / bad against which enemy units,
// and for each side: which enemy units the whole list struggles to deal with.
//
// Everything is an average-dice estimate of ONE round, with basic rules only:
// hit, wound, save (with AP and invulnerable), damage capped by model wounds, plus a few weapon keywords
// (Torrent, Twin-linked, Anti-X, Lethal Hits, Sustained Hits, Devastating Wounds) and the self-contained unit
// abilities that effects.js can read safely (Feel No Pain, damage reduction, -1 to be hit, re-rolls / +1 against
// certain targets). Ignored for now: range, movement, terrain, stratagems, leaders and auras, conditional
// abilities, Blast/Rapid Fire/Melta/Heavy, and One Shot weapons (excluded from per-round damage).

import { extractEffects } from "./effects.js";

export const DEFAULT_CONFIG = {
  meleeWeight: 0.5,       // melee damage counts this much compared with shooting (needs charging, etc.)
  goodMargin: 0.25,       // score above +margin = good, below -margin = bad, otherwise regular
  negligible: 0.05,       // if neither unit can remove 5% of the other, the matchup is regular
  topAnswers: 3,          // "struggles" looks at the best 3 units a list has against one enemy unit...
  pressureThreshold: 0.75, // ...and flags it when those 3 together remove less than 75% of it in a round
};

// ---------- dice and probabilities ----------

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rollProb = (n) => clamp((7 - n) / 6, 1 / 6, 5 / 6); // an "n+" roll: 6 always works, 1 never does
const saveProb = (n) => (n >= 7 ? 0 : clamp((7 - n) / 6, 0, 5 / 6));

export function woundNeeded(S, T) {
  if (S >= 2 * T) return 2;
  if (S > T) return 3;
  if (S === T) return 4;
  if (S * 2 <= T) return 6;
  return 5;
}

// "3", "D6", "D3+1", "2D6" -> [{v, p}] distribution, or null if unreadable
export function parseDice(expr) {
  const s = String(expr ?? "").trim().toUpperCase().replace(/\s/g, "");
  let m = s.match(/^(\d+)$/);
  if (m) return [{ v: +m[1], p: 1 }];
  m = s.match(/^(\d*)D(3|6)([+-]\d+)?$/);
  if (!m) return null;
  const n = m[1] ? +m[1] : 1, sides = +m[2], c = m[3] ? +m[3] : 0;
  let dist = new Map([[0, 1]]);
  for (let i = 0; i < n; i++) {
    const next = new Map();
    for (const [v, p] of dist) for (let f = 1; f <= sides; f++) next.set(v + f, (next.get(v + f) || 0) + p / sides);
    dist = next;
  }
  return [...dist].map(([v, p]) => ({ v: v + c, p }));
}
const mean = (d) => d.reduce((a, o) => a + o.v * o.p, 0);
const meanCapped = (d, cap, reduce = 0) => d.reduce((a, o) => a + Math.min(Math.max(o.v - reduce, 1), cap) * o.p, 0); // damage never drops below 1

function parseKeywords(str) {
  const k = { torrent: false, twin: false, lethal: false, dev: false, oneShot: false, sustained: 0, anti: [] };
  for (const part of String(str || "").split(",")) {
    const t = part.trim().toLowerCase();
    if (t === "torrent") k.torrent = true;
    else if (t === "twin-linked") k.twin = true;
    else if (t === "lethal hits") k.lethal = true;
    else if (t === "devastating wounds") k.dev = true;
    else if (t === "one shot") k.oneShot = true;
    else if (t.startsWith("sustained hits")) k.sustained = +(t.match(/\d+/)?.[0] || 1);
    else {
      const m = t.match(/^anti-(.+?)\s+(\d)\+$/);
      if (m) k.anti.push({ kw: m[1].trim(), n: +m[2] });
    }
  }
  return k;
}

// ---------- one weapon profile against one defender ----------

// v: {type, attacks, skill, strength, ap, damage, keywords}; count: how many of this weapon the unit has
// def: {T, save, invuln, W (wounds per model), keywords: Set, fnp?, dmgReduce?, hitPenalty?}
// mods: {weapon: weapon name, offense: effects of the attacking unit (see effects.js)}
export function weaponDamage(v, count, def, mods = {}) {
  const kw = parseKeywords(v.keywords);
  if (kw.oneShot) return { dmg: 0, skipped: "one shot" };
  const A = parseDice(v.attacks), D = parseDice(v.damage);
  const S = parseInt(v.strength, 10), AP = parseInt(v.ap, 10) || 0;
  const skill = parseInt(v.skill, 10);
  if (!A || !D || Number.isNaN(S) || (!kw.torrent && Number.isNaN(skill))) return { dmg: 0, skipped: "unreadable profile" };

  const wname = String(mods.weapon || "").toLowerCase();
  const fx = (mods.offense || []).filter((e) =>
    (!e.type || e.type === v.type) &&
    (!e.weapon || wname.includes(e.weapon) || e.weapon.includes(wname)) &&
    (!e.vs || e.vs.some((k) => def.keywords.has(k))));
  const has = (roll, kind) => fx.some((e) => e.roll === roll && e.kind === kind);

  const attacks = count * mean(A);
  let hitP = 1;
  if (!kw.torrent) {
    const mod = clamp((has("hit", "plus1") ? 1 : 0) - (def.hitPenalty || 0), -1, 1);
    hitP = rollProb(skill - mod);
    if (has("hit", "reroll")) hitP = 1 - (1 - hitP) ** 2;
    else if (has("hit", "ones")) hitP += hitP / 6;
  }
  const crits = kw.torrent ? 0 : attacks / 6;
  const hits = attacks * hitP + crits * kw.sustained;
  const lethalAuto = kw.lethal ? crits : 0;
  const rolls = hits - lethalAuto;

  let need = woundNeeded(S, def.T), critNeed = 6;
  for (const a of kw.anti) if (def.keywords.has(a.kw)) { need = Math.min(need, a.n); critNeed = Math.min(critNeed, a.n); }
  let pW = rollProb(has("wound", "plus1") ? need - 1 : need), pCrit = rollProb(critNeed);
  if (kw.twin || has("wound", "reroll")) { pW = 1 - (1 - pW) ** 2; pCrit = 1 - (1 - pCrit) ** 2; }
  else if (has("wound", "ones")) { pW += pW / 6; pCrit += pCrit / 6; }

  const woundsOk = rolls * pW + lethalAuto;
  const critW = kw.dev ? rolls * Math.min(pCrit, pW) : 0; // devastating: cannot be saved
  const normalW = woundsOk - critW;

  const modified = def.save - AP;
  const best = def.invuln ? Math.min(modified, def.invuln) : modified;
  const failP = 1 - saveProb(best);
  const fnpFail = def.fnp ? 1 - saveProb(def.fnp) : 1; // Feel No Pain also applies to mortal wounds

  return { dmg: (normalW * failP + critW) * fnpFail * meanCapped(D, def.W, def.dmgReduce || 0) };
}

// Expected wounds one unit removes from another in one round
export function unitDamage(att, def, cfg = DEFAULT_CONFIG) {
  let total = 0;
  for (const w of att.weapons) {
    let best = 0;
    for (const v of w.variants) {
      const r = weaponDamage(v, w.count, def, { weapon: w.name, offense: att.fx?.offense });
      const weighted = r.dmg * (v.type === "melee" ? cfg.meleeWeight : 1);
      if (weighted > best) best = weighted; // alternative firing modes: take the better one
    }
    total += best;
  }
  return total;
}

// fraction (0-1) of the defender's wounds removed in one round
export const fractionKilled = (att, def, cfg) => Math.min(1, unitDamage(att, def, cfg) / def.totalWounds);

// ---------- from a matched list to unit profiles ----------

const num = (s) => { const n = parseInt(s, 10); return Number.isNaN(n) ? null : n; };

export function buildProfiles(report, listIndex = 0) {
  const units = [], skipped = [];
  for (const u of report.units) {
    if (!u.matched) { skipped.push(`${u.name}: no datasheet`); continue; }
    const groups = u.models.filter((m) => m.stats);
    if (groups.length === 0) { skipped.push(`${u.name}: no stat line`); continue; }
    const main = [...groups].sort((a, b) => b.count - a.count)[0].stats;
    const totalWounds = groups.reduce((n, g) => n + g.count * (num(g.stats.W) ?? 1), 0);
    const fx = extractEffects(u.datasheet?.abilities);
    units.push({
      name: u.name,
      points: u.points,
      fx, fnp: fx.fnp, dmgReduce: fx.dmgReduce, hitPenalty: fx.hitPenalty,
      listIndex,
      models: groups.reduce((n, g) => n + g.count, 0),
      T: num(main.T), save: num(main.Sv), invuln: num(main.InSv),
      W: Math.max(...groups.map((g) => num(g.stats.W) ?? 1)),
      totalWounds,
      keywords: new Set((u.datasheet?.keywords || []).map((k) => k.toLowerCase())),
      weapons: u.weapons.map((w) => ({ name: w.name, count: w.count, variants: w.variants })),
    });
  }
  return { units, skipped };
}

// ---------- side against side ----------

const groupKey = (u) => `${u.name}|${u.points}`;

function groupUnits(units) {
  const map = new Map();
  for (const u of units) {
    const g = map.get(groupKey(u));
    if (g) g.count++; else map.set(groupKey(u), { unit: u, count: 1 });
  }
  return [...map.values()];
}

function labelFor(fMine, fTheirs, mine, theirs, cfg) {
  if (fMine < cfg.negligible && fTheirs < cfg.negligible) return { label: "regular", score: 0 };
  const dm = fMine * theirs.points, dt = fTheirs * mine.points;
  const score = dm + dt === 0 ? 0 : (dm - dt) / (dm + dt);
  return { label: score > cfg.goodMargin ? "good" : score < -cfg.goodMargin ? "bad" : "regular", score };
}

// One side's view: per-unit matchups, and which enemy units the whole list struggles with.
export function sideSummary(mine, theirs, cfg = DEFAULT_CONFIG) {
  const myGroups = groupUnits(mine), theirGroups = groupUnits(theirs);
  const theirPoints = theirGroups.reduce((n, g) => n + g.unit.points * g.count, 0);

  const units = myGroups.map(({ unit: m, count }) => {
    const buckets = { good: [], regular: [], bad: [] };
    for (const { unit: t, count: tc } of theirGroups) {
      const fMine = fractionKilled(m, t, cfg), fTheirs = fractionKilled(t, m, cfg);
      const { label, score } = labelFor(fMine, fTheirs, m, t, cfg);
      buckets[label].push({ name: t.name, count: tc, points: t.points, score: Math.round(score * 100) / 100 });
    }
    const pct = (arr) => theirPoints ? Math.round((arr.reduce((n, x) => n + x.points * x.count, 0) / theirPoints) * 100) : 0;
    return {
      name: m.name, count, points: m.points,
      habilidades: m.fx.applied, habilidadesSinAplicar: m.fx.notApplied,
      good: buckets.good, regular: buckets.regular, bad: buckets.bad,
      pct: { good: pct(buckets.good), regular: pct(buckets.regular), bad: pct(buckets.bad) },
    };
  });

  // Pressure: how much of each enemy unit my best few units remove together in one round.
  // Using the best 3 (not the whole list) keeps it realistic: a big list can always kill anything
  // if every unit shoots at it, so that would never flag a problem.
  const pressure = theirGroups.map(({ unit: t, count }) => {
    const best = mine.map((m) => fractionKilled(m, t, cfg)).sort((a, b) => b - a).slice(0, cfg.topAnswers);
    const p = Math.min(1, best.reduce((n, x) => n + x, 0));
    return { name: t.name, count, points: t.points, pressurePct: Math.round(p * 100) };
  });
  const struggles = pressure.filter((x) => x.pressurePct < cfg.pressureThreshold * 100)
    .sort((a, b) => a.pressurePct - b.pressurePct);

  return { units, pressure, struggles };
}

// mode "1v1": one list per side. mode "2v2": two lists per side, each side treated as one combined force.
// Team vs Team is a placeholder: the screen only asks for the team size, nothing is calculated yet.
export function compareMatch({ mode, sideA, sideB, config = {} }) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (mode === "team") throw new Error("Team vs Team is not implemented yet");
  const want = mode === "1v1" ? 1 : mode === "2v2" ? 2 : null;
  if (want === null) throw new Error(`Unknown mode: ${mode}`);
  if (sideA.length !== want || sideB.length !== want) throw new Error(`${mode} needs ${want} list(s) per side`);

  const build = (reports) => {
    const parts = reports.map((r, i) => buildProfiles(r, i));
    return { units: parts.flatMap((p) => p.units), skipped: parts.flatMap((p) => p.skipped) };
  };
  const a = build(sideA), b = build(sideB);
  return {
    mode,
    yourSide: sideSummary(a.units, b.units, cfg),      // your units vs theirs; "struggles" = enemy units you struggle with
    opponentSide: sideSummary(b.units, a.units, cfg),  // their units vs yours; "struggles" = your units they struggle with
    skipped: { yourSide: a.skipped, opponentSide: b.skipped },
    config: cfg,
  };
}
