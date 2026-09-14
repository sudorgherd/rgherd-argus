# Installed frontend modules

ARGUS discovers deployment-installed frontend manifests with Vite at build
time from `src/modules/installed/*/manifest.jsx`. The installed directory is
ignored by Git so deployment-specific and private module code cannot enter the
public repository accidentally.

A manifest exports a default object with a stable `moduleId`, display `name`,
`version`, and `navigation` entries. Each navigation entry supplies an `id`,
label, required `capability` (`authenticated`, `dispatch`, `respond`,
`dispatch_or_respond`, or `admin`), and a React component. Components receive
the current responder, core console data, navigation callback, and the shared
same-origin request helper through a `host` prop.

Installed modules are compiled into the one ARGUS frontend build. They do not
bootstrap another console or authentication session.

Only manifests whose backend module is enabled are imported at runtime. Each
manifest is validated independently; malformed, mismatched, duplicate, or
initialization-failing modules are omitted without preventing core console use.
Module component render failures are contained by the host view boundary.

Backend security is host-owned. Every discovered router receives the current
ARGUS responder dependency and the module-enabled dependency. The current
responder dependency requires an authenticated session and an approved, active
local responder. A module must add dispatch, respond, admin, or narrower
object-level authorization when its operation requires more authority. ARGUS
v1.3 does not support public installed-module routes.
