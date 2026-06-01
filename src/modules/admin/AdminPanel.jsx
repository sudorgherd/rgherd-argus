import { useEffect, useState } from "react";
import { Activity, Users } from "lucide-react";

import { availabilityTone, presenceTone } from "../../constants/ui";
import { formatDateTime, responderLabel, safeArray } from "../../utils/display";
import { Panel } from "../../components/ui";
import ZonesPanel from "../zones/ZonesPanel";
import {
  createResponder,
  deleteResponder as deleteResponderApi,
  getMatrixSettings,
  getPresenceSettings,
  lookupMasUserByUsername,
  updateMatrixSettings,
  updatePresenceSettings,
  updateResponder,
} from "./adminApi";

function presenceRank(presence) {
  if (presence === "Online") return 0;
  if (presence === "Idle") return 1;
  return 2;
}

function lastSeenText(lastSeenAt) {
  if (!lastSeenAt) return "Last seen: —";

  const seen = new Date(lastSeenAt);
  if (Number.isNaN(seen.getTime())) return "Last seen: —";

  const minutes = Math.max(0, Math.round((Date.now() - seen.getTime()) / 60000));

  if (minutes < 1) return "Last seen: just now";
  if (minutes === 1) return "Last seen: 1m ago";
  if (minutes < 60) return `Last seen: ${minutes}m ago`;

  return `Last seen: ${formatDateTime(lastSeenAt)}`;
}

