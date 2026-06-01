import AlertsPanel from "../../components/AlertsPanel";
import DispatchQueuePanel from "../../components/DispatchQueuePanel";
import MatrixIntegrationStatusPanel from "../../components/MatrixIntegrationStatusPanel";
import SummaryRow from "../../components/SummaryRow";
import SelectedRecordPanel from "./SelectedRecordPanel";

export default function DispatchRecordsView({
  activeDetailTab,
  alertDestination,
  alertNote,
  alertResponderId,
  alertResult,
  alertSending,
  alertZoneId,
  assignmentsByRecordId,
  auditEvents,
  canDispatch,
  canRetryAlert,
  detailLoading,
  isAdmin,
  loading,
  matrixStatus,
  mode,
  notes,
  onAlertDestinationChange,
  onAlertNoteChange,
  onAlertResponderIdChange,
  onAlertZoneIdChange,
  onAssignmentCreated,
  onAssignmentDeleted,
  onNoteCreated,
  onRecordUpdated,
  onRetryLastAlert,
  onSendAlert,
  onTabChange,
  queueMode,
  records,
  responderMap,
  responders,
  selectedAssignments,
  selectedRecord,
  setSelectedRecordId,
  showAlerts = false,
  zones,
}) {
  return (
    <>
      <SummaryRow
        records={records}
        responders={responders}
        assignmentsByRecordId={assignmentsByRecordId}
        mode={mode}
      />

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.95fr)]">
        <DispatchQueuePanel
          mode={queueMode}
          records={records}
          assignmentsByRecordId={assignmentsByRecordId}
          responderMap={responderMap}
          selectedRecordId={selectedRecord?.id ?? null}
          onSelect={(recordId) => {
            setSelectedRecordId(recordId);
            onTabChange("Overview");
          }}
          loading={loading}
          zones={zones}
        />
        <SelectedRecordPanel
          record={selectedRecord}
          assignments={selectedAssignments}
          responderMap={responderMap}
          notes={notes}
          auditEvents={auditEvents}
          activeTab={activeDetailTab}
          onTabChange={onTabChange}
          detailLoading={detailLoading}
          onRecordUpdated={onRecordUpdated}
          onNoteCreated={onNoteCreated}
          onAssignmentCreated={onAssignmentCreated}
          onAssignmentDeleted={onAssignmentDeleted}
          zones={zones}
          isAdmin={isAdmin}
          canDispatch={canDispatch}
        />
      </section>

      {showAlerts && (
        <section className="grid gap-4 xl:grid-cols-2">
          <AlertsPanel
            record={selectedRecord}
            responders={responders}
            zones={zones}
            alertDestination={alertDestination}
            onAlertDestinationChange={onAlertDestinationChange}
            alertResponderId={alertResponderId}
            onAlertResponderIdChange={onAlertResponderIdChange}
            alertZoneId={alertZoneId}
            onAlertZoneIdChange={onAlertZoneIdChange}
            alertNote={alertNote}
            onAlertNoteChange={onAlertNoteChange}
            alertSending={alertSending}
            onSendAlert={onSendAlert}
            onRetryLastAlert={onRetryLastAlert}
            alertResult={alertResult}
            canRetryAlert={canRetryAlert}
          />
          <MatrixIntegrationStatusPanel
            responders={responders}
            zones={zones}
            alertResult={alertResult}
            matrixStatus={matrixStatus}
          />
        </section>
      )}
    </>
  );
}
