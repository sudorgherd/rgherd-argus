import { loadManifestSet } from "./moduleManifestRegistry";

const discoveredManifestLoaders = import.meta.glob("./installed/*/manifest.jsx");

export function loadInstalledModuleManifests(catalog) {
  return loadManifestSet(catalog, discoveredManifestLoaders);
}

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

export function enabledModuleNavigation(catalog, responder, manifests = []) {
  const enabledIds = new Set(
    (catalog || []).filter((item) => item.enabled).map((item) => item.module_id),
  );
  return manifests.flatMap((manifest) => {
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

export function findInstalledModuleRoute(navigationId, manifests = []) {
  if (!isModuleNavigation(navigationId)) return null;
  const [, moduleId, viewId] = navigationId.split(":", 3);
  const manifest = manifests.find(
    (candidate) => candidate.moduleId === moduleId,
  );
  const entry = manifest?.navigation.find((candidate) => candidate.id === viewId);
  return manifest && entry ? { manifest, entry } : null;
}
