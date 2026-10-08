// parseList.js
// Parses the plain-text army list exported by the official Warhammer 40,000 app
// into structured data. Pure JavaScript, no dependencies: runs in Node and in the browser.
//
// Usage:  import { parseList } from "./parseList.js";
//         const { list, warnings } = parseList(textFromPasteBox);

const POINTS_RE = /\(\s*([\d.,]+)\s*(?:Points?|pts)\s*\)\s*$/i;
const DET_POINTS_RE = /\(\s*([\d.,]+)\s*Detachment Points?\s*\)\s*$/i;
const SECTION_RE = /^[A-Z][A-Z0-9 &'\-]*$/; // CHARACTERS, BATTLELINE, ...
const COUNT_RE = /^(\d+)\s*x\s+(.+)$/i;
const BULLET_RE = /^(\s*)([•◦▪‣\-*])\s*(.*)$/;

const num = (s) => parseInt(String(s).replace(/[.,]/g, ""), 10);

function bulletLevel(indent, mark) {
  if (mark === "•") return 1;
  if (mark === "◦") return 2;
  return indent.length >= 4 ? 2 : 1; // fallback for other bullet characters
}

export function parseList(text) {
  const warnings = [];
  const lines = String(text)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, "    ")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""));

  const list = {
    name: "",
    totalPoints: null,
    faction: "",
    battleSize: null, // e.g. { name: "Strike Force", points: 2000 }
    detachmentPoints: null,
    headerLines: [], // header lines kept as written, so nothing is lost
    units: [],
  };

  let i = 0;
  const next = () => {
    while (i < lines.length && lines[i].trim() === "") i++;
    return i < lines.length ? lines[i++] : null;
  };

  // --- title line: "<name> (N Points)"
  const title = next();
  if (title === null) return { list, warnings: ["Empty input"] };
  const t = title.match(POINTS_RE);
  if (t) {
    list.totalPoints = num(t[1]);
    list.name = title.replace(POINTS_RE, "").trim();
  } else {
    list.name = title.trim();
    warnings.push("Title line has no '(N Points)' total");
  }

  // --- header lines until the first section heading
  let first = true;
  while (i < lines.length) {
    const peek = lines[i].trim();
    if (peek === "") { i++; continue; }
    if (SECTION_RE.test(peek)) break;
    i++;
    list.headerLines.push(peek);
    const dp = peek.match(DET_POINTS_RE);
    if (dp) {
      list.detachmentPoints = num(dp[1]);
      continue;
    }
    const p = peek.match(POINTS_RE);
    if (p) {
      list.battleSize = { name: peek.replace(POINTS_RE, "").trim(), points: num(p[1]) };
      continue;
    }
    if (first) { list.faction = peek; first = false; }
  }

  // --- sections and units
  let section = "";
  let unit = null;
  let group = null; // current level-1 item that may turn out to be a model group

  const closeUnit = () => {
    if (!unit) return;
    unit.modelCount = unit.models.reduce((n, m) => n + m.count, 0) || 1;
    list.units.push(unit);
    unit = null;
    group = null;
  };

  const closeGroup = () => {
    if (!unit || !group) return;
    if (group.children.length > 0) {
      unit.models.push({ count: group.count, name: group.name, wargear: group.children });
    } else {
      unit.wargear.push({ count: group.count, name: group.name });
    }
    group = null;
  };

  while (i < lines.length) {
    const raw = lines[i++];
    const line = raw.trim();
    if (line === "") continue;

    const b = raw.match(BULLET_RE);
    if (b) {
      if (!unit) { warnings.push(`Bullet outside a unit: "${line}"`); continue; }
      const level = bulletLevel(b[1], b[2]);
      const body = b[3].trim();

      if (level === 1) {
        closeGroup();
        if (/^warlord$/i.test(body)) { unit.warlord = true; continue; }
        const enh = body.match(/^enhancements?\s*:\s*(.+)$/i);
        if (enh) { unit.enhancements.push(enh[1].trim()); continue; }
        const c = body.match(COUNT_RE);
        if (c) { group = { count: parseInt(c[1], 10), name: c[2].trim(), children: [] }; continue; }
        unit.extras.push(body);
        warnings.push(`Unrecognised line in "${unit.name}": "${body}"`);
      } else {
        if (!group) { warnings.push(`Orphan sub-item in "${unit.name}": "${body}"`); continue; }
        const c = body.match(COUNT_RE);
        group.children.push(c ? { count: parseInt(c[1], 10), name: c[2].trim() } : { count: 1, name: body });
      }
      continue;
    }

    if (SECTION_RE.test(line)) {
      closeGroup(); closeUnit();
      section = line;
      continue;
    }

    const p = line.match(POINTS_RE);
    if (p) {
      closeGroup(); closeUnit();
      unit = {
        name: line.replace(POINTS_RE, "").trim(),
        points: num(p[1]),
        section,
        warlord: false,
        enhancements: [],
        models: [],   // model groups: [{ count, name, wargear: [{count,name}] }]
        wargear: [],  // wargear on single-model units (vehicles, characters)
        extras: [],
        modelCount: 0,
      };
      continue;
    }

    warnings.push(`Unrecognised line: "${line}"`);
  }
  closeGroup(); closeUnit();

  // --- checks
  const sum = list.units.reduce((n, u) => n + u.points, 0);
  list.unitPointsSum = sum;
  if (list.totalPoints !== null && sum !== list.totalPoints) {
    warnings.push(`Unit points add up to ${sum}, but the list total says ${list.totalPoints}`);
  }
  if (list.units.length === 0) warnings.push("No units found");

  return { list, warnings };
}
