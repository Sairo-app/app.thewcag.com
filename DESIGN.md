# TheWCAG Design System

## Direction

The visual language is a precise product workshop: cool daylight, calibrated instruments, clear evidence sheets, and one unmistakable orange action color. It is light, compact, and confident without becoming sterile.

Design dials:

- Design variance: 4/10
- Motion intensity: 2/10
- Visual density: 5/10

## Core tokens

- Canvas: `oklch(0.978 0.006 250)`
- Surface: `oklch(0.995 0.002 250)`
- Soft surface: `oklch(0.95 0.012 250)`
- Ink: `oklch(0.205 0.028 255)`
- Body: `oklch(0.41 0.025 255)`
- Muted: `oklch(0.49 0.022 255)`
- Line: `oklch(0.865 0.014 250)`
- Orange: `oklch(0.66 0.19 39)`
- Accessible orange text: `oklch(0.47 0.17 38)`
- Success: `oklch(0.46 0.12 160)`
- Danger: `oklch(0.48 0.18 27)`

Orange is the only brand accent. Success, warning, and danger colors appear only when they communicate a real state.

## Typography

- Display: Manrope, weights 600-800.
- Body: Source Sans 3, weights 400-700.
- Technical values: JetBrains Mono, weights 400-600.
- Display tracking never goes below `-0.04em`.
- Body measures stay below 72 characters.
- Headings use balanced wrapping and body copy uses pretty wrapping.

## Shape and depth

- Cards and substantial panels use a 14px radius.
- Inputs and buttons use a 10px radius.
- Chips and status labels may be full pills.
- Borders and whitespace carry most hierarchy.
- Shadows are reserved for menus and the main product preview. A border and a wide decorative shadow are never paired.

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

- Primary: orange fill with dark ink text.
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

## Motion

- No scroll hijacking, parallax, custom cursor, or perpetual animation.
- Hover and press feedback use 120-180ms transitions.
- Menus and state changes may use short opacity and transform transitions.
- Keyboard-triggered product actions remain immediate.
- Reduced motion removes transforms and keeps only short color or opacity feedback.

## Accessibility acceptance

- One `h1` per page and logical headings.
- Skip link reaches `#main` and becomes visible on focus.
- Focus outline uses the accessible orange token with a 3px offset.
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
