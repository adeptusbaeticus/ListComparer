import { readFileSync } from "node:fs";
import { parseList } from "./parseList.js";
import { buildDataset } from "./buildDataset.js";
import { matchList } from "./matchList.js";

const ds = buildDataset("./data");
console.log(`Dataset: ${ds.unitCount} units; problems: ${ds.problems.length}`);
console.log(ds.problems.slice(0, 8));
const { list, warnings } = parseList(readFileSync("./samples/astra-militarum-2000.txt", "utf8"));
console.log("parser warnings:", warnings);
const rep = matchList(list, ds);
console.log(JSON.stringify(rep.summary, null, 1));
for (const u of rep.units) {
  const ms = u.models.map((m) => `${m.count}x ${m.name}${m.stats ? ` (T${m.stats.T} W${m.stats.W} Sv${m.stats.Sv})` : " (NO STATS)"}`).join("; ");
  console.log(`${u.matched ? "OK " : "-- "}${u.name}: ${ms} | weapons ${u.weapons.length}, other ${u.notWeapons.length}`);
}
