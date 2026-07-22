import DodoPayments from "dodopayments";
import { billingEnvironment } from "./plans";

let client: DodoPayments | null = null;

export function dodoClient(): DodoPayments {
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY?.trim();
  if (!bearerToken) throw new Error("Dodo Payments API key is not configured");
  if (!client) {
    client = new DodoPayments({
      bearerToken,
      environment: billingEnvironment(),
    });
  }
  return client;
}

export function dodoWebhookKey(): string {
  const value = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  if (!value) throw new Error("Dodo Payments webhook key is not configured");
  return value;
}

export function isAllowedDodoHostedUrl(value: string, kind: "checkout" | "portal"): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const allowed = kind === "checkout"
      ? ["checkout.dodopayments.com", "test.checkout.dodopayments.com"]
      : ["customer.dodopayments.com", "test.customer.dodopayments.com"];
    return allowed.includes(url.hostname);
  } catch {
    return false;
  }
}

export function requireDodoHostedUrl(value: string | null | undefined, kind: "checkout" | "portal"): string {
  if (!value || !isAllowedDodoHostedUrl(value, kind)) {
    throw new Error(`Dodo Payments returned an invalid ${kind} URL`);
  }
  return value;
}

export function resetDodoClientForTests(): void {
  client = null;
}
