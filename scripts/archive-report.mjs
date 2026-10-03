import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , dataDir, host, outDir] = process.argv;
if (!dataDir || !host || !outDir) {
  console.error("usage: node scripts/archive-report.mjs <data-dir> <host> <out-dir>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "cofre.db"), { readOnly: true });
const all = (sql, ...args) => db.prepare(sql).all(...args);
const has = (table) => all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", table).length > 0;
const clock = (s) => (s === null || s === undefined ? "–" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.round((s % 1) * 10) % 10)}`);

const vault = all("SELECT narrator AS subject, birth_year AS birthYear, language FROM vault")[0] ?? null;
const recordings = all("SELECT id, original_name AS file, language, stage, duration FROM recordings ORDER BY recorded_at");
const stories = all("SELECT id, recording_id AS recordingId, ord, title, start_sec AS start, end_sec AS end FROM stories ORDER BY recording_id, ord");
const facts = all(
  `SELECT f.story_id AS storyId, f.kind, f.value, f.detail, f.year_from AS yearFrom, f.year_to AS yearTo, f.provenance, f.evidence, f.start_sec AS start, f.note, f.model,
          e.name AS entity, e.relation AS relation
   FROM facts f LEFT JOIN entities e ON e.id = f.entity_id ORDER BY f.story_id, f.start_sec`,
);
const entities = all(
  `SELECT e.id, e.kind, e.name, e.relation, e.aliases, COUNT(DISTINCT f.story_id) AS stories
   FROM entities e LEFT JOIN facts f ON f.entity_id = e.id GROUP BY e.id ORDER BY e.kind, e.name`,
);
const questions = all("SELECT story_id AS storyId, text FROM questions WHERE dismissed = 0 ORDER BY id");
const marks = has("marks")
  ? all(
      `SELECT m.story_id AS storyId, m.kind, m.status, m.reason, m.value, m.year_from AS yearFrom, m.year_to AS yearTo, m.anchored, m.provenance,
              m.evidence, m.start_sec AS start, m.note, e.name AS entity
       FROM marks m LEFT JOIN entities e ON e.id = m.entity_id ORDER BY m.story_id, m.start_sec`,
    )
  : [];
const rejections = has("rejections")
  ? all("SELECT story_id AS storyId, kind, value, mention, reason FROM rejections ORDER BY id")
  : [];
const segments = (recordingId, start, end) =>
  all("SELECT start_sec AS start, end_sec AS end, text FROM segments WHERE recording_id = ? AND start_sec >= ? AND end_sec <= ? ORDER BY start_sec", recordingId, start - 0.05, end + 0.05);

async function lifeFromPage() {
  const html = await (await fetch(host)).text();
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => JSON.parse(`"${m[1]}"`));
  const payload = chunks.join("");
  const key = Math.max(payload.indexOf('"life":{"subject":'), payload.indexOf('"life":{"narrator":'));
  if (key < 0) return null;
  const at = key + '"life":'.length;
  let depth = 0;
  let inString = false;
  for (let i = at; i < payload.length; i++) {
    const c = payload[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(payload.slice(at, i + 1));
  }
  return null;
}

const life = await lifeFromPage();
writeFileSync(path.join(outDir, "archive.json"), JSON.stringify({ vault, recordings, stories, facts, entities, questions, marks, rejections }, null, 2));
writeFileSync(path.join(outDir, "life.json"), JSON.stringify(life, null, 2));

const lines = [];
lines.push(`# Archive report`, "", `Archive of ${vault?.subject} · born ${vault?.birthYear ?? "unknown"} · language ${vault?.language}`, "");
lines.push(`Recordings: ${recordings.map((r) => `${r.file} (${r.language ?? "?"}, ${r.stage}, ${Math.round(r.duration ?? 0)} s)`).join(" · ")}`, "");
lines.push("## Entities", "", "| kind | name | relation | aliases | stories |", "|---|---|---|---|---|");
for (const e of entities) lines.push(`| ${e.kind} | ${e.name} | ${e.relation ?? ""} | ${JSON.parse(e.aliases || "[]").join(", ")} | ${e.stories} |`);
lines.push("");

const lifeStories = new Map((life?.stories ?? []).map((s) => [s.id, s]));
const entityName = new Map((life?.entities ?? []).map((e) => [e.id, e.name]));
for (const recording of recordings) {
  for (const story of stories.filter((s) => s.recordingId === recording.id)) {
    const view = lifeStories.get(story.id);
    lines.push(`## ${story.title}`, "", `${recording.file} · ${clock(story.start)}–${clock(story.end)}`);
    if (view) lines.push(`Timeline: ${view.year === null ? "not placed" : `${view.year} (${view.certainty}${view.from !== null && view.from !== view.to ? `, ${view.from}–${view.to}` : ""})`}${view.age !== null ? ` · age ${view.age}` : ""}${view.lifeStage ? ` · ${view.lifeStage}` : ""}`);
    lines.push("", "Transcript:", "");
    for (const s of segments(story.recordingId, story.start, story.end)) lines.push(`- ${clock(s.start)} ${s.text}`);
    lines.push("", "Facts:", "", "| kind | value | provenance | evidence | at | note |", "|---|---|---|---|---|---|");
    for (const f of facts.filter((x) => x.storyId === story.id)) {
      const value = f.entity ? `${f.entity}${f.relation ? ` (${f.relation})` : ""}` : f.value;
      lines.push(`| ${f.kind} | ${value} | ${f.provenance} | ${f.evidence ?? ""} | ${clock(f.start)} | ${f.note ?? ""} |`);
    }
    const refused = rejections.filter((r) => r.storyId === story.id);
    if (refused.length) {
      lines.push("", "Rejected by the verifier:", "", "| kind | proposed | words | reason |", "|---|---|---|---|");
      for (const r of refused) lines.push(`| ${r.kind} | ${r.value} | ${r.mention ?? ""} | ${r.reason} |`);
    }
    const own = marks.filter((m) => m.storyId === story.id);
    if (own.length) {
      lines.push("", "Derived marks:", "", "| kind | status | value | evidence | at | reason / note |", "|---|---|---|---|---|---|");
      for (const m of own) {
        const value = m.entity ?? (m.kind === "duration" ? `${m.value} years${m.anchored ? ` ${m.yearFrom}–${m.yearTo}` : ""}` : m.yearFrom ?? m.value ?? "");
        lines.push(`| ${m.kind} | ${m.status} | ${value} | ${m.evidence ?? ""} | ${clock(m.start)} | ${m.reason ?? m.note ?? ""} |`);
      }
    }
    if (view) {
      lines.push("", "Shown during playback:", "");
      for (const m of view.mentions) lines.push(`- ${clock(m.time)} name · ${entityName.get(m.entityId) ?? m.entityId}`);
      for (const e of view.events) {
        const what =
          e.kind === "age"
            ? `age ${e.age ?? e.value} → ${e.year ?? "not placed"}`
            : e.kind === "offset"
              ? `point ${e.year}`
              : e.to
                ? `span ${e.year}–${e.to}`
                : `length of ${e.value} years, not placed`;
        lines.push(`- ${clock(e.time)} ${e.kind} · ${what} · “${e.evidence}”`);
      }
      const linked = new Map();
      for (const m of view.mentions) {
        const entity = (life?.entities ?? []).find((e) => e.id === m.entityId);
        for (const other of entity?.storyIds ?? []) {
          if (other === story.id) continue;
          linked.set(other, [...new Set([...(linked.get(other) ?? []), entity.name])]);
        }
      }
      for (const [other, names] of linked) lines.push(`- thread → ${lifeStories.get(other)?.title ?? other} (via ${names.join(", ")})`);
    }
    const q = questions.filter((x) => x.storyId === story.id).map((x) => x.text);
    if (q.length) lines.push("", `Questions: ${q.join(" · ")}`);
    lines.push("");
  }
}
writeFileSync(path.join(outDir, "report.md"), lines.join("\n"));
console.log(`wrote ${outDir}/report.md, archive.json, life.json (${stories.length} stories, ${facts.length} facts, ${marks.length} marks, ${rejections.length} rejections)`);
