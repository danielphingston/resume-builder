---
version: alpha
name: Folio Resume Studio
description: The existing Folio visual system, recorded from runtime CSS. DESIGN.md documents it; CSS remains canonical.
colors:
  primary: "#205c52"
  brand-deep: "#17594f"
  text: "#26352f"
  text-secondary: "#647168"
  muted: "#88918b"
  background: "#f8f9f7"
  surface: "#ffffff"
  border: "#e4e8e2"
  sage: "#eaf1ec"
  olive: "#bcbd86"
typography:
  app-body:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  reading-body:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.65
  display-app:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: 35px
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: -1.3px
  display-policy:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: 43px
    fontWeight: 400
    lineHeight: 1.15
  display-helper:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: 46px
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: -1.2px
  label:
    fontFamily: "Inter, ui-sans-serif, sans-serif"
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0.12em
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 35px
  rail-width: 80px
  topbar-height: 76px
  editor-panel-width: 370px
  policy-content-width: 900px
  helper-content-width: 1080px
rounded:
  xs: 4px
  sm: 6px
  md: 9px
  lg: 10px
  xl: 12px
  full: 9999px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.app-body}"
    rounded: "{rounded.sm}"
    padding: 10px 16px
    height: 37px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.app-body}"
    rounded: "{rounded.sm}"
    padding: 10px 16px
    height: 37px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.app-body}"
    rounded: "{rounded.sm}"
    padding: 12px
  content-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.reading-body}"
    rounded: "{rounded.lg}"
    padding: 24px
  active-navigation:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.primary}"
    typography: "{typography.app-body}"
    rounded: "{rounded.md}"
  policy-heading:
    textColor: "{colors.brand-deep}"
    typography: "{typography.display-policy}"
  reading-copy:
    textColor: "{colors.text-secondary}"
    typography: "{typography.reading-body}"
  utility-label:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  brand-detail:
    textColor: "{colors.olive}"
  divider:
    backgroundColor: "{colors.border}"
    size: 1px
---
## Overview

Folio is a browser-first resume builder for job seekers. Its voice is warm, clear, practical, and respectful of the user's ownership of their story. The UI pairs compact, tool-like editing controls with calm editorial headings and generous reading areas. Keep the local-first message and existing Folio identity intact.

Runtime authority: `src/buttons.css` provides shared controls; `src/style.css`, `src/policy.css`, and page-specific CSS define the remaining runtime styles. These notes record the current system; they do not drive or replace the existing CSS tokens and rules.

## Colors

Use deep Folio green for primary actions, links, and selected states. Keep body text dark green-gray on a soft off-white ground, with white surfaces and quiet sage borders. Muted olive is a small brand detail, not an alternate action color. Use the existing #528d7a keyboard focus ring.

## Typography

The editor uses a 13px Inter/system-sans base for dense controls and a Georgia serif for its 35px editorial headline. Reading and policy pages use a 15px sans-serif base, with a 43px Georgia title. The AI helper's 46px title is a page-specific extension. Small uppercase labels use generous tracking; keep long-form instructions comfortably readable.

## Layout

The editor uses a fixed 80px left rail, 76px toolbar, and a two-column studio with a 370px editing panel beside the resume canvas. Policy pages use a centered 900px content measure; the AI helper extends to 1080px for its handoff cards and schema. Use compact 4–12px control gaps and 16–35px section spacing. Collapse multi-column layouts on narrow screens and avoid horizontal overflow.

## Elevation & Depth

Use borders and pale tonal differences for most separation. Cards may use low-contrast, broad shadows; keep them subtle. Resume sheets can have a clearer paper shadow against the canvas. Avoid dark or floating dashboard-style elevation.

## Shapes

Use restrained rounded rectangles: 4–6px for controls, about 9–10px for panels, and 12px for the larger hero container. Reserve circular shapes for status marks and avatars. Keep borders thin and light.

## Components

Primary buttons are compact deep-green actions with white text. Secondary buttons are white with a light gray-green border. Inputs use a pale or white surface, a quiet border, and a clearly visible green focus ring. Navigation uses green text; the active item receives a pale sage fill. Cards use white surfaces, thin borders, and modest padding. Match existing dimensions and states in runtime CSS.

## Do's and Don'ts

- Do keep resume editing controls compact and reading content spacious.
- Do use Georgia for editorial headings and the existing sans-serif stack for interface copy.
- Do keep primary green for key actions and selected navigation.
- Do preserve accessible focus indication, responsive wrapping, and the local-first voice.
- Don't introduce new brand colors, typography families, or component shapes without a matching product need.
- Don't rewrite runtime styling from this document; update this guide only when actual CSS changes are intended.
