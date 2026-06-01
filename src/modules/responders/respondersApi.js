import { apiRequest } from "../../api/request";

export function listResponders() {
  return apiRequest("/api/responders", {
    errorMessage: "GET /api/responders failed",
  });
}

export function getCurrentResponder() {
  return apiRequest("/api/responders/me", {
    errorMessage: "GET /api/responders/me failed",
  });
}


export function sendResponderHeartbeat() {
  return apiRequest("/api/responders/me/heartbeat", {
    method: "POST",
    errorMessage: "POST /api/responders/me/heartbeat failed",
  });
}

export function updateCurrentResponder(payload) {
  return apiRequest("/api/responders/me", {
    method: "PATCH",
    body: payload,
    errorMessage: "PATCH /api/responders/me failed",
  });
}

export function getResponderCapacity() {
  return apiRequest("/api/responders/capacity", {
    errorMessage: "GET /api/responders/capacity failed",
  });
}

export function addResponderZone(responderId, zoneId) {
  return apiRequest(`/api/responders/${responderId}/zones`, {
    method: "POST",
    body: { zone_id: zoneId },
    errorMessage: `POST /api/responders/${responderId}/zones failed`,
  });
}

export function removeResponderZone(responderId, zoneId) {
  return apiRequest(`/api/responders/${responderId}/zones/${zoneId}`, {
    method: "DELETE",
    errorMessage: `DELETE /api/responders/${responderId}/zones/${zoneId} failed`,
  });
}
