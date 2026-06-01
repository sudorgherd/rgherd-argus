import { expect, test } from "@playwright/test";

const responders = [
  {
    id: 1,
    subject_id: "dispatcher-1",
    display_name: "Dispatch Operator",
    role: "Admin",
    availability: "Available",
    zones: [1],
    matrix_user_id: "@dispatch:base.test",
  },
  {
    id: 2,
    subject_id: "responder-1",
    display_name: "Responder One",
    role: "Responder",
    availability: "Available",
    zones: [1],
    matrix_user_id: "@responder:base.test",
  },
];

const zones = [
  {
    id: 1,
    zone_id: 1,
    name: "Main Zone",
    description: "Mocked primary operations zone",
  },
];

const records = [
  {
    id: 101,
    summary: "Mock active safety record",
    location: "North gate",
    category: "Safety / Threat / Health",
    severity: "High",
    status: "assigned",
    verification_state: "pending",
    active_response: false,
    professional_escalation: "",
    responder_instructions: "Approach calmly and confirm details.",
    internal_notes_summary: "Initial intake captured by mock.",
    zone_id: 1,
    created_at: "2026-05-18T04:00:00Z",
    updated_at: "2026-05-18T04:10:00Z",
    archived_at: null,
    outcome_type: "",
    outcome_notes: "",
    responders_involved: [],
    need_met: true,
    follow_up_needed: false,
  },
  {
    id: 102,
    summary: "Mock closed record",
    location: "West lot",
    category: "Logistics",
    severity: "Low",
    status: "closed",
    verification_state: "verified",
    active_response: false,
    professional_escalation: "no",
    responder_instructions: "",
    internal_notes_summary: "Closed mock record.",
    zone_id: 1,
    created_at: "2026-05-17T04:00:00Z",
    updated_at: "2026-05-17T05:00:00Z",
    archived_at: null,
    outcome_type: "resolved",
    outcome_notes: "Resolved in mock.",
    responders_involved: ["Responder One"],
    need_met: true,
    follow_up_needed: false,
  },
  {
    id: 103,
    summary: "Mock archived record",
    location: "Archive lane",
    category: "Info",
    severity: "Low",
    status: "closed",
    verification_state: "verified",
    active_response: false,
    professional_escalation: "no",
    responder_instructions: "",
    internal_notes_summary: "Archived mock record.",
    zone_id: 1,
    created_at: "2026-05-16T04:00:00Z",
    updated_at: "2026-05-16T05:00:00Z",
    archived_at: "2026-05-16T06:00:00Z",
    outcome_type: "resolved",
    outcome_notes: "Archived in mock.",
    responders_involved: ["Responder One"],
    need_met: true,
    follow_up_needed: false,
  },
];

const assignments = {
  101: [
    {
      id: 501,
      record_id: 101,
      responder_id: 2,
      assignment_state: "active",
      dispatcher_note: "Mock assignment note",
      assigned_at: "2026-05-18T04:15:00Z",
      cleared_at: null,
    },
  ],
  102: [],
  103: [],
};

const notes = {
  101: [
    {
      id: 701,
      record_id: 101,
      body: "Mock appended note for smoke testing.",
      visibility: "internal",
      author_role: "dispatcher",
      created_at: "2026-05-18T04:20:00Z",
    },
  ],
};

const auditEvents = {
  101: [
    {
      id: 801,
      record_id: 101,
      event_type: "record_created",
      actor_id: "dispatcher-1",
      created_at: "2026-05-18T04:00:00Z",
      event_metadata: {
        changes: {
          status: { from: null, to: "new" },
        },
      },
    },
    {
      id: 802,
      record_id: 101,
      event_type: "matrix_assignment_auto_send",
      actor_id: "dispatcher-1",
      created_at: "2026-05-18T04:16:00Z",
      event_metadata: {
        responder_id: 2,
        assignment_id: 501,
        assignment_state: "active",
        ok: true,
        matrix_user_id: "@responder:base.test",
        used_cached_room: true,
      },
    },
  ],
};

