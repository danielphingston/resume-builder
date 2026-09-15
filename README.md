# Folio — Resume Studio

A browser-first resume builder with direct editing, reusable blocks, multiple local resumes, and optional Google Drive saves. It has no analytics, remote fonts, or backend. Google sign-in loads only when Drive is configured and opened. Playwright is a development-only dependency for regression tests.

## Run

```sh
npm run dev
```

Requires Python 3. Open http://localhost:5173. Any static HTTP server also works; serve over HTTP rather than opening `index.html` directly because the app uses JavaScript modules.

This repository is already hosted at [danielphingston.github.io/resume-builder](https://danielphingston.github.io/resume-builder/). GitHub Pages can publish the static files from `main` and `/(root)` under **Settings → Pages → Build and deployment → Deploy from a branch**. The relative asset paths work under `/resume-builder/`, and `.nojekyll` keeps GitHub Pages from running Jekyll. There is no app backend or build step. Changes on a feature branch appear on Pages after they are merged into the publishing branch. GitHub's [branch publishing guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) describes the setting.

## How the editor works

- **Sections are groups.** Rename their headings directly on the resume. Drag a section handle to reorder the group or move it between columns.
- **Blocks are the content.** Each block can combine a title, subtitle, date, location, icon, paragraphs, and bullet points. Click any text to edit it. Empty fields appear when the block is selected.
- **Move blocks independently.** Drag the block handle onto another block to place it before/after, or onto a section’s Add block area to append it. Inspector up/down buttons and a Move to section dropdown provide a keyboard-accessible alternative. Touch handles share the same drop rules.
- **Work with bullets.** Enter splits a bullet at the caret; Backspace on an empty bullet removes it. Add/remove controls are available on the canvas. Paragraphs support multiple lines. Pasted text is kept as plain text.
- **Start with a preset.** Experience, summary, project, education, skills, achievement, and custom blocks are included. Save a styled block to your local library and insert independent copies later.
- **Style globally or locally.** Seven local font stacks, eight bullet styles (dot, circle, square, dash, arrow, checkmark, numbered, none), heading treatments, three layouts, backgrounds, and independent heading/subtitle/body colors. Individual blocks can override fonts, colors, bullets, backgrounds, icons, and frames. Reset restores inheritance. The Engineering style uses burgundy headings, orange subtitles, and underlined section headings.
- **Control the page.** One/two columns, column balance, margins, spacing, line height, font size, A4/Letter, and preview zoom.
- **Undo/redo.** Toolbar buttons and Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, or Ctrl/Cmd+Y. Typing is grouped into editing transactions; structural actions are individual undo steps.

## Storage, backups, and printing

Each resume saves separately in localStorage under `folio-resume-doc-<id>`, with titles and the active resume in `folio-resumes-v1`; saved presets use `folio-block-library-v1`. The existing `folio-resume-v2` and v1 browser saves migrate into the resume list without dropping their content. Open **Resumes** in the toolbar to create a blank resume, duplicate or rename the current one, and switch between saved resumes. Edits to one resume do not change another. Switching starts a fresh undo history.

Backups contain the current resume and saved block library. Import validates content and normalizes styling before replacing the current resume; create a new resume first if you want to retain the current one. Clearing browser data removes local work: download backups or save to Drive for safekeeping or transfer. Undo restores resume edits, including an imported resume; saved-library changes have their own explicit add/remove controls and are not part of resume undo history. Job descriptions are held only in memory.

## Google Drive setup

In [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients), open your OAuth **Web application** client to copy its client ID. Enable the Google Drive API and configure the OAuth consent screen if they are not already set up. Add `https://danielphingston.github.io` to **Authorized JavaScript origins**; the `/resume-builder/` path does not belong in that field. For local development, add `http://localhost:5173` as another origin. The Drive dialog displays the origin of whichever site you are using. If the consent screen is in Testing, add the Google account you will use as a test user. The popup token flow does not need a redirect URI or client secret in this app. Google's [OAuth setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid), [origin rules](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow), [token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), and [publishing status](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) describe these steps.

In the app, open **Google Drive**, enter the public client ID, choose **Save setup**, and then **Connect Google Drive**. **Save current to Drive** creates or updates a visible `.folio.json` file using the `drive.file` scope. **Open from Drive** lists JSON resumes made by this app and imports one as a separate local resume. If that Drive file is already linked locally, opening it creates a local copy rather than overwriting local edits. When a linked Drive file has changed since the last save, the app stops the overwrite; use **Open from Drive** to review it or **Save as new Drive copy**. Local edits save automatically in this browser; Drive saves are manual. Access tokens stay in memory and expire with the session. The public client ID stays in localStorage. Google's [Drive upload](https://developers.google.com/workspace/drive/api/guides/manage-uploads) and [file search](https://developers.google.com/workspace/drive/api/guides/search-files) guides cover the API behavior.

The repository and Pages app may be public while resumes saved in the browser or your Drive remain outside GitHub. The OAuth client ID is meant to appear in browser code and may be public; do not commit a client secret, downloaded credentials, resume backups, or a real resume JSON. The `.gitignore` excludes common credential and backup filenames. If you later open Google sign-in to users beyond your test accounts, review Google's [OAuth domain ownership and homepage requirements](https://developers.google.com/identity/protocols/oauth2/policies); a custom domain you control may be needed for production verification.

The canvas shows separate A4 or Letter sheets using the same page breaks as PDF export. Choose **PDF view** above the canvas to inspect clean sheets without editing controls, then **Edit view** to resume editing. Sections continue on the next sheet when they run out of room; oversized bullets and paragraphs can continue within a block. For text divided across sheets, edit the complete bullet or paragraph in the block settings. Use **Export PDF**, choose Save as PDF, disable browser headers/footers, and enable background graphics for colors. Editing handles, buttons, outlines, and empty-field placeholders are excluded from print.

The resume checker is an explained writing/formatting heuristic and local keyword matcher, not an employer’s ATS integration or a hiring prediction.

## Regression tests

Requires Node.js 18+ and Google Chrome for browser tests.

```sh
npm ci
npm test                  # Model tests + browser/UI regression tests
npm run test:unit         # Schema migration, validation, moves, presets, styles, scoring
npm run test:ui           # Real Chrome interactions, persistence, drag/drop, export, screenshots
```

The UI suite runs its own static server at http://127.0.0.1:5174. It exercises direct editing/caret behavior, bullet splitting/removal, plain-text paste, custom preset reuse, cross-section and cross-column dragging, keyboard movement, style inheritance, legacy recovery, multiple resumes, a mocked Google Drive flow, JSON backup/import, print output, and responsive layout. Live Google OAuth requires a configured client ID and a Google account.

Committed screenshot baselines cover desktop, mobile, selected engineering blocks, design controls, the block library, and the printed resume. They were captured on Linux using Chrome; use the same browser/OS for stable pixel comparisons. Test traces and failure screenshots are written to the ignored `test-results/` folder.

After an intentional UI change, inspect the visual changes, then regenerate baselines:

```sh
npm run test:ui:update
```

## Code map

- `src/model.mjs`: normalized v2 document schema, v1 conversion, block presets, movement operations, scoring.
- `src/resume-store.mjs`: local resume list, migration, and separate document saves.
- `src/drive.mjs`: Drive file listing, reading, uploads, and overwrite checks.
- `src/view.mjs`: escaped HTML rendering for the canvas, inspectors, and block library.
- `src/paginate.mjs`: measured page layout shared by canvas and printing.
- `src/app.js`: browser state, grouped edit history, persistence, inline editing, and mouse/touch drag handling.
- `src/style.css`: application UI, document styles, responsive behavior, and print rules.
- `src/model.test.mjs` / `tests/editor.spec.mjs`: model contracts and browser regression coverage.
