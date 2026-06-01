import { apiRequest } from "../../api/request";

export function listRecords(lifecycle = null) {
  const query = lifecycle ? `?lifecycle=${encodeURIComponent(lifecycle)}` : "";
  return apiRequest(`/api/records${query}`, {
    errorMessage: `GET /api/records${query} failed`,
  });
}

export function updateRecord(recordId, payload) {
  return apiRequest(`/api/records/${recordId}`, {
    method: "PATCH",
    body: payload,
    errorMessage: `PATCH /api/records/${recordId} failed`,
  });
}

export function closeRecord(recordId, payload) {
  return apiRequest(`/api/records/${recordId}/close`, {
    method: "POST",
    body: payload,
    errorMessage: `POST /api/records/${recordId}/close failed`,
  });
}

export function reopenRecord(recordId, payload = {}) {
  return apiRequest(`/api/records/${recordId}/reopen`, {
    method: "POST",
    body: payload,
    errorMessage: `POST /api/records/${recordId}/reopen failed`,
  });
}

export function archiveRecord(recordId, payload = {}) {
  return apiRequest(`/api/records/${recordId}/archive`, {
    method: "POST",
    body: payload,
    errorMessage: `POST /api/records/${recordId}/archive failed`,
  });
}

export function purgeRecord(recordId) {
  return apiRequest(`/api/records/${recordId}/purge`, {
    method: "DELETE",
    errorMessage: `DELETE /api/records/${recordId}/purge failed`,
  });
}
