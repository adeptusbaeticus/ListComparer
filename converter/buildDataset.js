// buildDataset.js
// Turns the BSData wh40k-11e catalogue JSON files into one clean dataset for the app.
//
// CLI:  node buildDataset.js <folder with BSData .json files> <output.json>
// API:  import { buildDataset } from "./buildDataset.js";

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { norm } from "./norm.js";
export { norm };

const SKIP_LINK_NAMES = new Set(["weapon modifications", "crusade"]);
const WEAPON_TYPES = { "Ranged Weapons": "ranged", "Melee Weapons": "melee" };

function loadCatalogues(dir) {
  const cats = [];
  for (const f of readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".json")).sort()) {
    let d;
    try { d = JSON.parse(readFileSync(join(dir, f), "utf8")); } catch { continue; }
    const c = d.catalogue || d.gameSystem;
    if (c) cats.push({ file: f, c });
  }
  return cats;
}

function buildIndex(cats) {
  const idx = new Map();
  const walk = (x) => {
    if (Array.isArray(x)) { for (const v of x) walk(v); return; }
    if (x && typeof x === "object") {
      if (typeof x.id === "string" && typeof x.name === "string" && !idx.has(x.id)) idx.set(x.id, x);
      for (const v of Object.values(x)) walk(v);
    }
  };
  for (const { c } of cats) walk(c);
  return idx;
}

const chars = (p) => Object.fromEntries((p.characteristics || []).map((c) => [c.name, c.$text ?? ""]));

// Follow every nested entry and every link under one unit, collecting profiles and keywords.
function collectUnit(root, idx) {
  const seen = new Set();
  const profiles = [];
  const keywords = new Set();
  const warnings = new Set();

  const visit = (e) => {
    if (!e || seen.has(e)) return;
    seen.add(e);
    for (const p of e.profiles || []) profiles.push(p);
    for (const l of e.infoLinks || []) {
      if (l.type === "profile") {
        const t = idx.get(l.targetId);
        if (t) profiles.push(t); else warnings.add(`unresolved profile link: ${l.name}`);
      }
    }
    for (const cl of e.categoryLinks || []) keywords.add(cl.name);
    for (const k of ["selectionEntries", "selectionEntryGroups"]) for (const s of e[k] || []) visit(s);
    for (const l of e.entryLinks || []) {
      if (SKIP_LINK_NAMES.has(norm(l.name))) continue;
      const t = idx.get(l.targetId);
      if (t) visit(t); else warnings.add(`unresolved link: ${l.name}`);
    }
  };
  visit(root);
  return { profiles, keywords, warnings };
}

// "➤ Plasma gun - supercharge" -> { base: "Plasma gun", mode: "supercharge" }
function splitWeaponName(name) {
  const n = name.replace(/^➤\s*/, "");
  const m = n.match(/^(.*?)\s+-\s+(.+)$/);
  return m && /^➤/.test(name) ? { base: m[1], mode: m[2] } : { base: n, mode: null };
}

function weaponStats(p) {
  const c = chars(p);
  return {
    range: c.Range ?? "",
    attacks: c.A ?? "",
    skill: c.BS ?? c.WS ?? "",
    strength: c.S ?? "",
    ap: c.AP ?? "",
    damage: c.D ?? "",
    keywords: c.Keywords ?? "",
  };
}

export function buildDataset(dir) {
  const cats = loadCatalogues(dir);
  const idx = buildIndex(cats);
  const units = [];
  const problems = [];

  for (const { file, c } of cats) {
    if (c.library) continue; // libraries hold definitions; faction catalogues say which units exist
    const roots = [];
    for (const l of c.entryLinks || []) {
      if (l.type !== "selectionEntry") continue;
      const t = idx.get(l.targetId);
      if (t && (t.type === "unit" || t.type === "model")) roots.push(t);
      else if (!t) problems.push(`${file}: unresolved unit link "${l.name}"`);
    }
    for (const e of c.selectionEntries || []) if (e.type === "unit" || e.type === "model") roots.push(e);

    for (const root of roots) {
      const { profiles, keywords, warnings } = collectUnit(root, idx);

      const models = [];
      const seenModels = new Set();
      const weapons = {};
      for (const p of profiles) {
        if (p.typeName === "Unit") {
          const c2 = chars(p);
          const key = norm(p.name) + JSON.stringify(c2);
          if (seenModels.has(key)) continue;
          seenModels.add(key);
          models.push({ name: p.name, M: c2.M, T: c2.T, Sv: c2.Sv, W: c2.W, LD: c2.LD, OC: c2.OC, InSv: c2.InSv || null });
        } else if (WEAPON_TYPES[p.typeName]) {
          const { base, mode } = splitWeaponName(p.name);
          const key = norm(base);
          const variant = { type: WEAPON_TYPES[p.typeName], mode, ...weaponStats(p) };
          const list = (weapons[key] ||= { name: base, variants: [] });
          const sig = JSON.stringify(variant);
          if (!list.variants.some((v) => JSON.stringify(v) === sig)) list.variants.push(variant);
        }
      }

      const ptsCost = (root.costs || []).find((x) => x.name === "pts");
      units.push({
        name: root.name,
        faction: c.name,
        points: ptsCost && ptsCost.value > 0 ? ptsCost.value : null, // null = depends on squad size
        keywords: [...keywords].sort(),
        models,
        weapons,
      });
      for (const w of warnings) if (!/Weapon Modifications|Enhancements/.test(w)) problems.push(`${root.name}: ${w}`);
    }
  }

  return {
    generated: new Date().toISOString(),
    catalogues: cats.filter((x) => !x.c.library).map((x) => x.file),
    unitCount: units.length,
    units,
    problems,
  };
}

// CLI
if (process.argv[1] && process.argv[1].endsWith("buildDataset.js") && process.argv.length >= 4) {
  const ds = buildDataset(process.argv[2]);
  writeFileSync(process.argv[3], JSON.stringify(ds));
  console.log(`Wrote ${process.argv[3]}: ${ds.unitCount} units from ${ds.catalogues.length} catalogue(s), ${ds.problems.length} problem(s).`);
}
