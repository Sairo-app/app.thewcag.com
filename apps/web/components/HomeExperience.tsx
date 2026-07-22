"use client";

import { useId, useState } from "react";
import {
  BookIcon,
  CheckIcon,
  CropIcon,
  FileCheckIcon,
  ImageIcon,
  SparklesIcon,
} from "@/components/icons";

const MODES = [
  { id: "Capture", label: "Capture", icon: CropIcon },
  { id: "Draft", label: "AI draft", icon: SparklesIcon },
  { id: "Review", label: "Review", icon: BookIcon },
  { id: "Deliver", label: "Deliver", icon: FileCheckIcon },
] as const;

type Mode = (typeof MODES)[number]["id"];

function CapturePanel() {
  return (
    <div className="hero-workspace__capture">
      <div className="hero-workspace__browser" aria-hidden="true">
        <div className="hero-workspace__address">
          <span>checkout.example</span>
          <strong>/ payment</strong>
        </div>
        <div className="hero-workspace__page">
          <span className="hero-workspace__page-label">Payment details</span>
          <strong>Complete your order</strong>
          <span className="hero-workspace__field-label">Cardholder name</span>
          <span className="hero-workspace__field">Alex Morgan</span>
          <span className="hero-workspace__target-label">button</span>
          <span className="hero-workspace__target">Continue to payment</span>
        </div>
      </div>

      <div className="hero-workspace__inspector">
        <span className="hero-workspace__section-label"><ImageIcon size={13} /> Browser evidence</span>
        <strong>Continue to payment</strong>
        <dl>
          <div><dt>Role</dt><dd>button</dd></div>
          <div><dt>Name</dt><dd>Continue to payment</dd></div>
          <div><dt>State</dt><dd>Focused</dd></div>
        </dl>
        <span className="hero-workspace__confirmed"><CheckIcon size={13} /> Visual and semantic context attached</span>
      </div>
    </div>
  );
}

function DraftPanel() {
  return (
    <div className="hero-workspace__document">
      <div className="hero-workspace__document-head">
        <div>
          <span className="hero-workspace__section-label"><SparklesIcon size={13} /> Finding draft</span>
          <strong>Visible focus is obscured by the sticky footer</strong>
        </div>
        <span className="hero-workspace__provider">Your AI provider</span>
      </div>
      <div className="hero-workspace__document-grid">
        <div>
          <span>Actual result</span>
          <p>The payment button receives focus, but its indicator is partially hidden by the persistent footer.</p>
        </div>
        <div>
          <span>Expected result</span>
          <p>The complete focus indicator remains visible while the control has keyboard focus.</p>
        </div>
        <div>
          <span>Suggested resolution</span>
          <p>Reserve space for the focused control or move the sticky footer so it cannot overlap the indicator.</p>
        </div>
        <div>
          <span>WCAG mapping</span>
          <p><strong>2.4.11</strong> Focus Not Obscured (Minimum)</p>
        </div>
      </div>
      <p className="hero-workspace__note">Every field stays editable before it becomes part of the audit.</p>
    </div>
  );
}

function ReviewPanel() {
  return (
    <div className="hero-workspace__review">
      <div className="hero-workspace__review-main">
        <span className="hero-workspace__section-label"><BookIcon size={13} /> Auditor review</span>
        <strong>Confirm the decision, not just the wording.</strong>
        <ul>
          <li><CheckIcon size={14} /><span><b>Evidence</b> Screenshot and browser semantics are attached.</span></li>
          <li><CheckIcon size={14} /><span><b>Traceability</b> WCAG 2.4.11 is mapped to the finding.</span></li>
          <li><CheckIcon size={14} /><span><b>Affected users</b> Keyboard and switch control users.</span></li>
          <li><CheckIcon size={14} /><span><b>Retest path</b> Reproduction steps are ready.</span></li>
        </ul>
      </div>
      <div className="hero-workspace__decision">
        <span>Severity</span>
        <strong>Major</strong>
        <span>Status</span>
        <strong>Ready for review</strong>
        <span>Owner</span>
        <strong>Checkout team</strong>
      </div>
    </div>
  );
}

function DeliverPanel() {
  return (
    <div className="hero-workspace__deliver">
      <div className="hero-workspace__report-mark"><FileCheckIcon size={28} /></div>
      <div className="hero-workspace__report-copy">
        <span className="hero-workspace__section-label">Audit delivery</span>
        <strong>Checkout accessibility audit</strong>
        <p>A clear handoff with approved findings, evidence, WCAG mapping, remediation guidance, and retest history.</p>
      </div>
      <div className="hero-workspace__delivery-options">
        <span><CheckIcon size={14} /> Export a portable audit</span>
        <span><CheckIcon size={14} /> Publish only when approved</span>
        <span><CheckIcon size={14} /> Keep local work private</span>
      </div>
    </div>
  );
}

