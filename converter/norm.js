// Name normaliser shared with the matcher: case, accents, quotes and the "➤" prefix are ignored.
export const norm = (s) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’`´]/g, "'")
    .replace(/^➤\s*/, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
