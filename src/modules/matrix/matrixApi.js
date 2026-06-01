import { apiRequest } from "../../api/request";

export function getMatrixStatus() {
  return apiRequest("/api/matrix/status", {
    errorMessage: "GET /api/matrix/status failed",
  });
}

export function sendRecordMatrixAlert(recordId, payload) {
  return apiRequest(`/api/records/${recordId}/matrix-alerts`, {
    method: "POST",
    body: payload,
    errorMessage: `POST /api/records/${recordId}/matrix-alerts failed`,
  });
}