export function AuditPlayground() {
  const [mode, setMode] = useState<Mode>("Capture");
  const id = useId();
  const artId = id.replace(/:/g, "");

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = MODES.findIndex((item) => item.id === mode);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? MODES.length - 1
        : (current + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + MODES.length) % MODES.length;
    const nextMode = MODES[next];
    setMode(nextMode.id);
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']");
    tabs?.[next]?.focus();
  }

  return (
    <div className="hero-showcase">
      <svg
        className="hero-showcase__art"
        viewBox="0 0 860 590"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${artId}-wash`} x1="96" y1="42" x2="760" y2="548" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--orange)" stopOpacity="0.23" />
            <stop offset="0.46" stopColor="var(--surface)" stopOpacity="0.84" />
            <stop offset="1" stopColor="var(--orange)" stopOpacity="0.09" />
          </linearGradient>
          <linearGradient id={`${artId}-line`} x1="75" y1="120" x2="786" y2="470" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--orange)" stopOpacity="0.12" />
            <stop offset="0.52" stopColor="var(--orange)" stopOpacity="0.8" />
            <stop offset="1" stopColor="var(--ink)" stopOpacity="0.16" />
          </linearGradient>
          <pattern id={`${artId}-dots`} width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.35" fill="var(--orange)" fillOpacity="0.24" />
          </pattern>
          <filter id={`${artId}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>

        <path
          d="M106 129C185 26 340 39 433 76c104 42 197 10 282 64 91 58 123 194 69 287-58 99-191 119-301 92-101-25-178 32-275-5C79 465 25 341 57 237c13-44 27-79 49-108Z"
          fill={`url(#${artId}-wash)`}
        />
        <ellipse
          cx="692"
          cy="147"
          rx="116"
          ry="92"
          fill="var(--orange)"
          fillOpacity="0.12"
          filter={`url(#${artId}-soft)`}
        />
        <rect x="34" y="318" width="198" height="210" rx="28" fill={`url(#${artId}-dots)`} />

        <g className="hero-showcase__orbit">
          <ellipse cx="430" cy="294" rx="362" ry="221" fill="none" stroke={`url(#${artId}-line)`} strokeWidth="1.6" />
          <ellipse cx="430" cy="294" rx="316" ry="180" fill="none" stroke="var(--orange)" strokeOpacity="0.18" strokeDasharray="7 13" />
          <circle cx="96" cy="211" r="7" fill="var(--surface)" stroke="var(--orange)" strokeWidth="2" />
          <circle cx="737" cy="389" r="6" fill="var(--orange)" />
          <circle cx="665" cy="92" r="4" fill="var(--ink)" fillOpacity="0.54" />
        </g>

        <g className="hero-showcase__focus">
          <rect x="690" y="104" width="104" height="104" rx="24" fill="none" stroke="var(--orange)" strokeWidth="2" />
          <path d="M690 138v-18c0-9 7-16 16-16h18M760 104h18c9 0 16 7 16 16v18M794 174v18c0 9-7 16-16 16h-18M724 208h-18c-9 0-16-7-16-16v-18" fill="none" stroke="var(--orange)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="742" cy="156" r="15" fill="var(--orange)" fillOpacity="0.16" />
          <circle cx="742" cy="156" r="5" fill="var(--orange)" />
        </g>

        <path d="M75 438c79 9 126-9 184-54 55-42 104-55 163-34 55 20 105 17 151-9 52-30 98-37 164-23" fill="none" stroke="var(--ink)" strokeOpacity="0.14" strokeWidth="1.5" strokeDasharray="3 8" />
        <path d="M104 459h70M104 473h42M677 468h78M713 482h42" stroke="var(--orange)" strokeOpacity="0.42" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="hero-showcase__signal hero-showcase__signal--evidence" aria-hidden="true">
        <span><CheckIcon size={13} /></span>
        <div><strong>Evidence linked</strong><small>Visual + semantic context</small></div>
      </div>

      <div className="hero-workspace" aria-label="Explore the connected TheWCAG audit workflow">
        <div className="hero-workspace__chrome">
          <div className="hero-workspace__brand">
            <span aria-hidden="true">W</span>
            <div><strong>TheWCAG</strong><small>Checkout accessibility audit</small></div>
          </div>
          <span className="hero-workspace__local"><CheckIcon size={12} /> Local audit</span>
        </div>

        <div className="hero-workspace__body">
          <div className="hero-workspace__tabs" role="tablist" aria-label="Audit workflow stages">
            {MODES.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  id={`${id}-${item.id}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={mode === item.id}
                  aria-controls={`${id}-${item.id}-panel`}
                  tabIndex={mode === item.id ? 0 : -1}
                  onClick={() => setMode(item.id)}
                  onKeyDown={handleKeyDown}
                >
                  <span className="hero-workspace__step">{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div
            id={`${id}-${mode}-panel`}
            className="hero-workspace__panel"
            role="tabpanel"
            aria-labelledby={`${id}-${mode}-tab`}
          >
            {mode === "Capture" && <CapturePanel />}
            {mode === "Draft" && <DraftPanel />}
            {mode === "Review" && <ReviewPanel />}
            {mode === "Deliver" && <DeliverPanel />}
          </div>
        </div>

        <div className="hero-workspace__footer">
          <span>Browser context intact</span>
          <span>Provider controlled by you</span>
          <span>Publish only when ready</span>
        </div>
      </div>

      <div className="hero-showcase__signal hero-showcase__signal--standard" aria-hidden="true">
        <span>2.4.11</span>
        <div><strong>WCAG 2.2</strong><small>Decision ready to review</small></div>
      </div>
    </div>
  );
}
