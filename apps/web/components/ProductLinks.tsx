import Link from "next/link";
import { ArrowRightIcon, ContrastIcon, CropIcon, DownloadIcon, ImageIcon } from "./icons";

export function ProductLinks({
  heading = "Continue through the complete audit workflow",
  description = "Move from browser evidence to a structured local audit, then publish only the report you choose.",
}: {
  heading?: string;
  description?: string;
}) {
  return (
    <section className="product-links" aria-labelledby="product-links-heading">
      <div>
        <h2 id="product-links-heading">{heading}</h2>
        <p>{description}</p>
      </div>
      <nav aria-label="Explore TheWCAG products">
        <Link href="/accessibility-audit-software">
          <ContrastIcon size={18} />
          <span><strong>Audit workstation</strong><small>Plan, test, document, retest, and deliver</small></span>
          <ArrowRightIcon size={16} />
        </Link>
        <Link href="/chrome-accessibility-extension">
          <CropIcon size={18} />
          <span><strong>Chrome evidence capture</strong><small>Mark a page barrier and draft a finding</small></span>
          <ArrowRightIcon size={16} />
        </Link>
        <Link href="/screenshot-tool">
          <ImageIcon size={18} />
          <span><strong>Standalone screenshot tool</strong><small>Capture, annotate, export, and share without an audit</small></span>
          <ArrowRightIcon size={16} />
        </Link>
        <Link href="/download">
          <DownloadIcon size={18} />
          <span><strong>Download desktop app</strong><small>Universal macOS and Windows installers</small></span>
          <ArrowRightIcon size={16} />
        </Link>
      </nav>
    </section>
  );
}
