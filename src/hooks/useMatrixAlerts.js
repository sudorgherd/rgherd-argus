import { useState } from "react";

import { getRecordAudit } from "../modules/audit/auditApi";
import { sendRecordMatrixAlert } from "../modules/matrix/matrixApi";
import { safeArray } from "../utils/display";

export function useMatrixAlerts({
  selectedRecord,
  setError,
  setSelectedAuditEvents,
}) {
  const [alertDestination, setAlertDestination] = useState("one_responder");
  const [alertResponderId, setAlertResponderId] = useState("");
  const [alertZoneId, setAlertZoneId] = useState("");
  const [alertNote, setAlertNote] = useState("");
  const [alertSending, setAlertSending] = useState(false);
  const [alertResult, setAlertResult] = useState(null);
  const [lastAlertAttempt, setLastAlertAttempt] = useState(null);

  async function sendAlertWithPayload(payload, { resetFormOnSuccess = false } = {}) {
    if (!selectedRecord) {
      setError("Select a record before sending an alert");
      return;
    }

    setAlertSending(true);
    setError("");

    try {
      setLastAlertAttempt({
        recordId: selectedRecord.id,
        payload,
      });

      const data = await sendRecordMatrixAlert(selectedRecord.id, payload);

      setAlertResult(data);

      const auditData = await getRecordAudit(selectedRecord.id);
      setSelectedAuditEvents(safeArray(auditData.audit_events));

      if (resetFormOnSuccess) {
        setAlertDestination("one_responder");
        setAlertResponderId("");
        setAlertZoneId("");
        setAlertNote("");
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send Matrix alert");
      throw err;
    } finally {
      setAlertSending(false);
    }
  }

  async function handleSendAlert() {
    const payload = {
      destination: alertDestination,
      responder_id: alertResponderId ? Number(alertResponderId) : null,
      zone_id: alertZoneId ? Number(alertZoneId) : null,
      dispatcher_note: alertNote.trim() || null,
    };

    return sendAlertWithPayload(payload, { resetFormOnSuccess: true });
  }

  async function handleRetryLastAlert() {
    if (!lastAlertAttempt?.payload) {
      setError("No failed Matrix alert is available to retry");
      return;
    }

    return sendAlertWithPayload(lastAlertAttempt.payload, { resetFormOnSuccess: false });
  }

  const canRetryAlert = Boolean(
    alertResult && alertResult.failure_count > 0 && lastAlertAttempt?.payload
  );

  return {
    alertDestination,
    setAlertDestination,
    alertResponderId,
    setAlertResponderId,
    alertZoneId,
    setAlertZoneId,
    alertNote,
    setAlertNote,
    alertSending,
    alertResult,
    canRetryAlert,
    handleSendAlert,
    handleRetryLastAlert,
  };
}
