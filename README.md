# Folio Resume Studio

Folio is a static, browser-based resume editor. It supports direct editing, reusable blocks, multiple local resumes, design presets, JSON backups, PDF export, and optional manual saves to Google Drive. There is no application server or build step.

## Run locally

Requirements: Python 3. Node.js 18+ and Google Chrome are needed for tests.

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. The app uses JavaScript modules, so serve it over HTTP instead of opening `index.html` as a local file. Any static HTTP server can serve the repository root. Relative asset paths also support hosting under a subdirectory, including GitHub Pages.

## Test

```sh
npm test             # Unit and browser tests
npm run test:unit    # Data model and storage tests
npm run test:ui      # Chrome/Playwright interaction and visual tests
```

The UI suite starts a server on `http://127.0.0.1:5174`. Screenshot baselines were captured with Chrome on Linux. After an intentional visual change, inspect the result and run `npm run test:ui:update` to update them. Failure traces and screenshots are written to `test-results/`.

## Project structure

| Path | Responsibility |
| --- | --- |
| `index.html`, `src/style.css` | Application shell, UI, resume styles, and print rules |
| `src/app.js` | Editor state, event handling, history, and persistence |
| `src/view.mjs` | Escaped HTML for panels, blocks, and resume content |
| `src/model.mjs` | Version 2 document validation, migration, presets, movement, and resume checks |
| `src/paginate.mjs` | Page layout for preview and PDF printing |
| `src/resume-store.mjs` | Multiple local resumes and legacy storage migration |
| `src/drive.mjs`, `src/config.mjs` | Optional Google Drive integration and public OAuth client ID |
| `src/*.test.mjs`, `tests/editor.spec.mjs` | Unit and browser regression tests |

## Data and development notes

Resumes are stored separately in browser `localStorage`; the active resume and titles are indexed under `folio-resumes-v1`. Reusable blocks use `folio-block-library-v1`. A downloaded JSON backup contains the current resume and block library. Import validates the document before replacing the current resume. Browser storage is local to the device and origin.

For optional Google Drive support, get a Google OAuth web client ID and set `GOOGLE_CLIENT_ID` in `src/config.mjs`.

The document schema and import normalization live in `src/model.mjs`; change them together. Render user text through the escaping helpers in `src/view.mjs`. Preview and print share the measured page breaks in `src/paginate.mjs`, so layout changes should be checked in both modes. Block-level design overrides take precedence over global styles.
