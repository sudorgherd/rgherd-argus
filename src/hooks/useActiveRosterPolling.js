import { useEffect } from "react";

import { listResponders } from "../modules/responders/respondersApi";
import { safeArray } from "../utils/display";

export function useActiveRosterPolling({
  activeNav,
  canDispatch,
  setResponders,
}) {
  useEffect(() => {
    if (!canDispatch || activeNav !== "Active Roster") return;

    let ignore = false;

    async function refreshResponders() {
      try {
        const respondersData = await listResponders();
        if (!ignore) {
          setResponders(safeArray(respondersData.responders));
        }
      } catch {
      }
    }

    refreshResponders();

    const intervalId = window.setInterval(refreshResponders, 5000);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [activeNav, canDispatch, setResponders]);
}
