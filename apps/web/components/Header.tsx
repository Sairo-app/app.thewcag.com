import Link from "next/link";
import { auth, signOut } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { HeaderNav } from "./HeaderNav";
import {
  BookIcon,
  ContrastIcon,
  CropIcon,
  DownloadIcon,
  EyeIcon,
  ImageIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
} from "@/components/icons";

export async function Header() {
  const session = await auth();
  const signedIn = Boolean(session?.user);
  const admin = isAdminEmail(session?.user?.email);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="relative mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 md:gap-6">
        <Link href="/" aria-label="TheWCAG home" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={24} height={24} className="h-6 w-6 rounded" />
          <span className="hidden text-sm font-bold tracking-tight min-[360px]:inline">TheWCAG</span>
        </Link>

        <HeaderNav />

        <div className="ml-auto hidden items-center gap-3 md:flex">
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
        </div>

        <details className="group ml-auto md:hidden">
          <summary aria-label="Open navigation menu" className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium marker:hidden hover:bg-background [&::-webkit-details-marker]:hidden">
            <MenuIcon size={16} />
            <span className="hidden min-[390px]:inline">Menu</span>
          </summary>
          <div className="absolute left-4 right-4 top-[calc(100%+0.65rem)] z-50 rounded-xl border border-border bg-card p-2 shadow-xl sm:left-auto sm:right-6 sm:w-72">
            <nav aria-label="Mobile primary" className="grid gap-1">
              {[
                ["/screenshot-tool", "Screenshot tool", <CropIcon key="crop" size={16} />],
                ["/color-contrast-checker", "Contrast checker", <ContrastIcon key="contrast" size={16} />],
                ["/color-blindness-simulator", "Color blindness", <EyeIcon key="eye" size={16} />],
                ["/wcag-checklist", "WCAG 2.2 checklist", <BookIcon key="book" size={16} />],
              ].map(([href, label, icon]) => (
                <Link key={String(href)} href={String(href)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-background hover:text-foreground">
                  <span className="text-primary">{icon}</span>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="my-2 h-px bg-border" />
            <div className="grid gap-1">
              {signedIn ? (
                <>
                  {admin && <Link href="/admin" className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-background">Admin</Link>}
                  <Link href="/screenshots" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-background hover:text-foreground"><ImageIcon size={16} />My screenshots</Link>
                  <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                    <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-background hover:text-foreground"><LogOutIcon size={16} />Sign out</button>
                  </form>
                </>
              ) : (
                <Link href="/signin" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-background hover:text-foreground"><LogInIcon size={16} />Sign in</Link>
              )}
            </div>
          </div>
        </details>

        <Link
          href="/download"
          aria-label="Download TheWCAG"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:px-3.5"
        >
          <DownloadIcon size={15} />
          <span className="hidden min-[420px]:inline">Download</span>
        </Link>
      </div>
    </header>
  );
}
