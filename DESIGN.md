# TheWCAG Design System — Precision Cinema

This document is the reusable visual and interaction brief for TheWCAG's website. It adapts the cinema-black, monumental-type, editorial-restraint principles seen in GetDesign's Bugatti analysis to TheWCAG's own accessibility-auditing identity. It is an original product system, not a copy of Bugatti's branding or components.

## Brand idea

- **Essence:** Exactitude.
- **Visual tension:** Cinematic restraint versus diagnostic signal.
- **Signature moment:** Monumental condensed typography beside a live screen-inspection frame.
- **Product promise:** Make inaccessible states visible, reviewable, and defensible.
- **Voice:** Precise, assured, concise, never playful or alarmist.

## Principles

1. Typography carries the atmosphere; interface chrome stays quiet.
2. Orange is an inspection signal, not general decoration.
3. Hairlines and whitespace organize information instead of rounded cards and shadows.
4. Product evidence is the imagery. Prefer real or code-native auditing views over stock photography.
5. Motion guides attention and never gates content.
6. Accessibility is a design constraint: readable measures, visible focus, semantic order, 44px targets, reduced-motion support, and AA contrast minimums.

## Color

| Token | Value | Use |
| --- | --- | --- |
| Cinema black | `#070707` | Marketing canvas and shared shell |
| Panel | `#10100f` | Subtle elevation on dark |
| Elevated | `#171716` | Hover and nested surfaces |
| Ink | `#f4f1ea` | Primary text on dark |
| Muted ink | `#aaa59c` | Supporting text on dark |
| Hairline | `#292826` | Dark dividers and boundaries |
| Signal orange | `#ff5a1f` | Primary action, inspection state, evidence band |
| Accessible orange text | `#c94312` | Orange text on light surfaces |
| Editorial cream | `#f1ede5` | Light product chapter |
| Light ink | `#151311` | Text on cream and orange |

Orange-on-cream body text uses the darker `#c94312`. The vivid signal orange is reserved for large UI, backgrounds, borders, and dark-surface text.

## Typography

- **Display:** Saira Condensed, weights 300–500. Uppercase, monumental, slightly tracked. Used for hero and chapter titles.
- **Editorial:** EB Garamond, weight 400. Used for narrative marketing copy and considered descriptions.
- **Interface:** Bricolage Grotesque. Used for product pages, controls, forms, and dense UI.
- **Technical:** platform monospace stack. Used for navigation, labels, specifications, state, and metadata.

Display-to-body scale should be at least 8:1 on large screens. Marketing headlines use controlled line breaks. Body content stays between 45 and 75 characters per line.

## Composition

- Marketing content caps at `100rem` with a responsive `1.125rem–3.5rem` gutter.
- Use a 12-column editorial grid at desktop sizes.
- Prefer asymmetric compositions and deliberate overlap.
- Alternate dense inspection moments with large areas of breathing room.
- Product groups use hairline-divided cells rather than floating card grids.
- Corners are square. Pill geometry is reserved for primary navigation actions and badges.
- Avoid gradients except subtle atmospheric light inside product evidence scenes.

## Components

### Header

- Sticky cinema-black shell with a single bottom hairline.
- Widely tracked uppercase wordmark and technical navigation labels.
- Download is a signal-orange outline pill that fills on hover.
- Mobile navigation uses a full-width dark panel with at least 48px rows.

### Buttons

- Primary: signal-orange fill, black label, pill geometry.
- Secondary: transparent, quiet gray outline, light label.
- Light-context: transparent black outline, inverts on hover.
- Labels are uppercase monospace at `0.625rem` with `0.13em` tracking.
- Minimum height is `3.15rem` on marketing surfaces.

### Product evidence

- The product frame should read as a real instrument, not a decorative mockup.
- Use authentic values, clear states, subtle depth, and a single movable inspection focus.
- Product scenes are non-essential illustrations with complete accessible labels.

### Editorial feature cells

- Two columns on desktop, one on small screens.
- Hairline boundary, large condensed title, serif explanation, technical text link.
- Dark inversion on hover is allowed when text contrast remains compliant.

### Footer

- Oversized outline statement rather than a solid-color brand wall.
- Hairline-divided columns, restrained link motion, visible platform actions.

## Motion

- Use `cubic-bezier(0.16, 1, 0.3, 1)` for entrances and spatial transforms.
- Reveal sections progressively through `IntersectionObserver`.
- Animate only opacity and transforms for scroll reveals.
- Pointer response is limited to the decorative inspection focus.
- Never hide content indefinitely if scripting or observation is unavailable.
- Respect `prefers-reduced-motion: reduce` globally.

## Responsive behavior

- **Wide (`> 1184px`):** full asymmetric hero, 12-column editorial compositions.
- **Laptop (`992–1184px`):** inspection frame overlaps less and typography scales down.
- **Tablet (`768–992px`):** hero becomes sequential; two-column evidence steps remain.
- **Mobile (`< 768px`):** single-column product features and platform panels; signal data becomes 2×2.
- **Narrow mobile (`< 512px`):** actions stack, evidence loop becomes one column, platform specifications become rows.

No breakpoint may introduce horizontal page scrolling. Headline sizing uses `clamp()` and should be tested at 320, 375, 768, 1024, and 1440px.

## Accessibility acceptance criteria

- One `h1`; headings follow a logical hierarchy.
- Main content has a working skip link.
- Interactive elements have visible focus and a minimum 44×44px target where applicable.
- Text and meaningful UI meet WCAG 2.2 AA contrast.
- Orange is never the only indicator of status.
- Illustrative product frames have descriptive accessible names and no nested focus targets.
- Layout and information remain available when motion is reduced or JavaScript is unavailable.
- Keyboard, zoom, forced-colors, and screen-reader behavior are verified before release.

## Avoid

- Generic gradient-orb SaaS heroes.
- Repeated rounded cards and oversized corner radii.
- Dense blueprint grids, HUD decoration, or faux-terminal noise.
- Decorative orange everywhere.
- Stock accessibility photography and generic accessibility icons as hero art.
- Custom cursors, scroll hijacking, parallax on text, or motion that blocks reading.
- Copying automotive names, imagery, logos, or brand-specific compositions.
