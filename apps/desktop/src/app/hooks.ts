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
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const timer = useRef<number | null>(null);
  function show(text: string, error = false) {
    if (timer.current) window.clearTimeout(timer.current);
    setMessage({ text, error });
    timer.current = window.setTimeout(() => setMessage(null), timeout);
  }
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  return [message, show] as const;
}
