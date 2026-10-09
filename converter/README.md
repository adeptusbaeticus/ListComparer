# Converter, matcher and safety checks

Folder layout expected in the repo: `converter/` (this folder), `public/data/dataset.json` (the published dataset), `data/source.json` (the BSData commit it came from).

- `parseList.js`: turns a list pasted from the Warhammer app into structured data.
- `buildDataset.js`: turns the BSData `wh40k-11e` JSON files into one clean dataset (stat lines, weapon profiles, keywords).
- `matchList.js`: links a parsed list to datasheets. Anything that does not match is reported, never guessed.
- `checks.js`: safety checks before a new dataset is published.
- `test.js`: tests against the sample list in `samples/`.

Run locally (Node 20 or newer), after putting the BSData `.json` files in `./data`:

    node test.js
    node report.js
    node buildDataset.js ./data ./dataset.json

Tested only with `Imperium - Astra Militarum.json` and its Library file.

## Comparison engine (compare.js)

- `compareMatch({ mode: "1v1" | "2v2", sideA: [reports], sideB: [reports] })` takes lists already matched with `matchList.js`. In 2v2 each side's two lists are combined into one force. `mode: "team"` is a placeholder and throws "not implemented yet".
- For every unit it gives good / regular / bad matchups against the enemy units, as a share of the enemy's points, and for each side the enemy units it struggles with (its best 3 units together remove less than 75% of the unit in one round).
- It is a general estimate of one round with average dice: hit, wound, save, AP, invulnerable saves, damage capped by model wounds, and the keywords Torrent, Twin-linked, Anti-X, Lethal Hits, Sustained Hits and Devastating Wounds. Ignored for now: range, movement, terrain, stratagems, unit abilities, Blast, Rapid Fire, Melta, Heavy, and One Shot weapons.
- Tunable numbers are in `DEFAULT_CONFIG` at the top of `compare.js`.
- `node test-compare.js` runs the tests; `node demo-compare.js` prints a readable example.
