import Link from "next/link";
import { auth, signOut } from "@/auth";
import { HeaderNav } from "./HeaderNav";

export async function Header() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={24} height={24} className="h-6 w-6 rounded" />
          <span className="text-sm font-bold tracking-tight">TheWCAG</span>
        </Link>

        <HeaderNav />

        <div className="ml-auto flex items-center gap-3">
          {signedIn ? (
            <>
              <Link href="/screenshots" className="text-sm text-muted hover:text-foreground">
                My screenshots
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="text-sm text-muted hover:text-foreground">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/signin" className="text-sm text-muted hover:text-foreground">
              Sign in
            </Link>
          )}
          <Link
            href="/download"
            className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Download
          </Link>
        </div>
      </div>
    </header>
  );
}
