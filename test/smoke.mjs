// Smoke test: starts the real server over a made-up data folder and drives the API.
// Every name here is invented. Run: node test/smoke.mjs
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
// Takes a boolean, never a function: a check that is handed `() => x` passes for ever.
function ok(cond, label) {
  if (typeof cond !== "boolean") throw new Error(`check "${label}" was given ${typeof cond}, not a boolean`);
  if (cond) pass++; else { fail++; console.error("FAIL", label); }
}

const D = fs.mkdtempSync(path.join(os.tmpdir(), "btb-"));
const W = (rel, obj) => { const f = path.join(D, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)); };
const iso = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
const days = ["mon", "tue", "wed", "thu", "fri"].map((key, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return { key, label: key[0].toUpperCase() + key.slice(1), date: d.toDateString().slice(4, 10), iso: iso(d) }; });
W("school.json", { title: "Demo", classes: {
    alg: { name: "Algebra", short: "Alg", kind: "math", color: ["#07564A", "#6CC9B3"], start: "09:00", len: 45, meets: ["mon", "tue", "wed", "thu", "fri"], course: "alg", folder: "Handouts/Week {week}" },
    art: { name: "Art", short: "Art", kind: "project", color: ["#553173", "#BC9AD8"], start: "13:00", len: 40, meets: ["mon"], course: null } },
  rails: { math: [{ k: "warm", from: 0, to: 5, name: "Warm-up", tag: "" }, { k: "group", from: 5, to: 35, name: "Small group", tag: "" }, { k: "exit", from: 35, to: 45, name: "Exit ticket", tag: "" }],
           project: [{ k: "recap", from: 0, to: 10, name: "Set up" }, { k: "build", from: 10, to: 40, name: "Build" }] },
  games: { g1: { name: "Demo Game", mins: "4 min", courses: ["alg"], how: ["Put a number up."] } }, prompts: { label: "Prompts", items: [{ title: "One", text: "Say one thing." }] } });
W("Plans/week-07.json", { week: 7, label: "Week 7", startsOn: days[0].iso, endsOn: days[4].iso, days,
  classes: { alg: { unit: "Unit 2", days: { mon: { focus: "Fractions <b>again</b>", warmup: "g1", exit: { q: "1/2 + 1/4?", a: "3/4" } } } }, art: { unit: "", days: { mon: { gap: true, focus: "?" } } } },
  prep: [{ id: "p1", text: "Copies" }] });
W("Gradebook/courses/alg.json", { name: "Algebra", students: [{ id: "s1", name: "Quillon Example" }, { id: "s2", name: "Zephyrine Sample" }, { id: "s3", name: "Bramwell Test" }],
  columns: [{ id: "c1", week: 7, kind: "CW", title: "Fractions", outOf: 8, items: ["1a", "1b", "2a", "2b"] }, { id: "h1", week: 7, kind: "HW", title: "Homework" }] });
W("Gradebook/marks/c1.json", { students: { s1: { status: "scored", pts: 6, outOf: 8, r: "2 2 1 1" }, s2: { status: "scored", pts: 4, outOf: 8, by: "claude", conf: "high", checked: false } } });
W("Handouts/Week 7/sheet.pdf", "%PDF-1.4 fake");
W("outside-secret.txt", "nope");

