// Smoke test: starts the real server over a made-up data folder and drives the API.
// Every name here is invented. Run: node test/smoke.mjs
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

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
  classes: { alg: { unit: "Unit 2", days: { mon: { focus: "Fractions <b>again</b>", warmup: "g1", exit: { q: "1/2 + 1/4?", a: "3/4" } }, tue: { focus: "Own folder", folder: "Lessons/Day {week}" }, wed: { focus: "Escape", folder: "../../etc" } } }, art: { unit: "", days: { mon: { gap: true, focus: "?" }, tue: { focus: "Paint", folder: "Art/Empty" } } } },
  prep: [{ id: "p1", text: "Copies" }] });
W("Gradebook/courses/alg.json", { name: "Algebra", students: [{ id: "s1", name: "Quillon Example" }, { id: "s2", name: "Zephyrine Sample" }, { id: "s3", name: "Bramwell Test" }],
  columns: [{ id: "c1", week: 7, kind: "CW", title: "Fractions", outOf: 8, items: ["1a", "1b", "2a", "2b"] }, { id: "h1", week: 7, kind: "HW", title: "Homework" }] });
W("Gradebook/marks/c1.json", { students: { s1: { status: "scored", pts: 6, outOf: 8, r: "2 2 1 1" }, s2: { status: "scored", pts: 4, outOf: 8, by: "claude", conf: "high", checked: false } } });
W("Handouts/Week 7/sheet.pdf", "%PDF-1.4 fake");
W("Handouts/Week 7/.hidden.pdf", "x"); W("Handouts/Week 7/notes.txt", "x"); W("Handouts/Week 7/a10.pdf", "x"); W("Handouts/Week 7/a9.pdf", "x");
W("Lessons/Day 7/plan.pdf", "%PDF-1.4 fake"); fs.mkdirSync(path.join(D, "Art/Empty"), { recursive: true });
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

  const sunR = await j("GET", "/api/sun");
  ok(sunR.status === 200 && JSON.stringify(sunR.body) === "{}", "no HA: the sun reading is empty, not a guessed day");

  let st = await j("GET", "/api/state");
  ok(st.body.ok === true, "state ok");
  ok(st.body.week === 7, "current week found from dates");
  ok(st.body.plan && st.body.plan.classes.alg.unit === "Unit 2", "plan loaded");
  const ha = st.body.handouts.alg;
  ok(ha.dir === "Handouts/Week 7" && ha.files.join() === "a9.pdf,a10.pdf,sheet.pdf", "handouts listed for the week folder, documents only, natural order");
  ok(ha.base === "Handouts", "class folder above the week is offered for copying");
  ok(ha.days.tue && ha.days.tue.dir === "Lessons/Day 7" && ha.days.tue.files.join() === "plan.pdf", "a plan day's own folder is listed");
  ok(!ha.days.wed, "a plan day's folder outside the data folder is dropped");
  ok(!!st.body.handouts.art && st.body.handouts.art.dir === null && st.body.handouts.art.days.tue.files.length === 0 && !st.body.handouts.art.days.tue.missing, "a class with no folder still gets its day's folder, empty but present");
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
  ok((f.headers.get("content-disposition") || "").startsWith("inline;") && f.headers.get("content-disposition").includes("sheet.pdf"), "handout opens in the browser under its own name");
  f = await fetch(B + "/api/file?p=" + encodeURIComponent("../../etc/passwd")); ok(f.status === 400, "traversal refused");
  f = await fetch(B + "/api/file?p=" + encodeURIComponent("/etc/hosts")); ok(f.status === 400, "absolute path refused");
  f = await fetch(B + "/api/file?p=outside-secret.txt"); ok(f.status === 400, "non-document type refused");

  // exit tickets become a column once
  r = await j("POST", "/api/xt", { course: "alg", date: days[0].iso, week: 7, title: "Exit ticket" }); ok(r.body.col === "xt-alg-" + days[0].iso, "exit ticket column id");
  await j("POST", "/api/xt", { course: "alg", date: days[0].iso, week: 7 });
  ok(JSON.parse(fs.readFileSync(path.join(D, "Gradebook/courses/alg.json"), "utf8")).columns.filter(c => c.kind === "XT").length === 1, "exit ticket column added once");

  // homework set from the day card becomes a completion column with both dates
  r = await j("POST", "/api/hw", { course: "alg", title: "Workbook pg 9", assigned: days[0].iso, due: days[1].iso, week: 7 });
  ok(r.status === 200 && r.body.col.kind === "HW" && r.body.col.assigned === days[0].iso && r.body.col.due === days[1].iso && r.body.col.outOf === null, "homework column created with assigned and due");
  ok(/^hw-alg-/.test(r.body.col.id), "homework column id names the course");
  ok(JSON.parse(fs.readFileSync(path.join(D, "Gradebook/courses/alg.json"), "utf8")).columns.some(c => c.id === r.body.col.id), "homework column written to the course");
  r = await j("POST", "/api/marks", { ops: [{ col: r.body.col.id, sid: "s1", patch: { status: "notin" } }] }); ok(r.body.results[0].ok === true, "homework checked in");
  r = await j("POST", "/api/hw", { course: "alg", title: "Backwards", assigned: days[1].iso, due: days[0].iso }); ok(r.status === 400, "homework due before it's set is refused");
  r = await j("POST", "/api/hw", { course: "alg", title: " ", assigned: days[0].iso, due: days[1].iso }); ok(r.status === 400, "homework with no title is refused");
  r = await j("POST", "/api/hw", { course: "nope", title: "x", assigned: days[0].iso, due: days[1].iso }); ok(r.status === 404, "homework for a missing course is refused");
  ok(fs.readFileSync(path.join(D, "activity.jsonl"), "utf8").includes('"did":"assigned"'), "setting homework is logged");

  // tests added in the app carry the whole test's points
  r = await j("POST", "/api/test", { course: "alg", title: "Unit 2 test", due: days[2].iso, outOf: 100, week: 7 });
  ok(r.status === 200 && r.body.col.kind === "TEST" && r.body.col.outOf === 100 && /^test-alg-/.test(r.body.col.id), "test column created with its out of");
  r = await j("POST", "/api/test", { course: "alg", title: "No points", due: days[2].iso }); ok(r.status === 400, "a test with no out of is refused");
  // student notes build up, and one can be taken back
  r = await j("POST", "/api/snote", { sid: "s1", text: "Quieter this week", col: "c1" });
  ok(r.status === 200 && r.body.doc.items.length === 1 && r.body.doc.items[0].col === "c1" && !!r.body.doc.items[0].at, "student note kept with its assignment");
  r = await j("POST", "/api/snote", { sid: "s1", text: "Second note" }); ok(r.body.doc.items.length === 2, "student notes build up");
  const nid = r.body.doc.items[0].id;
  r = await j("POST", "/api/snote", { sid: "s1", id: nid, del: true }); ok(r.body.doc.items.length === 1 && r.body.doc.items[0].text === "Second note", "one note removed, the other kept");
  r = await j("POST", "/api/snote", { sid: "s1", text: "  " }); ok(r.status === 400, "an empty student note is refused");
  r = await j("POST", "/api/snote", { sid: "../x", text: "x" }); ok(r.status === 400, "a path-like student id is refused");
  // a class note: one per class per day, replaced on save, removed when emptied
  r = await j("POST", "/api/classnote", { cls: "alg", date: days[1].iso, week: 7, day: "tue", text: "Got to problem 4" });
  ok(r.status === 200 && r.body.doc.notes.length === 1, "class note saved");
  await j("POST", "/api/classnote", { cls: "alg", date: days[0].iso, week: 7, day: "mon", text: "Monday" });
  r = await j("POST", "/api/classnote", { cls: "alg", date: days[1].iso, week: 7, day: "tue", text: "Got to problem 5" });
  ok(r.body.doc.notes.length === 2 && r.body.doc.notes[0].date === days[0].iso && r.body.doc.notes[1].text === "Got to problem 5", "class note replaced, notes kept in date order");
  ok(fs.existsSync(path.join(D, "Notes/alg.json")), "class notes live in Notes/<class>.json");
  r = await j("POST", "/api/classnote", { cls: "alg", date: days[0].iso, text: "" }); ok(r.body.doc.notes.length === 1, "an emptied class note is removed");
  st = await j("GET", "/api/state"); ok(st.body.cnotes.alg.notes.length === 1 && st.body.snotes.s1.items.length === 1, "notes come back in the state");

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

