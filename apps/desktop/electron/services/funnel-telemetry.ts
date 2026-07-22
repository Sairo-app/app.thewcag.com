import type {
  AppSettings,
  FunnelTelemetryEvent,
} from "../../src/shared/desktop";
import { FUNNEL_TELEMETRY_EVENTS } from "../../src/shared/desktop";

const DEFAULT_SITE = "https://app.thewcag.com";
const STATE_KEY = "funnel-telemetry-v1";
const EVENT_SET = new Set<string>(FUNNEL_TELEMETRY_EVENTS);

interface TelemetryState {
  attempted: FunnelTelemetryEvent[];
}

interface SettingsReader {
  get(): Promise<AppSettings>;
}

interface StateStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
}

export interface FunnelTelemetryResult {
  attempted: boolean;
  accepted: boolean;
  reason?: "disabled" | "duplicate" | "prerequisite" | "unavailable";
}

function eventValue(value: unknown): FunnelTelemetryEvent {
  if (typeof value !== "string" || !EVENT_SET.has(value)) throw new Error("Unsupported telemetry event");
  return value as FunnelTelemetryEvent;
}

export function parseDesktopTelemetryRequest(value: unknown): FunnelTelemetryEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid telemetry request");
  const request = value as Record<string, unknown>;
  const keys = Object.keys(request);
  if (keys.length !== 1 || keys[0] !== "event") throw new Error("Invalid telemetry request");
  return eventValue(request.event);
}

function normalizeState(value: unknown): TelemetryState {
  const attempted = value && typeof value === "object" && Array.isArray((value as Partial<TelemetryState>).attempted)
    ? (value as Partial<TelemetryState>).attempted!.filter(
        (event): event is FunnelTelemetryEvent => typeof event === "string" && EVENT_SET.has(event),
      )
    : [];
  return { attempted: [...new Set(attempted)] };
}

export class FunnelTelemetryService {
  private queue: Promise<void> = Promise.resolve();
  private readonly endpoint: URL;

  constructor(
    private readonly settings: SettingsReader,
    private readonly store: StateStore,
    site = process.env.MAIN_VITE_SITE_URL || DEFAULT_SITE,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.endpoint = new URL("/api/telemetry", new URL(site).origin);
  }

  emit(value: unknown): Promise<FunnelTelemetryResult> {
    const event = eventValue(value);
    const request = this.queue.then(() => this.attempt(event));
    this.queue = request.then(() => undefined, () => undefined);
    return request;
  }

  private async attempt(event: FunnelTelemetryEvent): Promise<FunnelTelemetryResult> {
    const settings = await this.settings.get();
    if (!settings.shareAnonymousFunnelTelemetry) {
      return { attempted: false, accepted: false, reason: "disabled" };
    }

    const state = normalizeState(await this.store.get<unknown>(STATE_KEY, { attempted: [] }));
    if (state.attempted.includes(event)) {
      return { attempted: false, accepted: false, reason: "duplicate" };
    }
    if (event === "first_plan_to_first_deliver" && !state.attempted.includes("download_to_first_plan")) {
      return { attempted: false, accepted: false, reason: "prerequisite" };
    }

    await this.store.set(STATE_KEY, { attempted: [...state.attempted, event] } satisfies TelemetryState);
    try {
      const response = await this.fetcher(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok
        ? { attempted: true, accepted: true }
        : { attempted: true, accepted: false, reason: "unavailable" };
    } catch {
      return { attempted: true, accepted: false, reason: "unavailable" };
    }
  }
}
