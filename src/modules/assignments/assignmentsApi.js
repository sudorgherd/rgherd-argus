import { apiRequest } from "../../api/request";

export function createAssignment(recordId, payload) {
  return apiRequest(`/api/records/${recordId}/assignments`, {
    method: "POST",
    body: payload,
    errorMessage: `POST /api/records/${recordId}/assignments failed`,
  });
}

export function deleteAssignment(recordId, assignmentId) {
  return apiRequest(`/api/records/${recordId}/assignments/${assignmentId}`, {
    method: "DELETE",
    errorMessage: `DELETE /api/records/${recordId}/assignments/${assignmentId} failed`,
  });
}

export function listRecordAssignments(recordId) {
  return apiRequest(`/api/records/${recordId}/assignments`, {
    errorMessage: `GET /api/records/${recordId}/assignments failed`,
  });
}

export function updateAssignment(recordId, assignmentId, payload) {
  return apiRequest(`/api/records/${recordId}/assignments/${assignmentId}`, {
    method: "PATCH",
    body: payload,
    errorMessage: `PATCH /api/records/${recordId}/assignments/${assignmentId} failed`,
  });
}