// a plan day's print list is rendered on the day card, as a list, through rich()
{
  const src = fs.readFileSync(path.join(ROOT, "bell_to_bell/www/app.js"), "utf8");
  ok(/const prints = Array\.isArray\(d\.print\)/.test(src), "print list read from the plan day");
  ok(src.includes("${filesBox(it.k, hand)}${print}${hwBox("), "print list placed in the side column, under the worksheet");
  ok(fs.readFileSync(path.join(ROOT, "bell_to_bell/www/index.html"), "utf8").includes(".printbox{"), "print list styled");
}

// homework prompts are wired into Today, the week and the sheets
{
  const src = fs.readFileSync(path.join(ROOT, "bell_to_bell/www/app.js"), "utf8");
  ok(src.includes("${print}${hwBox(it.k, S.day, showNames)}${exitBtn}"), "homework box placed in the side column");
  for (const t of ['s.t === "hwin"', 's.t === "hwnew"', 'case "hwin":', 'case "hwnew":', 'case "hwset":', 'case "hwrest":', 'case "hwsave":']) ok(src.includes(t), "homework wiring: " + t);
  ok(/rest = f\.c\.students\.filter\(st => !mark\(cid, st\.id\)\)/.test(src), "'the rest' only touches students with no mark yet");
  ok(/showNames \? t\.out\.map/.test(src), "names of who owes homework only show when grades may");
  ok(fs.readFileSync(path.join(ROOT, "bell_to_bell/server.mjs"), "utf8").includes("await homeworkLine(x.c.course"), "bell heads-up carries the homework line");
}

