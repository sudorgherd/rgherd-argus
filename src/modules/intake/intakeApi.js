import { apiRequest } from "../../api/request";

export function createRecord(payload) {
  return apiRequest("/api/records", {
    method: "POST",
    body: payload,
    errorMessage: "POST /api/records failed",
  });
}
