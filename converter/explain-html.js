// explain-html.js: builds the HTML of the hover bubble (in Spanish). Unit names, weapons and abilities stay in English.
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n1 = (x) => (Math.round(x * 10) / 10).toLocaleString("es-ES");
const ETIQUETA = { good: "Buen matchup", regular: "Matchup regular", bad: "Mal matchup" };

const tiradas = (i) => i
  ? `impacta ${i.hit ? i.hit + "+" : "automático"} · hiere ${i.wound}+ · ${i.save ? "salva " + i.save + "+" : "sin salvación"}${i.fnp ? ` · Feel No Pain ${i.fnp}+` : ""}`
  : "";

const armas = (a) => a.armas.length
  ? `<ul>${a.armas.map((w) => `<li>${esc(w.name)}${w.count > 1 ? ` ×${w.count}` : ""}: ${n1(w.dmg)} heridas (${w.pct} %)${w.tipo === "melee" ? " <small>cuerpo a cuerpo</small>" : ""}<br><small>${tiradas(w.info)}</small></li>`).join("")}</ul>`
  : "<p><small>No le puede hacer daño.</small></p>";

const est = (s) => `T${s.T} · Sv ${s.save}+${s.invuln ? ` · Inv ${s.invuln}+` : ""} · ${s.models} modelo${s.models === 1 ? "" : "s"} · ${s.totalWounds} heridas${s.lideres.length ? " (con líder)" : ""}`;
const habs = (h) => h.length ? h.map((x) => `${esc(x.name)} <small>(${esc(x.efecto)})</small>`).join("; ") : "ninguna";

export function htmlPar(d) {
  const { yo, ellos } = d;
  const ventaja = d.despreciable ? "ninguno de los dos hace un daño apreciable" : `ventaja ${d.ventaja > 0 ? "+" : ""}${d.ventaja} %`;
  return `<b>${esc(yo.nombre)}</b> contra <b>${esc(ellos.nombre)}</b>
  <div class="etq ${d.etiqueta}">${ETIQUETA[d.etiqueta]} · ${ventaja}</div>
  <h4>Lo que hace ${esc(yo.nombre)}</h4>
  <p>Quita ${n1(d.ataque.heridas)} de ${d.ataque.de} heridas (${d.ataque.pct} %): unos ${d.ataque.puntos} de ${ellos.points} pts por ronda.</p>${armas(d.ataque)}
  <h4>Lo que hace ${esc(ellos.nombre)}</h4>
  <p>Quita ${n1(d.defensa.heridas)} de ${d.defensa.de} heridas (${d.defensa.pct} %): unos ${d.defensa.puntos} de ${yo.points} pts por ronda.</p>${armas(d.defensa)}
  <h4>Estadísticas</h4>
  <p><b>${esc(yo.nombre)}:</b> ${est(yo)}<br><b>${esc(ellos.nombre)}:</b> ${est(ellos)}</p>
  <h4>Habilidades que afectan</h4>
  <p><b>${esc(yo.nombre)}:</b> ${habs(yo.habilidades)}<br><b>${esc(ellos.nombre)}:</b> ${habs(ellos.habilidades)}</p>
  <small>Una ronda con tiradas medias. El cuerpo a cuerpo cuenta un ${Math.round(d.meleeWeight * 100)} % porque necesita cargar.</small>`;
}

export function htmlPresion(d) {
  return `<b>${esc(d.objetivo)}</b>
  <h4>Las mejores unidades contra ella</h4>
  <ul>${d.mejores.map((x) => `<li>${esc(x.name)}: ${x.pct} % de sus heridas</li>`).join("")}</ul>
  <p>Juntas le quitan un ${d.total} % en una ronda.</p>`;
}
