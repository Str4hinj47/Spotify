import { useEffect, useState } from "react";
import { loadValue, saveValue } from "../lib/storage";

export function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => loadValue(key, fallback));
  useEffect(() => {
    saveValue(key, value);
  }, [key, value]);
  return [value, setValue];
}
