import { useEffect, useRef, useState } from "react";
import { getStored, setStored } from "./api";

export function useStoredState<T>(key: string, initial: T) {
  const [state, setState] = useState<{
    key: string;
    value: T;
    ready: boolean;
    dirty: boolean;
  }>({ key, value: initial, ready: false, dirty: false });
  const queues = useRef(new Map<string, Promise<void>>());

  useEffect(() => {
    let active = true;
    setState({ key, value: initial, ready: false, dirty: false });
    void getStored(key, initial)
      .then((saved) => {
        if (!active) return;
        setState((current) =>
          current.key === key && !current.dirty
            ? { key, value: saved, ready: true, dirty: false }
            : current.key === key
              ? { ...current, ready: true }
              : current,
        );
      })
      .catch((error) => {
        console.error(`Could not load stored state for ${key}`, error);
      })
      .finally(() => {
        if (!active) return;
        setState((current) =>
          current.key === key ? { ...current, ready: true } : current,
        );
      });
    return () => { active = false; };
  }, [key]);

  function update(next: T | ((current: T) => T)) {
    setState((current) => {
      const currentValue = current.key === key ? current.value : initial;
      const resolved = typeof next === "function" ? (next as (current: T) => T)(currentValue) : next;
      const previous = queues.current.get(key) ?? Promise.resolve();
      const request = previous.then(() => setStored(key, resolved));
      queues.current.set(key, request.catch((error) => {
        console.error(`Could not save stored state for ${key}`, error);
      }));
      return { key, value: resolved, ready: current.key === key && current.ready, dirty: true };
    });
  }

  return [state.key === key ? state.value : initial, update, state.key === key && state.ready] as const;
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
