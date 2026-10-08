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
