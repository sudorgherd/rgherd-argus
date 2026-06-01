import IntakeView from "../modules/intake/IntakeView";
import PlaceholderPanel from "../components/PlaceholderPanel";
import AuditStream from "../components/AuditStream";
import ActiveRosterPanel from "../components/ActiveRosterPanel";
import SystemAuditView from "../modules/audit/SystemAuditView";
import AdminPanel from "../modules/admin/AdminPanel";
import ResponderInterfaceView from "../modules/responder/ResponderInterfaceView";
import DispatchRecordsView from "../modules/records/DispatchRecordsView";
export default function ConsoleRoutes({
  access,
  actions,
  alerts,
  data,
  recordsState,
  responderState,
  setters,
  status,
}) {
  const {
    activeNav,
    allowedNavItems,
    canDispatch,
    isAdmin,
  } = access;

  const {
    handleAssignmentCreated,
    handleAssignmentDeleted,
    handleMyAssignmentUpdate,
    handleNoteCreated,
    handleRecordCreated,
    handleRecordUpdated,
    handleResponderDeleted,
    handleResponderSaved,
    handleResponderZoneAdded,
    handleResponderZoneRemoved,
    handleRetryLastAlert,
    handleSendAlert,
    handleUpdateAvailability,
    handleZoneCreated,
    handleZoneDeleted,
    handleZoneUpdated,
  } = actions;

  const {
    alertDestination,
    alertNote,
    alertResponderId,
    alertResult,
    alertSending,
    alertZoneId,
    canRetryAlert,
  } = alerts;

  const {
    assignmentsByRecordId,
    matrixStatus,
    records,
    responders,
    systemAuditEvents,
    zones,
  } = data;

  const {
    activeDetailTab,
    detailLoading,
    isActiveQueueRecord,
    isArchivedQueueRecord,
    isClosedQueueRecord,
    isDispatchQueueRecord,
    loading,
    responderMap,
    selectedAssignments,
    selectedAuditEvents,
    selectedNotes,
    selectedRecord,
  } = recordsState;

  const {
    availabilitySaving,
    currentResponderAssignment,
    currentResponderRows,
    effectiveCapacityZoneId,
    responderAddNoteOpen,
    responderCapacity,
    responderConsoleRecords,
    responderNotesHistoryOpen,
    responderSelectedAssignments,
    responderSelectedRecord,
    subjectId,
    visibleDetailTabs,
  } = responderState;

  const {
    setActiveDetailTab,
    setAlertDestination,
    setAlertNote,
    setAlertResponderId,
    setAlertZoneId,
    setResponderAddNoteOpen,
    setResponderNotesHistoryOpen,
    setSelectedCapacityZoneId,
    setSelectedRecordId,
  } = setters;

  const {
    error,
  } = status;

  return (
    <>
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            {!allowedNavItems.length ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                User Not Authorized — Please contact admin.
              </div>
            ) : activeNav === "Report Intake" ? (
              <IntakeView onCreated={handleRecordCreated} zones={zones} />
            ) : activeNav === "Responder Interface" ? (
              <ResponderInterfaceView
                activeDetailTab={activeDetailTab}
                assignmentsByRecordId={assignmentsByRecordId}
                availabilitySaving={availabilitySaving}
                currentResponderAssignment={currentResponderAssignment}
                currentResponderRows={currentResponderRows}
                detailLoading={detailLoading}
                effectiveCapacityZoneId={effectiveCapacityZoneId}
                handleMyAssignmentUpdate={handleMyAssignmentUpdate}
                handleNoteCreated={handleNoteCreated}
                handleUpdateAvailability={handleUpdateAvailability}
                loading={loading}
                responderAddNoteOpen={responderAddNoteOpen}
                responderCapacity={responderCapacity}
                responderConsoleRecords={responderConsoleRecords}
                responderMap={responderMap}
                responderNotesHistoryOpen={responderNotesHistoryOpen}
                responderSelectedAssignments={responderSelectedAssignments}
                responderSelectedRecord={responderSelectedRecord}
                selectedNotes={selectedNotes}
                setActiveDetailTab={setActiveDetailTab}
                setResponderAddNoteOpen={setResponderAddNoteOpen}
                setResponderNotesHistoryOpen={setResponderNotesHistoryOpen}
                setSelectedCapacityZoneId={setSelectedCapacityZoneId}
                setSelectedRecordId={setSelectedRecordId}
                subjectId={subjectId}
                visibleDetailTabs={visibleDetailTabs}
                zones={zones}
              />
            ) : activeNav === "Admin" ? (
              <AdminPanel
                responders={responders}
                zones={zones}
                onResponderSaved={handleResponderSaved}
                onResponderDeleted={handleResponderDeleted}
                onResponderZoneAdded={handleResponderZoneAdded}
                onResponderZoneRemoved={handleResponderZoneRemoved}
                onZoneCreated={handleZoneCreated}
                onZoneUpdated={handleZoneUpdated}
                onZoneDeleted={handleZoneDeleted}
              />
            ) : activeNav === "Active Queue" ? (
              <DispatchRecordsView
                activeDetailTab={activeDetailTab}
                alertDestination={alertDestination}
                alertNote={alertNote}
                alertResponderId={alertResponderId}
                alertResult={alertResult}
                alertSending={alertSending}
                alertZoneId={alertZoneId}
                assignmentsByRecordId={assignmentsByRecordId}
                auditEvents={selectedAuditEvents}
                canDispatch={canDispatch}
                canRetryAlert={canRetryAlert}
                detailLoading={detailLoading}
                isAdmin={isAdmin}
                loading={loading}
                matrixStatus={matrixStatus}
                mode="dispatch_console"
                notes={selectedNotes}
                onAlertDestinationChange={setAlertDestination}
                onAlertNoteChange={setAlertNote}
                onAlertResponderIdChange={setAlertResponderId}
                onAlertZoneIdChange={setAlertZoneId}
                onAssignmentCreated={handleAssignmentCreated}
                onAssignmentDeleted={handleAssignmentDeleted}
                onNoteCreated={handleNoteCreated}
                onRecordUpdated={handleRecordUpdated}
                onRetryLastAlert={handleRetryLastAlert}
                onSendAlert={handleSendAlert}
                onTabChange={setActiveDetailTab}
                queueMode="active_incidents"
                records={records.filter(isActiveQueueRecord)}
                responderMap={responderMap}
                responders={responders}
                selectedAssignments={selectedAssignments}
                selectedRecord={selectedRecord && isActiveQueueRecord(selectedRecord) ? selectedRecord : null}
                setSelectedRecordId={setSelectedRecordId}
                showAlerts
                zones={zones}
              />
            ) : activeNav === "Dispatch Queue" ? (
              <DispatchRecordsView
                activeDetailTab={activeDetailTab}
                alertDestination={alertDestination}
                alertNote={alertNote}
                alertResponderId={alertResponderId}
                alertResult={alertResult}
                alertSending={alertSending}
                alertZoneId={alertZoneId}
                assignmentsByRecordId={assignmentsByRecordId}
                auditEvents={selectedAuditEvents}
                canDispatch={canDispatch}
                canRetryAlert={canRetryAlert}
                detailLoading={detailLoading}
                isAdmin={isAdmin}
                loading={loading}
                matrixStatus={matrixStatus}
                mode="dispatch_queue"
                notes={selectedNotes}
                onAlertDestinationChange={setAlertDestination}
                onAlertNoteChange={setAlertNote}
                onAlertResponderIdChange={setAlertResponderId}
                onAlertZoneIdChange={setAlertZoneId}
                onAssignmentCreated={handleAssignmentCreated}
                onAssignmentDeleted={handleAssignmentDeleted}
                onNoteCreated={handleNoteCreated}
                onRecordUpdated={handleRecordUpdated}
                onRetryLastAlert={handleRetryLastAlert}
                onSendAlert={handleSendAlert}
                onTabChange={setActiveDetailTab}
                queueMode="dispatch_queue"
                records={records.filter(isDispatchQueueRecord)}
                responderMap={responderMap}
                responders={responders}
                selectedAssignments={selectedAssignments}
                selectedRecord={selectedRecord && isDispatchQueueRecord(selectedRecord) ? selectedRecord : null}
                setSelectedRecordId={setSelectedRecordId}
                showAlerts
                zones={zones}
              />
            ) : activeNav === "Closed Records" ? (
              <DispatchRecordsView
                activeDetailTab={activeDetailTab}
                assignmentsByRecordId={assignmentsByRecordId}
                auditEvents={selectedAuditEvents}
                canDispatch={canDispatch}
                detailLoading={detailLoading}
                isAdmin={isAdmin}
                loading={loading}
                mode="incident_records"
                notes={selectedNotes}
                onAssignmentCreated={handleAssignmentCreated}
                onAssignmentDeleted={handleAssignmentDeleted}
                onNoteCreated={handleNoteCreated}
                onRecordUpdated={handleRecordUpdated}
                onTabChange={setActiveDetailTab}
                queueMode="closed_records"
                records={records.filter(isClosedQueueRecord)}
                responderMap={responderMap}
                responders={responders}
                selectedAssignments={selectedAssignments}
                selectedRecord={selectedRecord && isClosedQueueRecord(selectedRecord) ? selectedRecord : null}
                setSelectedRecordId={setSelectedRecordId}
                zones={zones}
              />
            ) : activeNav === "Archived Records" ? (
              <DispatchRecordsView
                activeDetailTab={activeDetailTab}
                assignmentsByRecordId={assignmentsByRecordId}
                auditEvents={selectedAuditEvents}
                canDispatch={canDispatch}
                detailLoading={detailLoading}
                isAdmin={isAdmin}
                loading={loading}
                mode="archived_records"
                notes={selectedNotes}
                onAssignmentCreated={handleAssignmentCreated}
                onAssignmentDeleted={handleAssignmentDeleted}
                onNoteCreated={handleNoteCreated}
                onRecordUpdated={handleRecordUpdated}
                onTabChange={setActiveDetailTab}
                queueMode="archived_records"
                records={records.filter(isArchivedQueueRecord)}
                responderMap={responderMap}
                responders={responders}
                selectedAssignments={selectedAssignments}
                selectedRecord={selectedRecord && isArchivedQueueRecord(selectedRecord) ? selectedRecord : null}
                setSelectedRecordId={setSelectedRecordId}
                zones={zones}
              />
            ) : activeNav === "Active Roster" ? (
              <>
                <section className="grid gap-4 xl:grid-cols-1">
                  <ActiveRosterPanel responders={responders} />
                </section>
              </>
            ) : activeNav === "System Audit" ? (
              <SystemAuditView systemAuditEvents={systemAuditEvents} />
            ) : (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                User Not Authorized — Please contact admin.
              </div>
            )}
    </>
  );
}
