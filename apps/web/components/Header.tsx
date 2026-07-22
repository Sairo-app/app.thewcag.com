import Link from "next/link";
import { HeaderNav } from "./HeaderNav";
import { SiteMenu } from "./SiteMenu";
import { HeaderAccount } from "./HeaderAccount";
import {
  BookIcon,
  ContrastIcon,
  CropIcon,
  DownloadIcon,
  EyeIcon,
  FileCheckIcon,
  FlagIcon,
  LinkIcon,
} from "@/components/icons";

const MOBILE_NAV = [
  ["/getting-started", "Getting started", <BookIcon key="getting-started" size={16} />],
  ["/accessibility-audit-software", "Audit software", <BookIcon key="software" size={16} />],
  ["/accessibility-reporting-software", "Accessible reporting", <FileCheckIcon key="reporting" size={16} />],
  ["/accessibility-issue-tracker-integrations", "Issue tracker integrations", <LinkIcon key="integrations" size={16} />],
  ["/accessibility-program-management", "Program management", <FlagIcon key="program" size={16} />],
  ["/screenshot-tool", "Screenshot tool", <CropIcon key="screenshots" size={16} />],
  ["/chrome-accessibility-extension", "Chrome extension", <ContrastIcon key="extension" size={16} />],
  ["/wcag-contrast", "Guides", <EyeIcon key="resources" size={16} />],
  ["/pricing", "Pricing", <BookIcon key="pricing" size={16} />],
] as const;

export function Header() {
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
          <HeaderAccount />

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
              <HeaderAccount mobile />
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
