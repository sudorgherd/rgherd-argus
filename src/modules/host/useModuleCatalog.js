import { useCallback, useEffect, useState } from "react";

import { listEnabledModules } from "./moduleApi";

export const MODULES_CHANGED_EVENT = "argus:modules-changed";

export function useModuleCatalog(enabled) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await listEnabledModules();
      setCatalog(Array.isArray(data.modules) ? data.modules : []);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCatalog([]);
      setLoading(true);
      return undefined;
    }
    let active = true;
    const load = async () => {
      try {
        const data = await listEnabledModules();
        if (active) setCatalog(Array.isArray(data.modules) ? data.modules : []);
      } catch {
        if (active) setCatalog([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const interval = window.setInterval(load, 5000);
    const onChanged = () => load();
    window.addEventListener(MODULES_CHANGED_EVENT, onChanged);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener(MODULES_CHANGED_EVENT, onChanged);
    };
  }, [enabled]);

  return { catalog, loading, refresh };
}
