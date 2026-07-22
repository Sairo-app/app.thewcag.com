# Dodo Payments operations

TheWCAG uses Dodo Payments as its only billing provider. The local audit workstation, extension, local exports, deterministic drafts, and direct AI providers using the auditor's own key remain free. Pro authorizes only TheWCAG-operated managed AI and hosted report services.

## Dodo catalog

Create one monthly and one annual recurring product in the same `TheWCAG Pro` product collection. Configure the customer portal to permit invoice access, payment-method recovery, cancellation, and monthly/annual changes. Copy the environment-specific product IDs into `DODO_PRO_MONTHLY_PRODUCT_ID` and `DODO_PRO_ANNUAL_PRODUCT_ID`; never accept a product ID from a browser request.

Create a webhook for:

```text
https://app.thewcag.com/api/billing/webhooks
```

Subscribe to subscription active, renewed, on-hold, cancelled, failed, expired, plan-changed, updated, and payment-method-update events, plus successful refunds and accepted/lost disputes. Store the endpoint signing secret as `DODO_PAYMENTS_WEBHOOK_KEY` and the exact business identifier as `DODO_PAYMENTS_BUSINESS_ID`.

Use `test_mode` outside production. Production startup rejects a partially configured Dodo integration, test-mode billing, or a reconciliation secret shorter than 32 characters.

## Deployment order

1. Apply `apps/web/drizzle/0004_dodo_billing.sql` or run the repository migration command.
2. Deploy the signed webhook and reconciliation route before enabling pricing buttons.
3. Configure both test products, business ID, API key, webhook key, and a strong reconciliation secret.
4. Exercise purchase, renewal, on-hold/recovery, cancellation, refund, dispute, account deletion, and report retention in Dodo test mode.
5. Create equivalent live products, switch all Dodo values together, and deploy with `DODO_PAYMENTS_ENVIRONMENT=live_mode`.
6. Complete an internal live purchase and cancellation before opening checkout broadly.

The return page never grants access. Only a verified webhook or server-to-server reconciliation updates the normalized subscription row.

## Reconciliation and retention schedule

Invoke the route at least hourly from a scheduler that can send an Authorization header:

```sh
curl --fail --silent --show-error \
  -H "Authorization: Bearer $BILLING_RECONCILE_SECRET" \
  https://app.thewcag.com/api/internal/billing/reconcile
```

The job checks up to 100 nonterminal subscriptions per run, expires elapsed report grace periods, deletes up to 100 retained report objects/rows per run, removes webhook ledger entries and deleted-account ID tombstones after 180 days, and removes checkout/portal attempt records after 30 days. Run it repeatedly when either backlog reaches the batch size. A response reports checked, failed, expired, and deleted counts without returning customer or payment data.

## Incident checks

- A rising `Failed webhooks` admin metric means signature verification succeeded but state application failed. Check bounded server error codes; never log or copy raw payloads.
- A customer who paid but remains Free should first be reconciled against the Dodo subscription ID. Do not edit a user or entitlement directly.
- Unknown products are ignored. Correct the environment mapping or Dodo catalog and reconcile again.
- Report objects must remain in a private R2 bucket. Do not enable an `r2.dev` public URL or a public-read bucket policy.
- If account deletion reports a billing error, the account is intentionally preserved. Cancel/recover the Dodo subscription and retry deletion.
- Rotate a leaked API, webhook, or reconciliation secret immediately. Update the deployment atomically and send a signed test webhook afterward.

## Acceptance evidence

Before each billing release, retain non-PII evidence that invalid signatures fail, duplicate events are idempotent, old events do not regress state, reconciliation repairs a missed event, Free requests are rejected before evidence/image parsing, concurrent quotas hold, private report images return `410` after revocation, and account deletion cancels billing first.

Official references: [checkout sessions](https://docs.dodopayments.com/developer-resources/checkout-session), [webhooks](https://docs.dodopayments.com/developer-resources/webhooks), [subscription lifecycle](https://docs.dodopayments.com/developer-resources/webhooks/intents/subscription), and [customer portal](https://docs.dodopayments.com/features/customer-portal).
