import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { buildDataset } from "./buildDataset.js";
import { analizar, traducirAviso } from "./ui-logic.js";

const ds = buildDataset("./data");
const txt = readFileSync("./samples/astra-militarum-2000.txt", "utf8");
const r = analizar({ modo: "1v1", ladoA: [txt], ladoB: [txt] }, ds);
assert.deepEqual(r.avisos, []);
assert.ok(r.resultado.yourSide.units.length > 0);
const r2 = analizar({ modo: "2v2", ladoA: [txt, txt], ladoB: [txt, txt] }, ds);
assert.equal(r2.resultado.mode, "2v2");
const bad = analizar({ modo: "1v1", ladoA: [txt.replace("Chimera (75", "Nave Rara (75")], ladoB: [txt] }, ds);
assert.ok(bad.avisos.some((a) => a.includes("Nave Rara")));
assert.equal(traducirAviso("Unit points add up to 1900, but the list total says 2000"), "Los puntos de las unidades suman 1900, pero el total de la lista indica 2000.");
console.log("UI logic checks passed.");
