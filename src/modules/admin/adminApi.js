import { apiRequest } from "../../api/request";

export function lookupMasUserByUsername(username) {
  return apiRequest(`/api/admin/mas-users/by-username/${encodeURIComponent(username)}`, {
    errorMessage: "MAS lookup failed",
  });
}

export function createResponder(payload) {
  return apiRequest("/api/admin/responders", {
    method: "POST",
    body: payload,
    errorMessage: "POST /api/admin/responders failed",
  });
}

export function updateResponder(responderId, payload) {
  return apiRequest(`/api/admin/responders/${responderId}`, {
    method: "PATCH",
    body: payload,
    errorMessage: `PATCH /api/admin/responders/${responderId} failed`,
  });
}

export function deleteResponder(responderId) {
  return apiRequest(`/api/admin/responders/${responderId}`, {
    method: "DELETE",
    errorMessage: `DELETE /api/admin/responders/${responderId} failed`,
  });
}


export function getPresenceSettings() {
  return apiRequest("/api/admin/settings/presence", {
    errorMessage: "GET /api/admin/settings/presence failed",
  });
}

export function updatePresenceSettings(payload) {
  return apiRequest("/api/admin/settings/presence", {
    method: "PATCH",
    body: payload,
    errorMessage: "PATCH /api/admin/settings/presence failed",
  });
}


export function getMatrixSettings() {
  return apiRequest("/api/admin/settings/matrix", {
    errorMessage: "GET /api/admin/settings/matrix failed",
  });
}

export function updateMatrixSettings(payload) {
  return apiRequest("/api/admin/settings/matrix", {
    method: "PATCH",
    body: payload,
    errorMessage: "PATCH /api/admin/settings/matrix failed",
  });
}
