// matchList.js
// Links a parsed army list (from parseList.js) to datasheets in the dataset (from buildDataset.js).
// Nothing is guessed: anything that does not match is reported, not invented.

import { norm } from "./buildDataset.js";

const stripTags = (s) => norm(s).replace(/\s*\[[^\]]*\]\s*/g, " ").trim(); // drop "[Legends]" etc.

export function makeLookup(dataset) {
  const byName = new Map();
  for (const u of dataset.units) {
    for (const key of new Set([norm(u.name), stripTags(u.name)])) {
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(u);
    }
  }
  return byName;
}

function pickUnit(candidates, faction) {
  if (!candidates || candidates.length === 0) return null;
  const f = norm(faction);
  return candidates.find((u) => f && norm(u.faction).includes(f)) || candidates[0];
}

// Exact name first. If the datasheet has only one distinct stat line (squads where the sergeant
// shares the troopers' stats), that line applies to every model group. Otherwise: no guess.
function findModel(unitData, name) {
  const key = norm(name);
  const exact = unitData.models.find((m) => norm(m.name) === key);
  if (exact) return { ...exact, source: "name" };
  const sig = (m) => [m.M, m.T, m.Sv, m.W, m.LD, m.OC, m.InSv].join("/");
  const distinct = new Set(unitData.models.map(sig));
  if (unitData.models.length > 0 && distinct.size === 1) return { ...unitData.models[0], source: "datasheet" };
  return null;
}

export function matchList(list, dataset) {
  const lookup = makeLookup(dataset);
  const report = { faction: list.faction, units: [], summary: {} };
  let unitsMatched = 0, weaponLines = 0, weaponsMatched = 0;
  const gear = new Set();

  for (const u of list.units) {
    const data = pickUnit(lookup.get(norm(u.name)) || lookup.get(stripTags(u.name)), list.faction);
    const entry = { name: u.name, points: u.points, section: u.section, matched: !!data, models: [], weapons: [], notWeapons: [] };

    if (!data) { report.units.push(entry); continue; }
    unitsMatched++;
    entry.datasheet = { name: data.name, faction: data.faction, keywords: data.keywords };

    // Models and their stat lines
    if (u.models.length > 0) {
      for (const m of u.models) {
        const stat = findModel(data, m.name);
        entry.models.push({ name: m.name, count: m.count, stats: stat });
      }
    } else {
      // single-model unit: use the datasheet's first stat line
      entry.models.push({ name: data.models[0]?.name ?? u.name, count: 1, stats: data.models[0] ?? null });
    }

    // Wargear lines: flat ones on single-model units and per-model ones in squads
    const lines = [
      ...u.wargear.map((w) => ({ ...w, owner: null })),
      ...u.models.flatMap((m) => m.wargear.map((w) => ({ ...w, owner: m.name }))),
    ];
    for (const w of lines) {
      const hit = data.weapons[norm(w.name)];
      if (hit) {
        weaponLines++; weaponsMatched++;
        entry.weapons.push({ name: w.name, count: w.count, owner: w.owner, variants: hit.variants });
      } else {
        entry.notWeapons.push({ name: w.name, count: w.count, owner: w.owner });
        gear.add(w.name);
      }
    }
    report.units.push(entry);
  }

  report.summary = {
    units: list.units.length,
    unitsMatched,
    unitsUnmatched: report.units.filter((x) => !x.matched).map((x) => x.name),
    modelGroupsWithoutStats: report.units.flatMap((x) =>
      x.models.filter((m) => !m.stats).map((m) => `${x.name} / ${m.name}`)),
    weaponLinesMatched: weaponsMatched,
    linesWithoutWeaponProfile: [...gear].sort(), // wargear that has no weapon profile (shields, vox-casters, mines...)
  };
  return report;
}
