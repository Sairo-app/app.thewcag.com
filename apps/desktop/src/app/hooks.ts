import { useEffect, useRef, useState } from "react";
import { getStored, setStored } from "./api";

export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void getStored(key, initial).then((saved) => {
      if (active) setValue(saved);
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [key]);

  function update(next: T | ((current: T) => T)) {
    setValue((current) => {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      queue.current = queue.current.then(() => setStored(key, resolved)).catch(() => undefined);
      return resolved;
    });
  }

  return [value, update, ready] as const;
}
export function useTransientMessage(timeout = 3000) {
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
    title?: string;
  } | null>(null);
  const timer = useRef<number | null>(null);
  function clear() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setMessage(null);
  }
  function show(text: string, error = false, title?: string) {
    if (timer.current) window.clearTimeout(timer.current);
    setMessage({ text, error, title });
    timer.current = window.setTimeout(() => setMessage(null), timeout);
  }
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  return [message, show, clear] as const;
}

export function messageFromError(
  error: unknown,
  fallback = "The action could not be completed. Try again.",
): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.replace(/^Error:\s*/i, "").trim();
  if (!message) return fallback;
  if (/failed to fetch|network request failed/i.test(message)) {
    return "TheWCAG could not reach the service. Check your connection and try again.";
  }
  if (/tainted canvas|toDataURL|securityerror/i.test(message)) {
    return "The capture could not be prepared. Close and reopen it, then try again.";
  }
  if (/failed to execute|htmlcanvaselement|ipc|stack trace/i.test(message)) {
    return fallback;
  }
  return message;
}
