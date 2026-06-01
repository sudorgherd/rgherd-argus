export function useAdminZoneListActions({
  setResponders,
  setZones,
}) {
  function sortResponders(a, b) {
    return (a.display_name || a.subject_id || "").localeCompare(
      b.display_name || b.subject_id || ""
    );
  }

  function sortZones(a, b) {
    return (a.name || "").localeCompare(b.name || "");
  }

  function handleResponderSaved(savedResponder) {
    setResponders((current) => {
      const exists = current.some((responder) => responder.id === savedResponder.id);
      const next = exists
        ? current.map((responder) =>
            responder.id === savedResponder.id ? savedResponder : responder
          )
        : [...current, savedResponder];

      return next.sort(sortResponders);
    });
  }

  function handleResponderDeleted(deletedResponderId) {
    setResponders((current) =>
      current.filter((responder) => responder.id !== deletedResponderId)
    );
  }

  function handleZoneCreated(zone) {
    setZones((current) => [...current, zone].sort(sortZones));
  }

  function handleZoneUpdated(updatedZone) {
    setZones((current) =>
      current
        .map((zone) => (zone.id === updatedZone.id ? updatedZone : zone))
        .sort(sortZones)
    );
  }

  function handleZoneDeleted(zoneId) {
    setZones((current) => current.filter((zone) => zone.id !== zoneId));
  }

  return {
    handleResponderDeleted,
    handleResponderSaved,
    handleZoneCreated,
    handleZoneDeleted,
    handleZoneUpdated,
  };
}
