// Bell to Bell server: serves the page and a small JSON-file API over a data folder.
// No dependencies. Everything personal lives in DATA_DIR, never in this repo:
//   school.json                      classes, bell times, rail shapes, warm-up library, prompts
//   Plans/week-NN.json               one week's plan
//   Gradebook/courses/<id>.json      roster + assignments
//   Gradebook/marks/<column>.json    one file per assignment
//   Gradebook/profiles/<student>.json
//   Gradebook/inbox/, scans/         scans waiting to be scored / already scored
//   state/prep.json, overrides.json  prep ticks, warm-up swaps (written by this app only)
//   requests.json, activity.jsonl    notes to Claude, change log
import http from "node:http";
import fs from "node:fs/promises";
import { readFileSync, existsSync, realpathSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
function options() { try { return JSON.parse(readFileSync("/data/options.json", "utf8")); } catch { return {}; } }
const OPT = options();
const DATA_DIR = path.resolve(process.env.DATA_DIR || OPT.data_dir || "/share/classes");
const PORT = +(process.env.PORT || 8099);
// Ingress traffic always arrives from the Supervisor's proxy; anything else is refused,
// so there is no open port and no login of its own: HA's login is the login.
const INGRESS_ONLY = process.env.INGRESS_ONLY !== "0";
const INGRESS_IP = "172.30.32.2";
const P = rel => path.join(DATA_DIR, rel);
const SCHOOL = P("school.json"), PLANS = P("Plans"), GB = P("Gradebook");
const COURSES = path.join(GB, "courses"), MARKS = path.join(GB, "marks"), PROFILES = path.join(GB, "profiles");
const INBOX = path.join(GB, "inbox"), SCANS = path.join(GB, "scans");
const PREP = P("state/prep.json"), OVERRIDES = P("state/overrides.json");
const REQUESTS = P("requests.json"), ACTIVITY = P("activity.jsonl");
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const MAX_BODY = 512 * 1024, MAX_SCAN = 30 * 1024 * 1024;

function supervisorToken() {
  if (process.env.SUPERVISOR_TOKEN) return process.env.SUPERVISOR_TOKEN;
  try { return readFileSync("/run/s6/container_environment/SUPERVISOR_TOKEN", "utf8").trim(); } catch { return ""; }
}
const SUP_TOKEN = process.env.HA_API ? "" : supervisorToken();
const HA_API = process.env.HA_API || (SUP_TOKEN ? "http://supervisor/core/api" : "");
const HA_TOKEN = process.env.HA_TOKEN || SUP_TOKEN;
const NOW_SENSOR = OPT.now_sensor === false || process.env.NOW_SENSOR === "0" ? null : "sensor.bell_to_bell_now";
const BELL_NOTIFY = (OPT.bell_notify || []).map(s => String(s).trim().replace(/^notify\./, "")).filter(s => /^[a-z0-9_]+$/.test(s));
const BELL_MIN = Number.isFinite(+OPT.bell_minutes) ? +OPT.bell_minutes : 2;

const PAGE = readFileSync(path.join(HERE, "www", "index.html"));
const APPJS = readFileSync(path.join(HERE, "www", "app.js"));

/* ---------------- files ---------------- */
// The folder is the share. If it is not mounted we must not write into the empty
// directory underneath it, or the data forks: school.json is the marker that it is there.
const mounted = () => existsSync(SCHOOL);
async function readJSON(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (e) { if (e.code === "ENOENT") return null; throw e; }
}
async function writeJSON(file, obj) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp-" + process.pid + "-" + crypto.randomBytes(3).toString("hex");
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2) + "\n");
  await fs.rename(tmp, file);
}
let chain = Promise.resolve();
const serial = fn => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
async function tag(f) { try { const s = await fs.stat(f); return s.mtimeMs + ":" + s.size; } catch { return "-"; } }
async function list(dir, ext = ".json") { try { return (await fs.readdir(dir)).filter(n => n.endsWith(ext) && !n.startsWith(".")).sort(); } catch { return []; } }

