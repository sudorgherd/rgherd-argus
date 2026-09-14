const MODULE_ID_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;

function sourceModuleId(source) {
  const match = source.match(/\/installed\/([^/]+)\/manifest\.jsx$/);
  return match ? match[1] : null;
}

export function validateManifest(manifest, source) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error(`Invalid installed module manifest: ${source}`);
  }
  if (!MODULE_ID_PATTERN.test(manifest.moduleId || "")) {
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

export async function loadManifestSet(catalog, loaders) {
  const enabledIds = new Set(
    (catalog || []).filter((item) => item.enabled).map((item) => item.module_id),
  );
  const manifests = [];
  const failures = [];
  const seenIds = new Set();

  for (const [source, loader] of Object.entries(loaders || {}).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const expectedId = sourceModuleId(source);
    if (!expectedId || !enabledIds.has(expectedId)) continue;

    try {
      const loaded = await loader();
      const manifest = validateManifest(loaded?.default, source);
      if (seenIds.has(manifest.moduleId)) {
        throw new Error(`Duplicate installed module ID: ${manifest.moduleId}`);
      }
      if (manifest.moduleId !== expectedId) {
        throw new Error(
          `Installed module ID ${manifest.moduleId} does not match directory ${expectedId}`,
        );
      }
      seenIds.add(manifest.moduleId);
      manifests.push(manifest);
    } catch (error) {
      failures.push(Object.freeze({
        source,
        reason: error instanceof Error ? error.message : "Module load failed",
      }));
    }
  }

  manifests.sort((left, right) => left.moduleId.localeCompare(right.moduleId));
  return Object.freeze({
    manifests: Object.freeze(manifests),
    failures: Object.freeze(failures),
  });
}

export function isolateManifestState(current, moduleId, error) {
  return {
    manifests: current.manifests.filter((manifest) => manifest.moduleId !== moduleId),
    failures: [
      ...current.failures,
      {
        moduleId,
        reason: error instanceof Error ? error.message : "Module render failed",
      },
    ],
  };
}
