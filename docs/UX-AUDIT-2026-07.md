# TheWCAG UX and client-experience audit

Audit date: 22 July 2026
Surfaces: public website, authentication and account service, desktop audit workstation, Chrome extension, administration views, and first-time guide.

## Executive result

The product already had a strong, consistent visual system and a coherent five-stage audit model. No unresolved critical application defect was found in this pass. The highest-impact gaps were first-time route choice, developer extension installation, keyboard bypass of repeated desktop/extension chrome, undersized extension and footer controls, destructive-account affordance, and several places where the website did not use the desktop product's current language.

All issues that could be resolved safely in the repository were implemented. Remaining items need a distribution account, production credentials, physical assistive-technology/device testing, or release operations rather than another interface change.

## Scope and method

- Followed the signed-out website journey across landing, Getting started, audit software, Chrome extension, pricing, download, sign in, protected-route callbacks, and public legal/support states.
- Inspected signed-in account, subscription, report, branding, device, delete-account, and administrator implementations at source level. A real magic-link email, Dodo checkout, or destructive production action was intentionally not triggered.
- Exercised the live desktop renderer, Plan gate, scoper, audit template, command palette, status inspector, Settings, account/service messaging, empty audit state, and packaged Windows runtime.
- Inspected the complete extension capture, evidence, consent, deterministic/AI draft, WCAG mapping, save/export, connection, expiry, and protected-page paths; then built and tested the production extension bundle.
- Reviewed loading, error, global error, not-found, empty, success, pending, disabled, callback, pagination, responsive, focus, forced-colors, and reduced-motion behavior.

## Prioritized issue list

| Priority | Surface | Issue found | Resolution |
| --- | --- | --- | --- |
| High | Website | A new visitor had to infer whether to read the guide, download locally, or compare hosted services from a long landing-page narrative. | Added a compact “What do you need today?” decision panel immediately after product proof, with distinct first-audit, local-work, and hosted-service routes. |
| High | Chrome extension website | The public store listing is not ready, but the page only linked to source and did not explain how a tester could install or connect the current build. | Added a complete four-step developer-build flow, current limitations, local-mode expectations, setup guide, and source links. The first-time guide now points to it. |
| High | Desktop and extension | Keyboard users had no direct bypass around repeated application chrome. | Added focus-visible skip links and programmatic main-workspace targets to both surfaces. |
| High | Extension | Multiple interactive controls were 24–42 px and some review copy was 9–10 px, increasing miss and reading risk in the narrow side panel. | Raised primary interactive targets to 44 px, increased critical helper copy, made affected-user chips true flex targets, and added a 355 px WCAG-card reflow. |
| High | Account | The permanent-delete button became actionable before the exact destructive confirmation phrase was entered. | Made confirmation controlled and kept the action disabled until `DELETE MY ACCOUNT` matches exactly; server validation remains the final authority. |
| High | Reports | The empty state told users to press “Share,” while the current desktop stage is “Deliver,” and offered no recovery path. | Updated the terminology and added direct guide/download actions. |
| Medium | Website header | The desktop account disclosure stayed open after outside clicks, Escape, or navigation. | Added a dedicated disclosure controller with outside dismissal, Escape focus restoration, navigation reset, and state-aware accessible naming. |
| Medium | Mobile navigation | The accessible menu name always said “Open navigation menu,” including while open. | Added open-state tracking and a matching “Close navigation menu” name while preserving native disclosure semantics. |
| Medium | Branding | Free-typed invalid hex values could disagree with the native color control and preview. | Added a safe preview fallback, explicit six-digit validation, inline alert, `aria-invalid`, and submit blocking until valid. |
| Medium | Reports and administration | An out-of-range `?page=` could show an empty list while the page counter implied a valid last page. | Clamp by redirecting report, admin-report, and admin-user URLs to the actual final page. |
| Medium | Sign in | The account boundary was technically correct but did not explain that local audits remain free and accountless. | Added first-audit/download routes and a concise explanation of exactly which hosted services require sign-in. |
| Medium | Website footer | Platform, GitHub, and navigation targets computed below 44 px. | Raised all 21 footer targets to a measured minimum height of 44 px. |
| Medium | Extension | Desktop connection changes were visible but not announced as live status. | Added a polite live status region to the connection badge. |
| Medium | Desktop | The detailed website guide was not discoverable from inside the audit workstation. | Added an accessible command-bar guide control using the existing allowlisted external-link bridge. |
| Low | Build hygiene | The alternate packaged-runtime verification output could appear as untracked source. | Added the local `release-check` output to ignored build artifacts. |

## Before and after

