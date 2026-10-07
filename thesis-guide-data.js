// Pure, local-only thesis draft helpers. The guide never writes a study plan or
// a track preference, and a saved draft is not a university thesis registration.
const ThesisGuideData = (() => {
  "use strict";
  const DRAFT_KEY = "euhem-thesis-guide-v1";
  const FIELD_LIMITS = Object.freeze({ topic: 300, question: 800, population: 400,
    context: 400, outcome: 400, method: 500, data: 1000, access: 1000,
    supervisor: 300, notes: 2500 });

  function clean(value, limit) {
    return typeof value === "string" ? value.trim().slice(0, limit) : "";
  }
  function checklistIds(guide) {
    return (guide?.journey || []).flatMap((stage) => (stage.checklist || []).map((item) => item.id));
  }
  function sanitizeDraft(raw, guide, cohort) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) &&
      raw.version === 1 && raw.cohort === cohort?.id ? raw : {};
    const fields = {};
    for (const [key, limit] of Object.entries(FIELD_LIMITS)) fields[key] = clean(source.fields?.[key], limit);
    const track = (cohort?.tracks || []).find((item) => item.id === source.trackId);
    const validChecks = new Set(checklistIds(guide));
    const validIdeas = new Set((guide?.topics || []).map((item) => item.id));
    return {
      version: 1,
      cohort: cohort?.id || "2026-2028",
      selectedStage: (guide?.journey || []).some((item) => item.id === source.selectedStage)
        ? source.selectedStage : guide?.journey?.[0]?.id || "semester-1",
      trackId: track?.id || "",
      hostUniversity: track?.thesis?.includes(source.hostUniversity) ? source.hostUniversity : "",
      fields,
      completed: [...new Set((Array.isArray(source.completed) ? source.completed : []).filter((id) => validChecks.has(id)))],
      savedIdeas: [...new Set((Array.isArray(source.savedIdeas) ? source.savedIdeas : []).filter((id) => validIdeas.has(id)))],
    };
  }
  function readiness(draft, guide) {
    const valid = new Set(checklistIds(guide));
    const completed = new Set((draft?.completed || []).filter((id) => valid.has(id))).size;
    const total = valid.size;
    return { completed, total, percent: total ? Math.round(completed / total * 100) : 0 };
  }
  function briefText(draft, cohort, guide) {
    const track = (cohort?.tracks || []).find((item) => item.id === draft.trackId);
    const host = cohort?.universities?.[draft.hostUniversity];
    const labels = { topic: "Working topic", question: "Research question", population: "Population / unit of analysis",
      context: "Setting / context", outcome: "Outcome / decision", method: "Proposed method",
      data: "Data or evidence", access: "Access, ethics and feasibility", supervisor: "Possible supervisor / team", notes: "Notes / next action" };
    const lines = ["MY THESIS — WORKING BRIEF", "EU-HEM Student Hub · personal planning draft", "", `Cohort: ${draft.cohort}`,
      `Track focus: ${track?.name || "To decide"}`, `Possible thesis host: ${host?.name || "To confirm"}`, ""];
    for (const [key, label] of Object.entries(labels)) lines.push(`${label}\n${draft.fields[key] || "To develop"}\n`);
    if (guide) {
      const selected = new Set(draft.completed);
      lines.push("PLANNING CHECKLIST");
      for (const stage of guide.journey || []) {
        lines.push(stage.label);
        for (const item of stage.checklist || []) lines.push(`${selected.has(item.id) ? "[x]" : "[ ]"} ${item.text}`);
      }
    }
    lines.push("", "This is an unofficial planning aid. Confirm deadlines, approvals, supervision and submission rules with your thesis-host university.");
    return lines.join("\n");
  }
  function exportBackup(draft) {
    return { format: "euhem-thesis-guide-backup", version: 1, cohort: draft.cohort, draft, exportedAt: new Date().toISOString() };
  }
  function importBackup(raw, guide, cohort) {
    if (!raw || raw.format !== "euhem-thesis-guide-backup" || raw.version !== 1 ||
      raw.cohort !== cohort?.id || !raw.draft || typeof raw.draft !== "object" || Array.isArray(raw.draft) ||
      raw.draft.version !== 1 || raw.draft.cohort !== cohort?.id ||
      !raw.draft.fields || typeof raw.draft.fields !== "object" || Array.isArray(raw.draft.fields)) {
      throw new Error("Choose a valid thesis-workspace backup for this cohort.");
    }
    return sanitizeDraft(raw.draft, guide, cohort);
  }
  return { DRAFT_KEY, FIELD_LIMITS, checklistIds, sanitizeDraft, readiness, briefText, exportBackup, importBackup };
})();
if (typeof module !== "undefined" && module.exports) module.exports = ThesisGuideData;
