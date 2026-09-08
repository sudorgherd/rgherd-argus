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
