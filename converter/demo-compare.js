import { readFileSync } from "node:fs";
import { parseList } from "./parseList.js";
import { buildDataset } from "./buildDataset.js";
import { matchList } from "./matchList.js";
import { compareMatch } from "./compare.js";

// Demo: the sample list against an infantry-heavy list made from the same units.
const ds = buildDataset("./data");
const { list } = parseList(readFileSync("./samples/astra-militarum-2000.txt", "utf8"));
const rep = matchList(list, ds);
const keep = ["Catachan Jungle Fighters", "Kasrkin", "Bullgryn Squad", "Chimera", "Hellhound", "Hippogriff AFV"];
const rep2 = { ...rep, units: rep.units.filter((u) => keep.includes(u.name)) };

const r = compareMatch({ mode: "1v1", sideA: [rep], sideB: [rep2] });
const fmt = (arr) => arr.length ? arr.map((x) => `${x.name}${x.count > 1 ? " x" + x.count : ""}`).join(", ") : "-";

console.log("=== YOUR UNITS ===");
for (const u of r.yourSide.units) {
  console.log(`${u.name}${u.count > 1 ? " x" + u.count : ""} (${u.points} pts)  good ${u.pct.good}% / regular ${u.pct.regular}% / bad ${u.pct.bad}%`);
  console.log(`   good vs: ${fmt(u.good)}\n   bad vs:  ${fmt(u.bad)}`);
}
console.log("\n=== ENEMY UNITS YOUR LIST STRUGGLES WITH ===");
console.log(r.yourSide.struggles.length ? r.yourSide.struggles.map((x) => `${x.name} (your best 3 units remove ${x.pressurePct}%)`).join("\n") : "none");
console.log("\n=== YOUR UNITS THE OPPONENT STRUGGLES WITH ===");
console.log(r.opponentSide.struggles.length ? r.opponentSide.struggles.map((x) => `${x.name} (their best 3 units remove ${x.pressurePct}%)`).join("\n") : "none");
console.log("\nPressure on every enemy unit (your list):", r.yourSide.pressure.map((x) => `${x.name} ${x.pressurePct}%`).join(", "));
console.log("Pressure on every one of your units (their list):", r.opponentSide.pressure.map((x) => `${x.name} ${x.pressurePct}%`).join(", "));
