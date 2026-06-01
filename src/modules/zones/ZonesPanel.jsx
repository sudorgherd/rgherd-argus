import { useState } from "react";
import { MapPinned } from "lucide-react";
import { Panel } from "../../components/ui";
import { createZone as createZoneRequest, deleteZone as deleteZoneRequest, updateZone as updateZoneRequest } from "./zonesApi";

export default function ZonesPanel({ zones, onCreated, onUpdated, onDeleted, modalMode = false }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [matrixRoomId, setMatrixRoomId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMatrixRoomId, setEditMatrixRoomId] = useState("");

  async function createZone(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await createZoneRequest({ name, description, matrix_room_id: matrixRoomId });
      onCreated(data);
      setName("");
      setDescription("");
      setMatrixRoomId("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create zone");
    } finally {
      setSaving(false);
    }
  }

  async function saveZone(zoneId) {
    setSaving(true);
    try {
      const data = await updateZoneRequest(zoneId, {
        name: editName,
        description: editDescription,
        matrix_room_id: editMatrixRoomId,
      });
      onUpdated(data);
      setEditingId(null);
      setEditName("");
      setEditDescription("");
      setEditMatrixRoomId("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update zone");
    } finally {
      setSaving(false);
    }
  }

  async function deleteZone(zoneId) {
    if (!window.confirm("Delete this zone?")) return;
    setSaving(true);
    try {
      await deleteZoneRequest(zoneId);
      onDeleted(zoneId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete zone");
    } finally {
      setSaving(false);
    }
  }

  const sectionClass = modalMode
    ? "grid h-full min-h-0 gap-4 2xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]"
    : "grid gap-4 2xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]";

  const panelClass = modalMode
    ? "flex min-h-0 flex-col"
    : "flex h-[860px] min-h-[860px] flex-col";

  const listColumnClass = modalMode ? "grid min-h-0 gap-4" : "grid gap-4";
  const listClass = modalMode ? "min-h-0 flex-1 overflow-y-auto space-y-3 pr-1" : "flex-1 overflow-y-auto space-y-3 pr-1";

  return (
    <section className={sectionClass}>
      <Panel
        title="Add Zone"
        subtitle="Create a flat operational zone label"
        icon={MapPinned}
        className={panelClass}
      >
        <form onSubmit={createZone} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Zone Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              placeholder="Central"
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-[120px] w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              placeholder="Primary central operating zone"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Matrix Room ID</label>
            <input
              value={matrixRoomId}
              onChange={(event) => setMatrixRoomId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              placeholder="!zoneRoomId:example.org"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
          >
            Add Zone
          </button>
        </form>
      </Panel>

      <div className={listColumnClass}>
        <Panel
          title="Zones"
          subtitle="Existing operational zone labels"
          icon={MapPinned}
          className={panelClass}
        >
        <div className={listClass}>
          {zones.length === 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-400">
              No zones created yet.
            </div>
          )}

          {zones.map((zone) => {
            const isEditing = editingId === zone.id;
            return (
              <div key={zone.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      className="min-h-[96px] w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    />
                    <input
                      value={editMatrixRoomId}
                      onChange={(event) => setEditMatrixRoomId(event.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                      placeholder="!zoneRoomId:example.org"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => saveZone(zone.id)}
                        disabled={saving || !editName.trim()}
                        className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditName("");
                          setEditDescription("");
                          setEditMatrixRoomId("");
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-100">{zone.name}</p>
                      <p className="mt-2 text-sm text-slate-400">{zone.description || "No description."}</p>
                      <p className="mt-1 text-xs text-slate-500">{zone.matrix_room_id || "No Matrix room ID set"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(zone.id);
                          setEditName(zone.name);
                          setEditDescription(zone.description || "");
                          setEditMatrixRoomId(zone.matrix_room_id || "");
                        }}
                        className="rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-sm text-sky-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteZone(zone.id)}
                        disabled={saving}
                        className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </Panel>
      </div>
    </section>
  );
}
