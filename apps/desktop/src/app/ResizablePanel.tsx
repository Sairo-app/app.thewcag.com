import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

export function PanelResizer({
  label,
  side,
  size,
  min,
  max,
  initial,
  onSize,
  onCommit,
  className = "",
}: {
  label: string;
  side: "left" | "right";
  size: number;
  min: number;
  max: number;
  initial: number;
  onSize: (value: number) => void;
  onCommit: (value: number) => void;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const cleanupRef = useRef<() => void>(() => undefined);
  const direction = side === "right" ? 1 : -1;

  useEffect(() => () => {
    cleanupRef.current();
    delete document.documentElement.dataset.resizing;
  }, []);

  function start(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    cleanupRef.current();
    const startX = event.clientX;
    const startSize = size;
    let lastX = startX;
    const nextSize = (clientX: number) => startSize + (clientX - startX) * direction;

    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("blur", finish);
      window.removeEventListener("keydown", cancel);
    };
    const stop = () => {
      cleanup();
      cleanupRef.current = () => undefined;
      draggingRef.current = false;
      setDragging(false);
      delete document.documentElement.dataset.resizing;
    };
    const move = (pointerEvent: PointerEvent) => {
      if (!draggingRef.current) return;
      lastX = pointerEvent.clientX;
      onSize(nextSize(lastX));
    };
    const finish = (pointerEvent: PointerEvent | Event) => {
      if (!draggingRef.current) return;
      if (pointerEvent instanceof PointerEvent) lastX = pointerEvent.clientX;
      stop();
      onCommit(nextSize(lastX));
    };
    const cancel = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== "Escape" || !draggingRef.current) return;
      keyboardEvent.preventDefault();
      stop();
      onSize(startSize);
    };

    draggingRef.current = true;
    setDragging(true);
    document.documentElement.dataset.resizing = "true";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("blur", finish);
    window.addEventListener("keydown", cancel);
    cleanupRef.current = cleanup;
  }

  function resizeWithKeyboard(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 24 : 8;
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = size - step * direction;
    if (event.key === "ArrowRight") next = size + step * direction;
    if (event.key === "Home") next = min;
    if (event.key === "End") next = max;
    if (event.key === "Enter") next = initial;
    if (next === null) return;
    event.preventDefault();
    onSize(next);
    onCommit(next);
  }

  return (
    <button
      type="button"
      className={`panel-resizer ${className}`}
      data-dragging={dragging}
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(size)}
      aria-valuetext={`${Math.round(size)} pixels. Use arrow keys to resize, Home or End for limits, and Enter to reset.`}
      title={`${label}. Double-click to reset.`}
      onDoubleClick={() => {
        onSize(initial);
        onCommit(initial);
      }}
      onKeyDown={resizeWithKeyboard}
      onPointerDown={start}
    />
  );
}