// Fingerprint of every file the page shows. SMB mounts deliver no change events for
// writes from another machine, so the page polls this.
async function revision() {
  const parts = [];
  for (const f of [SCHOOL, PREP, OVERRIDES, REQUESTS, ACTIVITY]) parts.push(f + (await tag(f)));
  for (const d of [PLANS, COURSES, MARKS, PROFILES]) for (const n of await list(d)) parts.push(n + (await tag(path.join(d, n))));
  parts.push("inbox" + (await list(INBOX, "")).length);
  let h = 2166136261;
  for (const ch of parts.join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}
const stable = v => Array.isArray(v) ? "[" + v.map(stable).join(",") + "]"
  : v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}" : JSON.stringify(v ?? null);
const markHash = m => m == null ? "none" : crypto.createHash("sha1").update(stable(m)).digest("hex").slice(0, 12);

async function loadDir(dir) {
  const out = {}, bad = [];
  for (const n of await list(dir)) {
    const id = n.slice(0, -5);
    if (!ID.test(id)) continue;
    try { out[id] = await readJSON(path.join(dir, n)); } catch { bad.push(n); }   // one half-written file must not take the page down
  }
  return { out, bad };
}
const todayISO = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
async function weeks() {
  const out = [];
  for (const n of await list(PLANS)) {
    const m = n.match(/^week-(\d{1,2})\.json$/);
    if (!m) continue;
    try { const w = await readJSON(path.join(PLANS, n)); out.push({ week: +m[1], startsOn: w.startsOn, endsOn: w.endsOn, label: w.label || "Week " + +m[1] }); }
    catch { out.push({ week: +m[1], bad: true }); }
  }
  return out.sort((a, b) => a.week - b.week);
}
function currentWeek(ws, iso = todayISO()) {
  const ok = ws.filter(w => !w.bad && w.startsOn);
  const hit = ok.find(w => iso >= w.startsOn && iso <= (w.endsOn || w.startsOn));
  if (hit) return hit.week;
  const next = ok.find(w => w.startsOn > iso);          // a weekend shows the coming week
  return next ? next.week : ok.length ? ok[ok.length - 1].week : null;
}
// A class's handouts folder, plus any plan day that names its own (`folder` on the day).
// `base` is the class folder above the week, so "copy the class folder" has somewhere to point.
const DOC_RE = /\.(pdf|png|jpe?g|webp|heic)$/i;
async function listDir(rel) {
  const abs = safePath(rel);
  if (!abs) return null;
  try { return { dir: rel, files: (await fs.readdir(abs)).filter(n => DOC_RE.test(n) && !n.startsWith(".")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) }; }
  catch { return { dir: rel, files: [], missing: true }; }
}
const weekOf = (tpl, plan) => String(tpl).replace(/\{week\}/g, plan ? plan.week : "").replace(/\/+$/, "");
const baseOf = tpl => String(tpl).split("/").filter(Boolean).filter((seg, i, a) => !a.slice(0, i + 1).some(x => x.includes("{week}"))).join("/");
async function handouts(school, plan) {
  const out = {};
  for (const [k, c] of Object.entries(school.classes || {})) {
    const days = (plan && plan.classes && plan.classes[k] && plan.classes[k].days) || {};
    const own = Object.entries(days).filter(([, d]) => d && typeof d.folder === "string" && d.folder);
    if (!c.folder && !own.length) continue;
    const h = c.folder ? await listDir(weekOf(c.folder, plan)) : null;
    const o = h ? { ...h } : { dir: null, files: [] };
    o.base = c.folder ? baseOf(c.folder) || null : null;
    if (o.base === o.dir) o.base = null;
    o.days = {};
    for (const [dk, d] of own) { const x = await listDir(weekOf(d.folder, plan)); if (x) o.days[dk] = x; }
    out[k] = o;
  }
  return out;
}
async function tailActivity(n = 80) {
  try {
    const lines = (await fs.readFile(ACTIVITY, "utf8")).trim().split("\n").slice(-n);
    return lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}
async function state(weekParam) {
  if (!mounted()) return { ok: false, error: "not_mounted", now: Date.now() };
  const school = await readJSON(SCHOOL).catch(() => null);
  const ws = await weeks();
  const week = weekParam && ws.some(w => w.week === weekParam) ? weekParam : currentWeek(ws);
  const plan = week != null ? await readJSON(path.join(PLANS, `week-${String(week).padStart(2, "0")}.json`)).catch(() => null)
    || await readJSON(path.join(PLANS, `week-${week}.json`)).catch(() => null) : null;
  const [courses, marks, profiles] = await Promise.all([loadDir(COURSES), loadDir(MARKS), loadDir(PROFILES)]);
  const hashes = {};
  for (const [cid, f] of Object.entries(marks.out)) { hashes[cid] = {}; for (const [sid, m] of Object.entries((f && f.students) || {})) hashes[cid][sid] = markHash(m); }
  return { ok: true, rev: await revision(), now: Date.now(), today: todayISO(), school: school || {}, weeks: ws, week, plan,
           handouts: await handouts(school || {}, plan), courses: courses.out, marks: marks.out, hashes, profiles: profiles.out,
           prep: (await readJSON(PREP).catch(() => null)) || {}, overrides: (await readJSON(OVERRIDES).catch(() => null)) || {},
           requests: ((await readJSON(REQUESTS).catch(() => null)) || {}).items || [], activity: await tailActivity(),
           inbox: (await list(INBOX, "")).filter(n => !n.startsWith(".")).length,
           bad: [...courses.bad, ...marks.bad, ...profiles.bad], schoolBad: !school };
}
// Only files under DATA_DIR, and only after symlinks are resolved.
function safePath(rel) {
  if (typeof rel !== "string" || !rel || rel.includes("\0")) return null;
  const abs = path.resolve(DATA_DIR, rel);
  if (abs !== DATA_DIR && !abs.startsWith(DATA_DIR + path.sep)) return null;
  try { const real = realpathSync(abs); const root = realpathSync(DATA_DIR); if (real !== root && !real.startsWith(root + path.sep)) return null; } catch {}
  return abs;
}

/* ---------------- http helpers ---------------- */
function send(res, code, body, type = "application/json", extra = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  res.writeHead(code, { "content-type": type, "cache-control": "no-store", "content-length": buf.length, "x-content-type-options": "nosniff", ...extra });
  res.end(buf);
}
function raw(req, max) {
  return new Promise((ok, fail) => {
    let n = 0; const chunks = [];
    req.on("data", c => { n += c.length; if (n > max) { fail(Object.assign(new Error("too_large"), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => ok(Buffer.concat(chunks)));
    req.on("error", fail);
  });
}
async function body(req) {
  const b = await raw(req, MAX_BODY);
  try { return JSON.parse(b.toString("utf8") || "{}"); } catch { throw Object.assign(new Error("bad_json"), { code: 400 }); }
}
const bad = msg => Object.assign(new Error(msg), { code: 400 });
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const str = (v, n) => typeof v === "string" ? v.slice(0, n) : undefined;
function who(req) { const v = req.headers["x-remote-user-display-name"] || req.headers["x-remote-user-name"]; return v ? String(v).slice(0, 80) : "teacher"; }
async function log(entry) {
  try { await fs.appendFile(ACTIVITY, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n"); } catch (e) { console.error("activity", e.message); }
}

/* ---------------- marks ---------------- */
const STATUS = new Set(["scored", "late", "missing", "absent", "excused", "nopage", "done", "partial", "notin"]);
function applyPatch(cur, patch) {
  const next = { ...(cur || {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (k === "status") { if (!STATUS.has(v)) throw bad("bad_status"); next.status = v; }
    else if (k === "pts" || k === "outOf") { if (v === null) delete next[k]; else if (Number.isFinite(v) && v >= 0 && v <= 1000) next[k] = v; else throw bad("bad_number"); }
    else if (k === "inc" || k === "checked") next[k] = !!v;
    else if (k === "note") { if (typeof v !== "string") throw bad("bad_note"); if (v) next.note = v.slice(0, 2000); else delete next.note; }
    else if (k === "r") { if (v === null) delete next.r; else if (typeof v === "string" && /^[012\- ]{0,400}$/.test(v)) next.r = v; else throw bad("bad_codes"); }
    else throw bad("field_not_allowed:" + k);
  }
  const onlyCheck = Object.keys(patch).every(k => k === "checked");
  if (!onlyCheck) {                       // a person changed it: it is theirs now
    next.by = "teacher"; next.checked = true;
    delete next.proposed; delete next.conf;
  } else if (next.checked && next.by === "claude") next.checkedAt = new Date().toISOString();
  next.at = new Date().toISOString();
  return next;
}
// Each op is one student's mark in one assignment. It names the hash of the mark it was
// made against; if the file moved under it (another device, or Claude), that op alone is
// refused with the current mark and every other op still lands.
async function markOps(ops, by) {
  if (!Array.isArray(ops) || !ops.length || ops.length > 400) throw bad("bad_ops");
  for (const o of ops) if (!isObj(o) || !ID.test(o.col || "") || !ID.test(o.sid || "") || !(o.del || isObj(o.patch))) throw bad("bad_op");
  return serial(async () => {
    const results = [], files = {};
    for (const o of ops) {
      const file = path.join(MARKS, o.col + ".json");
      const doc = files[o.col] || (files[o.col] = (await readJSON(file)) || { students: {} });
      if (!isObj(doc.students)) doc.students = {};
      const cur = doc.students[o.sid] || null;
      if (!o.force && o.base !== undefined && o.base !== markHash(cur)) { results.push({ ok: false, conflict: true, col: o.col, sid: o.sid, mark: cur, hash: markHash(cur) }); continue; }
      if (o.del) delete doc.students[o.sid];
      else doc.students[o.sid] = applyPatch(cur, o.patch);
      doc._dirty = true;
      results.push({ ok: true, col: o.col, sid: o.sid, mark: doc.students[o.sid] || null, hash: markHash(doc.students[o.sid]) });
    }
    for (const [col, doc] of Object.entries(files)) if (doc._dirty) { delete doc._dirty; await writeJSON(path.join(MARKS, col + ".json"), doc); }
    const n = results.filter(r => r.ok).length;
    if (n) await log({ by, did: "marked", what: [...new Set(results.filter(r => r.ok).map(r => r.col))].join(","), n });
    return results;
  });
}
async function columnPatch(b) {
  if (!ID.test(b.col || "")) throw bad("bad_col");
  return serial(async () => {
    const file = path.join(MARKS, b.col + ".json");
    const doc = (await readJSON(file)) || { students: {} };
    if ("excused" in b) doc.excused = !!b.excused;
    if ("sheetNote" in b) { const s = str(b.sheetNote, 4000); if (s === undefined) throw bad("bad_note"); doc.sheetNote = s; }
    await writeJSON(file, doc);
    return doc;
  });
}
// Exit tickets become a gradebook column the first time one is scored.
async function ensureExitTicket(b) {
  if (!ID.test(b.course || "") || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) throw bad("bad_xt");
  const id = `xt-${b.course}-${b.date}`;
  return serial(async () => {
    const file = path.join(COURSES, b.course + ".json");
    const c = await readJSON(file);
    if (!c || !Array.isArray(c.columns)) throw Object.assign(new Error("no_such_course"), { code: 404 });
    if (!c.columns.some(x => x.id === id)) {
      c.columns.push({ id, week: Number.isFinite(+b.week) ? +b.week : null, kind: "XT", title: str(b.title, 120) || "Exit ticket",
                       due: b.date, outOf: 2, q: str(b.q, 600) || undefined, a: str(b.a, 400) || undefined });
      await writeJSON(file, c);
    }
    return id;
  });
}
// Homework the teacher sets from the day card. `assigned` is the day it's handed out and
// `due` the day it's collected; both drive the prompts on Today. Completion only, so no outOf.
const ISO = /^\d{4}-\d{2}-\d{2}$/;
async function addHomework(b, by) {
  const title = (str(b.title, 120) || "").trim();
  if (!ID.test(b.course || "") || !title || !ISO.test(b.due || "") || !ISO.test(b.assigned || "") || b.due < b.assigned) throw bad("bad_hw");
  const id = `hw-${b.course}-${b.assigned}-${crypto.randomBytes(2).toString("hex")}`;
  const col = await serial(async () => {
    const file = path.join(COURSES, b.course + ".json");
    const c = await readJSON(file);
    if (!c || !Array.isArray(c.columns)) throw Object.assign(new Error("no_such_course"), { code: 404 });
    const col = { id, week: Number.isFinite(+b.week) ? +b.week : null, kind: "HW", title, assigned: b.assigned, due: b.due, outOf: null };
    c.columns.push(col);
    await writeJSON(file, c);
    return col;
  });
  await log({ by, did: "assigned", what: `${b.course}: ${title}, due ${b.due}`, n: 1 });
  return col;
}
async function profilePut(b, by) {
  if (!ID.test(b.sid || "") || !isObj(b.data)) throw bad("bad_profile");
  const list = v => Array.isArray(v) ? v.map(s => String(s).trim().slice(0, 80)).filter(Boolean).slice(0, 20) : [];
  return serial(async () => {
    const file = path.join(PROFILES, b.sid + ".json");
    const cur = await readJSON(file);
    if (b.base !== undefined && !b.force && b.base !== markHash(cur)) return { ok: false, conflict: true, profile: cur, hash: markHash(cur) };
    const next = { ...(cur || {}), focus: str(b.data.focus, 1000) || "", solid: list(b.data.solid), work: list(b.data.work), updated: todayISO(), by };
    await writeJSON(file, next);
    return { ok: true, profile: next, hash: markHash(next) };
  });
}
async function prepTick(b) {
  if (!Number.isInteger(b.week) || !ID.test(b.id || "")) throw bad("bad_prep");
  return serial(async () => {
    const s = (await readJSON(PREP).catch(() => null)) || {};
    const k = "week-" + b.week; s[k] = s[k] || {};
    if (b.on) s[k][b.id] = new Date().toISOString(); else delete s[k][b.id];
    await writeJSON(PREP, s); return s;
  });
}
async function override(b) {
  if (!Number.isInteger(b.week) || !ID.test(b.cls || "") || !/^[a-z]{3}$/.test(b.day || "") || !(b.warmup === null || ID.test(b.warmup || ""))) throw bad("bad_override");
  return serial(async () => {
    const s = (await readJSON(OVERRIDES).catch(() => null)) || {};
    const k = `week-${b.week}/${b.cls}/${b.day}`;
    if (b.warmup === null) delete s[k]; else s[k] = { warmup: b.warmup, at: new Date().toISOString() };
    await writeJSON(OVERRIDES, s); return s;
  });
}
async function request(b, by) {
  if (!/^[A-Za-z0-9/_-]{1,80}$/.test(b.key || "")) throw bad("bad_key");
  return serial(async () => {
    const doc = (await readJSON(REQUESTS).catch(() => null)) || { items: [] };
    if (!Array.isArray(doc.items)) doc.items = [];
    const text = str(b.text, 2000) || "";
    const i = doc.items.findIndex(x => x.key === b.key && x.status !== "done");
    if (!text) { if (i >= 0) doc.items.splice(i, 1); }
    else if (i >= 0) Object.assign(doc.items[i], { text, at: new Date().toISOString() });
    else doc.items.push({ key: b.key, label: str(b.label, 120) || b.key, text, status: "open", by, at: new Date().toISOString() });
    await writeJSON(REQUESTS, doc); return doc.items;
  });
}
const SCAN_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/webp": "webp", "application/pdf": "pdf" };
async function scan(req) {
  const ext = SCAN_TYPES[String(req.headers["content-type"] || "").split(";")[0].trim()];
  if (!ext) throw bad("bad_type");
  const course = String(req.headers["x-course"] || "");
  const buf = await raw(req, MAX_SCAN);
  if (!buf.length) throw bad("empty");
  const d = new Date(), stamp = todayISO(d).replace(/-/g, "") + "-" + d.toTimeString().slice(0, 8).replace(/:/g, "");
  const name = `${stamp}-${ID.test(course) ? course + "-" : ""}${crypto.randomBytes(3).toString("hex")}.${ext}`;
  await fs.mkdir(INBOX, { recursive: true });
  await fs.writeFile(path.join(INBOX, name), buf);
  return name;
}
const FILE_TYPES = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", heic: "image/heic" };

/* ---------------- the clock: sensor + bell heads-up ---------------- */
const DAYKEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const mins = hhmm => { const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
const clock = m => { const h = Math.floor(m / 60), mm = m % 60; return (h % 12 || 12) + ":" + String(mm).padStart(2, "0"); };
async function today() {
  if (!mounted()) return null;
  const school = await readJSON(SCHOOL).catch(() => null);
  if (!school || !school.classes) return null;
  const ws = await weeks(), iso = todayISO(), wk = ws.find(w => !w.bad && iso >= w.startsOn && iso <= (w.endsOn || w.startsOn));
  const plan = wk ? (await readJSON(path.join(PLANS, `week-${String(wk.week).padStart(2, "0")}.json`)).catch(() => null)
                    || await readJSON(path.join(PLANS, `week-${wk.week}.json`)).catch(() => null)) : null;
  const day = DAYKEYS[new Date().getDay()];
  const list = Object.entries(school.classes).filter(([, c]) => (c.meets || []).includes(day) && mins(c.start) != null)
    .map(([k, c]) => ({ k, c, start: mins(c.start), end: mins(c.start) + (+c.len || 45), d: plan && plan.classes && plan.classes[k] && plan.classes[k].days && plan.classes[k].days[day] || null }))
    .sort((a, b) => a.start - b.start);
  return { school, plan, day, list };
}
// "Collect: Pg 40 · Hand out: Pg 44" for the bell heads-up, or "" when there's none.
async function homeworkLine(course, iso) {
  if (!course || !ID.test(course)) return "";
  const c = await readJSON(path.join(COURSES, course + ".json")).catch(() => null);
  const cols = ((c && c.columns) || []).filter(x => x.kind === "HW" || x.kind === "XP");
  const bits = [];
  const due = cols.filter(x => x.due === iso).map(x => x.title), out = cols.filter(x => x.assigned === iso).map(x => x.title);
  if (due.length) bits.push("Collect: " + due.join(", "));
  if (out.length) bits.push("Hand out: " + out.join(", "));
  return bits.join(" · ");
}
let lastSensor = "", lastSensorAt = 0; const rung = new Set();
async function ha(method, p, data) {
  if (!HA_API) return null;
  const r = await fetch(HA_API + p, { method, headers: { authorization: "Bearer " + HA_TOKEN, "content-type": "application/json" },
                                      body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HA ${method} ${p} -> ${r.status}`);
  return r;
}
// sun.sun for the theme: dim while the sun is up, night after sunset. {} when HA can't say,
// so the page falls back to following the device rather than guessing day.
let sunCache = null, sunAt = 0;
async function sun() {
  if (!HA_API) return {};
  if (sunCache && Date.now() - sunAt < 300e3) return sunCache;
  try {
    const j = await (await ha("GET", "/states/sun.sun")).json();
    const t = v => { const n = Date.parse(v); return Number.isFinite(n) ? n : null; };
    if (j.state === "above_horizon" || j.state === "below_horizon") {
      sunCache = { state: j.state, rising: t(j.attributes && j.attributes.next_rising), setting: t(j.attributes && j.attributes.next_setting) };
      sunAt = Date.now();
    }
  } catch (e) { console.error("sun", e.message); }
  return sunCache || {};
}
async function tickClock() {
  if (!HA_API) return;
  const t = await today().catch(() => null);
  const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
  if (NOW_SENSOR) {
    let st = "No class", attrs = { class: null, step: null, until: null, next: null, next_at: null };
    if (t && t.list.length) {
      const live = t.list.find(x => m >= x.start && m < x.end), next = t.list.find(x => x.start > m);
      if (live) {
        const kind = (live.d && live.d.kind) || live.c.kind, rail = (t.school.rails || {})[kind] || [];
        const off = m - live.start, seg = rail.find(s => off >= s.from && off < s.to);
        st = seg ? `${live.c.name} · ${seg.name} until ${clock(live.start + seg.to)}` : `${live.c.name} until ${clock(live.end)}`;
        attrs = { ...attrs, class: live.c.name, focus: live.d && live.d.focus || null, step: seg ? seg.name : null, until: clock(seg ? live.start + seg.to : live.end) };
      } else if (next) st = `Next: ${next.c.name} at ${clock(next.start)}`;
      else st = "Done for the day";
      if (next) attrs = { ...attrs, next: next.c.name, next_at: clock(next.start) };
    }
    const body = { state: st.slice(0, 250), attributes: { friendly_name: "Bell to Bell now", icon: "mdi:bell-ring-outline", ...attrs } };
    const sig = JSON.stringify(body);
    if (sig !== lastSensor || Date.now() - lastSensorAt > 600e3) {
      try { await ha("POST", "/states/" + NOW_SENSOR, body); lastSensor = sig; lastSensorAt = Date.now(); } catch (e) { console.error("sensor", e.message); }
    }
  }
  if (BELL_NOTIFY.length && t) for (const x of t.list) {
    const key = todayISO() + x.k;
    if (rung.has(key) || m !== x.start - BELL_MIN) continue;
    rung.add(key);
    const hw = await homeworkLine(x.c.course, todayISO()).catch(() => "");
    const message = String((x.d && x.d.focus) || x.c.name).replace(/<[^>]+>/g, "") + (hw ? "\n" + hw : "");
    for (const svc of BELL_NOTIFY) ha("POST", "/services/notify/" + svc, {
      title: `${x.c.name} in ${BELL_MIN} min`, message, data: { tag: "btb-bell" } })
      .catch(e => console.error("notify", e.message));
  }
}

/* ---------------- routes ---------------- */
async function handle(req, res) {
  const ip = (req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  if (INGRESS_ONLY && ip !== INGRESS_IP) return send(res, 403, { error: "ingress_only" });
  const url = new URL(req.url, "http://x");
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const by = who(req);

  if (req.method === "GET" && (p === "/" || p === "/index.html")) return send(res, 200, PAGE, "text/html; charset=utf-8");
  if (req.method === "GET" && p === "/app.js") return send(res, 200, APPJS, "text/javascript; charset=utf-8");
  if (req.method === "GET" && p === "/api/rev") return send(res, 200, { rev: mounted() ? await revision() : null, now: Date.now() });
  if (req.method === "GET" && p === "/api/sun") return send(res, 200, await sun());
  if (req.method === "GET" && p === "/api/state") return send(res, 200, await state(url.searchParams.has("week") ? +url.searchParams.get("week") : null));
  if (req.method === "GET" && p === "/api/file") {
    const abs = safePath(url.searchParams.get("p"));
    const ext = abs && path.extname(abs).slice(1).toLowerCase();
    if (!abs || !FILE_TYPES[ext]) return send(res, 400, { error: "bad_path" });
    try { return send(res, 200, await fs.readFile(abs), FILE_TYPES[ext], { "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(path.basename(abs))}` }); } catch { return send(res, 404, { error: "not_found" }); }
  }
  if (req.method !== "GET" && !mounted()) return send(res, 503, { error: "not_mounted" });

  if (req.method === "POST" && p === "/api/marks") { const b = await body(req); return send(res, 200, { ok: true, results: await markOps(b.ops, by) }); }
  if (req.method === "POST" && p === "/api/column") return send(res, 200, { ok: true, doc: await columnPatch(await body(req)) });
  if (req.method === "POST" && p === "/api/hw") return send(res, 200, { ok: true, col: await addHomework(await body(req), by) });
  if (req.method === "POST" && p === "/api/xt") return send(res, 200, { ok: true, col: await ensureExitTicket(await body(req)) });
  if (req.method === "PUT" && p === "/api/profile") return send(res, 200, await profilePut(await body(req), by));
  if (req.method === "POST" && p === "/api/prep") return send(res, 200, { ok: true, prep: await prepTick(await body(req)) });
  if (req.method === "POST" && p === "/api/override") return send(res, 200, { ok: true, overrides: await override(await body(req)) });
  if (req.method === "POST" && p === "/api/request") return send(res, 200, { ok: true, requests: await request(await body(req), by) });
  if (req.method === "POST" && p === "/api/scan") { const name = await scan(req); await log({ by, did: "scanned", what: name, n: 1 }); return send(res, 200, { ok: true, name }); }
  send(res, 404, { error: "not_found" });
}

setInterval(() => tickClock().catch(() => {}), 30e3); setTimeout(() => tickClock().catch(() => {}), 3000);
http.createServer((req, res) => {
  handle(req, res).catch(e => {
    console.error(new Date().toISOString(), req.method, req.url.split("?")[0], e.message);
    if (!res.headersSent) send(res, [400, 404, 413].includes(e.code) ? e.code : 500, { error: e.message });
  });
}).listen(PORT, () => console.log(`Bell to Bell on :${PORT}; data folder ${mounted() ? "found" : "NOT FOUND - is the network storage mounted?"}; sensor ${HA_API && NOW_SENSOR ? "on" : "off"}; bell heads-up ${BELL_NOTIFY.length ? "on" : "off"}`));
