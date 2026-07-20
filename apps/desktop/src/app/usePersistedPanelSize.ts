import { useEffect, useState } from "react";
import { getStored, setStored } from "./api";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function usePersistedPanelSize(
  key: string,
  initial: number,
  min: number,
  max: number,
) {
  const [size, setSizeState] = useState(initial);

  useEffect(() => {
    let active = true;
    void getStored<number>(key, initial)
      .then((stored) => {
        if (active && Number.isFinite(stored)) {
          setSizeState(clamp(stored, min, max));
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [initial, key, max, min]);

  function setSize(value: number) {
    setSizeState(clamp(value, min, max));
  }

  function commit(value: number) {
    const next = clamp(value, min, max);
    setSizeState(next);
    void setStored(key, next).catch(() => undefined);
  }

  return { commit, setSize, size };
}
