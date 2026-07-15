# TheWCAG Design System — Audit Lab

This document is the reusable visual and interaction brief for TheWCAG's website. It translates the warm, developer-friendly, anti-corporate principles in GetDesign's PostHog analysis into an original accessibility-auditing identity. It does not copy PostHog's brand, mascot, assets, or page compositions.

## Brand idea

- **Essence:** Practical proof.
- **Visual tension:** Friendly engineering notebook versus rigorous audit record.
- **Signature moment:** A real, keyboard-operable audit playground surrounded by small hand-authored annotations.
- **Product promise:** Find the issue, keep the proof, and hand it off without rebuilding the context.
- **Voice:** Candid, capable, direct, lightly playful, and never flippant about accessibility.

## Principles

1. Make dense auditor workflows feel approachable without hiding their detail.
2. Use warm cream as the canvas, olive-black as the ink, and TheWCAG orange as the single dominant action color.
3. Prefer flat hairline surfaces, 4–8px corners, compact labels, and documentation-like organization.
4. Product evidence is the illustration. Use authentic interface states instead of stock imagery or borrowed mascots.
5. Supporting pastels clarify categories and callouts; they never replace text, icons, or status labels.
6. Motion confirms hierarchy and state, but content remains usable without it.
7. Accessibility is part of the system: semantic order, visible focus, 44px targets, reduced motion, forced colors, reflow, and AA contrast.

## Color

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#eeefe9` | Primary website background |
| Soft surface | `#e5e7e0` | Navigation strip, secondary panels, inactive chrome |
| Paper | `#fcfcfa` | Cards, documentation sections, product UI |
| Ink | `#23251d` | Headings, high-emphasis copy, dark inverted surface |
| Body | `#4d4f46` | Paragraphs and supporting UI copy |
| Muted | `#606258` | Metadata and low-emphasis labels |
| Hairline | `#bfc1b7` | Card, table, and navigation boundaries |
| TheWCAG orange | `#f15a29` | Primary buttons, inspection marks, proof bands |
| Accessible orange text | `#a8330d` | Links and orange text on light surfaces |
| Soft green | `#d9eddf` | Success and vision-tool category |
| Soft blue | `#dceaf6` | Informational and finding-tool category |
| Soft red | `#f7d6d3` | Warnings and open findings |
| Soft purple | `#e7d8ee` | Standards and checklist category |
| Soft yellow | `#f6e7b7` | Palette and analysis category |

Orange is not the only signifier for any state. Small orange text on cream uses the darker accessible token. Vivid orange is used for large fills, boundaries, focus marks, and text in the ink color.

## Typography

- **Interface and display:** IBM Plex Sans, weights 400–700. Headings are bold, tightly tracked, and sentence case.
- **Technical:** IBM Plex Mono, weights 400–600. Used for labels, shortcuts, metadata, ratios, code, and small status text.
- The largest marketing headline uses a responsive `3.5rem–6.4rem` range with approximately `0.92` line height.
- Section headlines use a responsive `2.6rem–5rem` range.
- Default marketing body copy is `16–20px` with `1.55–1.62` line height.
- Body measures stay under roughly 75 characters; technical labels remain concise at small sizes.

## Composition

- Shared marketing content caps at `90rem` with a responsive `1.125rem–3.5rem` gutter.
- The hero uses a copy/product split on wide screens and becomes sequential below `1024px`.
- Major sections use generous `5–9rem` vertical rhythm.
- Cards are flat, separated by olive hairlines, and use 6px corners. Shadows are not part of the default vocabulary.
- Small circular stickers and slightly rotated annotations are reserved for marketing emphasis, never form controls or content-heavy panels.
- Dark ink surfaces are limited to code-like evidence sequences and the footer so that inversion stays meaningful.

## Components

### Header

- Sticky translucent cream surface with a single hairline.
- Active navigation lifts onto a white 6px card with an orange underline.
- Download is the persistent orange primary action.
- Mobile navigation is a bordered paper panel with 48px rows and complete authenticated actions.

### Buttons

- Primary: orange fill, ink label, 6px radius, 48px minimum height.
- Secondary: paper fill, olive hairline, ink label.
- Dark: ink fill, white label, used on orange surfaces.
- Hover may lift by 2px. Focus uses a 3px dark-orange outline with a 3px offset.

### Audit playground

- This is a functional preview, not a static illustration.
- Contrast, Evidence, and Vision are real ARIA tabs with arrow, Home, and End key behavior.
- Each mode demonstrates authentic vocabulary and values without claiming a live audit is occurring.
- Its essential meaning is available through the surrounding heading and copy; decorative mock-interface details remain hidden from assistive technology.

### Tool cards

- Three columns on wide screens, two on laptop/tablet, and one on mobile.
- A pastel category surface, explicit text label, icon, headline, explanation, and deep link are always present.
- Hover introduces a small lift/rotation only when motion is allowed.

### Public field-guide pages

- Use a readable `70rem` content shell and a compact `THEWCAG FIELD GUIDE` label.
- Each section is a bordered paper surface with a clear heading marker.
- Tables retain visible rules and links use underlines, not color alone.
- Existing semantic content and heading hierarchy remain authoritative.

### Footer

- Ink inversion reads like the system's final code block.
- A large `AUDIT. PROVE. SHIP.` statement provides the brand moment.
- Navigation, platform downloads, repository link, and product positioning remain explicit.

## Motion

- Use `cubic-bezier(0.16, 1, 0.3, 1)` for entrances and spatial changes.
- Reveal sections with `IntersectionObserver`; immediately reveal content when observation is unavailable.
- Animate only opacity and transforms for scroll entrances.
- Interactive states use `180–280ms` transitions.
- Never scroll-hijack, animate body copy while it is being read, or add a custom cursor.
- `prefers-reduced-motion: reduce` shortens every animation and transition to effectively immediate.

## Responsive behavior

- **Wide (`> 1216px`):** copy/product hero, 3-up tool cards, two platform panels.
- **Laptop (`1024–1216px`):** narrower product preview and reduced gaps.
- **Tablet (`768–1024px`):** sequential hero, 2-up tool cards, stacked workflow copy.
- **Mobile (`592–768px`):** single platform column, 2-up specification cells, compact playground.
- **Narrow mobile (`< 592px`):** stacked actions, single tool column, compact evidence preview.
- **Minimum (`320px`):** single proof cells where needed and simplified non-essential preview chrome.

No breakpoint may create horizontal page scrolling. Test at `320`, `375`, `768`, `1024`, and `1440px`, plus Windows compact desktop sizing and a wide MacBook workspace.

## Accessibility acceptance criteria

- Exactly one `h1`; headings follow a logical hierarchy.
- The skip link reaches `#main` and is visible on focus.
- Interactive targets are at least 44px in their tappable dimension.
- Text, icons, borders needed for understanding, and meaningful states meet WCAG 2.2 AA contrast.
- Status is never conveyed by color alone.
- The audit playground implements the ARIA tabs pattern and retains keyboard focus when changing modes.
- Layout remains readable at 320px, 200% zoom, reduced motion, forced colors, and with JavaScript unavailable.
- Product copy does not invent customers, usage figures, certifications, or audit outcomes.

## Avoid

- Borrowed mascots, logos, illustrations, or PostHog-specific product language.
- Generic gradient-orb SaaS heroes, glassmorphism, and excessive shadows.
- Huge display text that pushes the product below the first viewport without purpose.
- Decorative rounded containers around every line of copy.
- Orange body text below the accessible text token.
- Stock accessibility photography and performative disability imagery.
- Custom cursors, scroll hijacking, parallax reading surfaces, or animations that gate content.
