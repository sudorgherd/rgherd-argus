import { CheckCircle2 } from "lucide-react";

import NoteComposer from "../notes/NoteComposer";
import ResponderPanel from "./ResponderPanel";
import ResponderQueuePanel from "../../components/ResponderQueuePanel";
import ResponderSummaryRow from "../../components/ResponderSummaryRow";
import { DetailStat, Panel } from "../../components/ui";
import { escalationLabel, formatDateTime, formatLabel, responderLabel, zoneLabel } from "../../utils/display";
import { severityTone, statusTone } from "../../constants/ui";

export default function ResponderInterfaceView({
  activeDetailTab,
  assignmentsByRecordId,
  availabilitySaving,
  currentResponderAssignment,
  currentResponderRows,
  detailLoading,
  effectiveCapacityZoneId,
  handleMyAssignmentUpdate,
  handleNoteCreated,
  handleUpdateAvailability,
  loading,
  responderAddNoteOpen,
  responderConsoleRecords,
  responderMap,
  responderNotesHistoryOpen,
  responderSelectedAssignments,
  responderSelectedRecord,
  responderCapacity,
  selectedNotes,
  setActiveDetailTab,
  setResponderAddNoteOpen,
  setResponderNotesHistoryOpen,
  setSelectedCapacityZoneId,
  setSelectedRecordId,
  subjectId,
  visibleDetailTabs,
  zones,
}) {
  return (
              <>
                  <ResponderSummaryRow
                    records={responderConsoleRecords}
                    currentResponderId={currentResponderRows[0]?.id ?? null}
                    assignmentsByRecordId={assignmentsByRecordId}
                    capacity={responderCapacity}
                    selectedZoneId={effectiveCapacityZoneId}
                    onSelectZone={setSelectedCapacityZoneId}
                  />

                <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.95fr)]">
                  <ResponderQueuePanel
                    records={responderConsoleRecords}
                    assignmentsByRecordId={assignmentsByRecordId}
                    currentResponderId={currentResponderRows[0]?.id ?? null}
                    selectedRecordId={responderSelectedRecord?.id ?? null}
                    onSelect={(recordId) => {
                      setSelectedRecordId(recordId);
                      setActiveDetailTab("Overview");
                    }}
                    loading={loading}
                    zones={zones}
                  />

                  <Panel
                    title="Responder Workspace"
                    subtitle="Assigned record detail"
                    icon={CheckCircle2}
                    className="flex h-[720px] min-h-[720px] flex-col"
                  >
                    {!responderSelectedRecord ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                        No assigned record selected.
                      </div>
                    ) : (
                      <>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-xs text-slate-500">
                                  #{responderSelectedRecord.id} · {zoneLabel(responderSelectedRecord.zone_id, zones)} · {responderSelectedRecord.category || "Uncategorized"}
                                </p>

                                <h4 className="mt-3 text-xl font-semibold text-slate-100">
                                  {responderSelectedRecord.summary}
                                </h4>
                                <p className="mt-2 text-sm leading-6 text-slate-300">
                                  {responderSelectedRecord.location || "No location captured yet."}
                                </p>
                                <p className="mt-2 text-xs text-slate-500">
                                  Visibility: <span className="text-slate-300">{currentResponderAssignment ? "My Assignment" : "Zone View"}</span>
                                </p>
                              </div>

                              <div className="flex shrink-0 flex-wrap justify-start gap-2 sm:justify-end">
                                <span className={`rounded-full border px-2.5 py-1 text-xs ${statusTone[responderSelectedRecord.status] || statusTone.new}`}>
                                  {formatLabel(responderSelectedRecord.status)}
                                </span>
                                <span className={`rounded-full border px-2.5 py-1 text-xs ${severityTone[responderSelectedRecord.severity] || severityTone.Low}`}>
                                  {responderSelectedRecord.severity || "—"}
                                </span>
                                {responderSelectedRecord.active_response && (
                                  <span className="rounded-full border border-amber-300 bg-amber-500/30 px-2.5 py-1 text-xs text-amber-50 shadow-[0_0_14px_rgba(245,158,11,0.22)]">
                                      {escalationLabel(responderSelectedRecord)}
                                  </span>
                                )}
                              </div>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
                          {visibleDetailTabs.map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setActiveDetailTab(tab)}
                              className={`rounded-lg px-3 py-2 text-sm transition ${
                                activeDetailTab === tab
                                  ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                                  : "border border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800"
                              }`}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>

                        <div className="mt-4 flex-1 overflow-hidden">
                          {detailLoading && (
                            <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/55 px-3 py-3 text-sm text-slate-400">
                              Loading selected-record detail…
                            </div>
                          )}

                          {activeDetailTab === "Overview" && (
                            <div className="h-full space-y-4 overflow-y-auto pr-1">
                              <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                  Responder snapshot
                                </p>

                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  <DetailStat label="Verification" value={formatLabel(responderSelectedRecord.verification_state)} />
                                  <DetailStat label="Created" value={formatDateTime(responderSelectedRecord.created_at)} />
                                  <DetailStat label="Updated" value={formatDateTime(responderSelectedRecord.updated_at || responderSelectedRecord.created_at)} />
                                  <DetailStat label="Assignments" value={responderSelectedAssignments.length > 0 ? responderSelectedAssignments.map((assignment) => responderLabel(responderMap.get(assignment.responder_id), assignment.responder_id)).join(", ") : "Awaiting assignment"} />
                                </div>
                              </div>

                              <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                  Responder Actions
                                </p>

                                {!currentResponderAssignment ? (
                                  <p className="mt-3 text-sm text-slate-400">
                                    Zone-visible only. Assignment is required for responder actions and notes.
                                  </p>
                                ) : (
                                  <div className="mt-3 space-y-3">
                                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-300">
                                      <p className="text-slate-100">
                                        Current response: {formatLabel(currentResponderAssignment.assignment_state)}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-400">
                                        Assigned: {formatDateTime(currentResponderAssignment.assigned_at)}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-400">
                                        Cleared: {currentResponderAssignment.cleared_at ? formatDateTime(currentResponderAssignment.cleared_at) : "Not cleared"}
                                      </p>
                                      {currentResponderAssignment.dispatcher_note && (
                                        <p className="mt-2 text-xs text-slate-300">
                                          Dispatcher note: {currentResponderAssignment.dispatcher_note}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleMyAssignmentUpdate(responderSelectedRecord.id, currentResponderAssignment.id, {
                                            assignment_state: "active",
                                          })
                                        }
                                        disabled={currentResponderAssignment.assignment_state === "active"}
                                        className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
                                      >
                                        Mark Responding
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleMyAssignmentUpdate(responderSelectedRecord.id, currentResponderAssignment.id, {
                                            mark_cleared: true,
                                          })
                                        }
                                        disabled={currentResponderAssignment.assignment_state === "cleared"}
                                        className="rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-sm font-medium text-sky-100 disabled:opacity-60"
                                      >
                                        Mark Cleared
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {activeDetailTab === "Notes" && (
                            <div className="h-full overflow-y-auto pr-1">
                              <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Responder Notes</p>
                                    <p className="mt-2 text-sm text-slate-400">
                                      Recent responder-visible notes only.
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setResponderAddNoteOpen(true)}
                                      className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-100"
                                    >
                                      Add Note
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setResponderNotesHistoryOpen(true)}
                                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                                    >
                                      View All Notes
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-4 space-y-3">
                                  {selectedNotes.length === 0 ? (
                                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-400">
                                      No responder-visible notes yet. Use Add Note to create the first responder-visible note.
                                    </div>
                                  ) : (
                                    selectedNotes.slice(0, 3).map((note) => {
                                      const preview =
                                        note.body.length > 180 ? `${note.body.slice(0, 180).trimEnd()}…` : note.body;

                                      return (
                                        <div
                                          key={note.id}
                                          className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-300"
                                        >
                                          <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                                            {note.author_role} • {formatLabel(note.visibility)} • {formatDateTime(note.created_at)}
                                          </p>
                                          <p>{preview}</p>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </Panel>
                </section>

                  <section className="grid gap-4 xl:grid-cols-1">
                    <ResponderPanel
                      responders={currentResponderRows}
                      currentSubjectId={subjectId}
                      availabilitySaving={availabilitySaving}
                      onUpdateAvailability={handleUpdateAvailability}
                    />
                  </section>

                {responderAddNoteOpen && responderSelectedRecord && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
                    <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Responder notes</p>
                          <h3 className="mt-2 text-lg font-semibold text-slate-100">Add Note to Record #{responderSelectedRecord.id}</h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => setResponderAddNoteOpen(false)}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-5">
                        <NoteComposer
                          recordId={responderSelectedRecord.id}
                            allowVisibilitySelect={false}
                            defaultVisibility="responder"
                          onCreated={(createdNote) => {
                            setResponderAddNoteOpen(false);
                            handleNoteCreated(createdNote);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {responderNotesHistoryOpen && responderSelectedRecord && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
                    <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Responder notes</p>
                          <h3 className="mt-2 text-lg font-semibold text-slate-100">Record #{responderSelectedRecord.id} Notes</h3>
                          <p className="mt-2 text-sm text-slate-400">
                            Full responder-visible note history.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setResponderNotesHistoryOpen(false)}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-5 flex-1 overflow-y-auto pr-1">
                        <div className="space-y-2">
                          {selectedNotes.length === 0 && (
                            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-400">
                              No responder-visible notes yet.
                            </div>
                          )}
                          {selectedNotes.map((note) => (
                            <div key={note.id} className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-300">
                              <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                                {note.author_role} • {formatLabel(note.visibility)} • {formatDateTime(note.created_at)}
                              </p>
                              <p>{note.body}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
  );
}
