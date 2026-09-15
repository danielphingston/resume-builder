# Folio — Resume Studio

A browser-only resume builder with direct editing and reusable blocks. No accounts, uploads, analytics, remote fonts, or runtime dependencies. Playwright is a development-only dependency for regression tests.

## Run

```sh
npm run dev
```

Requires Python 3. Open http://localhost:5173. Any static HTTP server also works; serve over HTTP rather than opening `index.html` directly because the app uses JavaScript modules.

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

Resume data stays in localStorage under `folio-resume-v2`; saved presets use `folio-block-library-v1`. Existing v1 browser data and old JSON backups automatically convert to sections of blocks without dropping their content. The old storage key is retained for recovery.

Backups contain the resume and saved block library. Import validates content and normalizes styling before use. Clearing browser data removes saved work: download backups for safekeeping or transfer. Undo restores resume edits, including an imported resume; saved-library changes have their own explicit add/remove controls and are not part of resume undo history. Job descriptions are held only in memory.

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

The UI suite runs its own static server at http://127.0.0.1:5174. It exercises direct editing/caret behavior, bullet splitting/removal, plain-text paste, custom preset reuse, cross-section and cross-column dragging, keyboard movement, style inheritance, legacy recovery, JSON backup/import, print output, and responsive layout.

Committed screenshot baselines cover desktop, mobile, selected engineering blocks, design controls, the block library, and the printed resume. They were captured on Linux using Chrome; use the same browser/OS for stable pixel comparisons. Test traces and failure screenshots are written to the ignored `test-results/` folder.

After an intentional UI change, inspect the visual changes, then regenerate baselines:

```sh
npm run test:ui:update
```

## Code map

- `src/model.mjs`: normalized v2 document schema, v1 conversion, block presets, movement operations, scoring.
- `src/view.mjs`: escaped HTML rendering for the canvas, inspectors, and block library.
- `src/paginate.mjs`: measured page layout shared by canvas and printing.
- `src/app.js`: browser state, grouped edit history, persistence, inline editing, and mouse/touch drag handling.
- `src/style.css`: application UI, document styles, responsive behavior, and print rules.
- `src/model.test.mjs` / `tests/editor.spec.mjs`: model contracts and browser regression coverage.
