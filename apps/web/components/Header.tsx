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

const MOBILE_NAV = [
  ["/screenshot-tool", "Screenshot tool", <CropIcon key="crop" size={16} />],
  ["/color-contrast-checker", "Contrast checker", <ContrastIcon key="contrast" size={16} />],
  ["/color-blindness-simulator", "Color blindness", <EyeIcon key="eye" size={16} />],
  ["/wcag-checklist", "WCAG 2.2 checklist", <BookIcon key="book" size={16} />],
] as const;

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
          <span className="site-brand__meta">Auditor toolkit</span>
        </Link>

        <HeaderNav />

        <div className="site-account">
          {signedIn ? (
            <>
              {admin && <Link href="/admin">Admin</Link>}
              <Link href="/screenshots"><ImageIcon size={14} />Reports</Link>
              <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                <button type="submit"><LogOutIcon size={14} />Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/signin"><LogInIcon size={14} />Sign in</Link>
          )}
        </div>

        <details className="site-menu">
          <summary aria-label="Open navigation menu" className="site-menu__trigger">
            <MenuIcon size={16} />
            <span>Menu</span>
          </summary>
          <div className="site-menu__panel">
            <nav aria-label="Mobile primary">
              {MOBILE_NAV.map(([href, label, icon]) => (
                <Link key={href} href={href} className="site-menu__link">
                  <span>{icon}</span>{label}
                </Link>
              ))}
            </nav>
            <div className="site-menu__rule" />
            <div className="site-menu__account">
              {signedIn ? (
                <>
                  {admin && <Link href="/admin" className="site-menu__link">Admin</Link>}
                  <Link href="/screenshots" className="site-menu__link"><ImageIcon size={16} />My reports</Link>
                  <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                    <button type="submit" className="site-menu__link"><LogOutIcon size={16} />Sign out</button>
                  </form>
                </>
              ) : (
                <Link href="/signin" className="site-menu__link"><LogInIcon size={16} />Sign in</Link>
              )}
            </div>
          </div>
        </details>

        <Link href="/download" aria-label="Download TheWCAG" className="site-header__download">
          <DownloadIcon size={14} />
          <span>Download</span>
        </Link>
      </div>
    </header>
  );
}
