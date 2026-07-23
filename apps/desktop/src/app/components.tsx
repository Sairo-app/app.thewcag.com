import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { CheckCircle, WarningCircle, X, type IconComponent } from "./Icon";

export function IconButton({
  label,
  children,
  onClick,
  className = "",
  disabled = false,
  ariaExpanded,
  ariaControls,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`icon-button ${className}`}
    >
      {children}
    </button>
  );
}
export function Button({
  children,
  id,
  onClick,
  variant = "secondary",
  icon: Icon,
  type = "button",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  id?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  icon?: IconComponent;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`button button-${variant} ${className}`}
    >
      {Icon ? <Icon size={20} /> : null}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: IconComponent;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={32} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function Toast({
  message,
  onClose,
  actionLabel,
  onAction,
}: {
  message: { text: string; error: boolean; title?: string } | null;
  onClose?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message && !message.error
          ? `${message.title ? `${message.title}. ` : ""}${message.text}`
          : ""}
      </div>
      <div
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {message?.error
          ? `${message.title ? `${message.title}. ` : ""}${message.text}`
          : ""}
      </div>
      {message ? (
        <div
          className={`toast ${message.error ? "toast-error" : "toast-success"}`}
        >
          <span className="toast-icon" aria-hidden="true">
            {message.error ? (
              <WarningCircle size={20} weight="fill" />
            ) : (
              <CheckCircle size={20} weight="fill" />
            )}
          </span>
          <span className="toast-copy">
            {message.title ? <strong>{message.title}</strong> : null}
            <span>{message.text}</span>
          </span>
          {actionLabel && onAction ? (
            <button type="button" className="toast-action" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              className="toast-close"
              onClick={onClose}
              aria-label="Dismiss message"
            >
              <X size={20} />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
}) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal-dialog confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClose={() => {
        if (open && !busy) onCancel();
      }}
    >
      <div className="confirm-dialog-copy">
        <span className="confirm-dialog-icon" aria-hidden>
          <WarningCircle size={20} />
        </span>
        <div>
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
        </div>
      </div>
      <div className="confirm-dialog-actions">
        <Button disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" disabled={busy} onClick={onConfirm}>
          {busy ? "Working" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
