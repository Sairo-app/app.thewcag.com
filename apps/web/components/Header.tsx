import Link from "next/link";
import { auth, signOut } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { HeaderNav } from "./HeaderNav";
import { DownloadIcon, ImageIcon, LogInIcon, LogOutIcon } from "@/components/icons";

export async function Header() {
  const session = await auth();
  const signedIn = Boolean(session?.user);
  const admin = isAdminEmail(session?.user?.email);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={24} height={24} className="h-6 w-6 rounded" />
          <span className="text-sm font-bold tracking-tight">TheWCAG</span>
        </Link>

        <HeaderNav />

        <div className="ml-auto flex items-center gap-3">
          {signedIn ? (
            <>
              {admin && (
                <Link href="/admin" className="text-sm font-medium text-primary hover:underline">
                  Admin
                </Link>
              )}
              <Link
                href="/screenshots"
                className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
              >
                <ImageIcon size={15} />
                My screenshots
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
                >
                  <LogOutIcon size={15} />
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/signin"
              className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
            >
              <LogInIcon size={15} />
              Sign in
            </Link>
          )}
          <Link
            href="/download"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <DownloadIcon size={15} />
            Download
          </Link>
        </div>
      </div>
    </header>
  );
}
