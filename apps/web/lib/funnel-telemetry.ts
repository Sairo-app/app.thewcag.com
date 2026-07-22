export const FUNNEL_TRANSITION_EVENTS = [
  "guide_to_download",
  "download_to_first_plan",
  "first_plan_to_first_deliver",
] as const;

export type FunnelTransitionEvent = (typeof FUNNEL_TRANSITION_EVENTS)[number];

export interface FunnelTelemetryPayload {
  event: FunnelTransitionEvent;
}

const EVENT_SET = new Set<string>(FUNNEL_TRANSITION_EVENTS);

/** Accept exactly one allowlisted event field. No metadata or content fields are permitted. */
export function parseFunnelTelemetryPayload(value: unknown): FunnelTelemetryPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid telemetry payload");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== "event" || typeof record.event !== "string" || !EVENT_SET.has(record.event)) {
    throw new Error("Invalid telemetry payload");
  }
  return { event: record.event as FunnelTransitionEvent };
}
