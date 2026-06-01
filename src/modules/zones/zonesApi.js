import { apiRequest } from "../../api/request";

export function listZones() {
  return apiRequest("/api/zones", {
    errorMessage: "GET /api/zones failed",
  });
}

export function createZone(payload) {
  return apiRequest("/api/zones", {
    method: "POST",
    body: payload,
    errorMessage: "POST /api/zones failed",
  });
}

export function updateZone(zoneId, payload) {
  return apiRequest(`/api/zones/${zoneId}`, {
    method: "PATCH",
    body: payload,
    errorMessage: `PATCH /api/zones/${zoneId} failed`,
  });
}

export function deleteZone(zoneId) {
  return apiRequest(`/api/zones/${zoneId}`, {
    method: "DELETE",
    errorMessage: `DELETE /api/zones/${zoneId} failed`,
  });
}
