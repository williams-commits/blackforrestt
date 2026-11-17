"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

export function useAdminPersistentState<T>(
  key: string,
  initialValue: T,
  parse: (value: unknown) => T | undefined,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initialValue);
  const [ready, setReady] = useState(false);
  const parseRef = useRef(parse);
  parseRef.current = parse;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = parseRef.current(JSON.parse(raw) as unknown);
        if (parsed !== undefined) setValue(parsed);
        else console.warn(`Ignoring invalid saved admin preference: ${key}`);
      }
    } catch (error) {
      console.warn(`Unable to restore admin preference: ${key}`, error);
    } finally {
      setReady(true);
    }
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Unable to save admin preference: ${key}`, error);
    }
  }, [key, ready, value]);

  return [value, setValue];
}
