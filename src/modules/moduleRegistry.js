const discoveredManifests = import.meta.glob(
  "./installed/*/manifest.jsx",
  { eager: true },
);

function validateManifest(manifest, source) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error(`Invalid installed module manifest: ${source}`);
  }
  if (!/^[a-z][a-z0-9_-]{1,63}$/.test(manifest.moduleId || "")) {
    throw new Error(`Invalid installed module ID: ${source}`);
  }
  if (!Array.isArray(manifest.navigation)) {
    throw new Error(`Installed module navigation is required: ${source}`);
  }
  for (const entry of manifest.navigation) {
    if (!entry?.id || !entry?.label || typeof entry.component !== "function") {
      throw new Error(`Invalid installed module navigation entry: ${source}`);
    }
  }
  return Object.freeze(manifest);
}

export const installedModuleManifests = Object.freeze(
  Object.entries(discoveredManifests)
    .map(([source, loaded]) => validateManifest(loaded.default, source))
    .sort((left, right) => left.moduleId.localeCompare(right.moduleId)),
);

export function moduleNavigationId(moduleId, viewId) {
  return `module:${moduleId}:${viewId}`;
}

export function isModuleNavigation(value) {
  return typeof value === "string" && value.startsWith("module:");
}

export function capabilityAllows(capability, responder) {
  if (!responder) return false;
  if (responder.is_admin) return true;
  if (capability === "admin") return false;
  if (capability === "dispatch") return Boolean(responder.can_dispatch);
  if (capability === "respond") return Boolean(responder.can_respond);
  if (capability === "dispatch_or_respond") {
    return Boolean(responder.can_dispatch || responder.can_respond);
  }
  return capability == null || capability === "authenticated";
}

export function enabledModuleNavigation(catalog, responder) {
  const enabledIds = new Set(
    (catalog || []).filter((item) => item.enabled).map((item) => item.module_id),
  );
  return installedModuleManifests.flatMap((manifest) => {
    if (!enabledIds.has(manifest.moduleId)) return [];
    return manifest.navigation
      .filter((entry) => capabilityAllows(entry.capability, responder))
      .map((entry) => ({
        id: moduleNavigationId(manifest.moduleId, entry.id),
        label: entry.label,
        moduleId: manifest.moduleId,
      }));
  });
}

export function findInstalledModuleRoute(navigationId) {
  if (!isModuleNavigation(navigationId)) return null;
  const [, moduleId, viewId] = navigationId.split(":", 3);
  const manifest = installedModuleManifests.find(
    (candidate) => candidate.moduleId === moduleId,
  );
  const entry = manifest?.navigation.find((candidate) => candidate.id === viewId);
  return manifest && entry ? { manifest, entry } : null;
}
