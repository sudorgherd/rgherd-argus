import { apiRequest } from "../../api/request";

export function getSystemAudit() {
  return apiRequest("/api/system-audit", {
    errorMessage: "GET /api/system-audit failed",
  });
}

export function getRecordAudit(recordId) {
  return apiRequest(`/api/records/${recordId}/audit`, {
    errorMessage: `GET /api/records/${recordId}/audit failed`,
  });
}
