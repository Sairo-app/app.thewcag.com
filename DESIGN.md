# TheWCAG Design System

## Direction

The visual language is a precise product workshop: cool daylight, calibrated instruments, clear evidence sheets, and one unmistakable orange action color. It is light, compact, and confident without becoming sterile.

Design dials:

- Design variance: 4/10
- Motion intensity: 2/10
- Visual density: 5/10

## Core tokens

This block is copied verbatim into the web, desktop, and extension stylesheets. Change all four copies together; the token tests reject drift.

<!-- canonical-design-tokens:start -->
```css
:root {
  --canvas: oklch(0.968 0.026 84);
  --surface: oklch(0.992 0.012 85);
  --surface-soft: oklch(0.943 0.034 82);
  --surface-strong: oklch(0.895 0.044 79);
  --ink: oklch(0.215 0.034 54);
  --body: oklch(0.39 0.034 58);
  --muted: oklch(0.51 0.03 61);
  --line: oklch(0.83 0.042 77);
  --line-strong: oklch(0.68 0.052 72);
  --action: oklch(0.52 0.18 42);
  --action-hover: oklch(0.47 0.17 40);
  --action-text: oklch(0.48 0.17 39);
  --action-soft: oklch(0.925 0.065 57);
  --on-orange: oklch(0.98 0.014 85);
  --success: oklch(0.43 0.12 153);
  --danger: oklch(0.48 0.18 27);
  --radius-panel: 14px;
  --radius-control: 10px;
  --hairline: 1px solid var(--line);
  --hairline-strong: 1px solid var(--line-strong);
  --elevation-0: none;
  --elevation-1: 0 1px 2px rgb(33 24 14 / 0.08), 0 6px 24px rgb(33 24 14 / 0.10);
  --elevation-2: 0 2px 4px rgb(33 24 14 / 0.10), 0 18px 48px rgb(33 24 14 / 0.14);
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --control-height-compact: 36px;
  --control-height-standard: 44px;
  --card-padding: var(--space-5);
  --rhythm-editorial: var(--space-8);
  --rhythm-marketing: var(--space-12);
  --rhythm-product: var(--space-4);
  --rhythm-admin: var(--space-3);
  --motion-duration-fast: 120ms;
  --motion-duration-base: 180ms;
  --motion-easing-entrance: cubic-bezier(0.23, 1, 0.32, 1);
  --motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --focus-ring-color: var(--action-text);
  --focus-ring-width: 2px;
  --focus-halo-width: 3px;
  --focus-halo-color: color-mix(in oklch, var(--action) 24%, transparent);
  --focus-halo-shadow: 0 0 0 calc(var(--focus-ring-width) + var(--focus-halo-width) + 1px) var(--focus-halo-color);
  --font-family-display: "Manrope", system-ui, sans-serif;
  --font-family-body: "Source Sans 3", system-ui, sans-serif;
  --font-family-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", "Cascadia Code", Consolas, monospace;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --type-caption-size: 0.625rem;
  --type-caption-line: 1.4;
  --type-caption-tracking: 0.01em;
  --type-footnote-size: 0.6875rem;
  --type-footnote-line: 1.45;
  --type-footnote-tracking: 0.008em;
  --type-callout-size: 0.75rem;
  --type-callout-line: 1.5;
  --type-callout-tracking: 0.005em;
  --type-body-size: 0.875rem;
  --type-body-line: 1.6;
  --type-body-tracking: 0em;
  --type-headline-size: 1rem;
  --type-headline-line: 1.45;
  --type-headline-tracking: -0.005em;
  --type-title-3-size: 1.125rem;
  --type-title-3-line: 1.35;
  --type-title-3-tracking: -0.01em;
  --type-title-2-size: 1.375rem;
  --type-title-2-line: 1.25;
  --type-title-2-tracking: -0.015em;
  --type-title-1-size: 1.75rem;
  --type-title-1-line: 1.15;
  --type-title-1-tracking: -0.022em;
  --type-large-title-size: clamp(2.125rem, 4vw, 3.5rem);
  --type-large-title-line: 1.08;
  --type-large-title-tracking: -0.03em;
  --type-display-size: clamp(3rem, 6vw, 5.5rem);
  --type-display-line: 1.02;
  --type-display-tracking: -0.04em;
}
```
<!-- canonical-design-tokens:end -->

