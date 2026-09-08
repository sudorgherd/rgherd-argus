import { Boxes, Power } from "lucide-react";
import { useEffect, useState } from "react";

import { Panel } from "../../components/ui";
import { listAdminModules, setModuleEnabled } from "./moduleApi";
import { MODULES_CHANGED_EVENT } from "./useModuleCatalog";

function statusText(value) {
  if (value == null) return "Not reported";
  if (typeof value === "string") return value;
  if (typeof value.status === "string") return value.status;
  return "Reported";
}

export default function ModulesPanel() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const data = await listAdminModules();
      setModules(Array.isArray(data.modules) ? data.modules : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load modules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(item) {
    setSavingId(item.module_id);
    setError("");
    try {
      const updated = await setModuleEnabled(item.module_id, !item.enabled);
      setModules((current) =>
        current.map((candidate) =>
          candidate.module_id === updated.module_id ? updated : candidate,
        ),
      );
      window.dispatchEvent(new Event(MODULES_CHANGED_EVENT));
    } catch (updateError) {
      setError(updateError.message || "Unable to update the module.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Panel
      title="Modules"
      subtitle="Deployment-installed extensions and their operational state"
      icon={Boxes}
    >
      {error && <p role="alert" className="mb-3 text-sm text-rose-200">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-400">Loading installed modules…</p>
      ) : modules.length === 0 ? (
        <p className="text-sm text-slate-400">No modules are installed in this deployment.</p>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {modules.map((item) => (
            <article
              key={item.module_id}
              className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{item.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.module_id} · {item.version}
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs ${
                  item.enabled
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                    : "border-slate-700 bg-slate-900 text-slate-300"
                }`}>
                  {item.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              {item.description && (
                <p className="mt-3 text-xs leading-5 text-slate-400">{item.description}</p>
              )}
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-slate-500">Backend health</dt><dd className="mt-1 text-slate-200">{statusText(item.health)}</dd></div>
                <div><dt className="text-slate-500">Migrations</dt><dd className="mt-1 text-slate-200">{statusText(item.migration_status)}</dd></div>
              </dl>
              <button
                type="button"
                onClick={() => toggle(item)}
                disabled={savingId === item.module_id}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-sm text-cyan-100 disabled:opacity-50"
              >
                <Power size={14} />
                {savingId === item.module_id
                  ? "Saving…"
                  : item.enabled ? "Disable" : "Enable"}
              </button>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
