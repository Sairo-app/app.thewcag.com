import Link from "next/link";
import { auth, signOut } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { HeaderNav } from "./HeaderNav";
import { SiteMenu } from "./SiteMenu";
import {
  BookIcon,
  ContrastIcon,
  CropIcon,
  DownloadIcon,
  EyeIcon,
  ImageIcon,
  LogInIcon,
  LogOutIcon,
} from "@/components/icons";

const MOBILE_NAV = [
  ["/accessibility-audit-software", "Audit software", <BookIcon key="software" size={16} />],
  ["/chrome-accessibility-extension", "Chrome extension", <ContrastIcon key="extension" size={16} />],
  ["/screenshot-tool", "Screenshot tool", <CropIcon key="screenshots" size={16} />],
  ["/wcag-contrast", "Guides", <EyeIcon key="resources" size={16} />],
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
        </Link>

        <div className="site-header__center">
          <HeaderNav />
        </div>

        <div className="site-header__utilities">
          {signedIn ? (
            <details className="account-menu">
              <summary>Account</summary>
              <div className="account-menu__panel">
                <p>{session?.user?.email}</p>
                {admin && <Link href="/admin">Admin</Link>}
                <Link href="/screenshots"><ImageIcon size={15} />My reports</Link>
                <Link href="/brand">Report branding</Link>
                <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                  <button type="submit"><LogOutIcon size={15} />Sign out</button>
                </form>
              </div>
            </details>
          ) : (
            <Link href="/signin" className="site-signin"><LogInIcon size={15} />Sign in</Link>
          )}

          <SiteMenu>
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
          </SiteMenu>

          <Link href="/download" aria-label="Download TheWCAG" className="site-header__download">
            <DownloadIcon size={15} />
            <strong>Download free</strong>
          </Link>
        </div>
      </div>
    </header>
  );
}
