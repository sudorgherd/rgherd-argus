import { apiRequest } from "../../api/request";

export function createNote(recordId, payload) {
  return apiRequest(`/api/records/${recordId}/notes`, {
    method: "POST",
    body: payload,
    errorMessage: `POST /api/records/${recordId}/notes failed`,
  });
}

export function listRecordNotes(recordId) {
  return apiRequest(`/api/records/${recordId}/notes`, {
    errorMessage: `GET /api/records/${recordId}/notes failed`,
  });
}

export async function listRecordNotesWithStatus(recordId) {
  const response = await fetch(`/api/records/${recordId}/notes`, {
    credentials: "same-origin",
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(
      data.detail || `GET /api/records/${recordId}/notes failed (${response.status})`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}
