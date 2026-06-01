import { useEffect } from "react";

import { sendResponderHeartbeat } from "../modules/responders/respondersApi";

export function useResponderHeartbeat({
  enabled,
  setMeResponder,
  setResponders,
}) {
  useEffect(() => {
    if (!enabled) return undefined;

    let stopped = false;

    function mergeResponder(updatedResponder) {
      if (!updatedResponder?.id) return;

      setMeResponder((current) =>
        current ? { ...current, ...updatedResponder } : updatedResponder
      );

      setResponders((current) => {
        const matched = current.some((responder) => responder.id === updatedResponder.id);

        return matched
          ? current.map((responder) =>
              responder.id === updatedResponder.id
                ? { ...responder, ...updatedResponder }
                : responder
            )
          : [updatedResponder, ...current];
      });
    }

    async function heartbeat() {
      try {
        const data = await sendResponderHeartbeat();

        if (!stopped) {
          mergeResponder(data.responder);
        }
      } catch {
        // Transient heartbeat failures should not force logout or break the console.
      }
    }

    heartbeat();

    const intervalId = window.setInterval(heartbeat, 60000);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, setMeResponder, setResponders]);
}