Orange is the only brand accent. Success, warning, and danger colors appear only when they communicate a real state.

## Typography

- Display: Manrope with the canonical system fallback, weights 600-800.
- Body: Source Sans 3 with the canonical system fallback, weights 400-700.
- Technical values: JetBrains Mono with the canonical monospace fallbacks, weights 400-600.
- Caption, footnote, callout, body, headline, title-3, title-2, title-1, large-title, and display use only the size, line-height, and tracking triplets in Core Tokens.
- Tracking is optical and monotonic: `0.01em` at caption size, neutral around body size, and `-0.04em` at display size.
- Body and interface copy use Source Sans 3. Headings and display text use Manrope.
- Code, hexadecimal values, and true monospace content use JetBrains Mono.
- Ratios, APCA Lc values, WCAG criteria, view counts, tables, and audit metrics use tabular lining numerals.
- Editorial body measures stay at or below 72ch.
- Headings use balanced wrapping and body copy uses pretty wrapping.

## Shape and depth

- Cards and substantial panels use `--radius-panel` (14px).
- Inputs and buttons use `--radius-control` (10px).
- Chips and status labels may be full pills.
- Flat cards and panels use a solid `--surface` or `--surface-soft` material, `--hairline` or `--hairline-strong`, and `--elevation-0`.
- Menus, popovers, dialogs, notices, and other floating surfaces use `--elevation-1` with no decorative border. Forced-colors mode restores a visible system-color border.
- `--elevation-2` is reserved for the single primary hero or product-preview surface in a composition and is never paired with a visible border.
- Row and section separators use `--hairline`; structural emphasis may use `--hairline-strong`.
- Decorative gradients, component-specific shadows, and visible borders paired with wide shadows are not part of the system.

## Spacing and density

- Padding, margin, and gap values use the `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`, `--space-8`, `--space-10`, and `--space-12` scale. Larger section spacing composes these tokens.
- `--card-padding` is the standard inset for cards and substantial panels.
- `--control-height-compact` is the 36px visual height for compact chrome contained inside a larger target. Standalone interactive controls use `--control-height-standard` and retain a minimum 44px target.
- Editorial content uses `--rhythm-editorial`; marketing sections use `--rhythm-marketing` and composed multiples where a larger section break is required.
- Product interfaces use `--rhythm-product`; administration interfaces use `--rhythm-admin`.
- Negative one- and two-pixel seam corrections, print units, viewport-relative spacing, and off-screen accessibility positioning are technical exceptions to the grid.
- Transactional email markup and fixed-format generated images use the same scale as explicit pixel equivalents where application CSS custom properties are unavailable.

## Layout

- Shared shell: maximum 1240px with fluid gutters.
- Header: one line at desktop, 68px maximum height.
- Marketing hero: two columns on wide screens, one column below 960px, and fully visible within a typical laptop viewport.
- Editorial guides: 760px reading measure with strong vertical rhythm.
- Product and admin screens: denser 1080-1240px shells with tables and list actions preserved.
- Multi-column layouts become one column below 768px unless a two-column compact arrangement remains more usable.

## Components

### Header

A solid, quiet navigation rail with the wordmark on the left, four primary links, account access, and an orange download action. The mobile menu is a native disclosure with explicit focus and Escape behavior.

### Buttons

- Primary: deep orange fill with cream text. The pairing must remain at or above 4.5:1 contrast in normal and hover states.
- Secondary: transparent or white surface with a visible neutral border.
- Dark: ink fill with off-white text, used sparingly.
- Press feedback scales to 0.98 for 120ms.
- Labels never wrap on desktop.

### Product preview