// the grading block, run on its own: tests 60 / homework 40, homework 70 done / 30 right
{
  const src = fs.readFileSync(path.join(ROOT, "bell_to_bell/www/app.js"), "utf8");
  const blk = src.match(/\/\* grading:start[\s\S]*?\/\* grading:end \*\//);
  ok(!!blk, "grading block is marked");
  const run = (cols, marks, grading) => {
    const ctx = { M: marks, G: grading };
    vm.runInNewContext(`const school = () => ({ grading: G }); const colX = c => !!c.x; const mark = (cid, sid) => (M[cid] || {})[sid] || null;
      const isScored = m => !!m && (m.status === "scored" || m.status === "late");\n${blk[0]}\nthis.out = grade({ columns: COLS }, "s");`, Object.assign(ctx, { COLS: cols }));
    return ctx.out;
  };
  const near = (a, b) => a != null && Math.abs(a - b) < 1e-9;
  const T = { id: "t", kind: "TEST", outOf: 100 }, H1 = { id: "h1", kind: "HW" }, H2 = { id: "h2", kind: "HW" }, W = { id: "w", kind: "CW", outOf: 40 };
  let g = run([T], { t: { s: { status: "scored", pts: 30, outOf: 40 } } });
  ok(near(g.tests, 30), "a test counts over the whole test, not over what was tried");
  g = run([T, H1], { t: { s: { status: "scored", pts: 80 } }, h1: { s: { status: "done" } } });
  ok(near(g.homework, 100) && near(g.grade, 0.6 * 80 + 0.4 * 100), "tests 60, homework 40");
  g = run([H1], { h1: { s: { status: "done", pts: 5, outOf: 10 } } });
  ok(near(g.homework, 70 + 30 * 0.5), "homework: 70 done + 30 right");
  g = run([H1, H2], { h1: { s: { status: "partial" } }, h2: { s: { status: "notin" } } });
  ok(near(g.homework, 25), "partial is half, not in is zero, no score means completion alone");
  g = run([H1], { h1: { s: { status: "absent" } } }); ok(g.homework === null && g.grade === null, "absent homework is left out, never zero");
  g = run([T, W], { t: { s: { status: "missing" } }, w: { s: { status: "scored", pts: 10, outOf: 40 } } });
  ok(g.grade === null && g.tests === null, "worksheets never count; a missing test is left out, not zero");
  g = run([{ ...T, x: true }, H1], { t: { s: { status: "scored", pts: 0 } }, h1: { s: { status: "done" } } }); ok(near(g.grade, 100), "an excused test drops out of the grade");
  g = run([T, H1], { t: { s: { status: "scored", pts: 50 } }, h1: { s: { status: "done" } } }, { tests: 50, homework: 50, completion: 100, accuracy: 0 });
  ok(near(g.grade, 75), "weights come from school.json grading");
  g = run([{ id: "a", kind: "TEST", outOf: 50 }, { id: "b", kind: "TEST", outOf: 100 }], { a: { s: { status: "scored", pts: 50 } }, b: { s: { status: "scored", pts: 50 } } });
  ok(near(g.tests, 100 * 100 / 150), "tests add up by points, so a longer test weighs more");
  ok(!/\?\? 0\)/.test(blk[0]), "the grading block never turns a missing reading into a zero");
}