const PORT = 18000 + Math.floor(Math.random() * 1000);
const srv = spawn(process.execPath, [path.join(ROOT, "bell_to_bell/server.mjs")], { env: { ...process.env, DATA_DIR: D, PORT: String(PORT), INGRESS_ONLY: "0", HA_API: "" }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", d => log += d); srv.stderr.on("data", d => log += d);
const B = `http://127.0.0.1:${PORT}`;
const j = async (method, p, body, headers = {}) => { const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; };
const up = async port => { for (let i = 0; i < 300; i++) { try { await fetch(`http://127.0.0.1:${port}/api/rev`); return; } catch { await new Promise(r => setTimeout(r, 100)); } } throw new Error("server did not start: " + log); };
await up(PORT);

try {
  const page = await fetch(B + "/"); ok(page.status === 200 && (await page.text()).includes("app.js"), "page served");
  const js = await fetch(B + "/app.js"); ok(js.status === 200 && js.headers.get("content-type").includes("javascript"), "app.js served");

  let st = await j("GET", "/api/state");
  ok(st.body.ok === true, "state ok");
  ok(st.body.week === 7, "current week found from dates");
  ok(st.body.plan && st.body.plan.classes.alg.unit === "Unit 2", "plan loaded");
  ok(st.body.handouts.alg.files.length === 1 && st.body.handouts.alg.files[0] === "sheet.pdf", "handouts listed for the week folder");
  ok(typeof st.body.hashes.c1.s1 === "string" && st.body.hashes.c1.s1.length === 12, "mark hashes sent");
  const h1 = st.body.hashes.c1.s1, h2 = st.body.hashes.c1.s2;

  // a teacher edit lands, is labelled, and returns the new hash
  let r = await j("POST", "/api/marks", { ops: [{ col: "c1", sid: "s1", base: h1, patch: { pts: 7, note: "good" } }] });
  ok(r.status === 200 && r.body.results[0].ok === true, "mark saved");
  const onDisk = JSON.parse(fs.readFileSync(path.join(D, "Gradebook/marks/c1.json"), "utf8"));
  ok(onDisk.students.s1.pts === 7 && onDisk.students.s1.by === "teacher" && onDisk.students.s1.checked === true, "written to the file as the teacher's");
  ok(onDisk.students.s2.by === "claude", "other students in the file untouched");
  const h1b = r.body.results[0].hash; ok(h1b !== h1, "hash moves with the mark");

  // a stale base is refused for that op alone
  r = await j("POST", "/api/marks", { ops: [{ col: "c1", sid: "s1", base: h1, patch: { pts: 1 } }, { col: "c1", sid: "s3", base: "none", patch: { status: "missing" } }] });
  ok(r.body.results[0].conflict === true && r.body.results[0].mark.pts === 7, "stale edit refused with the current mark");
  ok(r.body.results[1].ok === true, "the other op in the batch still lands");
  ok(JSON.parse(fs.readFileSync(path.join(D, "Gradebook/marks/c1.json"), "utf8")).students.s1.pts === 7, "refused edit did not reach the file");
  r = await j("POST", "/api/marks", { ops: [{ col: "c1", sid: "s1", base: h1, force: true, patch: { pts: 5 } }] });
  ok(r.body.results[0].ok === true && r.body.results[0].mark.pts === 5, "keep mine forces it");

  // checking Claude's mark keeps it Claude's
  r = await j("POST", "/api/marks", { ops: [{ col: "c1", sid: "s2", base: h2, patch: { checked: true } }] });
  ok(r.body.results[0].mark.by === "claude" && r.body.results[0].mark.checked === true && r.body.results[0].mark.conf === "high", "Looks right only checks it");
  // changing Claude's score makes it the teacher's
  r = await j("POST", "/api/marks", { ops: [{ col: "c1", sid: "s2", patch: { pts: 5 } }] });
  ok(r.body.results[0].mark.by === "teacher" && !("conf" in r.body.results[0].mark), "a changed score becomes the teacher's");

  r = await j("POST", "/api/marks", { ops: [{ col: "c1", sid: "s1", patch: { secret: 1 } }] }); ok(r.status === 400, "unknown field refused");
  r = await j("POST", "/api/marks", { ops: [{ col: "../x", sid: "s1", patch: { pts: 1 } }] }); ok(r.status === 400, "path-like column id refused");
  r = await j("POST", "/api/marks", { ops: [{ col: "c1", sid: "s1", patch: { status: "zero" } }] }); ok(r.status === 400, "unknown status refused");
  r = await j("POST", "/api/marks", { ops: [{ col: "c1", sid: "s3", del: true }] }); ok(r.body.results[0].ok === true && r.body.results[0].mark === null, "a mark can be removed (undo)");

  // files: only under the data folder
  let f = await fetch(B + "/api/file?p=" + encodeURIComponent("Handouts/Week 7/sheet.pdf")); ok(f.status === 200 && f.headers.get("content-type") === "application/pdf", "handout served");
  f = await fetch(B + "/api/file?p=" + encodeURIComponent("../../etc/passwd")); ok(f.status === 400, "traversal refused");
  f = await fetch(B + "/api/file?p=" + encodeURIComponent("/etc/hosts")); ok(f.status === 400, "absolute path refused");
  f = await fetch(B + "/api/file?p=outside-secret.txt"); ok(f.status === 400, "non-document type refused");

  // exit tickets become a column once
  r = await j("POST", "/api/xt", { course: "alg", date: days[0].iso, week: 7, title: "Exit ticket" }); ok(r.body.col === "xt-alg-" + days[0].iso, "exit ticket column id");
  await j("POST", "/api/xt", { course: "alg", date: days[0].iso, week: 7 });
  ok(JSON.parse(fs.readFileSync(path.join(D, "Gradebook/courses/alg.json"), "utf8")).columns.filter(c => c.kind === "XT").length === 1, "exit ticket column added once");

  r = await j("POST", "/api/column", { col: "c1", excused: true, sheetNote: "most missed 2b" }); ok(r.body.doc.excused === true && r.body.doc.students.s1.pts === 5, "column patch keeps the marks");
  r = await j("POST", "/api/prep", { week: 7, id: "p1", on: true }); ok(!!r.body.prep["week-7"].p1, "prep tick saved");
  r = await j("POST", "/api/override", { week: 7, cls: "alg", day: "mon", warmup: "g1" }); ok(r.body.overrides["week-7/alg/mon"].warmup === "g1", "warm-up swap saved");
  r = await j("POST", "/api/request", { key: "7/art", label: "Art", text: "on page 4" }); ok(r.body.requests.length === 1 && r.body.requests[0].status === "open", "request added");
  r = await j("POST", "/api/request", { key: "7/art", text: "page 5" }); ok(r.body.requests.length === 1 && r.body.requests[0].text === "page 5", "request updated, not duplicated");
  r = await j("PUT", "/api/profile", { sid: "s1", data: { focus: "Fractions", solid: ["a", "b"], work: [] } }); ok(r.body.ok === true && r.body.profile.solid.length === 2, "profile saved");
  r = await j("POST", "/api/scan", new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), { "content-type": "image/jpeg", "x-course": "alg" });
  ok(r.body.ok === true && fs.readdirSync(path.join(D, "Gradebook/inbox")).length === 1, "scan lands in the inbox");
  r = await j("POST", "/api/scan", "hello", { "content-type": "text/plain" }); ok(r.status === 400, "non-image scan refused");
  ok(fs.readFileSync(path.join(D, "activity.jsonl"), "utf8").includes('"did":"marked"'), "activity logged");

  // not mounted: reads say so, writes refused, nothing written into the empty folder
  fs.renameSync(path.join(D, "school.json"), path.join(D, "school.away"));
  st = await j("GET", "/api/state"); ok(st.body.ok === false && st.body.error === "not_mounted", "missing folder reported");
  r = await j("POST", "/api/marks", { ops: [{ col: "c1", sid: "s1", patch: { pts: 1 } }] }); ok(r.status === 503, "writes refused when not mounted");
  fs.renameSync(path.join(D, "school.away"), path.join(D, "school.json"));
  const rev1 = (await j("GET", "/api/rev")).body.rev;
  W("Gradebook/marks/c1.json", { students: {} }); await new Promise(r => setTimeout(r, 20));
  ok((await j("GET", "/api/rev")).body.rev !== rev1, "revision moves when a file changes");
} finally { srv.kill(); }

// ingress only: without INGRESS_ONLY=0 a local request is refused
{
  const port = PORT + 1;
  const s2 = spawn(process.execPath, [path.join(ROOT, "bell_to_bell/server.mjs")], { env: { ...process.env, DATA_DIR: D, PORT: String(port), HA_API: "" }, stdio: "ignore" });
  await up(port);
  try { const r = await fetch(`http://127.0.0.1:${port}/api/state`); ok(r.status === 403, "non-ingress request refused"); } finally { s2.kill(); }
}

// the privacy gate: a planted term is refused, a missing denylist refuses everything
{
  const dl = path.join(D, "deny.txt"), leak = path.join(D, "leak.txt");
  fs.writeFileSync(dl, "Zebulon\n"); fs.writeFileSync(leak, "a note about Zebulon\n");
  const run = (file, env) => spawnSync(process.execPath, [path.join(ROOT, "tools/privacy-check.mjs"), "--text", file], { env: { ...process.env, ...env } }).status;
  ok(run(leak, { BTB_DENYLIST: dl }) === 1, "privacy gate refuses a denylisted name");
  fs.writeFileSync(leak, "server at " + ["10", "0", "0", "12"].join(".") + "\n"); ok(run(leak, { BTB_DENYLIST: dl }) === 1, "privacy gate refuses a LAN address");
  fs.writeFileSync(leak, "write to someone" + "@" + "gmail.com\n"); ok(run(leak, { BTB_DENYLIST: dl }) === 1, "privacy gate refuses an e-mail address");
  fs.writeFileSync(leak, "nothing here\n"); ok(run(leak, { BTB_DENYLIST: dl }) === 0, "privacy gate passes clean text");
  ok(run(leak, { BTB_DENYLIST: path.join(D, "none.txt") }) === 2, "privacy gate refuses when its denylist is missing");
}

fs.rmSync(D, { recursive: true, force: true });
console.log(`${pass} passed, ${fail} failed`);
if (fail) { console.log(log); process.exit(1); }