| Area | Before | After |
| --- | --- | --- |
| First visit | Two hero actions, followed by a long product explanation; visitors had to decide where they belonged. | One compact decision row separates learning, local work, and hosted services without changing the hero. |
| First audit | The screenshot guide was comprehensive but the desktop app had no direct route back to it. | The guide is reachable from the desktop command bar and sign-in, report, landing, and extension paths. |
| Extension installation | “View extension source” was the only actionable current-distribution route. | Build, Load unpacked, local capture, pairing, limitations, and complete setup instructions are explicit. |
| Keyboard navigation | Website skip navigation existed; desktop and extension repeated chrome had to be traversed. | All three surfaces expose a focus-visible skip path to the task workspace. |
| Report empty state | Referred to a retired “Share” label and stopped at explanatory copy. | Uses “Deliver” and offers guide/download recovery actions. |
| Account deletion | Server rejected a wrong phrase, but the destructive submit remained enabled. | Submit stays unavailable until the exact phrase is present and remains server-validated. |
| Branding color | Invalid manual hex text could put the picker, preview, and submitted value out of sync. | Picker and preview stay safe; invalid text is explained and cannot be saved. |
| Narrow extension UI | Several controls fell below the 44 px target and WCAG controls could become cramped. | Critical controls meet 44 px and the WCAG header reflows at 355 px. |

## User-type coverage

- First-time visitor: clear start paths, truthful free/local boundary, screenshot-led guide, and extension installation expectations.
- Returning visitor: direct download, pricing, sign-in, account, reports, and branding paths remain visible without repeating onboarding.
- Local auditor: no sign-in requirement, local-storage messaging, bounded scoper, templates, readiness blockers, evidence traceability, and export path remain intact.
- Pro subscriber: managed AI, hosted-report, analytics, storage, branding, billing-return, and portal messaging remain separated from free local work.
- Administrator: report/user pagination now recovers from stale URLs; destructive actions remain separately confirmed.
- Keyboard, reduced-motion, and forced-colors user: visible focus, skip links, native dialogs/disclosures, Escape handling, reduced-motion rules, and forced-color borders are present.
- Extension developer/tester: can reach a current installable workflow without implying that a public store release exists.

## Confirmed strengths and non-issues

- Authentication is deliberately passwordless, so password creation/reset flows are not missing. Protected routes preserve a safe callback and the email-check state includes resend recovery.
- The desktop Plan gate blocks premature inspection with a specific next action. The built-in scoper is bounded to public, same-origin HTML, explains confidence, and never claims conformance.
- Desktop command palette uses dialog/listbox/combobox semantics and exposes arrow, Enter, and Escape instructions.
- Report publishing is intentionally separated from local evidence, displays entitlement/readiness constraints, and never makes working data public by default.
- Loading, route error, global startup error, not-found, billing return, pending checkout, empty, and success states all provide plain-language next actions.
- Original first-time screenshots, detailed alternative text, full-image links, privacy guidance, and the complete Plan → Inspect → Evidence → Review → Deliver sequence are already present.
- The landing hero, desktop shell, extension surface, and website maintain the same cream/ink/orange visual language without detected desktop overlap or horizontal overflow.

## Responsive and accessibility review

- Live visual review completed at 1280 × 720 for the website and at 1280 × 720 / packaged 1167 × 763 for the desktop application.
- Website breakpoints at 68, 60, 48, 36, and 23.5 rem were checked for grid collapse, menu substitution, footer stacking, hero reflow, and the new starting-path panel.
- Desktop viewport and container rules at 1040, 760, 520 px and task containers at 700/460 px were checked for rail, inspector, command, form, and panel reflow.
- Extension width handling at 440, 355, and 320 px was checked for header, connection, evidence, consent, affected-user, and WCAG-control wrapping.
- All new interactive behavior retains visible focus, semantic names, and reduced-motion compatibility. Footer target measurement reported 44 px minimum across 21 links.

## Verification

- Repository lint: passed.
- Automated tests: 146 passed across contracts, extension, accessibility core, desktop, website, and release scripts.
- TypeScript: all four workspace typechecks passed.
- Production builds: extension, desktop main/preload/renderer, bundle validation, and Next.js website passed.
- Packaged Windows runtime: loaded `resources/app.asar/out/renderer/index.html`, rendered one React root, and produced a visible 1167 × 763 layout with audit content.
- Browser DOM review: landmark/headings, route links, protected callbacks, command dialog, Plan gate, Settings, first-time routes, and developer extension setup verified.

## Remaining future recommendations

These are intentionally not represented as completed interface work:

1. **Publish the Chrome Web Store listing (High).** Requires the organization’s Chrome Web Store account, approved listing/privacy disclosures, and final production extension ID. Replace the developer-flow emphasis with the verified store link after approval; keep sideload instructions under a developer disclosure.
2. **Run production-service acceptance tests (High).** Use owned test accounts to complete a real email magic link, Dodo sandbox monthly/annual purchase, webhook activation, billing portal, cancellation/grace/expiry, hosted report publication, analytics, branding, and account deletion. No production email, payment, or destructive action was sent during this audit.
3. **Complete a physical assistive-technology matrix (Medium).** Record NVDA + Chrome/Firefox, JAWS + Chrome, VoiceOver + Safari, Windows High Contrast, keyboard-only, 200% browser zoom, 400% text reflow, and representative touch-device results. Automated semantics and code inspection do not replace that evidence.
4. **Ship signed Windows releases (Medium, operational).** The current release documentation intentionally permits unsigned Windows artifacts. Adopt a CI-compatible signing service to reduce SmartScreen/install trust friction.
5. **Add privacy-preserving funnel telemetry (Low).** Measure guide → download, download → first completed plan, and first delivery without collecting audit content. Use the data to simplify only the steps users actually abandon.
