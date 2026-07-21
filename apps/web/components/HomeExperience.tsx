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
  );
}
