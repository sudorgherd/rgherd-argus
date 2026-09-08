import { apiRequest } from "../../api/request";

export function listEnabledModules() {
  return apiRequest("/api/modules", {
    errorMessage: "Unable to load installed modules.",
  });
}

export function listAdminModules() {
  return apiRequest("/api/admin/modules", {
    errorMessage: "Unable to load module administration.",
  });
}

export function setModuleEnabled(moduleId, enabled) {
  return apiRequest(`/api/admin/modules/${encodeURIComponent(moduleId)}`, {
    method: "PATCH",
    body: { enabled },
    errorMessage: "Unable to update the module.",
  });
}
