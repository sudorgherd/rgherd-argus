import assert from "node:assert/strict";
import test from "node:test";

import {
  isolateManifestState,
  loadManifestSet,
} from "../../src/modules/moduleManifestRegistry.js";
import { allowedNavigationForAccess } from "../../src/hooks/useAccessNavigation.js";

const component = () => null;
const catalog = (...ids) => ids.map((module_id) => ({ module_id, enabled: true }));

test("loads valid enabled modules and does not import disabled broken modules", async () => {
  let disabledLoaded = false;
  const result = await loadManifestSet(catalog("valid"), {
    "./installed/valid/manifest.jsx": async () => ({
      default: {
        moduleId: "valid",
        navigation: [{ id: "home", label: "Valid", component }],
      },
    }),
    "./installed/disabled/manifest.jsx": async () => {
      disabledLoaded = true;
      throw new Error("disabled module should not execute");
    },
  });

  assert.deepEqual(result.manifests.map((item) => item.moduleId), ["valid"]);
  assert.deepEqual(result.failures, []);
  assert.equal(disabledLoaded, false);
});

test("isolates throwing and malformed modules while retaining another valid module", async () => {
  const result = await loadManifestSet(catalog("throwing", "malformed", "valid"), {
    "./installed/throwing/manifest.jsx": async () => {
      throw new Error("initialization failed");
    },
    "./installed/malformed/manifest.jsx": async () => ({ default: { moduleId: "malformed" } }),
    "./installed/valid/manifest.jsx": async () => ({
      default: {
        moduleId: "valid",
        navigation: [{ id: "home", label: "Valid", component }],
      },
    }),
  });

  assert.deepEqual(result.manifests.map((item) => item.moduleId), ["valid"]);
  assert.equal(result.failures.length, 2);
  assert.match(result.failures[0].reason, /navigation|required|initialization/i);
  assert.match(result.failures[1].reason, /navigation|required|initialization/i);
});

test("isolates duplicate and mismatched module IDs", async () => {
  const manifest = {
    moduleId: "alpha",
    navigation: [{ id: "home", label: "Alpha", component }],
  };
  const result = await loadManifestSet(catalog("alpha", "beta", "gamma"), {
    "./installed/alpha/manifest.jsx": async () => ({ default: manifest }),
    "./installed/beta/manifest.jsx": async () => ({ default: manifest }),
    "./installed/gamma/manifest.jsx": async () => ({
      default: {
        moduleId: "wrong_id",
        navigation: [{ id: "home", label: "Wrong", component }],
      },
    }),
  });

  assert.deepEqual(result.manifests.map((item) => item.moduleId), ["alpha"]);
  assert.equal(result.failures.length, 2);
  assert.ok(result.failures.some((failure) => /Duplicate/.test(failure.reason)));
  assert.ok(result.failures.some((failure) => /does not match/.test(failure.reason)));
});

test("a render failure restores core navigation and retains another valid module", () => {
  const state = isolateManifestState(
    {
      manifests: [
        { moduleId: "broken" },
        { moduleId: "valid" },
      ],
      failures: [],
    },
    "broken",
    new Error("render failed"),
  );
  const moduleNavItems = [{ id: "module:valid:home", label: "Valid" }];
  const navigation = allowedNavigationForAccess({
    isAdmin: false,
    canDispatch: true,
    canRespond: false,
    moduleFocusActive: state.manifests.length > 0,
    moduleIsolationActive: state.failures.length > 0,
    moduleNavItems,
  });

  assert.deepEqual(state.manifests.map((manifest) => manifest.moduleId), ["valid"]);
  assert.equal(state.failures[0].reason, "render failed");
  assert.ok(navigation.includes("Active Queue"));
  assert.ok(navigation.includes(moduleNavItems[0]));
});
