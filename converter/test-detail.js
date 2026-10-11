import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { parseList } from "./parseList.js";
import { buildDataset } from "./buildDataset.js";
import { matchList } from "./matchList.js";
import { compareMatch, damageBreakdown, unitDamage, buildProfiles } from "./compare.js";

const ds = buildDataset("./data");
const rep = matchList(parseList(readFileSync("./samples/astra-militarum-2000.txt", "utf8")).list, ds);
const keep = ["Catachan Jungle Fighters", "Kasrkin", "Bullgryn Squad", "Chimera", "Hellhound", "Hippogriff AFV"];
const rep2 = { ...rep, units: rep.units.filter((u) => keep.includes(u.name)) };
const r = compareMatch({ mode: "1v1", sideA: [rep], sideB: [rep2] });

let pairs = 0;
for (const side of [r.yourSide, r.opponentSide]) {
  for (const u of side.units) for (const label of ["good", "regular", "bad"]) for (const e of u[label]) {
    pairs++;
    const d = e.detalle;
    assert.equal(d.tipo, "par"); assert.equal(d.etiqueta, label);
    for (const k of ["ataque", "defensa"]) {
      for (const n of [d[k].heridas, d[k].de, d[k].pct, d[k].puntos]) assert.ok(Number.isFinite(n));
      assert.ok(d[k].pct >= 0 && d[k].pct <= 100 && d[k].armas.length <= 3);
      const ws = d[k].armas.reduce((n, w) => n + w.pct, 0);
      assert.ok(ws <= 101 && (d[k].armas.length === 0 || ws > 0));
      for (const w of d[k].armas) assert.ok(w.info === null || Number.isFinite(w.info.wound));
    }
    // the label and the shown advantage agree
    if (label === "good") assert.ok(d.ventaja > 25); if (label === "bad") assert.ok(d.ventaja < -25);
    if (label === "regular") assert.ok(d.despreciable || Math.abs(d.ventaja) <= 25);
  }
  for (const p of side.pressure) {
    assert.equal(p.detalle.tipo, "presion"); assert.ok(p.detalle.mejores.length <= 3); assert.equal(p.detalle.total, p.pressurePct);
  }
}
assert.ok(pairs > 20);

// the breakdown adds up to the same number the labels are based on
const { units } = buildProfiles(rep);
const [a, b] = [units.find((u) => u.name === "Leman Russ Exterminator"), units.find((u) => u.name === "Chimera")];
const bd = damageBreakdown(a, b);
assert.ok(Math.abs(bd.total - unitDamage(a, b)) < 1e-12);
assert.ok(Math.abs(bd.weapons.reduce((n, w) => n + w.dmg, 0) - bd.total) < 1e-9);

// everything the page receives survives a JSON round trip with no NaN turning into null
const text = JSON.stringify(r);
assert.ok(!/"(heridas|pct|puntos|dmg|ventaja)":null/.test(text));
console.log(`Detail checks passed (${pairs} explained matchups, ${(text.length / 1024).toFixed(0)} KB of results).`);

// the bubble text: complete, in Spanish, no leftovers of undefined / NaN / null
const { htmlPar, htmlPresion } = await import("./explain-html.js");
let bubbles = 0;
for (const side of [r.yourSide, r.opponentSide]) {
  for (const u of side.units) for (const l of ["good", "regular", "bad"]) for (const e of u[l]) {
    const h = htmlPar(e.detalle); bubbles++;
    assert.ok(!/undefined|NaN|null|\[object/.test(h), h.slice(0, 200));
    assert.ok(h.includes("Lo que hace") && h.includes("Estadísticas") && h.includes("Habilidades que afectan"));
  }
  for (const p of side.pressure) assert.ok(!/undefined|NaN|null/.test(htmlPresion(p.detalle)));
}
const any = r.yourSide.units.flatMap((u) => [...u.good, ...u.regular, ...u.bad])[0].detalle;
assert.ok(htmlPar({ ...any, yo: { ...any.yo, nombre: "<b>x</b>" } }).includes("&lt;b&gt;x")); // names are escaped
console.log(`Bubble text checks passed (${bubbles} bubbles).`);
