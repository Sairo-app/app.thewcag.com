import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ConnectClient } from "./ConnectClient";
import { isValidConnectState, normalizeDeviceName } from "./validation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect your app", robots: { index: false } };

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; device?: string }>;
}) {
  const sp = await searchParams;
  const state = typeof sp.state === "string" ? sp.state : "";
  const device = normalizeDeviceName(sp.device);

  if (!isValidConnectState(state)) {
    return (
      <main id="main" className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Connection protected</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">This connection link is invalid</h1>
        <p className="mt-3 text-sm text-muted">
          Start sign-in again from the TheWCAG desktop app. Connection links are tied to the app that created them.
        </p>
        <a href="/download" className="mt-6 inline-flex rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-card">
          Return to downloads
        </a>
      </main>
    );
  }

  const session = await auth();
  if (!session?.user) {
    const back = `/connect?state=${encodeURIComponent(state)}&device=${encodeURIComponent(device)}`;
    redirect(`/signin?callbackUrl=${encodeURIComponent(back)}`);
  }

  return <ConnectClient state={state} device={device} email={session.user.email ?? ""} />;
}
