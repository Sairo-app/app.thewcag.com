# Automated accessibility signals

The web quality workflow runs axe-core against the built `apps/web` Next.js site. These checks are engineering signals only: they are not a WCAG conformance claim, certification, pass rate, or score. Manual auditing remains required.

## What CI scans

The `web-accessibility-signals` job in `.github/workflows/quality.yml` builds the production site and scans:

- `/`
- `/getting-started`
- `/download`
- `/pricing`
- `/wcag-contrast`
- `/wcag-checklist`
- `/s/A11yScan01`, backed by synthetic, environment-gated report data

Every route runs in four Chromium profiles: a 1440-pixel desktop viewport, a 320-pixel mobile viewport, forced colors, and reduced motion. Axe is limited to WCAG 2.0 A/AA, 2.1 A/AA, and 2.2 AA rule tags. Any untriaged violation fails the job. Incomplete axe results remain visible as manual-review signals but are not converted into a verdict.

## Run it locally

Install Chromium once, build the site, then run the scan:

```sh
pnpm --filter @thewcag/web exec playwright install chromium
ACCESSIBILITY_SCAN_FIXTURE=1 NEXT_PUBLIC_APP_URL=https://app.thewcag.com pnpm build:web
pnpm a11y:web
```

The Playwright configuration starts the built server and enables the synthetic report fixture only for the exact CI sample slug. It does not use or expose customer reports, URLs under audit, screenshots, credentials, or working data.

## Triage allowlist

Fix a reported violation whenever possible. If a violation cannot be fixed immediately and the team explicitly accepts temporary triage, add the narrowest possible entry to `apps/web/a11y/axe-allowlist.json`:

```json
{
  "ruleId": "color-contrast",
  "routes": ["/pricing"],
  "profiles": ["forced-colors"],
  "targets": ["[\".pricing-note\"]"],
  "reason": "Tracked design-system dependency needs a coordinated token migration.",
  "owner": "Web platform",
  "issue": "https://github.com/your-org/your-repo/issues/123",
  "expiresOn": "2026-08-31"
}
```

Copy the exact `ruleId`, route, profile, and serialized target from the failing CI output. Wildcards are unsupported. Each entry must include a meaningful reason, accountable owner, HTTPS tracking issue, and non-expired ISO date. Expired or malformed entries fail before scanning. Remove the entry as part of the fix.

Do not publish the scan output, aggregate it into a user-facing score, or describe a clean automated run as conformance. A zero-signal run means only that axe found no untriaged A/AA violations on these routes and profiles at that point in time.
