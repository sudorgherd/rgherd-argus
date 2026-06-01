export function formatLabel(value) {
  if (value == null || value === "") return "—";
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function responderLabel(responder, responderId = null) {
  if (responder?.display_name) return responder.display_name;
  if (responderId != null) return `Responder ${responderId}`;
  if (responder?.id != null) return `Responder ${responder.id}`;
  return "Responder";
}

export function zoneLabel(zoneId, zones = []) {
  if (zoneId == null) return "No zone";
  const match = safeArray(zones).find((zone) => zone.id === zoneId);
  return match?.name || `Zone ${zoneId}`;
}

export function escalationLabel(record) {
  return record?.category === "Safety / Threat / Health"
    ? "Safety Escalation"
    : "Escalated";
}
