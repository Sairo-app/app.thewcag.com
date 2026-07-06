import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ConnectClient } from "./ConnectClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect your app - TheWCAG", robots: { index: false } };

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; device?: string }>;
}) {
  const sp = await searchParams;
  const state = typeof sp.state === "string" ? sp.state : "";
  const device = typeof sp.device === "string" ? sp.device : "Desktop";

  const session = await auth();
  if (!session?.user) {
    const back = `/connect?state=${encodeURIComponent(state)}&device=${encodeURIComponent(device)}`;
    redirect(`/signin?callbackUrl=${encodeURIComponent(back)}`);
  }

  return <ConnectClient state={state} device={device} email={session.user.email ?? ""} />;
}
