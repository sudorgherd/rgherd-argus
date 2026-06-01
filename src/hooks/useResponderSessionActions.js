import { useState } from "react";

import { updateCurrentResponder } from "../modules/responders/respondersApi";

export function useResponderSessionActions({
  meResponder,
  setError,
  setMeCapabilities,
  setMeResponder,
  setResponders,
}) {
  const [availabilitySaving, setAvailabilitySaving] = useState(false);

  function mergeUpdatedResponder(updatedResponder) {
    setMeResponder((current) =>
      current ? { ...current, ...updatedResponder } : updatedResponder
    );

    setMeCapabilities((current) => ({
      is_admin: updatedResponder.is_admin ?? current.is_admin,
      can_dispatch: updatedResponder.can_dispatch ?? current.can_dispatch,
      can_respond: updatedResponder.can_respond ?? current.can_respond,
    }));

    setResponders((current) => {
      const matched = current.some((responder) => responder.id === updatedResponder.id);
      return matched
        ? current.map((responder) =>
            responder.id === updatedResponder.id ? { ...responder, ...updatedResponder } : responder
          )
        : [updatedResponder, ...current];
    });
  }

  async function handleUpdateAvailability(nextAvailability) {
    setAvailabilitySaving(true);
    setError("");

    try {
      const updatedResponder = await updateCurrentResponder({ availability: nextAvailability });
      mergeUpdatedResponder(updatedResponder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update availability");
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function handleSignOut() {
    setError("");

    if (meResponder?.availability === "Available") {
      setAvailabilitySaving(true);

      try {
        const updatedResponder = await updateCurrentResponder({ availability: "Away" });
        mergeUpdatedResponder(updatedResponder);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to set Away before sign out");
        return;
      } finally {
        setAvailabilitySaving(false);
      }
    }

    window.location.href = "/logout";
  }

  return {
    availabilitySaving,
    handleSignOut,
    handleUpdateAvailability,
  };
}