The homepage hero uses the real keyboard-operable preview component. Its Contrast, Evidence, and Vision tabs demonstrate authentic product vocabulary without claiming a live audit.

### Marketing sections

Use varied structures instead of repeated equal card rows: an asymmetric capability map, two platform workspaces, a compact feature matrix, a linear workflow, and one focused final action.

### Editorial pages

Guide pages share clear article typography, sparse separators, readable tables, structured ordered lists, and one callout action. FAQ entries use headings and negative space instead of nested cards.

### Product screens

Authentication, device connection, report libraries, branding, public reports, and admin pages use the same form controls, surfaces, focus states, and compact information hierarchy. Their actions and data contracts remain unchanged.

### Footer

The footer stays in the light theme family. It ends with a strong orange download panel followed by compact navigation, platform links, repository access, and the local-first promise.

### Icons

- Phosphor is the canonical UI icon family on web, desktop, and extension surfaces. Custom logos, wordmarks, and genuine platform or company marks remain unchanged.
- Icons render only at 16px for inline and body-text actions, 20px for controls, buttons, navigation, and toolbars, 24px for section and panel headings, or 32px for empty states and hero marks.
- `regular` is the default weight. A selected or toggled control may use `fill` without changing size; `fill` is also permitted for genuine success, warning, or danger status. It is not decorative emphasis.
- `duotone` is restricted to an intentional 32px empty-state or hero illustration and is not used in dense interfaces.
- Every UI glyph renders through the surface `Icon` wrapper, inherits `currentColor`, and aligns to adjacent text without changing the line box. Icon colors come from the surrounding semantic text or control state, never hardcoded color values.
- Decorative icons use `aria-hidden="true"`. A meaningful standalone icon receives an accessible label from the wrapper, and every icon-only control has an `aria-label` or equivalent labeling relationship. Visible text or an accessible name always accompanies icon-only meaning or state.
- Forced-colors mode keeps icons on `currentColor`, preserves filled-state silhouettes, and leaves the control's visible text or accessible name as the authoritative state cue.

## Motion

- No scroll hijacking, parallax, custom cursor, or perpetual animation.
- `--motion-duration-fast` is 120ms for pressed feedback and other direct manipulation.
- `--motion-duration-base` is 180ms for color, opacity, shadow, and floating-surface entrances.
- `--motion-easing-entrance` is `cubic-bezier(0.23, 1, 0.32, 1)`; `--motion-easing-standard` is `cubic-bezier(0.2, 0, 0, 1)`.
- Menus, dialogs, disclosures, popovers, and toasts enter with opacity plus at most 4px of vertical translation. Tabs use the same base timing without spatial movement.
- Hover feedback changes only color, opacity, or shadow and never changes layout or position.
- Pressed buttons, button-like links, and disclosure triggers use `scale(0.98)` for the fast duration.
- Keyboard-triggered product actions remain immediate.
- Reduced motion removes entrance translation, animations, and pressed scaling while retaining only immediate or fast color, opacity, and shadow feedback.

## Accessibility acceptance

- One `h1` per page and logical headings.
- Skip link reaches `#main` and becomes visible on focus.
- Focus uses a 2px orange ring with a soft 3px outer halo on canvas, cream, white, soft, orange, and dark surfaces.
- Forced-colors mode replaces the halo with a solid 2px `Highlight` outline.
- Text meets WCAG AA and body text targets stronger contrast where practical.
- Forms keep visible labels, helper text, and inline errors.
- Tables retain headers and horizontal containment on narrow screens.
- No meaning depends on color alone.
- Pages reflow without horizontal document scrolling at 320px.
- Forced-colors and reduced-motion preferences remain usable.

## Avoid

- Em dash and en dash characters in visible copy.
- Generic three-card feature rows.
- Repeated uppercase section eyebrows.
- Decorative grids, fake screenshots, gradient text, and glow effects.
- Mixed theme sections or random accent colors.
- Placeholder customers, metrics, testimonials, or certifications.
