import type { ComponentType, ReactNode } from "react";
import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";

export function IconButton({ label, children, onClick, className = "", disabled = false }: {
  label: string; children: ReactNode; onClick?: () => void; className?: string; disabled?: boolean;
}) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`icon-button ${className}`}>{children}</button>;
}
export function Button({ children, onClick, variant = "secondary", icon: Icon, type = "button", disabled = false, className = "" }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "quiet" | "danger";
  icon?: ComponentType<{ size?: number; weight?: "bold" | "regular" }>; type?: "button" | "submit"; disabled?: boolean; className?: string;
}) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`button button-${variant} ${className}`}>
    {Icon ? <Icon size={16} weight="bold" /> : null}{children}
  </button>;
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span>{children}{hint ? <span className="field-hint">{hint}</span> : null}</label>;
}

export function EmptyState({ icon: Icon, title, body, action }: {
  icon: ComponentType<{ size?: number; weight?: "duotone" }>; title: string; body: string; action?: ReactNode;
}) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={28} weight="duotone" /></div><h3>{title}</h3><p>{body}</p>{action}</div>;
}

export function Toast({ message, onClose }: { message: { text: string; error: boolean } | null; onClose?: () => void }) {
  if (!message) return null;
  return <div className={`toast ${message.error ? "toast-error" : "toast-success"}`} role={message.error ? "alert" : "status"} aria-live="polite">
    {message.error ? <WarningCircle size={18} weight="fill" /> : <CheckCircle size={18} weight="fill" />}
    <span>{message.text}</span>{onClose ? <button onClick={onClose} aria-label="Dismiss"><X size={14} /></button> : null}
  </div>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string;
}) {
  return <div className="segmented" role="group" aria-label={label}>{options.map((option) => (
    <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>
  ))}</div>;
}

export function StatusBadge({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral"; children: ReactNode }) {
  return <span className={`status status-${tone}`}>{children}</span>;
}
