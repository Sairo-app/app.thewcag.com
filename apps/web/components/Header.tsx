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
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" aria-label="TheWCAG home" className="site-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={26} height={26} />
          <span className="site-brand__name">TheWCAG</span>
          <span className="site-brand__meta">FIELD SYSTEM</span>
        </Link>

        <HeaderNav />

        <div className="site-account">
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

        <details className="group site-menu">
          <summary aria-label="Open navigation menu" className="site-menu__trigger">
            <MenuIcon size={16} />
            <span className="hidden min-[390px]:inline">Menu</span>
          </summary>
          <div className="site-menu__panel">
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
          className="site-header__download"
        >
          <DownloadIcon size={15} />
          <span className="hidden min-[420px]:inline">Download</span>
        </Link>
      </div>
    </header>
  );
}