async function fulfillJson(route, payload, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

async function installMockApi(page) {
  const browserErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (method === "GET" && pathname === "/api/records") {
      return fulfillJson(route, { records });
    }

    if (method === "GET" && pathname === "/api/responders/me") {
      return fulfillJson(route, {
        ...responders[1],
        is_admin: true,
        can_dispatch: true,
        can_respond: true,
        subject_id: "responder-1",
      });
    }

    if (method === "GET" && pathname === "/api/responders/capacity") {
      return fulfillJson(route, {
        zones: [
          {
            zone_id: 1,
            zone_name: "Main Zone",
            available_count: 2,
            busy_count: 0,
          },
        ],
      });
    }

    if (method === "GET" && pathname === "/api/responders") {
      return fulfillJson(route, { responders });
    }

    if (method === "GET" && pathname === "/api/zones") {
      return fulfillJson(route, { zones });
    }

    if (method === "GET" && pathname === "/api/matrix/status") {
      return fulfillJson(route, {
        enabled: true,
        homeserver: "base.test",
        status: "mocked",
      });
    }

    if (method === "GET" && pathname === "/api/system-audit") {
      return fulfillJson(route, {
        system_audit_events: [
          {
            id: 901,
            event_type: "mock_system_bootstrap",
            severity: "info",
            actor_id: "system",
            related_responder_id: null,
            related_record_id: null,
            created_at: "2026-05-18T04:30:00Z",
            event_metadata: { source: "playwright" },
          },
        ],
      });
    }

    const assignmentMatch = pathname.match(/^\/api\/records\/(\d+)\/assignments$/);
    if (method === "GET" && assignmentMatch) {
      const recordId = Number(assignmentMatch[1]);
      return fulfillJson(route, { assignments: assignments[recordId] || [] });
    }

    const notesMatch = pathname.match(/^\/api\/records\/(\d+)\/notes$/);
    if (method === "GET" && notesMatch) {
      const recordId = Number(notesMatch[1]);
      return fulfillJson(route, { notes: notes[recordId] || [] });
    }

    if (method === "POST" && notesMatch) {
      const recordId = Number(notesMatch[1]);
      return fulfillJson(route, {
        note: {
          id: 702,
          record_id: recordId,
          body: "Created from mocked smoke test.",
          visibility: "internal",
          author_role: "dispatcher",
          created_at: "2026-05-18T04:35:00Z",
        },
      });
    }

    const auditMatch = pathname.match(/^\/api\/records\/(\d+)\/audit$/);
    if (method === "GET" && auditMatch) {
      const recordId = Number(auditMatch[1]);
      return fulfillJson(route, { audit_events: auditEvents[recordId] || [] });
    }

    const recordMatch = pathname.match(/^\/api\/records\/(\d+)$/);
    if (method === "PATCH" && recordMatch) {
      const recordId = Number(recordMatch[1]);
      const current = records.find((record) => record.id === recordId);
      const body = JSON.parse(request.postData() || "{}");
      return fulfillJson(route, { ...current, ...body, updated_at: "2026-05-18T04:40:00Z" });
    }

    const alertMatch = pathname.match(/^\/api\/records\/(\d+)\/matrix-alert$/);
    if (method === "POST" && alertMatch) {
      return fulfillJson(route, {
        ok: true,
        success_count: 1,
        failure_count: 0,
        deliveries: [
          {
            responder_id: 2,
            ok: true,
            matrix_user_id: "@responder:base.test",
            used_cached_room: true,
          },
        ],
      });
    }

    return fulfillJson(route, { ok: true });
  });

  return browserErrors;
}

test("ARGUS refactored console renders core routes and record-detail UI", async ({ page }) => {
  const browserErrors = await installMockApi(page);

  const modalByText = (text) => page.locator(".fixed").filter({ hasText: text }).last();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mock active safety record" })).toBeVisible();

  await page.getByRole("button", { name: "Responder Interface", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Responder Workspace" })).toBeVisible();
  await expect(page.getByText("Current response: Active")).toBeVisible();

  await page.getByRole("button", { name: "Active Queue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mock active safety record" })).toBeVisible();

  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(page.getByText("Mock appended note for smoke testing.").first()).toBeVisible();

  await page.getByRole("button", { name: "View All Notes", exact: true }).click();
  const notesModal = modalByText("Record #101 Notes");
  await expect(notesModal).toBeVisible();
  await notesModal.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "Add Note", exact: true }).click();
  const addNoteModal = modalByText("Add Note to Record #101");
  await expect(addNoteModal).toBeVisible();
  await addNoteModal.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "Audit", exact: true }).click();
  await expect(page.getByText("Audit trail")).toBeVisible();
  await expect(page.getByText("Matrix DM:")).toBeVisible();

  await page.getByRole("button", { name: "Overview", exact: true }).click();

  await page.getByRole("button", { name: "Assign Responder", exact: true }).click();
  const assignmentModal = modalByText("Assign Responder to Record #101");
  await expect(assignmentModal).toBeVisible();
  await assignmentModal.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.getByLabel("Escalate this record?").click();
  const escalationModal = modalByText("Professional escalation check");
  await expect(escalationModal).toBeVisible();
  await escalationModal.getByRole("button", { name: "Unknown", exact: true }).click();

  await page.getByRole("button", { name: "Close Record", exact: true }).click();
  const closureModal = modalByText("Close Record #101");
  await expect(closureModal).toBeVisible();
  await closureModal.getByRole("button", { name: "Cancel", exact: true }).last().click();

  await page.getByRole("button", { name: "Dispatch Queue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mock active safety record" })).toBeVisible();

  await page.getByRole("button", { name: "Closed Records", exact: true }).click();
  await expect(page.getByText("Mock closed record").first()).toBeVisible();

  await page.getByRole("button", { name: "Archived Records", exact: true }).click();
  await expect(page.getByText("Mock archived record").first()).toBeVisible();

  await page.getByRole("button", { name: "Zones", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Zones" })).toBeVisible();

  await page.getByRole("button", { name: "Active Roster", exact: true }).click();
  await expect(page.getByText("Dispatch Operator").first()).toBeVisible();

  await page.getByRole("button", { name: "System Audit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "System Audit" })).toBeVisible();
  await expect(page.getByText("mock_system_bootstrap")).toBeVisible();

  expect(browserErrors).toEqual([]);
});
