# Plan: Extract Skland Wiki Data Generator to Independent Submodule

## Goal
Extract the code responsible for crawling, extracting, and generating the Skland wiki data pack into a separate, independent repository/submodule. This new repository will include a GitHub Action to periodically run the generation process and publish the data.

## 1. Repository Structure
We will create a new directory `skland-data-source` with the following structure:

```
skland-data-source/
├── .github/
│   └── workflows/
│       └── update-data.yml      # Scheduled action to run the pipeline
├── src/
│   ├── crawler.mjs              # Was scripts/crawl-skland-wiki.mjs
│   ├── extractor.mjs            # Was scripts/extract-skland-methods.mjs
│   ├── pack-builder.ts          # Was scripts/generate-skland-pack.ts
│   └── lib/                     # Was scripts/skland-pack/
│       ├── assets.ts
│       ├── build.ts
│       ├── cli.ts
│       ├── fs-utils.ts
│       ├── helpers.ts
│       ├── input.ts
│       ├── postprocess.ts
│       ├── types.ts
│       ├── converters/
│       └── rules/
├── docs/
│   ├── BUILD_NOTES.md           # Was docs/AEF_SKLAND_PACK_BUILD_NOTES.md
│   └── INFO_FORMAT.md           # Was docs/SKLAND_INFO_FORMAT.md
├── package.json
├── tsconfig.json
└── README.md
```

## 2. Files to Migrate
The following files need to be moved/copied from the main `jei-web` repository:

1.  `scripts/crawl-skland-wiki.mjs` -> `src/crawler.mjs`
2.  `scripts/extract-skland-methods.mjs` -> `src/extractor.mjs`
3.  `scripts/generate-skland-pack.ts` -> `src/pack-builder.ts`
4.  `scripts/skland-pack/**/*` -> `src/lib/**/*`
5.  `docs/AEF_SKLAND_PACK_BUILD_NOTES.md` -> `docs/BUILD_NOTES.md`
6.  `docs/SKLAND_INFO_FORMAT.md` -> `docs/INFO_FORMAT.md`

## 3. Code Adjustments
The migrated scripts need minor adjustments:
1.  **Path Resolution**: The scripts currently calculate `repoRoot` relative to `scripts/`. In the new structure, they will be in `src/`, so `repoRoot` (project root) will be `../` instead of `..`.
2.  **Imports**: Update import paths in `src/pack-builder.ts` to point to `src/lib/` instead of `./skland-pack/`.
3.  **Output Directories**: Ensure the scripts output to a consistent `dist/` or `data/` directory in the new repo.

## 4. Configuration Files

### `package.json`
Dependencies needed:
- `typescript`
- `tsx` (to run TS scripts directly)
- `@types/node`

```json
{
  "name": "skland-data-source",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "crawl": "node src/crawler.mjs",
    "extract": "node src/extractor.mjs",
    "build": "tsx src/pack-builder.ts",
    "all": "npm run crawl && npm run extract && npm run build"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### `.github/workflows/update-data.yml`
```yaml
name: Update Skland Data

on:
  schedule:
    - cron: '0 0 * * *' # Daily at midnight
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm install
      - run: npm run all
      - name: Upload Artifact
        uses: actions/upload-artifact@v3
        with:
          name: skland-pack
          path: dist/ # Adjust based on actual output path
      # Optional: Commit back to repo
      # - name: Commit changes
      #   run: |
      #     git config --local user.email "action@github.com"
      #     git config --local user.name "GitHub Action"
      #     git add dist/
      #     git commit -m "Update data"
      #     git push
```

## 5. Execution Steps
1.  Create the `skland-data-source` directory.
2.  Initialize `package.json` and `tsconfig.json`.
3.  Copy the files to their new locations.
4.  Refactor the code to fix paths and imports.
5.  Create the GitHub Action workflow.
