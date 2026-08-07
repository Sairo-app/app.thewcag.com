import Link from "next/link";
import { HeaderNav } from "./HeaderNav";
import { SiteMenu } from "./SiteMenu";
import { HeaderAccount } from "./HeaderAccount";
import {
  BookIcon,
  CompassIcon,
  CropIcon,
  DownloadIcon,
  FileCheckIcon,
  FileTextIcon,
  FlagIcon,
  LinkIcon,
  PuzzleIcon,
  TagIcon,
} from "@/components/icons";

const MOBILE_NAV = [
  ["/getting-started", "Getting started", <CompassIcon key="getting-started" size={20} />],
  ["/accessibility-audit-software", "Audit software", <FileCheckIcon key="software" size={20} />],
  ["/accessibility-reporting-software", "Accessible reporting", <FileTextIcon key="reporting" size={20} />],
  ["/accessibility-issue-tracker-integrations", "Issue tracker integrations", <LinkIcon key="integrations" size={20} />],
  ["/accessibility-program-management", "Program management", <FlagIcon key="program" size={20} />],
  ["/screenshot-tool", "Screenshot tool", <CropIcon key="screenshots" size={20} />],
  ["/chrome-accessibility-extension", "Chrome extension", <PuzzleIcon key="extension" size={20} />],
  ["/wcag-contrast", "Guides", <BookIcon key="resources" size={20} />],
  ["/pricing", "Pricing", <TagIcon key="pricing" size={20} />],
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
            <DownloadIcon size={16} />
            <strong>Download free</strong>
          </Link>
        </div>
      </div>
    </header>
  );
}
