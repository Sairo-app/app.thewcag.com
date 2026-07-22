# Opt-in funnel telemetry

TheWCAG measures three aggregate product transitions only. Telemetry is content-free, anonymous, and off by default.

## Events and exact firing rules

| Event | Fires when | Consent boundary | Maximum attempts |
| --- | --- | --- | --- |
| `guide_to_download` | A visitor activates a Download link on `/getting-started`. | The visitor must first enable **Share one anonymous guide milestone** on that page. | Once per browser profile. |
| `download_to_first_plan` | The installed desktop app first reaches the existing Plan readiness rule: all seven core Plan fields are complete, at least one representative sample exists, and every sample has a name and exact location. | Desktop **Settings → Privacy → Share anonymous funnel milestones** must be enabled. | Once per desktop installation. |
| `first_plan_to_first_deliver` | The auditor first enters the desktop Deliver stage after the completed-Plan transition has been attempted. Entering Deliver is the milestone; exporting or publishing is not required. | The same desktop privacy setting must be enabled. | Once per desktop installation. |

The desktop queues the Plan transition before the Deliver transition so their order cannot be reversed. A failed network attempt is not retried, which avoids duplicate aggregate counts.

## Payload and storage

Every request to `POST /api/telemetry` has exactly this shape:

```json
{ "event": "guide_to_download" }
```

`event` must be one of the three names above. The endpoint rejects missing fields, unknown event names, arrays, nested event objects, and every additional field. Request bodies are read through `apps/web/lib/bounded-json.ts` with a 128-byte limit.

The server stores only one aggregate row per event:

```text
event | count
```

There is no event-level record and no identifier that can connect one transition to another. The application does not read or persist request headers for telemetry.

The desktop stores only the names of transitions it has already attempted in its local settings store. This state contains no audit or account data.

## Data that is never accepted or stored

- Audit names, scope, methodology, conclusions, or other audit content
- URLs or locations under test
- Screenshots, captures, annotations, or image data
- Findings, WCAG decisions, evidence, or remediation details
- Names, email addresses, account or subscription details
- Device names, installation IDs, advertising IDs, IP addresses, or other identifiers
- Referrer, user-agent, timestamps, or arbitrary metadata

Payload validation rejects all non-allowlisted fields even when the event itself is valid.

## Disabling telemetry

Both consent controls default to off:

- Leave the guide-page checkbox unchecked to disable `guide_to_download`.
- Leave **Settings → Privacy → Share anonymous funnel milestones** off to disable both desktop transitions.

Turning either control off prevents future requests from that surface. Because the server stores only anonymous aggregate counters, an earlier count cannot be located or associated with a person for deletion.
