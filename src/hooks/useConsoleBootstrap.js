import { useEffect } from "react";

import { listRecordAssignments } from "../modules/assignments/assignmentsApi";
import { getSystemAudit } from "../modules/audit/auditApi";
import { getMatrixStatus } from "../modules/matrix/matrixApi";
import { listRecords } from "../modules/records/recordsApi";
import {
  getCurrentResponder,
  getResponderCapacity,
  listResponders,
} from "../modules/responders/respondersApi";
import { listZones } from "../modules/zones/zonesApi";
import { safeArray } from "../utils/display";

export function useConsoleBootstrap({
  activeNav,
  setAssignmentsByRecordId,
  setError,
  setLoading,
  setMatrixStatus,
  setMeCapabilities,
  setMeResponder,
  setRecords,
  setResponderCapacity,
  setResponders,
  setSelectedRecordId,
  setSubjectId,
  setSystemAuditEvents,
  setZones,
}) {
  useEffect(() => {
    let ignore = false;

    async function loadConsole(showLoading = true) {
      if (showLoading) {
        setLoading(true);
      }
      setError("");

      const lifecycle =
        activeNav === "Closed Records"
          ? "closed"
          : activeNav === "Archived Records"
            ? "archived"
            : null;

      try {
        const [recordsData, meData] = await Promise.all([
          listRecords(lifecycle),
          getCurrentResponder(),
        ]);

        if (ignore) return;

        const nextRecords = safeArray(recordsData.records);
        setRecords(nextRecords);
        setMeResponder(meData);
        setMeCapabilities({
          is_admin: Boolean(meData.is_admin),
          can_dispatch: Boolean(meData.can_dispatch),
          can_respond: Boolean(meData.can_respond),
        });

        const meCanDispatch = Boolean(meData.is_admin || meData.can_dispatch);
        const meCanRespond = Boolean(meData.is_admin || meData.can_respond);

        if (!meCanDispatch) {
          setResponders([meData]);
        }

        setSubjectId(recordsData.subject_id || meData.subject_id || "");
        setSelectedRecordId((current) => current ?? nextRecords[0]?.id ?? null);

        if (meCanRespond) {
          try {
            const capacityData = await getResponderCapacity();
            if (!ignore) {
              setResponderCapacity(capacityData);
            }
          } catch {
            if (!ignore) {
              setResponderCapacity(null);
            }
          }
        } else if (!ignore) {
          setResponderCapacity(null);
        }

        if (meCanDispatch) {
          try {
            const [respondersData, zonesData, matrixStatusData, systemAuditData] =
              await Promise.all([
                listResponders(),
                listZones(),
                getMatrixStatus(),
                getSystemAudit(),
              ]);

            if (!ignore) {
              setResponders(safeArray(respondersData.responders));
              setZones(safeArray(zonesData.zones));
              setMatrixStatus(matrixStatusData);
              setSystemAuditEvents(safeArray(systemAuditData.system_audit_events));
            }
          } catch {
            if (!ignore) {
              setMatrixStatus(null);
              setSystemAuditEvents([]);
            }
          }
        } else if (!ignore) {
          setMatrixStatus(null);
          setSystemAuditEvents([]);
        }

        if (meCanDispatch || meCanRespond) {
          const assignmentHydrationRecords = nextRecords.filter(
            (record) => !record.archived_at && record.status !== "closed"
          );

          const assignmentPairs = await Promise.all(
            assignmentHydrationRecords.map(async (record) => {
              try {
                const data = await listRecordAssignments(record.id);
                return [record.id, safeArray(data.assignments)];
              } catch {
                return [record.id, []];
              }
            })
          );

          if (ignore) return;

          setAssignmentsByRecordId(Object.fromEntries(assignmentPairs));
        } else if (!ignore) {
          setAssignmentsByRecordId({});
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load console data");
        }
      } finally {
        if (!ignore && showLoading) {
          setLoading(false);
        }
      }
    }

    loadConsole(true);

    const shouldPollConsole = [
      "Active Queue",
      "Dispatch Queue",
      "Closed Records",
      "Archived Records",
      "Responder Interface",
    ].includes(activeNav);

    let intervalId = null;
    if (shouldPollConsole) {
      intervalId = window.setInterval(() => {
        loadConsole(false);
      }, 5000);
    }

    return () => {
      ignore = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [
    activeNav,
    setAssignmentsByRecordId,
    setError,
    setLoading,
    setMatrixStatus,
    setMeCapabilities,
    setMeResponder,
    setRecords,
    setResponderCapacity,
    setResponders,
    setSelectedRecordId,
    setSubjectId,
    setSystemAuditEvents,
    setZones,
  ]);
}
