"use client";

import { useId, useState } from "react";
import {
  BookIcon,
  CheckIcon,
  CropIcon,
  FileCheckIcon,
  SparklesIcon,
} from "@/components/icons";
import { FrameCorners } from "@/components/Icon";

const MODES = [
  { id: "Format", label: "Set format", icon: SparklesIcon },
  { id: "Capture", label: "Capture", icon: CropIcon },
  { id: "Review", label: "Review", icon: BookIcon },
  { id: "Deliver", label: "Deliver", icon: FileCheckIcon },
] as const;

type Mode = (typeof MODES)[number]["id"];

function FormatPanel() {
  return (
    <div className="ledger-panel ledger-panel--format">
      <div className="ledger-panel__heading">
        <span className="ledger-kicker"><SparklesIcon size={16} /> Optional project setup</span>
        <strong>Agency-audit-template.xlsx</strong>
        <p>AI has learned how this client expects every issue to be logged.</p>
      </div>
      <div className="ledger-mapping" aria-label="Template fields mapped by AI">
        <div><span>Issue title</span><strong>Summary</strong><CheckIcon size={16} /></div>
        <div><span>WCAG criterion</span><strong>Success Criteria</strong><CheckIcon size={16} /></div>
        <div><span>User impact</span><strong>Impact Description</strong><CheckIcon size={16} /></div>
        <div><span>Remediation</span><strong>Recommendation</strong><CheckIcon size={16} /></div>
      </div>
      <div className="ledger-panel__status"><span>7 / 7 fields mapped</span><strong>Ready to log</strong></div>
    </div>
  );
}

function CapturePanel() {
  return (
    <div className="ledger-panel ledger-panel--capture">
      <div className="ledger-browser" aria-hidden="true">
        <div className="ledger-browser__bar"><span /><span /><span /><strong>checkout.example / payment</strong></div>
        <div className="ledger-browser__page">
          <span className="ledger-browser__label">Payment details</span>
          <strong>Complete your order</strong>
          <span className="ledger-browser__field">Cardholder name</span>
          <span className="ledger-browser__value">Alex Morgan</span>
          <span className="ledger-browser__target">Continue to payment</span>
          <span className="ledger-browser__focus" />
        </div>
      </div>
      <div className="ledger-inspector">
        <span className="ledger-kicker"><CropIcon size={16} /> Evidence 01</span>
        <strong>Continue to payment</strong>
        <dl>
          <div><dt>Role</dt><dd>button</dd></div>
          <div><dt>Name</dt><dd>Continue to payment</dd></div>
          <div><dt>State</dt><dd>Focused</dd></div>
        </dl>
        <span className="ledger-confirmed"><CheckIcon size={16} /> Visual + semantic context attached</span>
      </div>
    </div>
  );
}

function ReviewPanel() {
  return (
    <div className="ledger-panel ledger-panel--review">
      <div className="ledger-finding">
        <span className="ledger-kicker"><BookIcon size={16} /> Finding A-014</span>
        <strong>Sticky footer obscures the visible focus indicator</strong>
        <p>The payment button receives keyboard focus, but the persistent footer covers part of its indicator.</p>
        <div className="ledger-finding__checks">
          <span><CheckIcon size={16} /> Evidence attached</span>
          <span><CheckIcon size={16} /> Reproduction steps ready</span>
          <span><CheckIcon size={16} /> User impact confirmed</span>
        </div>
      </div>
      <dl className="ledger-decision">
        <div><dt>Criterion</dt><dd>2.4.11</dd></div>
        <div><dt>Severity</dt><dd>Major</dd></div>
        <div><dt>Status</dt><dd>Ready for review</dd></div>
        <div><dt>Owner</dt><dd>Checkout team</dd></div>
      </dl>
    </div>
  );
}

function DeliverPanel() {
  return (
    <div className="ledger-panel ledger-panel--deliver">
      <div className="ledger-delivery__mark"><FileCheckIcon size={32} /></div>
      <div className="ledger-delivery__copy">
        <span className="ledger-kicker">Delivery check</span>
        <strong>Client audit is ready</strong>
        <p>Approved findings, evidence, WCAG mapping, remediation guidance, and retest history are complete.</p>
      </div>
      <div className="ledger-delivery__formats">
        <span><CheckIcon size={16} /> Original agency workbook</span>
        <span><CheckIcon size={16} /> Accessible HTML or PDF</span>
        <span><CheckIcon size={16} /> Jira, Linear, or GitHub</span>
      </div>
    </div>
  );
}

export function AuditPlayground() {
  const [mode, setMode] = useState<Mode>("Format");
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
    setMode(MODES[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']")[next]?.focus();
  }

  return (
    <div className="ledger-demo">
      <span className="ledger-demo__frame" aria-hidden="true"><FrameCorners size={32} weight="duotone" /></span>
      <div className="ledger-demo__topbar">
        <div className="ledger-demo__identity">
          <span aria-hidden="true">W</span>
          <div><strong>Checkout audit</strong><small>Local project · 24 findings</small></div>
        </div>
        <span className="ledger-demo__local"><i /> Local-first</span>
      </div>

      <div className="ledger-demo__body">
        <div className="ledger-demo__tabs" role="tablist" aria-label="Explore the audit evidence workflow">
          {MODES.map((item, index) => {
            const Icon = item.icon;
            const selected = mode === item.id;
            return (
              <button
                key={item.id}
                id={`${id}-${item.id}-tab`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${id}-${item.id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setMode(item.id)}
                onKeyDown={handleKeyDown}
              >
                <span className="ledger-demo__step">{String(index + 1).padStart(2, "0")}</span>
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div
          id={`${id}-${mode}-panel`}
          className="ledger-demo__panel"
          role="tabpanel"
          aria-labelledby={`${id}-${mode}-tab`}
        >
          {mode === "Format" && <FormatPanel />}
          {mode === "Capture" && <CapturePanel />}
          {mode === "Review" && <ReviewPanel />}
          {mode === "Deliver" && <DeliverPanel />}
        </div>
      </div>

      <div className="ledger-demo__footer">
        <span><i /> Template optional</span>
        <span><i /> Human reviewed</span>
        <span><i /> Export controlled by you</span>
      </div>
    </div>
  );
}