export default function AdminPanel({ responders = [], zones = [], onResponderSaved, onResponderDeleted, onResponderZoneAdded, onResponderZoneRemoved, onZoneCreated, onZoneUpdated, onZoneDeleted }) {
  const accessProfileOptions = [
    {
      value: "none",
      label: "No Operational Access",
      role: "None",
      is_admin: false,
      can_dispatch: false,
      can_respond: false,
    },
    {
      value: "responder",
      label: "Responder",
      role: "Responder",
      is_admin: false,
      can_dispatch: false,
      can_respond: true,
    },
    {
      value: "dispatcher",
      label: "Dispatcher",
      role: "Dispatcher",
      is_admin: false,
      can_dispatch: true,
      can_respond: false,
    },
    {
      value: "dispatcher_responder",
      label: "Dispatcher + Responder",
      role: "Dispatcher + Responder",
      is_admin: false,
      can_dispatch: true,
      can_respond: true,
    },
    {
      value: "admin",
      label: "Admin",
      role: "Admin",
      is_admin: true,
      can_dispatch: true,
      can_respond: true,
    },
  ];

  const skillOptions = [
    "Medical",
    "Transport",
    "De-escalation",
    "Logistics",
    "Communications",
    "Legal Support",
    "Safety",
    "Search",
    "Supply",
  ];

  const emptyForm = {
    subject_id: "",
    display_name: "",
    matrix_user_id: "",
    dm_room_id: "",
    role: "Responder",
    skills: [],
    zone_ids: [],
    is_active: true,
    is_approved: false,
    is_admin: false,
    can_dispatch: false,
    can_respond: true,
  };

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [zonesOpen, setZonesOpen] = useState(false);

  const [masLookupUsername, setMasLookupUsername] = useState("");
  const [masLookupLoading, setMasLookupLoading] = useState(false);
  const [masLookupResult, setMasLookupResult] = useState(null);
  const [masLookupError, setMasLookupError] = useState("");

  const [presenceSettings, setPresenceSettings] = useState(null);
  const [presenceSettingsOpen, setPresenceSettingsOpen] = useState(false);
  const [presenceSettingsForm, setPresenceSettingsForm] = useState({
    idle_minutes: 5,
    offline_minutes: 10,
  });
  const [presenceSettingsSaving, setPresenceSettingsSaving] = useState(false);
  const [presenceSettingsError, setPresenceSettingsError] = useState("");
  const [presenceSettingsMessage, setPresenceSettingsMessage] = useState("");

  const [matrixSettings, setMatrixSettings] = useState(null);
  const [matrixSettingsOpen, setMatrixSettingsOpen] = useState(false);
  const [matrixSettingsForm, setMatrixSettingsForm] = useState({
    homeserver_url: "",
    sender_user_id: "",
    access_token: "",
    request_timeout_seconds: 10,
    user_domain: "",
  });
  const [matrixSettingsSaving, setMatrixSettingsSaving] = useState(false);
  const [matrixSettingsError, setMatrixSettingsError] = useState("");
  const [matrixSettingsMessage, setMatrixSettingsMessage] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadPresenceSettings() {
      try {
        const data = await getPresenceSettings();

        if (!ignore) {
          setPresenceSettings(data);
          setPresenceSettingsForm({
            idle_minutes: data.idle_minutes,
            offline_minutes: data.offline_minutes,
          });
        }
      } catch (err) {
        if (!ignore) {
          setPresenceSettingsError(
            err instanceof Error ? err.message : "Failed to load presence settings"
          );
        }
      }
    }

    loadPresenceSettings();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadMatrixSettings() {
      try {
        const data = await getMatrixSettings();

        if (!ignore) {
          setMatrixSettings(data);
          setMatrixSettingsForm({
            homeserver_url: data.homeserver_url || "",
            sender_user_id: data.sender_user_id || "",
            access_token: "",
            request_timeout_seconds: data.request_timeout_seconds || 10,
            user_domain: data.user_domain || "",
          });
        }
      } catch (err) {
        if (!ignore) {
          setMatrixSettingsError(
            err instanceof Error ? err.message : "Failed to load Matrix settings"
          );
        }
      }
    }

    loadMatrixSettings();

    return () => {
      ignore = true;
    };
  }, []);

  function getAccessProfile(values) {
    if (values.is_admin) return "admin";
    if (values.can_dispatch && values.can_respond) return "dispatcher_responder";
    if (values.can_dispatch) return "dispatcher";
    if (values.can_respond) return "responder";
    return "none";
  }

  function getAccessProfileLabel(values) {
    const value = getAccessProfile(values);
    return accessProfileOptions.find((profile) => profile.value === value)?.label || "No Operational Access";
  }

  function setAccessProfile(value) {
    const profile = accessProfileOptions.find((item) => item.value === value) || accessProfileOptions[0];

    setForm((current) => ({
      ...current,
      role: profile.role,
      is_admin: profile.is_admin,
      can_dispatch: profile.can_dispatch,
      can_respond: profile.can_respond,
    }));
  }

  function isAccountEnabled(values) {
    return Boolean(values.is_active && values.is_approved);
  }

  function setAccountEnabled(enabled) {
    setForm((current) => ({
      ...current,
      is_active: enabled,
      is_approved: enabled ? true : current.is_approved,
    }));
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function selectedZoneIds(value = form.zone_ids) {
    return safeArray(value)
      .map((zoneId) => Number(zoneId))
      .filter((zoneId) => Number.isFinite(zoneId));
  }

  function zoneAccessSummary(zoneIds = form.zone_ids) {
    const selected = selectedZoneIds(zoneIds);

    if (selected.length === 0) return "No zones selected";
    if (selected.length > 2) return `${selected.length} zones selected`;

    return selected
      .map((zoneId) => zones.find((zone) => Number(zone.id) === zoneId)?.name || `Zone ${zoneId}`)
      .join(", ");
  }

  function toggleZoneAccess(zoneId, enabled) {
    const numericZoneId = Number(zoneId);

    setForm((current) => {
      const currentZoneIds = selectedZoneIds(current.zone_ids);

      return {
        ...current,
        zone_ids: enabled
          ? Array.from(new Set([...currentZoneIds, numericZoneId]))
          : currentZoneIds.filter((currentZoneId) => currentZoneId !== numericZoneId),
      };
    });
  }

  function skillSummary(skills = form.skills) {
    const selected = safeArray(skills);

    if (selected.length === 0) return "No skills selected";
    if (selected.length > 2) return `${selected.length} skills selected`;

    return selected.join(", ");
  }

  function toggleSkill(skill, enabled) {
    setForm((current) => {
      const currentSkills = safeArray(current.skills);

      return {
        ...current,
        skills: enabled
          ? Array.from(new Set([...currentSkills, skill]))
          : currentSkills.filter((item) => item !== skill),
      };
    });
  }

  async function syncResponderZones(responderId, desiredZoneIds, currentZoneIds) {
    if (!onResponderZoneAdded || !onResponderZoneRemoved) return null;

    const desired = Array.from(new Set(selectedZoneIds(desiredZoneIds)));
    const current = Array.from(new Set(selectedZoneIds(currentZoneIds)));
    let latestResponder = null;

    for (const zoneId of current.filter((zoneId) => !desired.includes(zoneId))) {
      latestResponder = await onResponderZoneRemoved(responderId, zoneId);
    }

    for (const zoneId of desired.filter((zoneId) => !current.includes(zoneId))) {
      latestResponder = await onResponderZoneAdded(responderId, zoneId);
    }

    return latestResponder;
  }

  function resetForm() {
    setEditingId(null);
    setEditOpen(false);
    setRegisterOpen(false);
    setForm(emptyForm);
    setMasLookupUsername("");
    setMasLookupResult(null);
    setMasLookupError("");
  }

  function beginCreate() {
    setEditingId(null);
    setEditOpen(false);
    setForm(emptyForm);
    setMasLookupUsername("");
    setMasLookupResult(null);
    setMasLookupError("");
    setRegisterOpen(true);
  }

  function beginEdit(responder) {
    setRegisterOpen(false);
    setEditingId(responder.id);
    setEditOpen(true);
    setMasLookupUsername("");
    setMasLookupResult(null);
    setMasLookupError("");
    setForm({
      subject_id: responder.subject_id || "",
      display_name: responder.display_name || "",
      matrix_user_id: responder.matrix_user_id || "",
      dm_room_id: responder.dm_room_id || "",
      role: responder.role || "Responder",
      skills: safeArray(responder.skills),
      zone_ids: selectedZoneIds(responder.zone_ids),
      is_active: Boolean(responder.is_active),
      is_approved: Boolean(responder.is_approved),
      is_admin: Boolean(responder.is_admin),
      can_dispatch: Boolean(responder.can_dispatch),
      can_respond: Boolean(responder.can_respond),
    });
  }

  async function handleSavePresenceSettings() {
    setPresenceSettingsSaving(true);
    setPresenceSettingsError("");
    setPresenceSettingsMessage("");

    try {
      const updated = await updatePresenceSettings({
        idle_minutes: Number(presenceSettingsForm.idle_minutes),
        offline_minutes: Number(presenceSettingsForm.offline_minutes),
      });

      setPresenceSettings(updated);
      setPresenceSettingsForm({
        idle_minutes: updated.idle_minutes,
        offline_minutes: updated.offline_minutes,
      });
      setPresenceSettingsMessage("Presence timeout settings saved.");
      setPresenceSettingsOpen(false);
    } catch (err) {
      setPresenceSettingsError(
        err instanceof Error ? err.message : "Failed to save presence settings"
      );
    } finally {
      setPresenceSettingsSaving(false);
    }
  }

  async function handleSaveMatrixSettings() {
    setMatrixSettingsSaving(true);
    setMatrixSettingsError("");
    setMatrixSettingsMessage("");

    try {
      const updated = await updateMatrixSettings({
        homeserver_url: matrixSettingsForm.homeserver_url.trim() || null,
        sender_user_id: matrixSettingsForm.sender_user_id.trim() || null,
        access_token: matrixSettingsForm.access_token.trim() || null,
        request_timeout_seconds: Number(matrixSettingsForm.request_timeout_seconds || 10),
        user_domain: matrixSettingsForm.user_domain.trim() || null,
      });

      setMatrixSettings(updated);
      setMatrixSettingsForm({
        homeserver_url: updated.homeserver_url || "",
        sender_user_id: updated.sender_user_id || "",
        access_token: "",
        request_timeout_seconds: updated.request_timeout_seconds || 10,
        user_domain: updated.user_domain || "",
      });
      setMatrixSettingsMessage("Matrix integration settings saved.");
      setMatrixSettingsOpen(false);
    } catch (err) {
      setMatrixSettingsError(
        err instanceof Error ? err.message : "Failed to save Matrix settings"
      );
    } finally {
      setMatrixSettingsSaving(false);
    }
  }

  async function lookupMasUser() {
    const username = masLookupUsername.trim();

    if (!username) {
      setMasLookupError("Enter a MAS username/localpart first.");
      setMasLookupResult(null);
      return;
    }

    setMasLookupLoading(true);
    setMasLookupError("");
    setMasLookupResult(null);

    try {
      const data = await lookupMasUserByUsername(username);

      setMasLookupResult(data);
      setForm((current) => ({
        ...current,
        subject_id: data.subject_id || current.subject_id,
        display_name: data.display_name || current.display_name,
        matrix_user_id: data.matrix_user_id || current.matrix_user_id,
      }));
    } catch (err) {
      setMasLookupError(err instanceof Error ? err.message : "MAS lookup failed");
    } finally {
      setMasLookupLoading(false);
    }
  }

  async function submitResponder(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        subject_id: form.subject_id.trim(),
        display_name: form.display_name.trim(),
        matrix_user_id: form.matrix_user_id.trim() || null,
        dm_room_id: form.dm_room_id.trim() || null,
        role: form.role || "Responder",
        skills: safeArray(form.skills),
        is_active: form.is_active,
        is_approved: form.is_approved,
        is_admin: form.is_admin,
        can_dispatch: form.can_dispatch,
        can_respond: form.can_respond,
      };

      const existingResponder = editingId
        ? responders.find((responder) => responder.id === editingId)
        : null;

      const currentZoneIds = editingId
        ? selectedZoneIds(existingResponder?.zone_ids)
        : [];

      const data = editingId
        ? await updateResponder(editingId, payload)
        : await createResponder(payload);

      const zoneSyncedResponder = await syncResponderZones(
        data.id,
        form.zone_ids,
        currentZoneIds
      );

      onResponderSaved(zoneSyncedResponder || data);
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save responder");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteResponder() {
    if (!editingId) return;
    if (!window.confirm("Delete this operator record entirely? This cannot be undone.")) return;

    setSaving(true);
    try {
      await deleteResponderApi(editingId);

      if (onResponderDeleted) onResponderDeleted(editingId);
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete responder");
    } finally {
      setSaving(false);
    }
  }

  const sortedResponders = [...responders].sort((a, b) => {
    const aRank = presenceRank(a.presence);
    const bRank = presenceRank(b.presence);

    if (aRank !== bRank) return aRank - bRank;

    return (a.display_name || a.subject_id || "").localeCompare(b.display_name || b.subject_id || "");
  });

  const onlineCount = sortedResponders.filter((responder) => responder.presence === "Online").length;
  const idleCount = sortedResponders.filter((responder) => responder.presence === "Idle").length;
  const offlineCount = sortedResponders.filter((responder) => responder.presence === "Offline" || !responder.presence).length;
  const enabledCount = sortedResponders.filter((responder) => responder.is_active && responder.is_approved).length;

  function renderOperatorForm({ title, subtitle, showDelete = false }) {
    return (
      <form onSubmit={submitResponder} className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">MAS User Lookup</p>
          <p className="mt-1 text-xs text-slate-400">
            Enter a | base | username/localpart to resolve the MAS Subject ID and Matrix ID.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={masLookupUsername}
              onChange={(event) => setMasLookupUsername(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  lookupMasUser();
                }
              }}
              className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              placeholder="testuser4"
            />
            <button
              type="button"
              onClick={lookupMasUser}
              disabled={masLookupLoading || !masLookupUsername.trim()}
              className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-100 disabled:opacity-60"
            >
              {masLookupLoading ? "Looking up..." : "Lookup MAS User"}
            </button>
          </div>

          {masLookupError && (
            <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {masLookupError}
            </p>
          )}

          {masLookupResult && (
            <div className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              <p>
                Resolved {masLookupResult.display_name} → {masLookupResult.subject_id}
              </p>
              <p className="mt-1 text-emerald-200/80">{masLookupResult.matrix_user_id}</p>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.14em] text-slate-500">MAS Subject ID</label>
            <input
              value={form.subject_id}
              onChange={(event) => updateField("subject_id", event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              placeholder="01ABC..."
              required
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.14em] text-slate-500">ARGUS Display Name</label>
            <input
              value={form.display_name}
              onChange={(event) => updateField("display_name", event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              placeholder="RaveGoat"
              required
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Matrix User ID</label>
            <input
              value={form.matrix_user_id}
              onChange={(event) => updateField("matrix_user_id", event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              placeholder="@operator:example.org"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Cached DM Room ID</label>
            <input
              value={form.dm_room_id}
              onChange={(event) => updateField("dm_room_id", event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              placeholder="!dmRoomId:example.org"
            />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Access Profile</label>
          <select
            value={getAccessProfile(form)}
            onChange={(event) => setAccessProfile(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          >
            {accessProfileOptions.map((profile) => (
              <option key={profile.value} value={profile.value}>
                {profile.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Sets responder, dispatcher, and admin capabilities together.
          </p>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Zone Access</label>
          <details className="group mt-2 rounded-lg border border-slate-800 bg-slate-950/60 text-sm text-slate-100">
            <summary className="cursor-pointer list-none px-3 py-2 text-slate-200 marker:hidden">
              <span className="flex items-center justify-between gap-3">
                <span>{zoneAccessSummary(form.zone_ids)}</span>
                <span className="text-xs text-slate-500">⌄</span>
              </span>
            </summary>

            <div className="border-t border-slate-800 p-2">
              {zones.length === 0 ? (
                <p className="px-2 py-2 text-xs text-slate-500">No zones created yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {zones.map((zone) => {
                    const zoneId = Number(zone.id);
                    const checked = selectedZoneIds(form.zone_ids).includes(zoneId);

                    return (
                      <label key={zone.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => toggleZoneAccess(zoneId, event.target.checked)}
                        />
                        <span className="min-w-0 truncate">{zone.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </details>
          <p className="mt-2 text-xs text-slate-500">
            Controls which operational zones this operator can view or respond within when responder access is enabled.
          </p>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Skills</label>
          <details className="group mt-2 rounded-lg border border-slate-800 bg-slate-950/60 text-sm text-slate-100">
            <summary className="cursor-pointer list-none px-3 py-2 text-slate-200 marker:hidden">
              <span className="flex items-center justify-between gap-3">
                <span>{skillSummary(form.skills)}</span>
                <span className="text-xs text-slate-500">⌄</span>
              </span>
            </summary>

            <div className="border-t border-slate-800 p-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {skillOptions.map((skill) => {
                  const checked = safeArray(form.skills).includes(skill);

                  return (
                    <label key={skill} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleSkill(skill, event.target.checked)}
                      />
                      <span className="min-w-0 truncate">{skill}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </details>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Account Access</label>
          <label className="mt-2 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={isAccountEnabled(form)}
              onChange={(event) => setAccountEnabled(event.target.checked)}
            />
            Enabled
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Enabled means the operator is approved and the account is usable. Disabling pauses access without deleting the record.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving || !form.subject_id.trim() || !form.display_name.trim()}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
          >
            {saving ? "Saving..." : showDelete ? "Save Operator" : "Create Operator"}
          </button>

          {showDelete && (
            <button
              type="button"
              onClick={handleDeleteResponder}
              disabled={saving || !editingId}
              className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-100 disabled:opacity-60"
            >
              Delete Operator
            </button>
          )}

          <button
            type="button"
            onClick={resetForm}
            disabled={saving}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  function renderOperatorModal({ title, subtitle, showDelete = false }) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 p-4">
        <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Admin</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-100">{title}</h3>
              <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
            </div>

          </div>

          {renderOperatorForm({ title, subtitle, showDelete })}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <Panel
        title="System Settings"
        subtitle="Global ARGUS operator behavior"
        icon={Activity}
      >
        <div className="grid gap-3 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Presence & Sessions</p>
            <h4 className="mt-2 text-sm font-semibold text-slate-100">
              Idle {presenceSettings?.idle_minutes ?? presenceSettingsForm.idle_minutes}m / Offline {presenceSettings?.offline_minutes ?? presenceSettingsForm.offline_minutes}m
            </h4>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Controls when stale operator sessions appear Idle or Offline.
            </p>

            {(presenceSettingsError || presenceSettingsMessage) && (
              <div
                className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                  presenceSettingsError
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                }`}
              >
                {presenceSettingsError || presenceSettingsMessage}
              </div>
            )}

            <button
              type="button"
              onClick={() => setPresenceSettingsOpen(true)}
              className="mt-4 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-100"
            >
              Configure
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Operational Zones</p>
            <h4 className="mt-2 text-sm font-semibold text-slate-100">
              {zones.length} configured
            </h4>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Create zone labels and maintain Matrix room routing for zone alerts.
            </p>

            <button
              type="button"
              onClick={() => setZonesOpen(true)}
              className="mt-4 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-100"
            >
              Manage Zones
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Matrix Integration</p>
            <h4 className="mt-2 text-sm font-semibold text-slate-100">
              {matrixSettings?.configured ? "Configured" : "Not configured"}
            </h4>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Homeserver, sender account, token status, and timeout controls.
            </p>
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              <p>Sender: {matrixSettings?.sender_user_id || "—"}</p>
              <p>Token: {matrixSettings?.access_token_configured ? "Configured" : "Missing"}</p>
              <p>Source: {matrixSettings?.access_token_source || "—"}</p>
            </div>

            {(matrixSettingsError || matrixSettingsMessage) && (
              <div
                className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                  matrixSettingsError
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                }`}
              >
                {matrixSettingsError || matrixSettingsMessage}
              </div>
            )}

            <button
              type="button"
              onClick={() => setMatrixSettingsOpen(true)}
              className="mt-4 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-100"
            >
              Configure
            </button>
          </div>
        </div>
      </Panel>

      <Panel
        title="Operator Management"
        subtitle="Administrative directory with live roster state"
        icon={Users}
        className="flex min-h-[680px] flex-col"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">
              Total: {sortedResponders.length}
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
              Enabled: {enabledCount}
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
              Online: {onlineCount}
            </span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
              Idle: {idleCount}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">
              Offline: {offlineCount}
            </span>
          </div>

          <button
            type="button"
            onClick={beginCreate}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-100"
          >
            Register Operator
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {sortedResponders.length === 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-400">
              No operators returned yet.
            </div>
          )}

          {sortedResponders.map((responder) => {
            const isOffline = responder.presence === "Offline" || !responder.presence;
            const isIdle = responder.presence === "Idle";

            return (
              <div
                key={responder.id}
                className={`rounded-xl border p-4 text-xs ${
                  isOffline
                    ? "border-slate-800 bg-slate-950/60 opacity-75"
                    : isIdle
                      ? "border-amber-500/20 bg-slate-900/70"
                      : "border-slate-800 bg-slate-900/70"
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-100">{responderLabel(responder)}</p>
                      <span className={`rounded-full border px-2 py-0.5 ${presenceTone[responder.presence] || presenceTone.Offline}`}>
                        {responder.presence || "Offline"}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 ${availabilityTone[responder.availability] || availabilityTone.Away}`}>
                        {responder.availability || "—"}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-[11px] text-slate-400">{responder.subject_id}</p>
                    <p className="mt-1 truncate text-xs text-slate-300">{responder.matrix_user_id || "No Matrix ID set"}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-500">{responder.dm_room_id || "No cached DM room"}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => beginEdit(responder)}
                    className="w-fit rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs text-sky-100"
                  >
                    Edit
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {responder.is_active && responder.is_approved ? (
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-100">Enabled</span>
                  ) : (
                    <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-slate-300">Disabled</span>
                  )}
                  {responder.can_respond && <span className="rounded-full border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-sky-100">Respond</span>}
                  {responder.can_dispatch && <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-amber-100">Dispatch</span>}
                  {responder.is_admin && <span className="rounded-full border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-violet-100">Admin</span>}
                </div>

                <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
                  <p className="text-slate-300">
                    Profile: {getAccessProfileLabel(responder)}
                  </p>
                  <p className="text-slate-300">
                    Skills: {safeArray(responder.skills).length > 0 ? responder.skills.join(", ") : "—"}
                  </p>
                  <p className="text-slate-400">
                    Zones: {safeArray(responder.zones).length > 0 ? responder.zones.join(", ") : "—"}
                  </p>
                </div>

                <p className="mt-2 text-slate-400">{lastSeenText(responder.last_seen_at)}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      {presenceSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">System Settings</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-100">Presence & Sessions</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Set the global timeout thresholds used by effective operator presence.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPresenceSettingsOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                Close
              </button>
            </div>

            {(presenceSettingsError || presenceSettingsMessage) && (
              <div
                className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                  presenceSettingsError
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                }`}
              >
                {presenceSettingsError || presenceSettingsMessage}
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="presence_idle_minutes" className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Idle After
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="presence_idle_minutes"
                    name="presence_idle_minutes"
                    type="number"
                    min={presenceSettings?.min_idle_minutes ?? 2}
                    max={presenceSettings?.max_offline_minutes ?? 60}
                    value={presenceSettingsForm.idle_minutes}
                    onChange={(event) =>
                      setPresenceSettingsForm((current) => ({
                        ...current,
                        idle_minutes: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                  />
                  <span className="text-xs text-slate-500">min</span>
                </div>
              </div>

              <div>
                <label htmlFor="presence_offline_minutes" className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Offline After
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="presence_offline_minutes"
                    name="presence_offline_minutes"
                    type="number"
                    min={Number(presenceSettingsForm.idle_minutes || 0) + 1}
                    max={presenceSettings?.max_offline_minutes ?? 60}
                    value={presenceSettingsForm.offline_minutes}
                    onChange={(event) =>
                      setPresenceSettingsForm((current) => ({
                        ...current,
                        offline_minutes: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                  />
                  <span className="text-xs text-slate-500">min</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSavePresenceSettings}
                disabled={presenceSettingsSaving}
                className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-100 disabled:opacity-60"
              >
                {presenceSettingsSaving ? "Saving..." : "Save Presence Settings"}
              </button>
              <button
                type="button"
                onClick={() => setPresenceSettingsOpen(false)}
                disabled={presenceSettingsSaving}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {matrixSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">System Settings</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-100">Matrix Integration</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Configure the Matrix homeserver and sender account used for ARGUS alerts. The access token is never displayed after saving.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMatrixSettingsOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                Close
              </button>
            </div>

            {(matrixSettingsError || matrixSettingsMessage) && (
              <div
                className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                  matrixSettingsError
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                }`}
              >
                {matrixSettingsError || matrixSettingsMessage}
              </div>
            )}

            <div className="mt-5 grid gap-4">
              <div>
                <label htmlFor="matrix_homeserver_url" className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Homeserver URL
                </label>
                <input
                  id="matrix_homeserver_url"
                  value={matrixSettingsForm.homeserver_url}
                  onChange={(event) =>
                    setMatrixSettingsForm((current) => ({
                      ...current,
                      homeserver_url: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                  placeholder="https://matrix.example.org"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="matrix_sender_user_id" className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    Sender Matrix User ID
                  </label>
                  <input
                    id="matrix_sender_user_id"
                    value={matrixSettingsForm.sender_user_id}
                    onChange={(event) =>
                      setMatrixSettingsForm((current) => ({
                        ...current,
                        sender_user_id: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    placeholder="@argus-bot:example.org"
                  />
                </div>

                <div>
                  <label htmlFor="matrix_user_domain" className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    User Domain
                  </label>
                  <input
                    id="matrix_user_domain"
                    value={matrixSettingsForm.user_domain}
                    onChange={(event) =>
                      setMatrixSettingsForm((current) => ({
                        ...current,
                        user_domain: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    placeholder="example.org"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_160px]">
                <div>
                  <label htmlFor="matrix_access_token" className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    Access Token
                  </label>
                  <input
                    id="matrix_access_token"
                    type="password"
                    value={matrixSettingsForm.access_token}
                    onChange={(event) =>
                      setMatrixSettingsForm((current) => ({
                        ...current,
                        access_token: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    placeholder={matrixSettings?.access_token_configured ? "Leave blank to keep current token" : "Enter Matrix access token"}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Current token status: {matrixSettings?.access_token_configured ? "configured" : "missing"}.
                  </p>
                </div>

                <div>
                  <label htmlFor="matrix_timeout_seconds" className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    Timeout
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      id="matrix_timeout_seconds"
                      type="number"
                      min="1"
                      max="60"
                      value={matrixSettingsForm.request_timeout_seconds}
                      onChange={(event) =>
                        setMatrixSettingsForm((current) => ({
                          ...current,
                          request_timeout_seconds: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                    />
                    <span className="text-xs text-slate-500">sec</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveMatrixSettings}
                disabled={matrixSettingsSaving}
                className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-100 disabled:opacity-60"
              >
                {matrixSettingsSaving ? "Saving..." : "Save Matrix Settings"}
              </button>
              <button
                type="button"
                onClick={() => setMatrixSettingsOpen(false)}
                disabled={matrixSettingsSaving}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {zonesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/75 p-4">
          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Admin</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-100">Manage Zones</h3>
              <p className="mt-2 text-sm text-slate-400">
                Create and edit operational zones and their Matrix room routing.
              </p>
            </div>

            <div className="min-h-0 flex-1 pr-1">
              <ZonesPanel
                zones={zones}
                onCreated={onZoneCreated}
                onUpdated={onZoneUpdated}
                onDeleted={onZoneDeleted}
                modalMode
              />
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setZonesOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {registerOpen &&
        renderOperatorModal({
          title: "Register Operator",
          subtitle: "Create an ARGUS operator record and map it to a | base | identity.",
        })}

      {editOpen &&
        renderOperatorModal({
          title: "Edit Operator",
          subtitle: "Update the selected ARGUS operator record.",
          showDelete: true,
        })}
    </section>
  );
}