// the new Today and Grades wiring
{
  const src = fs.readFileSync(path.join(ROOT, "bell_to_bell/www/app.js"), "utf8");
  for (const t of ['case "jump":', 'case "qscore":', 'case "qstat":', 'case "newcol":', 'case "colsave":', 'case "snote":', 'case "snsave":', 'case "sndel":', 'case "copynotes":', 'case "akind":', 'case "asgmiss":', 't.dataset.cnote', 's.t === "qscore"', 's.t === "newcol"', 's.t === "snote"'])
    ok(src.includes(t), "wiring: " + t);
  ok(src.includes("${noteBox(it)}</section>") && src.includes("h += glance(c);") && src.includes('return h + asgGrid(c);') && src.includes("h += notesSection(c, st);"), "notes box, glance, grid and student notes are all called, not just defined");
  ok(src.includes("${worksheetDock(it.k, hand)}"), "phone worksheet button is placed");
  ok(fs.readFileSync(path.join(ROOT, "bell_to_bell/config.yaml"), "utf8").includes("panel_title: Bell to Bell"), "sidebar says Bell to Bell");
}

// themes: the head script's picker, run for real, and every theme's small text passes 4.5:1
{
  const html = fs.readFileSync(path.join(ROOT, "bell_to_bell/www/index.html"), "utf8");
  const script = html.match(/<script>\n(\/\* Theme[\s\S]*?)<\/script>/);
  ok(!!script, "theme picker sits inline in the head");
  ok(html.indexOf("btbTheme") < html.indexOf("<style>"), "theme is picked before the stylesheet paints");
  ok(!html.includes("@media (prefers-color-scheme"), "no media-query theme left to fight the picker");
  const H = 3600e3, now = Date.now();
  const pick = (dark, store) => {
    const root = { dataset: {} }, ctx = { document: { documentElement: root }, Date, JSON,
      matchMedia: () => ({ matches: dark }), localStorage: { getItem: k => (k in store ? store[k] : null) }, window: {} };
    vm.runInNewContext(script[1], ctx); return root.dataset.theme;
  };
  const sunAt = (state, rising, setting) => ({ "btb.sun": JSON.stringify({ state, rising, setting }) });
  ok(pick(false, sunAt("below_horizon", now + H, now + 9 * H)) === "light", "device light is light, even at night");
  ok(pick(true, sunAt("above_horizon", now + 9 * H, now + H)) === "dim", "device dark with the sun up is dim");
  ok(pick(true, sunAt("below_horizon", now + H, now + 9 * H)) === "night", "device dark after sunset is night");
  ok(pick(true, sunAt("above_horizon", now + 9 * H, now - 60e3)) === "night", "a stale 'up' reading past its sunset counts as night");
  ok(pick(true, sunAt("below_horizon", now - 60e3, now + 9 * H)) === "dim", "a stale 'down' reading past its sunrise counts as day");
  ok(pick(true, {}) === "night", "no sun reading: a dark device stays night, as before");
  ok(pick(true, { "btb.sun": "unknown" }) === "night", "a garbage sun reading is no reading");
  ok(pick(false, { "btb.theme": "night" }) === "night" && pick(true, { "btb.theme": "light", ...sunAt("below_horizon", now + H, now + 9 * H) }) === "light", "a manual theme wins over device and sun");
  const blocks = { light: html.match(/:root\{([^}]*)\}/)[1], dim: html.match(/:root\[data-theme="dim"\]\{([^}]*)\}/)[1], night: html.match(/:root\[data-theme="night"\]\{([^}]*)\}/)[1] };
  const tok = (b, n) => (b.match(new RegExp("--" + n + ":(#[0-9A-Fa-f]{6})")) || [])[1];
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const [name, b] of Object.entries(blocks)) for (const fg of ["fg2", "muted", "faint", "live", "accent-ink"]) for (const bg of ["bg", "surface"])
    ok(ratio(tok(b, fg), tok(b, bg)) >= 4.5, `${name}: --${fg} on --${bg} is ${ratio(tok(b, fg), tok(b, bg)).toFixed(2)}:1`);
  const src = fs.readFileSync(path.join(ROOT, "bell_to_bell/www/app.js"), "utf8");
  ok(src.includes('case "theme":') && src.includes("${themeBtn()}"), "theme button wired into the header");
  ok(src.includes('dataset.theme === "night"'), "course colours follow the picked theme, not the device");
  ok(/function tick\(\) \{\n  retheme\(\);/.test(src) && src.includes("setInterval(fetchSun"), "the theme flips at sunset without a reload");
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
