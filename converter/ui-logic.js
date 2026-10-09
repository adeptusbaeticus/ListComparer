// ui-logic.js: connects the pasted texts to the engine and translates parser messages into Spanish.
import { parseList } from "./parseList.js";
import { matchList } from "./matchList.js";
import { compareMatch } from "./compare.js";

export function traducirAviso(w) {
  let m;
  if ((m = w.match(/^Unit points add up to (\d+), but the list total says (\d+)/))) return `Los puntos de las unidades suman ${m[1]}, pero el total de la lista indica ${m[2]}.`;
  if ((m = w.match(/^Unrecognised line in "(.+)": "(.+)"$/))) return `Línea no reconocida en "${m[1]}": "${m[2]}"`;
  if ((m = w.match(/^Unrecognised line: "(.+)"$/))) return `Línea no reconocida: "${m[1]}"`;
  if ((m = w.match(/^Bullet outside a unit: "(.+)"$/))) return `Línea suelta fuera de una unidad: "${m[1]}"`;
  if ((m = w.match(/^Orphan sub-item in "(.+)": "(.+)"$/))) return `Elemento sin grupo en "${m[1]}": "${m[2]}"`;
  if (w.startsWith("Title line")) return "La primera línea no indica el total de puntos.";
  if (w === "No units found") return "No se ha encontrado ninguna unidad.";
  if (w === "Empty input") return "La lista está vacía.";
  return w;
}

// modo: "1v1" | "2v2"; ladoA / ladoB: arrays with one pasted text per list
export function analizar({ modo, ladoA, ladoB }, dataset) {
  const avisos = [];
  const procesa = (textos, etiqueta) => textos.map((t, i) => {
    const nombre = textos.length > 1 ? `${etiqueta} ${i + 1}` : etiqueta;
    const { list, warnings } = parseList(t);
    const rep = matchList(list, dataset);
    for (const w of warnings) avisos.push(`${nombre}: ${traducirAviso(w)}`);
    if (rep.summary.unitsUnmatched.length) avisos.push(`${nombre}: unidades sin ficha en los datos (no se comparan): ${rep.summary.unitsUnmatched.join(", ")}`);
    return rep;
  });
  const a = procesa(ladoA, "Tu lista"), b = procesa(ladoB, "Lista rival");
  return { resultado: compareMatch({ mode: modo, sideA: a, sideB: b }), avisos };
}
