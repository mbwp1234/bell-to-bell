"use strict";
/* Bell to Bell — the day's plan and the gradebook, one page.
   Everything shown comes from /api/state; every change is one small call that the server
   writes to the data folder. Marks are queued on the device first so nothing is lost when
   the folder or the Wi-Fi is away. */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Plans may use <b>, <strong>, <em>. Nothing else survives.
const rich = s => esc(s).replace(/&lt;(\/?)(b|strong|em)&gt;/g, "<$1$2>");
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
const desk = () => window.matchMedia("(min-width: 900px)").matches;
const DAYKEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const mins = h => { const m = String(h || "").match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
const clock = m => (Math.floor(m / 60) % 12 || 12) + ":" + String(m % 60).padStart(2, "0");
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const isoOf = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const dark = () => document.documentElement.dataset.theme === "night";
const ccol = c => (Array.isArray(c && c.color) ? c.color[dark() ? 1 : 0] : (c && c.color)) || "var(--accent)";

const I = {
  today: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
  week: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  grades: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="7" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="6" cy="15" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="18" cy="15" r="2"/></svg>',
  students: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  l: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  r: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>',
  copy: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
  open: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
  folder: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  cam: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  theme: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  eye: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeoff: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.3 6.3C3.6 8 2 12 2 12s3.5 7 10 7a10 10 0 0 0 5.7-1.7"/></svg>'
};

/* ---------------------------------------------------------------- state */
const S = {
  d: null, view: "today", day: null, cls: null, course: null, sid: null, cid: null, back: null,
  gmode: LS.get("btb.gmode", "all"), gweek: null, sel: null, buf: "", sheet: null,
  filter: "all", sort: "name", showAll: false, wtab: "plan", lib: "games", week: null,
  gradesOpen: LS.get("btb.grades", "0") === "1", editProfile: false, akind: LS.get("btb.akind", "all"), amiss: false,
  q: [], flushing: false, save: "saved", savedAt: null, undo: [], conflicts: [], pending: false, lastLive: undefined, error: null
};
try { S.q = JSON.parse(LS.get("btb.q", "[]")) || []; } catch { S.q = []; }
const saveQ = () => LS.set("btb.q", JSON.stringify(S.q));

async function api(method, p, body, headers = {}) {
  const bin = body instanceof ArrayBuffer;
  const r = await fetch(p, { method, cache: "no-store",
    headers: bin ? headers : { "content-type": "application/json", ...headers },
    body: body == null ? undefined : bin ? body : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "http " + r.status), { status: r.status, body: j });
  return j;
}
async function load() {
  try {
    const j = await api("GET", "api/state" + (S.week != null ? "?week=" + S.week : ""));
    S.d = j; S.error = null;
    if (!j.ok) { S.save = "ro"; render(); return; }
    if (S.save === "ro") S.save = "saved";
    for (const o of S.q) localApply(o);        // edits still waiting must not appear undone
    if (S.day == null || !planDays().some(d => d.key === S.day)) S.day = todayKey() || (planDays()[0] || {}).key || DAYKEYS[new Date().getDay()];
    if (!S.cls || !dayList(S.day).some(x => x.k === S.cls)) S.cls = defaultCls(S.day);
    if (!S.course || !S.d.courses[S.course]) S.course = defaultCourse();
    S.pending = false;
    render();
  } catch (e) { S.error = e.message; if (!S.d) renderProblem(); }
}

/* ---------------------------------------------------------------- schedule */
const school = () => (S.d && S.d.school) || {};
const plan = () => (S.d && S.d.plan) || null;
const planDays = () => (plan() && plan().days) || [];
function todayKey() { const t = isoOf(); const d = planDays().find(x => x.iso === t); return d ? d.key : null; }
const isToday = day => day === todayKey();
function dayList(day) {
  return Object.entries(school().classes || {})
    .filter(([, c]) => (c.meets || []).includes(day) && mins(c.start) != null)
    .map(([k, c]) => ({ k, c, start: mins(c.start), end: mins(c.start) + (+c.len || 45) }))
    .sort((a, b) => a.start - b.start);
}
const planDay = (k, day) => { const p = plan(); return (p && p.classes && p.classes[k] && p.classes[k].days && p.classes[k].days[day]) || null; };
const planUnit = k => { const p = plan(); return (p && p.classes && p.classes[k] && p.classes[k].unit) || ""; };
function liveInfo(day) {
  if (!isToday(day)) return { live: null, next: null };
  const m = nowMin(), list = dayList(day);
  return { live: list.find(x => m >= x.start && m < x.end) || null, next: list.find(x => x.start > m) || null };
}
function defaultCls(day) {
  const list = dayList(day); if (!list.length) return null;
  const { live, next } = liveInfo(day);
  return (live || next || list[0]).k;
}
function defaultCourse() {
  const cs = Object.keys((S.d && S.d.courses) || {}); if (!cs.length) return null;
  const day = todayKey(), li = day ? liveInfo(day) : {};
  const k = (li.live || li.next || {}).k, c = k && school().classes[k];
  return c && c.course && S.d.courses[c.course] ? c.course : cs[0];
}
function rail(c, d) {
  const kind = (d && d.kind) || c.kind;
  const r = (school().rails || {})[kind];
  return r && r.length ? r : [{ k: "class", from: 0, to: +c.len || 45, name: "Class", tag: "" }];
}
const overrideOf = (cls, day) => (S.d.overrides || {})[`week-${S.d.week}/${cls}/${day}`] || null;
// Handouts for one class on one day: the day's own folder when the plan names one, else the
// class's week folder. `copies` is every folder worth copying, nearest first, without repeats.
function handFor(k, day) {
  const h = (S.d.handouts || {})[k]; if (!h) return null;
  const own = h.days && h.days[day], cur = own || h, wk = /\{week\}/.test(((school().classes || {})[k] || {}).folder || "");
  const copies = [];
  const add = (dir, label) => { if (dir && !copies.some(c => c.dir === dir)) copies.push({ dir, label }); };
  add(cur.dir, own ? "Today's folder" : wk ? `Week ${S.d.week} folder` : "Class folder");
  if (own) add(h.dir, wk ? `Week ${S.d.week} folder` : "Class folder");
  add(h.base, "Class folder");
  return { dir: cur.dir, files: cur.files || [], missing: !!cur.missing, copies };
}
// The path as the teacher's own computer sees it, from school.json's `folderRoot`.
function folderPath(dir) {
  const root = String(school().folderRoot || "").replace(/[\\/]+$/, "");
  if (!root) return dir;
  return root.includes("\\") ? root + "\\" + dir.replace(/\//g, "\\") : root + "/" + dir;
}
async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch {}
  try { const ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok; } catch { return false; }
}
const gameFor = (cls, day, d) => { const o = overrideOf(cls, day); const key = (o && o.warmup) || (d && d.warmup); return key ? { key, g: (school().games || {})[key], swapped: !!o } : null; };

/* ---------------------------------------------------------------- gradebook */
const courseOf = id => (S.d.courses || {})[id] || null;
const isComp = col => col.kind === "HW" || col.kind === "XP";
const counts = col => !isComp(col) && col.kind !== "XT";
const colX = col => !!(S.d.marks[col.id] || {}).excused;
const mark = (cid, sid) => (((S.d.marks[cid] || {}).students) || {})[sid] || null;
const hashOf = (cid, sid) => ((S.d.hashes || {})[cid] || {})[sid] || "none";
const isScored = m => !!m && (m.status === "scored" || m.status === "late");
const pct = (m, col) => { const o = m.outOf || col.outOf; return m.pts == null || !o ? null : 100 * m.pts / o; };
const fmt = x => x == null ? "—" : String(Math.round(x));
const band = a => a >= 90 ? 1 : a >= 80 ? 2 : a >= 70 ? 3 : a >= 60 ? 4 : 5;
const first = n => String(n || "").split(" ")[0];
const short = t => { t = String(t || "").replace(/^Sub\s*[\d/]*\s*·\s*/, ""); return t.length > 18 ? t.slice(0, 17) + "…" : t; };
const KIND = { CW: "Classwork", HW: "Homework", XP: "Extra practice", SUB: "Sub day", TEST: "Test", XT: "Exit ticket" };
const LABEL = { scored: "Scored", late: "Scored", missing: "Missing", absent: "Absent", excused: "Excused", nopage: "Not sorted", done: "Done", partial: "Partial", notin: "Not in" };
const weeksOf = c => [...new Set(c.columns.map(x => x.week).filter(w => w != null))].sort((a, b) => a - b);
const isClaude = m => !!m && m.by === "claude" && !m.checked;

function weekTopic(c, w) {
  const col = c.columns.find(x => x.week === w && x.kind === "CW") || c.columns.find(x => x.week === w && counts(x)) || c.columns.find(x => x.week === w);
  return col ? short(col.title) : "";
}
function mainCol(c, w) { return c.columns.find(x => x.week === w && x.kind === "CW") || c.columns.find(x => x.week === w && counts(x)) || c.columns.find(x => x.week === w); }
function weekCell(c, sid, w) {
  let pts = 0, out = 0, full = 0, miss = false, abs = false, hwDone = 0, hwNot = 0, claude = false;
  for (const col of c.columns) {
    if (col.week !== w || colX(col)) continue;
    const m = mark(col.id, sid);
    if (isClaude(m)) claude = true;
    if (col.kind === "HW") { if (!m) continue; if (m.status === "notin") hwNot++; else if (m.status === "done" || m.status === "partial") hwDone++; continue; }
    if (!counts(col) || !m) continue;
    if (isScored(m) && m.pts != null) { const o = m.outOf || col.outOf; if (o) { pts += m.pts; out += o; full += Math.max(col.outOf || o, o); } }
    else if (m.status === "missing") miss = true; else if (m.status === "absent") abs = true;
  }
  return { acc: out ? 100 * pts / out : null, att: full ? Math.min(100, 100 * out / full) : null, miss, abs, claude, hw: hwNot ? "notin" : hwDone ? "done" : "" };
}
function sheetsFor(c, sid) {
  const r = [];
  for (const col of c.columns) {
    if (!counts(col) || colX(col)) continue;
    const m = mark(col.id, sid); if (!m) continue;
    r.push({ col, m, p: isScored(m) ? pct(m, col) : null, att: isScored(m) && col.outOf ? Math.min(100, 100 * (m.outOf || col.outOf) / col.outOf) : null });
  }
  return r;
}
function stats(c, sid) {
  const sh = sheetsFor(c, sid).filter(x => x.p != null);
  const avg = sh.length ? sh.reduce((a, b) => a + b.p, 0) / sh.length : null;
  const att = sh.length ? sh.reduce((a, b) => a + (b.att ?? 0), 0) / sh.length : null;
  const wk = weeksOf(c).map(w => weekCell(c, sid, w).acc).filter(x => x != null);
  let trend = 0;
  if (wk.length >= 4) { const k = Math.min(3, Math.floor(wk.length / 2)); trend = wk.slice(-k).reduce((a, b) => a + b, 0) / k - wk.slice(0, k).reduce((a, b) => a + b, 0) / k; }
  let miss = 0, owed = 0, hwd = 0, hwn = 0;
  for (const col of c.columns) {
    if (colX(col)) continue;
    const m = mark(col.id, sid); if (!m) continue;
    if (counts(col) && m.status === "missing") miss++;
    if (m.status === "absent") owed++;
    if (col.kind === "HW") { if (m.status === "done" || m.status === "partial") hwd++; if (["done", "partial", "notin"].includes(m.status)) hwn++; }
  }
  return { avg, att, n: sh.length, trend, miss, owed, hw: hwn ? hwd + " of " + hwn : "—", last: sh.length ? sh[sh.length - 1] : null, weeks: wk };
}
const trendTxt = t => t > 4 ? ["↗ Improving", ""] : t < -4 ? ["↘ Slipping", "low"] : ["→ Steady", "muted"];
function needs(c) {
  const out = [], recent = weeksOf(c).slice(-2);
  for (const st of c.students) {
    const bits = [];
    const missCols = c.columns.filter(col => !colX(col) && counts(col) && (mark(col.id, st.id) || {}).status === "missing");
    if (missCols.length) bits.push(missCols.length + " missing");
    const last = sheetsFor(c, st.id).filter(s => s.p != null).slice(-1)[0];
    if (last && last.p < 60) bits.push(Math.round(last.p) + "% on " + short(last.col.title));
    const hwN = c.columns.filter(col => col.kind === "HW" && !colX(col) && recent.includes(col.week) && (mark(col.id, st.id) || {}).status === "notin");
    if (hwN.length) bits.push("homework not in");
    if (bits.length) out.push({ sid: st.id, name: first(st.name), txt: bits.join(", "), w: missCols.length * 2 + (last && last.p < 60 ? 2 : 0) + hwN.length });
  }
  return out.sort((a, b) => b.w - a.w);
}
function claudeOpen(courseId) {
  const out = [];
  for (const [cid, c] of Object.entries(S.d.courses || {})) {
    if (courseId && cid !== courseId) continue;
    for (const col of c.columns) for (const st of c.students) { const m = mark(col.id, st.id); if (isClaude(m)) out.push({ course: cid, c, col, st, m }); }
  }
  return out;
}
function classStats(c) {
  const st = c.students.map(s => stats(c, s.id)).filter(x => x.avg != null);
  return { acc: st.length ? st.reduce((a, x) => a + x.avg, 0) / st.length : null, att: st.length ? st.reduce((a, x) => a + (x.att ?? 0), 0) / st.length : null };
}

/* grading:start — the grade that counts. Pure: it reads only mark(), colX(), isScored() and
   school(), so the smoke test runs this block on its own.
   Tests and homework are the two categories (school.json `grading`, default 60 / 40).
   A test is points over the WHOLE test (the larger of the column's and the mark's outOf), summed
   across tests, so a longer test weighs more. A homework is completion (done 1, partial ½,
   not in 0) mixed with accuracy (pts / outOf) 70 / 30 — but only when it has a score; one with
   no score counts on completion alone. Absent, excused, nopage and unmarked are left out, never
   zero. A missing test is left out of the average and counted as missing instead.
   Worksheets, sub days, extra practice and exit tickets are shown but never counted. */
function weights() {
  const g = school().grading || {}, n = (v, d) => Number.isFinite(+v) && v !== null && v !== "" && +v >= 0 ? +v : d;
  return { tests: n(g.tests, 60), homework: n(g.homework, 40), completion: n(g.completion, 70), accuracy: n(g.accuracy, 30) };
}
const COMP = { done: 1, partial: 0.5, notin: 0 };
function hwPart(m, col) {
  if (!m || COMP[m.status] == null) return null;
  const o = m.outOf || col.outOf, w = weights();
  const acc = m.status !== "notin" && m.pts != null && o ? Math.min(1, m.pts / o) : null;
  const score = acc == null || !(w.completion + w.accuracy) ? COMP[m.status] : (w.completion * COMP[m.status] + w.accuracy * acc) / (w.completion + w.accuracy);
  return { comp: COMP[m.status], acc, score };
}
function testPts(m, col) {
  if (!isScored(m) || m.pts == null) return null;
  const o = Math.max(+col.outOf || 0, +m.outOf || 0);
  return o ? { pts: Math.min(m.pts, o), outOf: o } : null;
}
const testPct = (m, col) => { const t = testPts(m, col); return t ? 100 * t.pts / t.outOf : null; };
function grade(c, sid) {
  let tp = 0, to = 0, nT = 0;
  const hw = [], comp = [], acc = [];
  for (const col of c.columns) {
    if (colX(col)) continue;
    const m = mark(col.id, sid);
    if (col.kind === "TEST") { const t = testPts(m, col); if (t) { tp += t.pts; to += t.outOf; nT++; } }
    else if (col.kind === "HW") { const x = hwPart(m, col); if (x) { hw.push(100 * x.score); comp.push(100 * x.comp); if (x.acc != null) acc.push(100 * x.acc); } }
  }
  const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  const w = weights(), tests = to ? 100 * tp / to : null, homework = avg(hw);
  const parts = [[tests, w.tests], [homework, w.homework]].filter(([v, wt]) => v != null && wt > 0);
  const den = parts.reduce((s, [, wt]) => s + wt, 0);
  return { grade: den ? parts.reduce((s, [v, wt]) => s + v * wt, 0) / den : null, tests, nTests: nT, homework, nHw: hw.length, comp: avg(comp), acc: avg(acc), nAcc: acc.length };
}
function classGrade(c) {
  const g = c.students.map(s => grade(c, s.id)), mean = k => { const v = g.map(x => x[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return { grade: mean("grade"), tests: mean("tests"), homework: mean("homework"), n: g.filter(x => x.grade != null).length };
}
/* grading:end */
// What each student owes: missing tests, worksheets and sub-day sheets, and homework not in.
function missingFor(c, sid) {
  return c.columns.filter(col => !colX(col) && col.kind !== "XT" && col.kind !== "XP").filter(col => {
    const s = (mark(col.id, sid) || {}).status; return s === "missing" || (col.kind === "HW" && s === "notin");
  });
}
const slipping = c => c.students.map(s => ({ s, x: stats(c, s.id) })).filter(r => r.x.n >= 4 && r.x.trend < -4).sort((a, b) => a.x.trend - b.x.trend);
const wtxt = () => { const w = weights(); return `tests ${w.tests} · homework ${w.homework} (${w.completion}% done, ${w.accuracy}% right)`; };

/* ---------------------------------------------------------------- homework */
// A homework column carries `assigned` (handed out) and `due` (collected). Today prompts for
// both, and for anything from the last two weeks that is still out or was never checked in.
const isoAdd = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoOf(d); };
const dayIso = day => (planDays().find(x => x.key === day) || {}).iso || null;
const niceDate = iso => new Date(iso + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
function dueTxt(due, from) {
  if (!due) return "no due date";
  if (due === from) return "due today";
  if (due === isoAdd(from, 1)) return "due tomorrow";
  return "due " + niceDate(due);
}
function nextMeet(k, iso) {
  const c = (school().classes || {})[k]; if (!c) return isoAdd(iso, 1);
  for (let i = 1; i <= 14; i++) { const d = isoAdd(iso, i); if ((c.meets || []).includes(DAYKEYS[new Date(d + "T12:00:00").getDay()])) return d; }
  return isoAdd(iso, 1);
}
function hwTally(c, col) {
  const t = { done: 0, partial: 0, notin: 0, absent: 0, excused: 0, marked: 0, out: [] };
  for (const s of c.students) { const m = mark(col.id, s.id); if (!m || t[m.status] == null) continue; t[m.status]++; t.marked++; if (m.status === "notin") t.out.push(s); }
  return t;
}
function hwFor(k, day) {
  const cl = (school().classes || {})[k], cid = cl && cl.course, c = cid && courseOf(cid), iso = dayIso(day);
  if (!c || !iso) return null;
  const cols = c.columns.filter(x => isComp(x) && !colX(x));
  const collect = cols.filter(x => x.due === iso).map(col => ({ col, t: hwTally(c, col) }));
  const assign = cols.filter(x => x.assigned === iso);
  const owed = cols.filter(x => x.due && x.due < iso && x.due >= isoAdd(iso, -14)).map(col => ({ col, t: hwTally(c, col) })).filter(o => o.t.notin || !o.t.marked);
  return { cid, c, iso, collect, assign, owed };
}
function hwBox(k, day, showNames) {
  const h = hwFor(k, day); if (!h) return "";
  const ro = S.save === "ro" ? " disabled" : "";
  const rows = [];
  for (const { col, t } of h.collect) rows.push(`<div class="hwr"><div><span class="hwk">Collect</span> <button class="link hwtl" data-act="hwedit" data-cid="${col.id}" title="Edit this homework">${esc(col.title)}</button><div class="small muted">${t.marked ? `${t.marked} of ${h.c.students.length} checked in` : "Nobody checked in yet"}${t.notin ? ` · ${t.notin} not in` : ""}</div></div><button class="btn sunk" data-act="hwin" data-cid="${col.id}"${ro}>${I.check}Check in</button></div>`);
  for (const col of h.assign) rows.push(`<div class="hwr"><div><span class="hwk">Hand out</span> <button class="link hwtl" data-act="hwedit" data-cid="${col.id}" title="Edit this homework">${esc(col.title)}</button><div class="small muted">${esc(dueTxt(col.due, h.iso))}</div></div><button class="btn sunk" data-act="hwedit" data-cid="${col.id}"${ro}>Edit</button></div>`);
  for (const { col, t } of h.owed) {
    const who = !t.marked ? "Never checked in" : showNames ? t.out.map(s => esc(first(s.name))).join(", ") + " not in" : `${t.notin} not in`;
    rows.push(`<div class="hwr owed"><div><span class="hwk">Still out</span> <button class="link hwtl" data-act="hwedit" data-cid="${col.id}" title="Edit this homework">${esc(col.title)}</button><div class="small">${who} · was ${esc(dueTxt(col.due, h.iso))}</div></div><button class="btn sunk" data-act="hwin" data-cid="${col.id}"${ro}>Check in</button></div>`);
  }
  return `<div class="hwbox noprint"><div class="row" style="justify-content:space-between"><div class="n">Homework</div><button class="link small" data-act="hwnew" data-cls="${k}"${ro}>+ Set homework</button></div>
    ${rows.join("") || '<div class="small muted" style="margin-top:4px">Nothing to collect or hand out.</div>'}</div>`;
}

/* ---------------------------------------------------------------- saving */
// Local copy of the server's rule, so the screen changes before the network answers.
function localApply(o) {
  const doc = S.d.marks[o.col] || (S.d.marks[o.col] = { students: {} });
  if (!doc.students) doc.students = {};
  if (o.del) { delete doc.students[o.sid]; return; }
  const next = { ...(doc.students[o.sid] || {}) };
  for (const [k, v] of Object.entries(o.patch)) { if (v === null || (k === "note" && v === "")) delete next[k]; else next[k] = v; }
  if (!Object.keys(o.patch).every(k => k === "checked")) { next.by = "teacher"; next.checked = true; delete next.proposed; delete next.conf; }
  doc.students[o.sid] = next;
}
let savingTimer = null;
function setSave(s) {
  S.save = s; clearTimeout(savingTimer);
  if (s === "saved") S.savedAt = new Date();
  const el = document.getElementById("savepill"); if (el) el.outerHTML = savePill();
}
function savePill() {
  const n = S.q.length;
  const [cls, txt] = S.save === "ro" ? ["ro", "Can't reach the folder"] : S.save === "waiting" ? ["waiting", n + " change" + (n === 1 ? "" : "s") + " waiting"]
    : S.save === "saving" ? ["saving", "Saving…"] : ["ok", S.savedAt ? "Saved · " + S.savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "Saved"];
  return `<span class="save ${cls}" id="savepill" role="status"><i></i>${esc(txt)}</span>`;
}
function writeMark(col, sid, patch, opt = {}) {
  if (S.save === "ro") { toast("The folder isn't reachable, so editing is off."); return; }
  const prev = mark(col.id, sid);
  const o = { col: col.id, sid, patch: { ...patch }, del: !!opt.del, force: !!opt.force };
  const q = S.q.find(x => x.col === o.col && x.sid === o.sid && !x.inflight);
  if (q) { if (o.del) { q.del = true; q.patch = {}; } else { q.del = false; Object.assign(q.patch, o.patch); } q.force = q.force || o.force; }
  else S.q.push({ ...o, base: hashOf(o.col, sid) });
  localApply(o); saveQ();
  if (!opt.noUndo) { S.undo.push({ col: col.id, sid, prev: prev ? { ...prev } : null }); if (S.undo.length > 50) S.undo.shift(); }
  if (opt.toast) toast(opt.toast, true);
  render(); flush();
}
function writeMany(items) {           // [{col, sid, patch}] as one batch, e.g. accept all
  for (const it of items) writeMark(it.col, it.sid, it.patch, { noUndo: true });
}
async function flush() {
  if (S.flushing || !S.q.length) { if (!S.q.length && S.save !== "ro") setSave("saved"); return; }
  S.flushing = true;
  const batch = S.q.slice(); batch.forEach(x => x.inflight = true);
  clearTimeout(savingTimer); savingTimer = setTimeout(() => { if (S.flushing) setSave("saving"); }, 400);
  try {
    const j = await api("POST", "api/marks", { ops: batch.map(({ col, sid, patch, base, force, del }) => ({ col, sid, patch, base, force, del })) });
    S.q = S.q.filter(x => !batch.includes(x)); saveQ();
    for (const r of j.results) {
      const h = (S.d.hashes[r.col] = S.d.hashes[r.col] || {});
      if (r.ok) { h[r.sid] = r.hash; const doc = S.d.marks[r.col] || (S.d.marks[r.col] = { students: {} }); if (r.mark) doc.students[r.sid] = r.mark; else delete doc.students[r.sid]; }
      else if (r.conflict) { const mine = batch.find(x => x.col === r.col && x.sid === r.sid); S.conflicts.push({ ...r, mine }); h[r.sid] = r.hash; }
    }
    S.flushing = false;
    if (S.q.length) return flush();
    setSave("saved");
    if (S.conflicts.length && !S.sheet) openSheet({ t: "conflict" });
  } catch (e) {
    batch.forEach(x => delete x.inflight); S.flushing = false;
    if (e.status === 503) { setSave("ro"); return; }
    if (e.status === 400) { S.q = S.q.filter(x => !batch.includes(x)); saveQ(); toast("That change was refused: " + e.message); load(); return; }
    setSave("waiting"); setTimeout(flush, 5000);
  }
}
window.addEventListener("online", flush);
function undo() {
  const u = S.undo.pop(); if (!u) { toast("Nothing to undo"); return; }
  const c = Object.values(S.d.courses).find(c => c.columns.some(x => x.id === u.col));
  const col = c && c.columns.find(x => x.id === u.col); if (!col) return;
  if (!u.prev) writeMark(col, u.sid, {}, { del: true, noUndo: true, force: true });
  else {
    const p = {}; for (const k of ["status", "pts", "outOf", "inc", "note", "r", "checked"]) p[k] = k in u.prev ? u.prev[k] : (k === "note" ? "" : k === "inc" || k === "checked" ? false : null);
    writeMark(col, u.sid, p, { noUndo: true, force: true });
  }
  toast("Undone");
}
async function post(path, body, ok) {
  if (S.save === "ro") { toast("The folder isn't reachable, so editing is off."); return null; }
  try { setSave("saving"); const j = await api("POST", path, body); setSave("saved"); if (ok) ok(j); return j; }
  catch (e) { setSave(e.status === 503 ? "ro" : "saved"); toast(e.status === 503 ? "The folder isn't reachable." : "Couldn't save: " + e.message); return null; }
}

/* ---------------------------------------------------------------- toast */
let toastTimer = null;
function toast(msg, withUndo) {
  clearTimeout(toastTimer);
  $("#toasthost").innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${withUndo ? '<button data-act="undo">Undo</button>' : ""}</div>`;
  toastTimer = setTimeout(() => { $("#toasthost").innerHTML = ""; }, withUndo ? 6000 : 3500);
}

/* ---------------------------------------------------------------- shell */
function head(o) {
  const nOpen = S.d.ok ? claudeOpen().length + (S.d.requests || []).filter(r => r.status !== "done").length : 0;
  return `<header class="top">
    <div class="ttl">${o.back ? `<button class="link noprint" data-act="go" data-v="${o.back[0]}">← ${esc(o.back[1])}</button>` : ""}
      <div class="eyebrow">${o.eyebrow || ""}</div>
      <h1>${o.dot ? `<span class="cdot" style="background:${o.dot}"></span>` : ""}${o.title}</h1>
      ${o.lede ? `<p class="lede">${o.lede}</p>` : ""}</div>
    <div class="tools">
      <nav class="seg dnav" aria-label="Sections">${[["today", "Today"], ["week", "Week"], ["grades", "Grades"], ["students", "Students"]].map(([v, t]) =>
        `<button data-act="go" data-v="${v}" aria-pressed="${tabOf(S.view) === v}">${t}</button>`).join("")}</nav>
      ${desk() && nOpen ? `<button class="btn" data-act="go" data-v="review"><span class="dia"></span>From Claude · ${nOpen}</button>` : ""}
      ${o.tools || ""}${themeBtn()}${savePill()}
    </div></header>`;
}
const THEMES = ["auto", "light", "dim", "night"], THEME_NAME = { auto: "Auto", light: "Light", dim: "Dim", night: "Night" };
function themeBtn() {
  const m = window.btbTheme ? btbTheme.mode() : "auto", now = document.documentElement.dataset.theme;
  const tip = m === "auto" ? `Theme: auto, ${THEME_NAME[now] || ""} now. Tap to change` : `Theme: ${THEME_NAME[m]}. Tap to change`;
  return `<button class="btn themeb noprint" data-act="theme" aria-label="${tip}" title="${tip}">${I.theme}${THEME_NAME[m] || "Auto"}</button>`;
}
// Re-pick the theme; course colours depend on it, so a change re-renders.
function retheme() { if (window.btbTheme && btbTheme.apply() && S.d) render(); }
async function fetchSun() {
  try { const j = await api("GET", "api/sun"); if (j && j.state) LS.set("btb.sun", JSON.stringify(j)); } catch {}
  retheme();
}
const tabOf = v => ({ student: "students", sheet: "grades", review: "grades" }[v] || v);
function renderTabs() {
  $("#tabbar").innerHTML = [["today", "Today"], ["week", "Week"], ["grades", "Grades"], ["students", "Students"]].map(([v, t]) =>
    `<button data-act="go" data-v="${v}" ${tabOf(S.view) === v ? 'aria-current="page"' : ""}>${I[v]}${t}</button>`).join("");
}
function renderProblem() {
  const msg = S.d && S.d.error === "not_mounted"
    ? `<h1 style="justify-content:center">Can't reach the folder</h1><p class="lede" style="margin:10px auto">The app reads everything from its data folder on your network storage, and that folder isn't there right now. In Home Assistant, check <b>Settings › System › Storage</b> that the network storage is connected, then reload.</p>`
    : `<h1 style="justify-content:center">Couldn't load</h1><p class="lede" style="margin:10px auto">${esc(S.error || "")}</p>`;
  $("#app").innerHTML = `<div class="problem">${msg}<button class="btn primary" data-act="reload" style="margin-top:14px">Try again</button></div>`;
  $("#tabbar").innerHTML = "";
}
function render() {
  if (!S.d || !S.d.ok) return renderProblem();
  const views = { today: viewToday, week: viewWeek, grades: viewGrades, students: viewStudents, student: viewStudent, sheet: viewSheet, review: viewReview };
  if (!views[S.view]) S.view = "today";
  if (S.view === "student" && !findStudent(S.sid)) S.view = "students";
  if (S.view === "sheet" && !findCol(S.cid)) S.view = "grades";
  const scrolls = [...document.querySelectorAll("[data-keepx]")].map(el => [el.dataset.keepx, el.scrollLeft]);
  $("#app").innerHTML = views[S.view]();
  for (const [k, x] of scrolls) { const el = document.querySelector(`[data-keepx="${k}"]`); if (el) el.scrollLeft = x; }
  document.querySelectorAll("[data-endx]").forEach(el => { if (!scrolls.some(s => s[0] === el.dataset.keepx)) el.scrollLeft = el.scrollWidth; });
  renderTabs();
  if (!sheetBusy()) renderSheet();
  try { history.replaceState(null, "", "#" + [S.view, S.course || "", S.sid || S.cid || ""].join("/")); } catch {}
}
function findStudent(sid) { for (const [cid, c] of Object.entries(S.d.courses || {})) { const s = c.students.find(x => x.id === sid); if (s) return { cid, c, s }; } return null; }
function findCol(id) { for (const [cid, c] of Object.entries(S.d.courses || {})) { const col = c.columns.find(x => x.id === id); if (col) return { cid, c, col }; } return null; }
const busyIn = sel => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== "checkbox" && !!a.closest(sel); };
const sheetBusy = () => busyIn("#sheethost");

/* ---------------------------------------------------------------- today */
function viewToday() {
  const p = plan(), days = planDays();
  const list = dayList(S.day);
  const dayMeta = days.find(d => d.key === S.day) || { label: S.day, date: "" };
  const li = liveInfo(S.day);
  const it = list.find(x => x.k === S.cls) || null;
  const daysBar = days.length ? `<div class="days" role="group" aria-label="Day">${days.map(d =>
    `<button data-act="day" data-v="${d.key}" aria-pressed="${d.key === S.day}" class="${isToday(d.key) ? "today" : ""}">${esc(d.label)}<small>${esc(d.date || "")}</small></button>`).join("")}</div>` : "";
  const strip = list.length ? `<div class="strip" role="group" aria-label="Classes">${list.map(x => {
    const live = li.live && li.live.k === x.k, hw = hwFor(x.k, S.day), hwn = hw ? hw.collect.length + hw.assign.length : 0;
    return `<button class="pill${live ? " live" : ""}" data-act="cls" data-v="${x.k}" aria-pressed="${x.k === S.cls && !live}"><span class="a">${clock(x.start)}${live ? " · now" : ""}${hwn ? ' · <span class="hwt">HW</span>' : ""}</span><span class="b"><span class="cdot" style="background:${ccol(x.c)}"></span>${esc(x.c.short || x.c.name)}</span></button>`;
  }).join("")}</div>` : "";

  if (!p) return head({ eyebrow: "No plan", title: "Nothing planned yet", lede: "There's no week file in the Plans folder for this week. Ask Claude to plan it." }) + reqBox("week", "This week", "What should this week cover?");
  if (!it) return head({ eyebrow: `${esc(dayMeta.label)} · ${esc(p.label || "")}`, title: "No classes", lede: "Nothing meets on this day." }) + daysBar;

  const d = planDay(it.k, S.day) || {};
  const course = it.c.course && courseOf(it.c.course) ? it.c.course : null;
  const live = li.live && li.live.k === it.k;
  const segs = rail(it.c, d), off = nowMin() - it.start;
  const segNow = live ? segs.find(s => off >= s.from && off < s.to) : null;
  let lede = "";
  if (live) lede = segNow ? `${esc(segNow.name)} until <b class="live">${clock(it.start + segNow.to)}</b>.` : `Until <b class="live">${clock(it.end)}</b>.`;
  else if (isToday(S.day) && nowMin() < it.start) lede = `Starts at ${clock(it.start)}.`;
  else if (isToday(S.day)) lede = "Finished for today.";
  else lede = `${esc(dayMeta.label)} ${esc(dayMeta.date || "")} · ${clock(it.start)}–${clock(it.end)}`;
  if (li.next && isToday(S.day) && li.next.k !== it.k) lede += ` ${esc(li.next.c.name)} is next, at ${clock(li.next.start)}.`;
  const gradesHere = desk() && course;
  const showNames = !desk() || S.gradesOpen;
  const tools = gradesHere ? (S.gradesOpen
    ? `<button class="btn inkb" data-act="grades-toggle" aria-pressed="true">${I.eye}Hide grades <span class="kbd">G</span></button>`
    : `<button class="btn" data-act="grades-toggle" aria-pressed="false">${I.eyeoff}Show grades <span class="kbd">G</span></button>`) : "";

  const hand = handFor(it.k, S.day);
  const steps = segs.map(s => {
    const t0 = it.start + s.from, state = isToday(S.day) ? (nowMin() >= it.start + s.to ? "past" : segNow && segNow.k === s.k ? "now" : "") : "";
    const progress = state === "now" ? `<div class="prog"><i style="width:${Math.round(100 * (off - s.from) / Math.max(1, s.to - s.from))}%"></i></div>` : "";
    return `<div class="step ${state}" id="step-${esc(s.k)}"><div class="t">${clock(t0)}<span class="m">${state === "now" ? (it.start + s.to - nowMin()) + "m left" : (s.to - s.from) + " min"}</span></div><div><div class="n">${esc(s.name)}${s.tag ? `<span class="tag">${esc(s.tag)}</span>` : ""}</div>
      <div class="d">${segBody(s.k, d, it, course, showNames)}</div>${progress}</div></div>`;
  }).join("");
  // The bell-to-bell bar: every section at its share of the period, the one running now lit.
  const total = Math.max(1, ...segs.map(s => s.to));
  const tbar = `<div class="tbar noprint" role="list" aria-label="Sections and their times">${segs.map(s => {
    const state = isToday(S.day) ? (nowMin() >= it.start + s.to ? "past" : segNow && segNow.k === s.k ? "now" : "") : "";
    const fill = state === "now" ? `<i style="width:${Math.round(100 * (off - s.from) / Math.max(1, s.to - s.from))}%"></i>` : "";
    return `<button class="seg-${state || "next"}" role="listitem" data-act="jump" data-v="${esc(s.k)}" style="flex:${Math.max(1, s.to - s.from)} 1 0" title="${esc(s.name)} · ${clock(it.start + s.from)}–${clock(it.start + s.to)}">${fill}<span class="tn">${esc(s.name)}</span><span class="tt">${clock(it.start + s.from)} · ${s.to - s.from}m</span></button>`;
  }).join("")}${total < (+it.c.len || 45) ? `<span class="tspare" style="flex:${(+it.c.len || 45) - total} 1 0"></span>` : ""}</div>`;
  const watch = d.watch && d.watch.length ? `<div class="watchbox"><div class="n">Watch for</div><ul class="watch">${d.watch.map(w => `<li>${rich(w)}</li>`).join("")}</ul></div>` : "";
  // What to print for this class today: one line per handout, e.g. "<b>file.pdf</b> pages 1–2 · 10 copies".
  const prints = Array.isArray(d.print) ? d.print.filter(Boolean) : d.print ? [d.print] : [];
  const print = prints.length ? `<div class="printbox"><div class="n">Print</div><ul>${prints.map(x => `<li>${rich(x)}</li>`).join("")}</ul></div>` : "";
  const gap = d.gap ? `<div class="gap"><b style="color:var(--warn-ink)">Needs a plan</b><div class="small muted">${rich(school().gapNote || "Tell Claude where the class is and what's next.")}</div></div>${reqBox(`${S.d.week}/${it.k}`, it.c.name, "Where is the class? What's next?")}` : "";
  const exitBtn = course && d.exit ? `<button class="btn primary block noprint" data-act="score" data-cls="${it.k}">${I.check}Score the exit ticket</button>` : "";

  const main = `<section class="card railcard">
    <div class="dayhead"><h2>${rich(d.focus || it.c.name)}</h2>${planUnit(it.k) ? `<div class="unit">${esc(planUnit(it.k))}</div>` : ""}</div>
    ${d.sub ? `<p class="sub">${rich(d.sub)}</p>` : ""}
    ${tbar}<div class="steps">${steps}</div>${watch}${gap}${noteBox(it)}</section>`;
  const side = `<aside class="side">${filesBox(it.k, hand, prints)}${print}${hwBox(it.k, S.day, showNames)}${exitBtn}
    ${gradesHere && S.gradesOpen ? `<section class="card gpane">${miniGrid(course, li.live && li.live.k === it.k ? needs(courseOf(course)).slice(0, 6).map(n => n.sid) : [])}
    <p class="small muted" style="margin:10px 0 0">Grades hide themselves when the next class starts, so they never open on the projector.</p></section>` : ""}</aside>`;
  // The week's note is a sentence, not a label: it gets its own line instead of riding in the eyebrow.
  return head({ eyebrow: `${esc(dayMeta.label)}${isToday(S.day) ? " · today" : ""} · ${esc(p.label || "Week " + S.d.week)}`,
                title: esc(it.c.name), dot: ccol(it.c), lede, tools }) + (p.note ? `<p class="wnote">${esc(p.note)}.</p>` : "") + daysBar + strip +
    `<div class="todaygrid${gradesHere && S.gradesOpen ? " wide" : ""}" style="margin-top:12px">${main}${side}</div>${worksheetDock(it.k, hand)}`;
}
// The worksheet, always in the same place: top of the side column on a laptop, a button over
// the tab bar on a phone. One file opens straight away; the folder and its other files are a tap on.
function filesBox(k, hand, prints = []) {
  if (!hand || !hand.copies.length) return `<section class="card files"><div class="n">Worksheet</div><div class="small muted">No handouts folder for this class.</div></section>`;
  const open = f => `api/file?p=${encodeURIComponent(hand.dir + "/" + f)}`;
  // The highlighted one is what today's print list names; with no print list, the first file.
  const said = prints.join(" ").replace(/<[^>]+>/g, "").toLowerCase(), base = f => f.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
  const named = hand.files.filter(f => said && said.includes(base(f)));
  const lit = f => named.length ? named.includes(f) : f === hand.files[0];
  return `<section class="card files noprint"><div class="row" style="justify-content:space-between"><div class="n">Worksheet${hand.files.length > 1 ? "s · " + hand.files.length : ""}</div><button class="link small" data-act="handouts" data-cls="${k}">${I.folder} Folder</button></div>
    ${hand.files.length ? hand.files.map(f => `<a class="btn ${lit(f) ? "primary" : "sunk"} fileb" href="${open(f)}" target="_blank" rel="noopener">${I.open}<span>${esc(f.replace(/\.pdf$/i, ""))}</span></a>`).join("")
      : `<div class="small muted">${hand.missing ? "This week's folder isn't there yet." : "Nothing in the folder yet."}</div>`}</section>`;
}
function worksheetDock(k, hand) {
  if (desk() || !hand || !hand.files.length) return "";
  const one = hand.files.length === 1;
  return `<div class="wdock noprint">${one ? `<a class="btn primary block" href="api/file?p=${encodeURIComponent(hand.dir + "/" + hand.files[0])}" target="_blank" rel="noopener">${I.open}Worksheet</a>`
    : `<button class="btn primary block" data-act="handouts" data-cls="${k}">${I.open}Worksheets · ${hand.files.length}</button>`}</div>`;
}
// A note on this class for Claude, one per class per day, kept in Notes/<class>.json.
function noteBox(it) {
  const iso = dayIso(S.day); if (!iso) return "";
  const notes = ((S.d.cnotes || {})[it.k] || {}).notes || [], cur = notes.find(n => n.date === iso);
  const earlier = notes.filter(n => n.date < iso).slice(-3).reverse();
  return `<div class="cnote noprint"><label class="n" for="cn-${it.k}">Notes for Claude · ${esc(it.c.short || it.c.name)}</label>
    <textarea id="cn-${it.k}" data-cnote="${it.k}" data-date="${iso}" placeholder="How it went, where they got to, who needs what. Claude reads this the next time you ask about ${esc(it.c.name)}.">${esc(cur ? cur.text : "")}</textarea>
    <div class="small muted">Saves when you click away.${cur ? " Saved " + esc(new Date(cur.at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })) + "." : ""}</div>
    ${earlier.length ? `<details class="earlier"><summary class="small">Earlier notes · ${earlier.length}</summary>${earlier.map(n => `<div class="small"><b>${esc(niceDate(n.date))}</b> ${esc(n.text)}</div>`).join("")}</details>` : ""}</div>`;
}
function segBody(k, d, it, course, showNames) {
  const p = v => v ? `<p>${rich(v)}</p>` : "";
  switch (k) {
    case "warm": {
      const g = gameFor(it.k, S.day, d);
      if (!g || !g.g) return p(d.warm || "One problem from yesterday on the board while you take the register.");
      return `<p><button class="link" data-act="warmup" data-cls="${it.k}">${esc(g.g.name)}${g.swapped ? " (swapped)" : ""}</button> — ${rich(d.warmNote || (g.g.how || [])[0] || "")}</p>`;
    }
    case "board":
      if (!d.board) return p(d.boardText);
      return `<div class="board">${d.board.cap ? `<div class="cap">${rich(d.board.cap)}</div>` : ""}${(d.board.lines || []).map(l => `<div>${rich(l)}</div>`).join("")}</div>`;
    case "group": {
      let h = p(d.group);
      if (!course) return h;
      const n = needs(courseOf(course)).slice(0, 6);
      if (!n.length) return h + `<div class="small muted" style="margin-top:6px">The gradebook has nobody flagged right now.</div>`;
      if (!showNames) return h + `<div class="group"><div class="gk">${n.length} student${n.length > 1 ? "s" : ""} from the gradebook</div><div class="small" style="color:var(--warn-ink);padding-bottom:6px">Names show with grades, or on your phone.</div></div>`;
      return h + `<div class="group"><div class="gk">From the gradebook</div>${n.map(x => `<button class="kid" data-act="student" data-sid="${x.sid}"><span style="font-weight:600">${esc(x.name)}</span><span>${esc(x.txt)}</span></button>`).join("")}</div>`;
    }
    case "check": return p(d.check || "Group comes back. Pairs check against the posted key. You circulate.");
    case "exit":
      if (!d.exit) return p(d.exitText);
      return `<div class="exit"><div>${rich(d.exit.q)}</div>${d.exit.a ? `<div class="a"><span class="k">Answer </span>${rich(d.exit.a)}</div>` : ""}</div>`;
    case "close": return p(d.close || "Tools in, benches clear, one sentence from each group on what they need next time.");
    default: return p(d[k]);
  }
}
function reqBox(key, label, ph) {
  const r = (S.d.requests || []).find(x => x.key === key && x.status !== "done");
  return `<div class="reqbox noprint"><b>Tell Claude${label ? " · " + esc(label) : ""}</b>
    <label class="small" for="req-${esc(key)}" style="color:var(--warn-ink)">Claude reads this first the next time it plans.</label>
    <input type="text" id="req-${esc(key)}" data-req="${esc(key)}" data-label="${esc(label || "")}" value="${esc(r ? r.text : "")}" placeholder="${esc(ph)}" enterkeyhint="done"></div>`;
}
function miniGrid(cid, group) {
  const c = courseOf(cid), ws = weeksOf(c).slice(-5), cs = classStats(c);
  return `<div class="row" style="justify-content:space-between"><h2 class="h2">${esc(c.name)} grades</h2><span class="small muted">${fmt(cs.acc)}% right · finish ${fmt(cs.att)}%</span></div>
    <table class="gtable" style="margin-top:8px"><thead><tr><th style="text-align:left">Student</th>${ws.map(w => `<th><button class="wh" data-act="sheetcol" data-cid="${(mainCol(c, w) || {}).id || ""}">Wk ${w}</button></th>`).join("")}<th style="text-align:right">All</th></tr></thead><tbody>
    ${c.students.map(s => { const x = stats(c, s.id);
      return `<tr class="${group.includes(s.id) ? "hl" : ""}"><th scope="row" style="text-align:left"><button class="nm" data-act="student" data-sid="${s.id}">${esc(s.name)}</button></th>${ws.map(w => cellHTML(c, s, w)).join("")}<td class="ov ${x.avg != null && x.avg < 65 ? "low" : ""}">${fmt(x.avg)}${x.avg != null ? "%" : ""}</td></tr>`; }).join("")}
    </tbody></table>`;
}

/* ---------------------------------------------------------------- week */
function viewWeek() {
  const p = plan(), ws = S.d.weeks || [];
  const i = ws.findIndex(w => w.week === S.d.week);
  const nav = `<div class="row noprint"><button class="iconb" data-act="weeknav" data-v="${i > 0 ? ws[i - 1].week : ""}" aria-label="Previous week" ${i > 0 ? "" : "disabled"}>${I.l}</button><button class="iconb" data-act="weeknav" data-v="${i >= 0 && i < ws.length - 1 ? ws[i + 1].week : ""}" aria-label="Next week" ${i >= 0 && i < ws.length - 1 ? "" : "disabled"}>${I.r}</button></div>`;
  if (!p) return head({ eyebrow: "Week", title: "This week", lede: "No plan file for this week yet.", tools: nav }) + reqBox("week", "This week", "What should this week cover?");
  const gaps = [];
  for (const d of planDays()) for (const x of dayList(d.key)) { const pd = planDay(x.k, d.key); if (!pd || pd.gap) gaps.push(x); }
  const gapCls = [...new Map(gaps.map(g => [g.k, g])).values()];
  const lede = [p.note ? esc(p.note) + "." : "", gapCls.length ? `${gapCls.length} class${gapCls.length > 1 ? "es" : ""} still need${gapCls.length > 1 ? "" : "s"} a plan.` : "Every class has a plan."].join(" ");
  const planHTML = `<div class="stack">${planDays().map(d => {
    const list = dayList(d.key);
    return `<section class="card" style="${isToday(d.key) ? "box-shadow:inset 0 0 0 2px var(--accent)" : ""}"><div class="row" style="justify-content:space-between"><b>${esc(d.label)} ${esc(d.date || "")}${isToday(d.key) ? " · today" : ""}</b><span class="small muted">${list.length} class${list.length === 1 ? "" : "es"}</span></div>
      ${list.map(x => { const pd = planDay(x.k, d.key); const g = !pd || pd.gap, hw = hwFor(x.k, d.key);
        const tags = hw ? [hw.collect.length ? "collect HW" : "", hw.assign.length ? "hand out HW" : ""].filter(Boolean) : [];
        return `<button class="wr" data-act="openday" data-day="${d.key}" data-cls="${x.k}"><span class="t">${clock(x.start)}</span><span class="cdot" style="background:${ccol(x.c)}"></span><span><b>${esc(x.c.short || x.c.name)}</b> · ${g ? `<span class="gapt">needs a plan</span>` : rich(pd.focus || "")}${tags.length ? ` <span class="hwt">${tags.join(" · ")}</span>` : ""}</span></button>`; }).join("") || '<div class="small muted" style="padding:8px 0">No classes.</div>'}</section>`;
  }).join("")}${gapCls.map(x => reqBox(`${S.d.week}/${x.k}`, x.c.name, "Where is the class? What's next?")).join("")}</div>`;
  const ticks = (S.d.prep || {})["week-" + S.d.week] || {};
  const prep = p.prep || [];
  const done = prep.filter(x => ticks[x.id]).length;
  const prepHTML = `<section class="card"><div class="row" style="justify-content:space-between"><h2 class="h2">Prep</h2><span class="small muted">${done} of ${prep.length} done · same list on every device</span></div>
    ${prep.map(x => `<label class="prep"><input type="checkbox" data-prep="${esc(x.id)}" ${ticks[x.id] ? "checked" : ""}><span class="${ticks[x.id] ? "done" : ""}">${rich(x.text)}</span></label>`).join("") || '<div class="small muted">No prep list this week.</div>'}</section>`;
  const games = Object.entries(school().games || {}), prompts = (school().prompts || {}).items || [];
  const libHTML = `<section class="card"><div class="row" style="justify-content:space-between"><h2 class="h2">Library</h2>
      <div class="seg"><button data-act="lib" data-v="games" aria-pressed="${S.lib === "games"}">Warm-ups · ${games.length}</button><button data-act="lib" data-v="prompts" aria-pressed="${S.lib === "prompts"}">${esc((school().prompts || {}).label || "Prompts")} · ${prompts.length}</button></div></div>
    <div class="stack" style="margin-top:12px">${S.lib === "games" ? games.map(([k, g]) => gameCard(g)).join("") : prompts.map(x => `<div class="game"><b>${esc(x.title)}</b><div class="small muted" style="margin-top:3px">${rich(x.text)}</div></div>`).join("")}</div></section>`;
  const body = desk() ? `<div class="grid2">${planHTML}<div class="stack">${prepHTML}${libHTML}</div></div>`
    : `<div class="seg" style="margin-bottom:12px"><button data-act="wtab" data-v="plan" aria-pressed="${S.wtab === "plan"}">Plan</button><button data-act="wtab" data-v="prep" aria-pressed="${S.wtab === "prep"}">Prep · ${prep.length - done} left</button><button data-act="wtab" data-v="lib" aria-pressed="${S.wtab === "lib"}">Library</button></div>` +
      (S.wtab === "prep" ? prepHTML : S.wtab === "lib" ? libHTML : planHTML);
  const w = ws[i] || {};
  return head({ eyebrow: `${esc(p.label || "Week " + S.d.week)}${w.startsOn ? " · " + esc(planDays().map(d => d.date).filter(Boolean).slice(0, 1)[0] || "") + "–" + esc((planDays().slice(-1)[0] || {}).date || "") : ""}`, title: S.d.week === currentWeekNo() ? "This week" : esc(p.label || "Week"), lede, tools: nav }) + body;
}
function currentWeekNo() { const t = isoOf(); const w = (S.d.weeks || []).find(x => x.startsOn && t >= x.startsOn && t <= (x.endsOn || x.startsOn)); return w ? w.week : null; }
function gameCard(g, open) {
  const both = (g.courses || []).length > 1;
  return `<details class="game" ${open ? "open" : ""}><summary><span>${esc(g.name)}</span><span class="small muted">${esc(g.mins || "")}${g.courses && !both ? " · " + esc(g.courses.join(", ")) + " only" : ""}</span></summary>
    ${g.needs ? `<div class="small" style="margin-top:8px"><span class="k">Assumes </span>${rich(g.needs)}</div>` : ""}
    <ol>${(g.how || []).map(h => `<li>${rich(h)}</li>`).join("")}</ol>
    ${g.easier ? `<div class="small" style="margin-top:8px"><span class="k">If it's too hard </span>${rich(g.easier)}</div>` : ""}
    ${g.forwhom ? `<div class="small muted" style="margin-top:6px;font-style:italic">${rich(g.forwhom)}</div>` : ""}</details>`;
}

/* ---------------------------------------------------------------- grades */
function courseSeg() {
  const cs = Object.entries(S.d.courses || {});
  return cs.length > 1 ? `<div class="seg">${cs.map(([id, c]) => `<button data-act="course" data-v="${id}" aria-pressed="${id === S.course}">${esc(c.name)}</button>`).join("")}</div>` : "";
}
function cellHTML(c, s, w) {
  const cell = weekCell(c, s.id, w);
  let dot;
  if (cell.acc != null) { const k = band(cell.acc), a = Math.round(cell.att ?? 100); dot = `<span class="dot" style="border-color:var(--q${k});background:linear-gradient(to top,var(--q${k}) ${a}%,var(--q${k}t) ${a}%)"></span>`; }
  else dot = `<span class="dot ${cell.miss ? "miss" : cell.abs ? "abs" : "none"}"></span>`;
  const lab = `${s.name}, week ${w}: ` + (cell.acc != null ? `${Math.round(cell.acc)}% right, did ${Math.round(cell.att ?? 100)}% of the work` : cell.miss ? "missing" : cell.abs ? "absent" : "nothing scored") +
    (cell.hw === "done" ? ", homework done" : cell.hw === "notin" ? ", homework not in" : "") + (cell.claude ? ", scored by Claude, not checked yet" : "");
  return `<td><button class="cell" data-act="cell" data-sid="${s.id}" data-week="${w}" aria-label="${esc(lab)}" title="${esc(lab)}">${dot}<span class="hw ${cell.hw}"></span>${cell.claude ? '<span class="dia"></span>' : ""}</button></td>`;
}
function viewGrades() {
  const c = courseOf(S.course);
  if (!c) return head({ title: "Grades", lede: "No courses in the gradebook folder yet." });
  const open = claudeOpen(S.course);
  const scanB = `<button class="btn sunk noprint" data-act="scan" aria-label="Scan sheets for Claude">${I.cam}Scan</button>`;
  const addB = `<button class="btn noprint" data-act="newcol" data-v="TEST">+ Test</button><button class="btn noprint" data-act="newcol" data-v="HW">+ Homework</button>`;
  let h = head({ eyebrow: `${esc(c.name)} · ${c.students.length} students`, title: "Grades", lede: `The grade counts ${esc(wtxt())}. Worksheets show here but don't count.`, tools: desk() ? addB + scanB : "" });
  if (!["all", "asg", "week"].includes(S.gmode)) S.gmode = "all";
  h += `<div class="row noprint" style="margin-bottom:10px">${courseSeg()}<div class="seg"><button data-act="gmode" data-v="all" aria-pressed="${S.gmode === "all"}">Overview</button><button data-act="gmode" data-v="asg" aria-pressed="${S.gmode === "asg"}">Assignments</button><button data-act="gmode" data-v="week" aria-pressed="${S.gmode === "week"}">One week</button></div>${desk() ? "" : addB + scanB}</div>`;
  if (open.length) h += `<button class="banner noprint" data-act="go" data-v="review" style="margin-bottom:10px"><span class="row"><span class="dia"></span>Claude scored ${open.length} mark${open.length > 1 ? "s" : ""} here · not checked yet</span>${I.r}</button>`;
  if (S.gmode === "week") return h + weekGrid(c);
  if (S.gmode === "asg") return h + asgGrid(c);
  h += glance(c);
  const ws = weeksOf(c);
  h += `<section class="card" style="padding:6px 10px"><div class="scroll" data-keepx="grid-${S.course}" data-endx="1"><table class="gtable" style="min-width:${200 + ws.length * 44}px"><thead><tr><th style="text-align:left;padding-left:6px">Student</th>${ws.map(w => `<th><button class="wh" data-act="sheetcol" data-cid="${(mainCol(c, w) || {}).id || ""}" title="${esc(weekTopic(c, w))}">${w}</button></th>`).join("")}<th style="text-align:right;padding-right:6px">Grade</th></tr></thead><tbody>`;
  for (const s of c.students) {
    const g = grade(c, s.id), x = stats(c, s.id), tt = trendTxt(x.trend);
    h += `<tr><th scope="row" style="text-align:left"><button class="nm" data-act="student" data-sid="${s.id}">${esc(s.name)}</button></th>${ws.map(w => cellHTML(c, s, w)).join("")}<td class="ov ${g.grade != null && g.grade < 70 ? "low" : ""}">${g.grade != null ? fmt(g.grade) + "%" : "—"}<small class="${x.n >= 4 ? tt[1] : ""}">${x.n >= 4 ? tt[0] : x.n + " sheets"}</small></td></tr>`;
  }
  h += `</tbody></table></div></section>
  <div class="legend"><span>Dots are worksheets, week by week:</span><span><i class="sw" style="background:var(--q1)"></i>90+</span><span><i class="sw" style="background:var(--q2)"></i>80s</span><span><i class="sw" style="background:var(--q3)"></i>70s</span><span><i class="sw" style="background:var(--q4)"></i>60s</span><span><i class="sw" style="background:var(--q5)"></i>Under 60</span><span>Fill = share of the work done</span><span><span class="dot miss" style="width:12px;height:12px"></span>Missing</span><span><span class="dot abs" style="width:12px;height:12px"></span>Absent</span><span><span class="hw done"></span>Homework done</span><span><span class="hw notin"></span>Homework not in</span><span><span class="dia"></span>Claude scored, not checked</span><span>Grade = tests and homework only</span></div>`;
  return h;
}
// The three things worth seeing before anything else: the class's grade, who owes what, and who is slipping.
function glance(c) {
  const cg = classGrade(c), miss = c.students.map(s => ({ s, m: missingFor(c, s.id) })).filter(r => r.m.length).sort((a, b) => b.m.length - a.m.length);
  const nMiss = miss.reduce((a, r) => a + r.m.length, 0), sl = slipping(c), under = c.students.filter(s => { const g = grade(c, s.id).grade; return g != null && g < 70; }).length;
  const avgCard = `<section class="card gl"><div class="k">Class average</div><div class="big ${cg.grade != null && cg.grade < 70 ? "low" : ""}">${cg.grade != null ? fmt(cg.grade) + "%" : "—"}</div>
    <div class="glrow"><span>Tests</span><b>${cg.tests != null ? fmt(cg.tests) + "%" : "none yet"}</b></div><div class="glrow"><span>Homework</span><b>${cg.homework != null ? fmt(cg.homework) + "%" : "none yet"}</b></div>
    <div class="small ${under ? "low" : "muted"}" style="margin-top:6px">${under ? `${under} under 70%` : cg.n ? "Nobody under 70%" : "Nothing counted yet"}</div></section>`;
  const missCard = `<section class="card gl"><div class="row" style="justify-content:space-between"><div class="k">Missing</div><button class="link small" data-act="asgmiss">See the grid ${I.r}</button></div><div class="big ${nMiss ? "low" : ""}">${nMiss}</div>
    ${miss.slice(0, 4).map(r => `<button class="glrow link" data-act="student" data-sid="${r.s.id}"><span>${esc(r.s.name)}</span><b>${r.m.length}</b></button>`).join("") || '<div class="small muted">Nothing missing.</div>'}
    ${miss.length > 4 ? `<div class="small muted">and ${miss.length - 4} more</div>` : ""}</section>`;
  const slipCard = `<section class="card gl slip"><div class="k">Slipping</div>${sl.length ? sl.slice(0, 4).map(r => `<div class="slr"><button class="link" data-act="student" data-sid="${r.s.id}" style="color:var(--fg)">${esc(first(r.s.name))}</button>${spark(r.x.weeks.slice(-8), true)}<span class="small low">${fmt(r.x.weeks[r.x.weeks.length - 1])}%</span><button class="btn sunk mini" data-act="snote" data-sid="${r.s.id}" aria-label="Note on ${esc(r.s.name)}">+ Note</button></div>`).join("")
    : '<div class="small muted" style="margin-top:6px">Nobody is slipping. A student shows here when the last three weeks of worksheets are well below the first three.</div>'}
    ${sl.length > 4 ? `<button class="link small" data-act="go" data-v="students">and ${sl.length - 4} more</button>` : ""}</section>`;
  return `<div class="glance">${avgCard}${missCard}${slipCard}</div>`;
}
// Every assignment across, every student down: what each one has, and what they still owe.
const AK = { all: ["All", () => true], TEST: ["Tests", col => col.kind === "TEST"], HW: ["Homework", col => col.kind === "HW" || col.kind === "XP"], CW: ["Worksheets", col => ["CW", "SUB"].includes(col.kind)], XT: ["Exit tickets", col => col.kind === "XT"] };
const ABBR = { CW: "WS", HW: "HW", XP: "XP", SUB: "Sub", TEST: "Test", XT: "Exit" };
function asgCell(col, s) {
  const m = mark(col.id, s.id), base = `data-act="edit" data-sid="${s.id}" data-cid="${col.id}"`, dia = isClaude(m) ? '<span class="dia"></span>' : "";
  const lab = t => `aria-label="${esc(s.name)}, ${esc(col.title)}: ${esc(t)}" title="${esc(col.title)}: ${esc(t)}"`;
  if (colX(col)) return `<button class="ac x" ${base} ${lab("excused for the class")}>·</button>`;
  if (!m) return `<button class="ac none" ${base} ${lab("no mark")}></button>`;
  if (col.kind === "XP" && m.status === "notin") return `<button class="ac st" ${base} ${lab("not in (extra practice, not owed)")}>✗${dia}</button>`;
  if (m.status === "missing" || m.status === "notin") return `<button class="ac miss" ${base} ${lab(m.status === "notin" ? "not in" : "missing")}>${m.status === "notin" ? "✗" : "M"}${dia}</button>`;
  if (isComp(col)) {
    const x = hwPart(m, col);
    if (x) return `<button class="ac hw${m.status}" ${base} ${lab(LABEL[m.status] + (x.acc != null ? `, ${Math.round(100 * x.acc)}% right` : ""))}>${m.status === "done" ? "✓" : "½"}${x.acc != null ? `<small>${Math.round(100 * x.acc)}</small>` : ""}${dia}</button>`;
  }
  if (isScored(m) && m.pts != null) {
    const p = col.kind === "TEST" ? testPct(m, col) : pct(m, col);
    return `<button class="ac sc" ${base} ${lab(Math.round(p ?? 0) + "%")} style="--c:var(--q${band(p ?? 0)})">${fmt(p)}${dia}</button>`;
  }
  return `<button class="ac st" ${base} ${lab(LABEL[m.status] || m.status)}>${{ absent: "A", excused: "Ex", nopage: "?" }[m.status] || "·"}${dia}</button>`;
}
function asgGrid(c) {
  if (!AK[S.akind]) S.akind = "all";
  const cols = c.columns.filter(AK[S.akind][1]).map((col, i) => ({ col, i })).sort((a, b) => (a.col.week ?? 99) - (b.col.week ?? 99) || a.i - b.i).map(x => x.col);
  let rows = c.students.map(s => ({ s, miss: cols.filter(col => !colX(col) && col.kind !== "XP" && col.kind !== "XT" && ["missing", "notin"].includes((mark(col.id, s.id) || {}).status)).length, g: grade(c, s.id) }));
  if (S.amiss) rows = rows.filter(r => r.miss);
  const bar = `<div class="row noprint" style="margin-bottom:10px">${Object.entries(AK).map(([k, [t]]) => `<button class="chip" data-act="akind" data-v="${k}" aria-pressed="${S.akind === k}">${t}</button>`).join("")}<button class="chip" data-act="amiss" aria-pressed="${!!S.amiss}">Only who owes something</button></div>`;
  if (!cols.length) return bar + '<div class="card empty">No assignments of this kind yet.</div>';
  const tpl = `grid-template-columns:minmax(120px,170px) repeat(${cols.length},46px) 64px 60px`;
  let g = `<section class="card" style="padding:8px 10px"><div class="scroll" data-keepx="asg-${S.course}-${S.akind}" data-endx="1"><div class="agrid" style="${tpl}">
    <div class="ah nm0">Student</div>${cols.map(col => `<button class="ah" data-act="sheetcol" data-cid="${col.id}" title="${esc(col.title)}${col.due ? " · due " + esc(col.due) : ""}"><span class="ak ${col.kind}">${ABBR[col.kind] || col.kind}</span><span>${col.week != null ? "Wk " + col.week : ""}</span><span class="atl">${esc(col.title)}</span></button>`).join("")}<div class="ah r">Owes</div><div class="ah r">Grade</div>`;
  for (const r of rows) g += `<button class="an" data-act="student" data-sid="${r.s.id}">${esc(r.s.name)}</button>${cols.map(col => asgCell(col, r.s)).join("")}<div class="ar ${r.miss ? "low" : "muted"}">${r.miss || "—"}</div><div class="ar ${r.g.grade != null && r.g.grade < 70 ? "low" : ""}">${r.g.grade != null ? fmt(r.g.grade) + "%" : "—"}</div>`;
  if (!rows.length) g += `<div class="small muted" style="grid-column:1/-1;padding:14px 4px">Nobody owes anything here.</div>`;
  g += `</div></div></section>
    <div class="legend"><span><b>M</b> missing</span><span><b>✗</b> homework not in</span><span><b>✓</b> done · <b>½</b> partial (small number: % right)</span><span><b>A</b> absent</span><span><b>Ex</b> excused</span><span><b>?</b> page not sorted yet</span><span>Numbers are % (tests over the whole test)</span><span>Click a heading to open it and score the class</span></div>`;
  return bar + g;
}
function gweekOf(c) {
  const ws = weeksOf(c); if (!ws.length) return null;
  if (S.gweek != null && ws.includes(S.gweek)) return S.gweek;
  const cur = S.d.week, past = ws.filter(w => cur == null || w <= cur);
  return past.length ? past[past.length - 1] : ws[ws.length - 1];
}
function wcellHTML(col, s, sel) {
  const m = mark(col.id, s.id), q = S.q.some(x => x.col === col.id && x.sid === s.id);
  const base = `data-act="wcell" data-sid="${s.id}" data-cid="${col.id}"`;
  const cls = `wc${sel ? " sel" : ""}${q && S.save === "waiting" ? " q" : ""}`;
  const dia = isClaude(m) ? '<span class="dia"></span>' : "";
  if (sel && S.buf) return `<button class="${cls}" ${base}><span class="buf">${esc(S.buf)}</span><span class="small muted">/ ${esc((m && m.outOf) || col.outOf || "")}</span></button>`;
  if (!m) return `<button class="${cls} st" ${base} aria-label="${esc(s.name)}: no mark">—</button>`;
  if (isScored(m) && m.pts != null) {
    const p = pct(m, col), k = band(p ?? 0);
    return `<button class="${cls}" ${base} aria-label="${esc(s.name)}: ${m.pts} of ${m.outOf || col.outOf}"><span>${m.pts}/${m.outOf || col.outOf}</span><span class="bar"><i style="width:${Math.round(p ?? 0)}%;background:var(--q${k})"></i></span>${dia}</button>`;
  }
  const bad = ["missing", "notin"].includes(m.status);
  return `<button class="${cls} st ${bad ? "bad" : ""}" ${base}>${esc(LABEL[m.status] || m.status)}${dia}</button>`;
}
function weekGrid(c) {
  const w = gweekOf(c);
  if (w == null) return '<div class="card empty">Nothing in this course yet.</div>';
  const ws = weeksOf(c), i = ws.indexOf(w), cols = c.columns.filter(x => x.week === w);
  if (!S.sel || !cols.some(x => x.id === S.sel.cid) || !c.students.some(s => s.id === S.sel.sid)) S.sel = desk() ? { sid: c.students[0].id, cid: cols[0].id } : null;
  const tpl = `grid-template-columns:minmax(110px,1.2fr) repeat(${cols.length},minmax(96px,1fr)) 64px`;
  let g = `<div class="row noprint" style="margin-bottom:8px"><button class="iconb" data-act="gweek" data-v="${ws[i - 1] ?? ""}" ${i > 0 ? "" : "disabled"} aria-label="Previous week">${I.l}</button><b>Week ${w}</b><button class="iconb" data-act="gweek" data-v="${ws[i + 1] ?? ""}" ${i < ws.length - 1 ? "" : "disabled"} aria-label="Next week">${I.r}</button></div>`;
  g += `<section class="card" style="padding:8px 12px"><div class="scroll" data-keepx="wk-${S.course}-${w}"><div class="wgrid" style="${tpl};min-width:${200 + cols.length * 100}px"><div class="hd" style="text-align:left">Student</div>`;
  g += cols.map(col => `<button class="hd link" data-act="sheetcol" data-cid="${col.id}" style="color:var(--fg2);text-align:center">${esc(col.title)}<small>${KIND[col.kind] || col.kind}${col.outOf && !isComp(col) ? " · " + col.outOf : ""}${colX(col) ? " · excused" : ""}</small></button>`).join("") + `<div class="hd" style="text-align:right">Week</div>`;
  for (const s of c.students) {
    const cell = weekCell(c, s.id, w);
    g += `<button class="rn link" style="color:var(--fg)" data-act="student" data-sid="${s.id}">${esc(s.name)}</button>` +
      cols.map(col => wcellHTML(col, s, S.sel && S.sel.sid === s.id && S.sel.cid === col.id)).join("") +
      `<div class="wc st" style="justify-content:flex-end;${cell.acc != null && cell.acc < 65 ? "color:var(--low)" : ""}">${cell.acc != null ? Math.round(cell.acc) + "%" : "—"}</div>`;
  }
  g += `</div></div></section>`;
  if (desk()) g += `<div class="keys noprint"><span><span class="kbd">0–9</span> score</span><span><span class="kbd">Enter</span> save, next student (accepts Claude's)</span><span><span class="kbd">Tab</span> next column</span><span><span class="kbd">←↑↓→</span> move</span><span><span class="kbd">M</span> missing</span><span><span class="kbd">A</span> absent</span><span><span class="kbd">X</span> excused</span><span><span class="kbd">D</span><span class="kbd">P</span><span class="kbd">I</span> homework done · partial · not in</span><span><span class="kbd">N</span> note</span><span><span class="kbd">⌘Z</span> undo</span></div>`;
  if (!desk() || !S.sel) return g;
  const fc = findCol(S.sel.cid), st = c.students.find(s => s.id === S.sel.sid);
  return `<div class="split"><div class="main">${g}</div><aside class="card inspector" aria-label="Edit mark"><div class="k">${esc(fc.col.title)}</div><div style="font-size:20px;font-weight:800;margin:2px 0 12px"><button class="link" style="color:var(--fg)" data-act="student" data-sid="${st.id}">${esc(st.name)}</button></div>${editorHTML(fc.col, st.id, true)}</aside></div>`;
}

/* ---------------------------------------------------------------- the mark editor */
function editorHTML(col, sid, bare) {
  const m = mark(col.id, sid) || {}, comp = isComp(col), out = m.outOf || col.outOf;
  const ro = S.save === "ro" ? " disabled" : "";
  const ed = `data-sid="${sid}" data-cid="${col.id}"`;
  const opts = comp ? [["done", "Done"], ["partial", "Partial"], ["notin", "Not in"], ["absent", "Absent"], ["excused", "Excused"]]
    : [["scored", "Scored"], ["missing", "Missing"], ["absent", "Absent"], ["excused", "Excused"], ["nopage", "Not sorted"]];
  const cur = m.status === "late" ? "scored" : m.status;
  let h = `<div class="ed">`;
  if (!bare) h += `<div class="eh"><button class="link et" style="color:var(--fg)" data-act="sheetcol" data-cid="${col.id}">${esc(col.title)}</button><span class="small muted">${KIND[col.kind] || col.kind}${!comp && col.items ? " · " + col.items.length + " problems" : ""}${colX(col) ? " · excused for the class" : ""}</span></div>`;
  if (isClaude(m)) h += `<div class="claude"><span><span class="dia"></span>Claude scored this${m.scan ? " from the scan" : ""}${m.conf && m.conf !== "high" ? " — not sure" : ""}. Not checked yet.</span><button class="btn inkb" style="min-height:40px" data-act="accept" ${ed}${ro}>Looks right</button></div>`;
  if (m.proposed) h += `<div class="claude"><span><span class="dia"></span>Claude suggests ${esc(m.proposed.pts)}/${esc(m.proposed.outOf)}${m.proposed.note ? " — " + esc(m.proposed.note) : ""}</span><button class="btn inkb" style="min-height:40px" data-act="useprop" ${ed}${ro}>Use it</button></div>`;
  h += `<div class="stat">${opts.map(([v, t]) => `<button data-act="status" data-v="${v}" ${ed} aria-pressed="${cur === v}"${ro}>${t}</button>`).join("")}</div>`;
  if (!comp && col.kind !== "XT" && isScored(m)) {
    h += `<div class="ptsrow"><button class="stepb" data-act="ptsstep" data-v="-1" ${ed} aria-label="One point less"${ro}>−</button>
      <div style="flex:1;text-align:center"><label class="k" style="display:block" for="pts-${sid}-${col.id}">Points</label><input id="pts-${sid}-${col.id}" inputmode="decimal" data-f="pts" ${ed} value="${m.pts ?? ""}"${ro}> <span class="of">of</span> <input aria-label="Out of" inputmode="decimal" data-f="outOf" ${ed} value="${out ?? ""}" style="width:64px;font-size:18px"${ro}></div>
      <button class="stepb" data-act="ptsstep" data-v="1" ${ed} aria-label="One point more"${ro}>+</button></div>
      <div class="small muted" style="text-align:center;margin-top:-6px">${m.pts != null && out ? Math.round(100 * m.pts / out) + "% right · " : ""}out of = 2 × problems tried${col.outOf ? " · full packet " + col.outOf : ""}</div>`;
    if (col.items && col.items.length) {
      const codes = (m.r || col.items.map(() => "-").join(" ")).split(" ");
      h += `<div><div class="k" style="margin-bottom:6px">Problem by problem · tap to change</div><div class="codes">${col.items.map((it, i) => { const k = codes[i] || "-";
        return `<button class="${k === "2" ? "c2" : k === "1" ? "c1" : k === "0" ? "c0" : "cb"}" data-act="code" data-v="${i}" ${ed} title="${esc(it)}: ${k === "2" ? "right" : k === "1" ? "method only" : k === "0" ? "wrong" : "blank"}" aria-label="${esc(it)}"${ro}></button>`; }).join("")}</div></div>`;
    }
    h += `<label class="chk"><input type="checkbox" data-f="inc" ${ed} ${m.inc ? "checked" : ""}${ro}> Incomplete (say where they stopped in the note)</label>`;
  }
  if (comp && col.kind === "HW") h += `<div class="ptsrow"><div style="flex:1"><label class="k" style="display:block;margin-bottom:4px" for="pts-${sid}-${col.id}">Accuracy (optional)</label><input id="pts-${sid}-${col.id}" inputmode="decimal" data-f="pts" ${ed} value="${m.pts ?? ""}" placeholder="—"${ro}> <span class="of">of</span> <input aria-label="Out of" inputmode="decimal" data-f="outOf" ${ed} value="${m.outOf ?? ""}" placeholder="10" style="width:64px;font-size:18px"${ro}></div></div>
    <div class="small muted" style="margin-top:-6px">Counts ${weights().accuracy}% of this homework when it's there; done counts ${weights().completion}%.</div>`;
  if (col.kind === "XT" && isScored(m)) h += `<div class="xseg" role="group" aria-label="Exit ticket">${[[2, "✓", "r"], [1, "½", "h"], [0, "✗", "w"]].map(([v, t, c]) => `<button class="${c}" data-act="xt" data-v="${c}" ${ed} aria-pressed="${m.pts === v}"${ro}>${t}</button>`).join("")}</div>`;
  h += `<div><label class="k" style="display:block;margin-bottom:6px" for="note-${sid}-${col.id}">Note</label><textarea id="note-${sid}-${col.id}" data-f="note" ${ed} placeholder="e.g. scaled the bottom but not the top"${ro}>${esc(m.note || "")}</textarea></div>`;
  if (m.scan) h += `<a class="link small" href="api/file?p=${encodeURIComponent(m.scan)}" target="_blank" rel="noopener">Open the scan</a>`;
  return h + `</div>`;
}

/* ---------------------------------------------------------------- students */
function spark(wk, low) {
  if (!wk.length) return "";
  const n = wk.length, y = a => 38 - a * 0.36, x = i => n < 2 ? 110 : i * 220 / (n - 1);
  return `<svg viewBox="0 0 220 40" width="100%" height="40" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="220" y1="${y(70)}" y2="${y(70)}" stroke="var(--line2)" stroke-dasharray="4 4"/><polyline points="${wk.map((a, i) => x(i).toFixed(1) + "," + y(a).toFixed(1)).join(" ")}" fill="none" stroke="${low ? "var(--q5)" : "var(--accent)"}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function viewStudents() {
  const c = courseOf(S.course);
  if (!c) return head({ title: "Students", lede: "No courses in the gradebook folder yet." });
  const fl = new Set(needs(c).map(n => n.sid));
  let list = c.students.map(s => ({ s, x: stats(c, s.id), g: grade(c, s.id), p: S.d.profiles[s.id] || {} }));
  if (S.filter === "flag") list = list.filter(r => fl.has(r.s.id));
  if (S.sort === "low") list.sort((a, b) => (a.g.grade ?? 999) - (b.g.grade ?? 999));
  const hwc = c.columns.filter(col => col.kind === "HW" && !colX(col));
  return head({ eyebrow: `${esc(c.name)} · ${c.students.length} students`, title: "Students" }) +
    `<div class="row noprint" style="margin-bottom:12px">${courseSeg()}<button class="chip" data-act="filter" data-v="all" aria-pressed="${S.filter === "all"}">Everyone</button><button class="chip" data-act="filter" data-v="flag" aria-pressed="${S.filter === "flag"}">Needs a check-in · ${fl.size}</button><button class="chip" data-act="sort" aria-pressed="${S.sort === "low"}">Lowest first</button></div>
    <div class="cards">${list.map(({ s, x, g, p }) => { const tt = trendTxt(x.trend), low = g.grade != null && g.grade < 70;
      return `<button class="scard${fl.has(s.id) ? " flag" : ""}" data-act="student" data-sid="${s.id}">
        <div class="row" style="justify-content:space-between;align-items:flex-start"><div><div style="font-size:18px;font-weight:700">${esc(s.name)}</div><div class="small ${x.n >= 4 ? tt[1] : "muted"}" style="font-weight:600">${x.n >= 4 ? tt[0] : x.n + " sheets scored"}</div></div><div style="text-align:right"><div style="font-size:28px;font-weight:800;line-height:1.1" class="${low ? "low" : ""}">${g.grade != null ? fmt(g.grade) + "%" : "—"}</div><div class="small muted">grade</div></div></div>
        <div class="row small muted" style="justify-content:space-between"><span>Worksheets, week by week</span><b style="color:var(--fg2)">${fmt(x.avg)}${x.avg != null ? "% right" : ""}</b></div>
        ${spark(x.weeks, x.trend < -4)}
        <div class="row small muted" style="justify-content:space-between"><span>Finishes the packet</span><b style="color:var(--fg2)">${fmt(x.att)}%</b></div><div class="meter" style="margin-top:-6px"><i style="width:${Math.round(x.att || 0)}%"></i></div>
        <div class="row small muted" style="justify-content:space-between"><span>Homework ${esc(x.hw)}</span><span style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${hwc.map(col => { const st = (mark(col.id, s.id) || {}).status; return `<span class="sq" title="${esc(col.title)}" style="background:${st === "done" || st === "partial" ? "var(--q2)" : st === "notin" ? "var(--q5)" : "var(--sunk)"}"></span>`; }).join("")}</span></div>
        <div style="font-size:14px;color:var(--fg2);border-top:1px solid var(--line);padding-top:10px">${esc(p.focus || (x.miss ? x.miss + " missing sheet" + (x.miss > 1 ? "s" : "") + "." : "No focus note yet."))}</div></button>`; }).join("") ||
    '<div class="card empty" style="grid-column:1/-1">Nobody is flagged. Missing work, a last sheet under 60% or homework not in shows here.</div>'}</div>`;
}
function viewStudent() {
  const f = findStudent(S.sid), c = f.c, st = f.s; S.course = f.cid;
  const i = c.students.findIndex(s => s.id === st.id), prev = c.students[(i - 1 + c.students.length) % c.students.length], next = c.students[(i + 1) % c.students.length];
  const x = stats(c, st.id), g = grade(c, st.id), p = S.d.profiles[st.id] || {}, tt = trendTxt(x.trend), low = x.avg != null && x.avg < 65;
  const ws = weeksOf(c).map(w => ({ w, cell: weekCell(c, st.id, w) }));
  const sh = c.columns.filter(col => !isComp(col) && !colX(col)).map(col => ({ col, m: mark(col.id, st.id) })).filter(r => r.m && r.m.status !== "nopage").reverse();
  const shown = S.showAll ? sh : sh.slice(0, 6);
  const inGroup = (() => { const day = todayKey(); if (!day) return null; const k = dayList(day).find(x => x.c.course === f.cid); return k && needs(c).slice(0, 6).some(n => n.sid === st.id) ? k : null; })();
  const tools = `<button class="btn noprint" data-act="student" data-sid="${prev.id}">← ${esc(first(prev.name))}</button><button class="btn noprint" data-act="student" data-sid="${next.id}">${esc(first(next.name))} →</button>${desk() ? '<button class="btn primary noprint" data-act="print">Print for a conference</button>' : ""}`;
  let h = head({ back: [S.back || "students", S.back === "grades" ? "Grades" : "Students"], eyebrow: esc(c.name), title: esc(st.name), tools,
    lede: `${x.n} sheets scored · homework ${esc(x.hw)}${x.owed ? ` · owes ${x.owed} from absences` : ""}${missingFor(c, st.id).length ? ` · ${missingFor(c, st.id).length} missing` : ""}` });
  const profile = S.editProfile ? `<div class="stack"><label class="k" for="pf">Focus</label><textarea id="pf">${esc(p.focus || "")}</textarea><label class="k" for="ps">Solid (comma separated)</label><input type="text" id="ps" value="${esc((p.solid || []).join(", "))}"><label class="k" for="pw">Work on (comma separated)</label><input type="text" id="pw" value="${esc((p.work || []).join(", "))}"><div class="row"><button class="btn primary" data-act="profsave" data-sid="${st.id}">Save</button><button class="btn sunk" data-act="profcancel">Cancel</button></div></div>`
    : `<div style="font-size:15px">${esc(p.focus || "No focus note yet.")}</div>
       ${(p.solid || []).length ? `<div class="row" style="margin-top:8px;gap:6px"><span class="k" style="color:var(--accent-ink);width:56px">Solid</span>${p.solid.map(t => `<span class="tag good">${esc(t)}</span>`).join("")}</div>` : ""}
       ${(p.work || []).length ? `<div class="row" style="margin-top:6px;gap:6px"><span class="k" style="color:var(--warn-ink);width:56px">Work on</span>${p.work.map(t => `<span class="tag work">${esc(t)}</span>`).join("")}</div>` : ""}
       ${inGroup ? `<button class="btn sunk noprint" style="margin-top:10px;width:100%;justify-content:space-between" data-act="openday" data-day="${todayKey()}" data-cls="${inGroup.k}">In today's plan · ${esc(inGroup.c.short || inGroup.c.name)} small group ${I.r}</button>` : ""}`;
  h += `<div class="kpis three" style="margin-bottom:12px">
    <div class="card kpi"><div class="k">Grade</div><div class="v ${g.grade != null && g.grade < 70 ? "low" : ""}">${g.grade != null ? fmt(g.grade) + "%" : "—"}</div>
      <div class="glrow small"><span>Tests · ${g.nTests}</span><b>${g.tests != null ? fmt(g.tests) + "%" : "none yet"}</b></div>
      <div class="glrow small"><span>Homework · ${g.nHw}</span><b>${g.homework != null ? fmt(g.homework) + "%" : "none yet"}</b></div>
      ${g.nHw ? `<div class="small muted">${fmt(g.comp)}% done${g.nAcc ? ` · ${fmt(g.acc)}% right on ${g.nAcc} scored` : " · no accuracy scores yet"}</div>` : ""}</div>
    <div class="card kpi"><div class="k">Worksheets · don't count</div><div class="v ${low ? "low" : ""}">${fmt(x.avg)}${x.avg != null ? "%" : ""}</div><div class="small ${x.n >= 4 ? tt[1] : "muted"}">${x.n >= 4 ? tt[0] + " · " : ""}${x.last ? Math.round(x.last.p) + "% on the latest sheet" : "No scored sheets yet"}</div>${spark(x.weeks, x.trend < -4)}</div>
    <div class="card kpi"><div class="k">Finishes the packet</div><div class="v">${fmt(x.att)}${x.att != null ? "%" : ""}</div><div class="small muted">average share attempted</div><div class="meter" style="margin-top:10px"><i style="width:${Math.round(x.att || 0)}%"></i></div></div>
    <div class="card" style="grid-column:1/-1;min-width:0"><div class="row" style="justify-content:space-between"><span class="k">Focus and skills</span>${S.editProfile ? "" : '<button class="link small noprint" data-act="profedit">Edit focus and skills</button>'}</div><div style="margin-top:6px">${profile}</div></div></div>`;
  h += `<section class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><h2 class="h2">Week by week</h2><span class="small muted">Column: right, of what was tried · bar: share of the work done</span></div>
    <div class="scroll" style="margin-top:10px" data-keepx="wbw" data-endx="1"><div class="cols">${ws.map(({ w, cell }) => `<button class="wcol" style="border:0;background:none;padding:0" data-act="cell" data-sid="${st.id}" data-week="${w}"><div class="p ${cell.acc != null && cell.acc < 60 ? "low" : "muted"}">${cell.acc != null ? Math.round(cell.acc) + "%" : cell.miss ? "Missing" : cell.abs ? "Absent" : ""}</div><div class="well">${cell.acc != null ? `<i style="height:${Math.max(3, cell.acc)}%;background:var(--q${band(cell.acc)})"></i>` : ""}</div><div class="att"><i style="width:${cell.att != null ? Math.round(cell.att) : 0}%"></i></div><div class="l">Wk ${w}</div></button>`).join("")}</div></div></section>`;
  h += `<section class="card" style="margin-bottom:12px"><h2 class="h2" style="margin-bottom:4px">Sheets, newest first</h2>${shown.map(({ col, m }) => {
    const pc = isScored(m) ? pct(m, col) : null;
    return `<div class="lrow"><div class="w small muted">Week ${col.week ?? ""}</div><button class="link" style="color:var(--fg);display:flex;gap:7px;align-items:center" data-act="sheetcol" data-cid="${col.id}">${esc(col.title)}${col.kind !== "CW" ? ` <span class="stchip">${KIND[col.kind] || col.kind}</span>` : ""}${isClaude(m) ? '<span class="dia"></span>' : ""}</button>
      <div class="sc">${pc != null ? `<div class="meter"><i style="width:${Math.round(pc)}%;background:var(--q${band(pc)})"></i></div><b>${Math.round(pc)}%${m.inc ? '<span style="color:var(--q5)" title="Incomplete">•</span>' : ""}</b>` : `<span class="stchip ${m.status === "missing" ? "bad" : ""}">${esc(LABEL[m.status] || m.status)}</span>`}</div>
      <button class="nt" data-act="edit" data-sid="${st.id}" data-cid="${col.id}" aria-label="Edit ${esc(col.title)}">${esc(m.note || "No note")}</button></div>`; }).join("") || '<div class="small muted">Nothing scored yet.</div>'}
    ${sh.length > 6 ? `<button class="link noprint" data-act="showall" style="padding:12px 0">${S.showAll ? "Show fewer" : "Show all " + sh.length + " sheets"}</button>` : ""}</section>`;
  const hwc = c.columns.filter(col => isComp(col) && !colX(col));
  if (hwc.length) h += `<section class="card"><h2 class="h2">Homework (completion only)</h2><div class="row" style="gap:6px;margin-top:10px">${hwc.map(col => { const s = (mark(col.id, st.id) || {}).status;
    return `<button class="stchip ${s === "done" || s === "partial" ? "ok" : s === "notin" ? "bad" : ""}" style="min-height:34px" data-act="edit" data-sid="${st.id}" data-cid="${col.id}">Wk ${col.week} · ${esc(short(col.title))}: ${esc(LABEL[s] || "No mark")}</button>`; }).join("")}</div></section>`;
  h += notesSection(c, st);
  return h;
}
// Everything said about one student, newest first: the notes added here and the notes on each
// of their marks. It builds up all year, so report cards start from it.
function notesFor(c, sid) {
  const out = ((S.d.snotes || {})[sid] || {}).items || [];
  const list = out.map(n => ({ own: true, id: n.id, at: n.at, text: n.text, col: n.col ? c.columns.find(x => x.id === n.col) : null }));
  for (const col of c.columns) { const m = mark(col.id, sid); if (m && m.note) list.push({ own: false, at: m.at || col.due || "", text: m.note, col, by: m.by }); }
  return list.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
function notesSection(c, st) {
  const list = notesFor(c, st.id), ro = S.save === "ro" ? " disabled" : "";
  const when = at => at ? new Date(at).toLocaleDateString([], { month: "short", day: "numeric" }) : "";
  return `<section class="card notes" style="margin-top:12px"><div class="row" style="justify-content:space-between"><h2 class="h2">Notes · for report cards</h2>${list.length ? `<button class="btn sunk noprint" data-act="copynotes" data-sid="${st.id}">${I.copy}Copy all</button>` : ""}</div>
    <div class="addnote noprint"><textarea id="sn-${st.id}" placeholder="Anything worth remembering about ${esc(first(st.name))}. Claude reads these too."${ro}></textarea>
      <div class="row"><select id="snc-${st.id}" aria-label="About"><option value="">About: in general</option>${c.columns.slice().reverse().map(col => `<option value="${col.id}">${esc((ABBR[col.kind] || col.kind) + (col.week != null ? " wk " + col.week : "") + " · " + short(col.title))}</option>`).join("")}</select><button class="btn primary" data-act="snadd" data-sid="${st.id}"${ro}>Add note</button></div></div>
    ${(S.allNotes ? list : list.slice(0, 8)).map(n => `<div class="nrow"><div class="small muted">${esc(when(n.at))}</div><div><div>${esc(n.text)}</div>${n.col ? `<button class="link small" data-act="sheetcol" data-cid="${n.col.id}">${esc(n.col.title)}</button>` : ""}${!n.own ? ` <span class="small muted">· note on the mark${n.by === "claude" ? ", from Claude" : ""}</span>` : ""}</div>${n.own ? `<button class="iconb mini noprint" data-act="sndel" data-sid="${st.id}" data-v="${n.id}" aria-label="Remove this note"${ro}>${I.x}</button>` : "<span></span>"}</div>`).join("") || '<div class="small muted" style="margin-top:8px">No notes yet.</div>'}
    ${list.length > 8 ? `<button class="link noprint" data-act="allnotes" style="padding:12px 0">${S.allNotes ? "Show the newest 8" : "Show all " + list.length + " notes"}</button>` : ""}</section>`;
}

/* ---------------------------------------------------------------- one assignment */
function viewSheet() {
  const f = findCol(S.cid), c = f.c, col = f.col; S.course = f.cid;
  const md = S.d.marks[col.id] || {}, xd = colX(col), comp = isComp(col);
  const same = c.columns.filter(x => x.week === col.week);
  const rows = c.students.map(s => { const m = mark(col.id, s.id); return { s, m, p: isScored(m) ? (col.kind === "TEST" ? testPct(m, col) : pct(m, col)) : null }; });
  const sc = rows.filter(r => r.p != null), avg = sc.length ? sc.reduce((a, r) => a + r.p, 0) / sc.length : null;
  const tools = `${comp ? `<button class="btn noprint" data-act="hwedit" data-cid="${col.id}">Edit</button>` : ""}${col.kind !== "XT" ? `<button class="btn primary noprint" data-act="qscore" data-cid="${col.id}">${I.check}Score the class</button>` : ""}<button class="btn noprint" data-act="excuse" data-cid="${col.id}">${xd ? "Count this assignment again" : "Excuse for the whole class"}</button>`;
  let h = head({ back: ["grades", "Grades"], eyebrow: `${esc(c.name)} · Week ${col.week ?? ""}`, title: esc(col.title), tools,
    lede: `${KIND[col.kind] || col.kind}${col.due ? " · due " + esc(col.due) : ""}${!comp && col.items ? ` · ${col.items.length} problems` : ""}${!comp ? ` · ${sc.length} of ${c.students.length} scored` : ""}${col.kind === "TEST" ? ` · out of ${esc(col.outOf ?? "?")}, counts toward the grade` : col.kind === "HW" ? " · counts toward the grade" : " · shown, doesn't count"}` });
  if (same.length > 1) h += `<div class="strip noprint" style="margin-bottom:12px">${same.map(x => `<button class="chip" data-act="sheetcol" data-cid="${x.id}" aria-pressed="${x.id === col.id}">${x.kind !== "CW" ? (KIND[x.kind] || x.kind) + " · " : ""}${esc(x.title)}</button>`).join("")}</div>`;
  if (xd) h += `<div class="note-soft" style="margin-bottom:12px">Excused for everyone. It's left out of every average, homework count and missing count. The marks are kept, so counting it again brings them back.</div>`;
  if (col.q) h += `<div class="exit" style="margin-bottom:12px">${rich(col.q)}${col.a ? `<div class="a">${rich(col.a)}</div>` : ""}</div>`;
  h += '<div class="stack">';
  if (!comp && sc.length) {
    const tops = [2, 66, 16, 66];
    h += `<section class="card"><h2 class="h2">How the class did · average ${fmt(avg)}%</h2><div class="dist"><div class="line"></div>${sc.slice().sort((a, b) => a.p - b.p).map((r, i) => {
      const left = `calc(${r.p.toFixed(1)}% * 0.96 + 2%)`;
      return `<span class="pt" style="left:${left};background:var(--q${band(r.p)})"></span><button class="lb" style="left:${left};top:${tops[i % 4]}px" data-act="edit" data-sid="${r.s.id}" data-cid="${col.id}">${esc(first(r.s.name))} <span class="muted">${Math.round(r.p)}%</span></button>`; }).join("")}</div>
      <div class="row small muted" style="justify-content:space-between"><span>0%</span><span>50%</span><span>100%</span></div></section>`;
  }
  const pr = rows.filter(r => r.m && r.m.r);
  if (!comp && col.items && pr.length) {
    const n = col.items.length, tpl = `grid-template-columns:84px repeat(${n},minmax(14px,1fr)) 48px`;
    const sec = col.items.map((it, i) => i === 0 || String(it).replace(/[a-z]+$/i, "") !== String(col.items[i - 1]).replace(/[a-z]+$/i, ""));
    const tally = col.items.map((_, i) => ({ i, tried: pr.filter(r => (r.m.r.split(" ")[i] || "-") !== "-").length, right: pr.filter(r => r.m.r.split(" ")[i] === "2").length }));
    h += `<section class="card"><div class="row" style="justify-content:space-between"><h2 class="h2">Problem by problem</h2><div class="legend" style="margin:0"><span><i class="sq c2"></i>Right</span><span><i class="sq c1"></i>Method only</span><span><i class="sq c0"></i>Wrong</span><span><i class="sq cb"></i>Blank</span></div></div>
      <div class="scroll" style="margin-top:10px"><div style="min-width:${Math.max(560, 140 + n * 20)}px;display:flex;flex-direction:column;gap:4px">
      <div class="pg" style="${tpl}"><span></span>${col.items.map((it, i) => `<span class="h${sec[i] ? " s" : ""}">${esc(it)}</span>`).join("")}<span></span></div>
      ${pr.map(r => `<div class="pg" style="${tpl}"><button class="link small" style="color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" data-act="edit" data-sid="${r.s.id}" data-cid="${col.id}">${esc(first(r.s.name))}</button>${r.m.r.split(" ").map((k, i) => `<span class="q ${k === "2" ? "c2" : k === "1" ? "c1" : k === "0" ? "c0" : "cb"}" title="${esc(col.items[i] || "")}"></span>`).join("")}<span class="small" style="text-align:right;font-weight:700">${fmt(r.p)}%</span></div>`).join("")}
      <div class="pg" style="${tpl};border-top:1px solid var(--line);padding-top:6px"><span class="small muted">Got it</span>${tally.map(t => `<span class="h ${t.tried && t.right / t.tried < .5 ? "low" : ""}" style="font-weight:700">${t.right}</span>`).join("")}<span></span></div></div></div></section>`;
    const missed = tally.filter(t => t.tried >= 2 && t.right / t.tried < .5), solid = tally.filter(t => t.tried >= 3 && t.right / t.tried >= .85), blanks = tally.filter(t => t.tried <= 1);
    h += `<div class="callouts">${missed.length ? `<div class="callout warn"><div class="k">Reteach</div>Fewer than half got ${missed.map(t => `<b>${esc(col.items[t.i])}</b> (${t.right} of ${t.tried})`).join(", ")}.</div>` : ""}
      ${solid.length ? `<div class="callout good"><div class="k">Solid</div>${solid.length} problems right for nearly everyone who tried them, including ${solid.slice(0, 6).map(t => esc(col.items[t.i])).join(", ")}.</div>` : ""}
      ${blanks.length ? `<div class="callout plain"><div class="k">Barely reached</div>${blanks.length} tried by one student or fewer: ${blanks.slice(0, 8).map(t => esc(col.items[t.i])).join(", ")}${blanks.length > 8 ? "…" : ""}.</div>` : ""}</div>`;
  }
  h += `<section class="card"><label class="h2" for="sheetnote" style="display:block;margin-bottom:8px">Whole-class note</label><textarea id="sheetnote" data-sheetnote="${col.id}" placeholder="What went wrong for most of the class">${esc(md.sheetNote || "")}</textarea><div class="small muted" style="margin-top:4px">Saves when you leave the box.</div></section>`;
  const cnt = {}; rows.forEach(r => { const k = r.m ? r.m.status : "none"; cnt[k] = (cnt[k] || 0) + 1; });
  h += `<section class="card"><h2 class="h2">By student${comp ? ` · ${cnt.done || 0} done, ${cnt.partial || 0} partial, ${cnt.notin || 0} not in` : ""}</h2>${rows.map(r => { const m = r.m || {};
    return `<div class="lrow"><div class="w"></div><button class="link" style="color:var(--fg);display:flex;gap:7px;align-items:center" data-act="student" data-sid="${r.s.id}">${esc(r.s.name)}${isClaude(m) ? '<span class="dia"></span>' : ""}</button>
      <div class="sc">${r.p != null ? `<div class="meter"><i style="width:${Math.round(r.p)}%;background:var(--q${band(r.p)})"></i></div><b>${Math.round(r.p)}%</b>` : `<span class="stchip ${["missing", "notin"].includes(m.status) ? "bad" : m.status === "done" ? "ok" : ""}">${esc(LABEL[m.status] || "No mark")}</span>`}</div>
      <button class="nt" data-act="edit" data-sid="${r.s.id}" data-cid="${col.id}">${esc(m.note || "No note")}${m.scan ? " · scan" : ""}</button></div>`; }).join("")}</section></div>`;
  return h;
}

/* ---------------------------------------------------------------- from Claude */
function viewReview() {
  const open = claudeOpen(), groups = new Map();
  for (const o of open) { const k = o.col.id; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); }
  const sure = o => o.m.conf === "high" && o.m.status !== "nopage";
  const planned = (S.d.activity || []).filter(a => a.by === "claude" && ["planned", "moved", "scored"].includes(a.did)).slice(-8).reverse();
  const reqs = (S.d.requests || []).filter(r => r.status !== "done");
  let h = head({ back: ["today", "Today"], eyebrow: "Claude's work", title: '<span class="dia" style="width:12px;height:12px"></span>From Claude',
    lede: open.length ? `${open.length} mark${open.length > 1 ? "s" : ""} to check. Nothing Claude writes counts as checked until you say so.` : "Nothing waiting to be checked." });
  h += `<div class="grid2"><div class="stack">`;
  if (!groups.size) h += `<section class="card empty">When Claude scores a stack of scans, the marks wait here for you.${S.d.inbox ? ` ${S.d.inbox} scan${S.d.inbox > 1 ? "s are" : " is"} in the inbox for it.` : ""}</section>`;
  for (const [cid, list] of groups) {
    const col = list[0].col, c = list[0].c, ok = list.filter(sure);
    list.sort((a, b) => sure(a) - sure(b));
    h += `<section class="card"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2 class="h2">${esc(col.title)} · ${esc(c.name)}</h2><div class="small muted" style="margin-top:2px">${list.length} to check${list.length - ok.length ? ` · ${list.length - ok.length} Claude wasn't sure about` : ""}</div></div>
      ${ok.length ? `<button class="btn primary" data-act="acceptall" data-cid="${cid}">Accept the ${ok.length} it's sure of</button>` : ""}</div>
      ${list.map(o => { const p = isScored(o.m) && o.m.pts != null ? `${o.m.pts}/${o.m.outOf || col.outOf}` : LABEL[o.m.status] || "—";
        return `<div class="rv ${sure(o) ? "" : "unsure"}"><b>${esc(o.st.name)}</b><b style="font-variant-numeric:tabular-nums">${esc(p)}</b><span class="why small" style="color:var(--fg2)">${sure(o) ? "" : "<b>Not sure.</b> "}${esc(o.m.note || "")}</span>
          <span class="act row" style="gap:6px;justify-content:flex-end">${o.m.scan ? `<a class="btn sunk" href="api/file?p=${encodeURIComponent(o.m.scan)}" target="_blank" rel="noopener">Scan</a>` : ""}<button class="btn sunk" data-act="edit" data-sid="${o.st.id}" data-cid="${cid}">Change</button><button class="btn" style="background:var(--accent-soft);color:var(--accent-ink)" data-act="accept" data-sid="${o.st.id}" data-cid="${cid}">Looks right</button></span></div>`; }).join("")}</section>`;
  }
  h += `</div><div class="stack"><section class="card"><h2 class="h2">What Claude did</h2>${planned.map(a => `<div class="wr" style="grid-template-columns:minmax(0,1fr)"><span><b>${esc(a.did === "planned" ? "Planned" : a.did === "scored" ? "Scored" : "Moved")} · ${esc(a.what || "")}</b><span class="small muted" style="display:block">${esc(new Date(a.at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }))}${a.n ? " · " + a.n : ""}</span></span></div>`).join("") || '<div class="small muted">Nothing yet.</div>'}</section>
    <section class="card"><h2 class="h2">Waiting for Claude</h2>${reqs.map(r => `<div class="wr" style="grid-template-columns:minmax(0,1fr)"><span><b>${esc(r.label || r.key)}</b><span class="small muted" style="display:block">“${esc(r.text)}”</span></span></div>`).join("") || '<div class="small muted">No notes waiting.</div>'}
      <p class="small muted" style="margin:10px 0 0">${S.d.inbox ? `${S.d.inbox} scan${S.d.inbox > 1 ? "s" : ""} in the inbox. ` : ""}Notes live in requests.json; Claude reads them first the next time it works in the folder.</p></section></div></div>`;
  return h;
}

/* ---------------------------------------------------------------- sheets */
function openSheet(s) { S.sheet = s; renderSheet(); setTimeout(() => { const f = document.querySelector("#sheethost .sb button, #sheethost .sb input"); if (f && desk()) f.focus({ preventScroll: true }); }, 30); }
function closeSheet() { S.sheet = null; $("#sheethost").innerHTML = ""; if (S.pending) load(); else render(); }
function sheetFrame(eyebrow, title, body, foot) {
  return `<div class="scrim" data-act="close"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title.replace(/<[^>]+>/g, ""))}"><div class="grab"></div>
    <div class="sh"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div><button class="iconb" data-act="close" aria-label="Close">${I.x}</button></div>
    <div class="sb">${body}</div>${foot ? `<div class="sf">${foot}</div>` : ""}</section>`;
}
function renderSheet() {
  const s = S.sheet, host = $("#sheethost");
  if (!s || !S.d || !S.d.ok) { host.innerHTML = ""; return; }
  const top = (host.querySelector(".sb") || {}).scrollTop || 0;
  let html = "";
  if (s.t === "edit") {
    const f = findStudent(s.sid); if (!f) { S.sheet = null; host.innerHTML = ""; return; }
    const cols = s.week != null ? f.c.columns.filter(x => x.week === s.week) : f.c.columns.filter(x => x.id === s.cid);
    const i = f.c.students.findIndex(x => x.id === s.sid), prev = f.c.students[(i - 1 + f.c.students.length) % f.c.students.length], next = f.c.students[(i + 1) % f.c.students.length];
    const nav = `<div class="row" style="margin-bottom:12px"><button class="btn sunk" data-act="editnav" data-sid="${prev.id}">← ${esc(first(prev.name))}</button><button class="btn sunk" data-act="editnav" data-sid="${next.id}">${esc(first(next.name))} →</button><button class="link" style="margin-left:auto" data-act="student" data-sid="${s.sid}">Open ${esc(first(f.s.name))}'s page</button></div>`;
    html = sheetFrame(`${s.week != null ? "Week " + s.week : esc(short(cols[0] && cols[0].title))} · ${esc(f.c.name)}`, esc(f.s.name), nav + savePill().replace('id="savepill"', 'id="savepill2"') + `<div style="height:12px"></div>` + cols.map(col => editorHTML(col, s.sid)).join(""),
      s.week != null && S.save !== "ro" ? `<button class="btn sunk" style="width:100%" data-act="weekabs" data-sid="${s.sid}" data-week="${s.week}">Mark ${esc(first(f.s.name))} absent for all week ${s.week} work</button>` : "");
  } else if (s.t === "score") {
    const it = dayList(S.day).find(x => x.k === s.cls), d = planDay(s.cls, S.day) || {}, c = courseOf(it.c.course);
    const colId = `xt-${it.c.course}-${(planDays().find(x => x.key === S.day) || {}).iso}`;
    const col = c.columns.find(x => x.id === colId);
    const scored = c.students.filter(st => mark(colId, st.id)).length;
    const body = `${d.exit ? `<div class="exit" style="margin-bottom:12px">${rich(d.exit.q)}${d.exit.a ? `<div class="a">${rich(d.exit.a)}</div>` : ""}</div>` : ""}
      <div class="row small muted" style="justify-content:space-between;font-weight:600;margin-bottom:4px"><span>Tap as you read</span><span style="display:flex;gap:4px;padding-right:4px"><span style="width:52px;text-align:center">Right</span><span style="width:52px;text-align:center">Half</span><span style="width:52px;text-align:center">Wrong</span><span style="width:52px;text-align:center">Away</span></span></div>
      ${c.students.map(st => { const m = col ? mark(col.id, st.id) : null; const v = !m ? "" : m.status === "absent" ? "a" : m.pts === 2 ? "r" : m.pts === 1 ? "h" : m.pts === 0 ? "w" : "";
        return `<div class="xrow"><span style="font-size:15px;font-weight:600">${esc(st.name)}</span><div class="xseg">${[["r", "✓", "Right"], ["h", "½", "Half"], ["w", "✗", "Wrong"], ["a", "–", "Away"]].map(([k, t, l]) => `<button class="${k}" data-act="xtscore" data-v="${k}" data-sid="${st.id}" data-cls="${s.cls}" aria-pressed="${v === k}" aria-label="${esc(st.name)}: ${l}">${t}</button>`).join("")}</div></div>`; }).join("")}`;
    html = sheetFrame(`Exit ticket · ${esc(it.c.name)}`, rich(d.focus || "Exit ticket"), body,
      `<p class="small muted" style="margin:0;text-align:center">${scored} of ${c.students.length} scored. Each tap saves. Unscored tickets stay blank, never zero.</p><button class="btn primary block" data-act="close">Done</button>`);
  } else if (s.t === "hwin") {
    const f = findCol(s.cid); if (!f) { S.sheet = null; host.innerHTML = ""; return; }
    const { c, col } = f, t = hwTally(c, col), left = c.students.length - t.marked;
    const opts = [["done", "✓", "Done"], ["partial", "½", "Partial"], ["notin", "✗", "Not in"], ["absent", "–", "Away"]];
    const body = `<div class="row small muted" style="justify-content:space-between;font-weight:600;margin-bottom:4px"><span>Tap as they hand it in</span><span style="display:flex;gap:4px;padding-right:4px">${opts.map(o => `<span style="width:52px;text-align:center">${o[2]}</span>`).join("")}</span></div>
      ${c.students.map(st => { const m = mark(col.id, st.id) || {};
        return `<div class="xrow"><span style="font-size:15px;font-weight:600">${esc(st.name)}</span><div class="xseg hwseg">${opts.map(([v, tx, l]) => `<button class="${v}" data-act="hwset" data-v="${v}" data-sid="${st.id}" data-cid="${col.id}" aria-pressed="${m.status === v}" aria-label="${esc(st.name)}: ${l}">${tx}</button>`).join("")}</div></div>`; }).join("")}`;
    html = sheetFrame(`Homework · ${esc(c.name)} · ${esc(dueTxt(col.due, isoOf()))}`, esc(col.title), body,
      `<p class="small muted" style="margin:0;text-align:center">${t.marked} of ${c.students.length} checked in. Each tap saves. Nobody is marked until you tap.</p>
       ${left ? `<div class="row" style="flex-wrap:nowrap"><button class="btn sunk" style="flex:1" data-act="hwrest" data-v="done" data-cid="${col.id}">${t.marked ? "The other " + left : "All " + left}: done</button><button class="btn sunk" style="flex:1" data-act="hwrest" data-v="notin" data-cid="${col.id}">${t.marked ? "The other " + left : "All " + left}: not in</button></div>` : ""}
       <button class="btn primary block" data-act="close">Done</button>`);
  } else if (s.t === "hwnew") {
    const cl = school().classes[s.cls], iso = dayIso(S.day) || isoOf(), due = nextMeet(s.cls, iso);
    html = sheetFrame(`Homework · ${esc(cl.name)}`, "Set homework",
      `<div class="stack"><label class="k" for="hwt">What it is</label><input type="text" id="hwt" placeholder="e.g. Workbook pg 52–53" maxlength="120" enterkeyhint="done">
        <label class="k" for="hwd">Due</label><input type="date" id="hwd" value="${due}" min="${iso}">
        <p class="small muted" style="margin:0">Handed out ${esc(niceDate(iso))}. It shows on this day as <b>Hand out</b>, and on the due day as <b>Collect</b>, with a check-in list. Completion only.</p></div>`,
      `<button class="btn primary block" data-act="hwsave" data-cls="${s.cls}">Save homework</button>`);
  } else if (s.t === "warmup") {
    const it = dayList(S.day).find(x => x.k === s.cls), d = planDay(s.cls, S.day) || {}, g = gameFor(s.cls, S.day, d);
    const cur = g && g.g, course = it.c.course;
    const others = Object.entries(school().games || {}).filter(([k, x]) => k !== (g && g.key) && (!x.courses || !course || x.courses.includes(course)));
    html = sheetFrame(`Warm-up · ${clock(it.start)}${cur && cur.mins ? " · " + esc(cur.mins) : ""}`, esc(cur ? cur.name : "Warm-up"),
      `${d.warmNote && !g.swapped ? `<div class="exit" style="margin-bottom:12px"><b>Today:</b> ${rich(d.warmNote)}</div>` : ""}${cur ? gameCard(cur, true) : ""}
       <div class="k" style="margin:16px 0 8px">Swap today's game</div><div class="stack" style="gap:6px">${others.map(([k, x]) => `<button class="btn sunk" style="justify-content:space-between;width:100%" data-act="swap" data-v="${k}" data-cls="${s.cls}"><span>${esc(x.name)}</span><span class="small muted">${esc(x.mins || "")}</span></button>`).join("")}</div>
       ${g && g.swapped ? `<button class="link" style="margin-top:12px" data-act="swap" data-v="" data-cls="${s.cls}">Back to the planned game</button>` : ""}`,
      `<p class="small muted" style="margin:0;text-align:center">A swap saves to this day on every device. Every game is under Week › Library.</p>`);
  } else if (s.t === "handouts") {
    const h = handFor(s.cls, S.day) || { files: [], copies: [] }, c = school().classes[s.cls];
    const files = h.files.length ? `<div class="stack" style="gap:6px">${h.files.map(f => `<a class="btn sunk" style="justify-content:flex-start;width:100%;text-align:left;white-space:normal" href="api/file?p=${encodeURIComponent(h.dir + "/" + f)}" target="_blank" rel="noopener">${I.open}<span style="flex:1;min-width:0;overflow-wrap:anywhere">${esc(f)}</span></a>`).join("")}</div>`
      : `<p class="small muted" style="margin:0">${h.missing ? "This folder isn't there yet." : "No PDFs or pictures in this folder yet."}</p>`;
    const copies = h.copies.map((x, i) => `<div class="row" style="flex-wrap:nowrap;margin-top:8px"><button class="btn sunk" style="flex:none" data-act="copyfolder" data-i="${i}" data-cls="${s.cls}">${I.copy}Copy</button>
      <div style="min-width:0"><div class="small" style="font-weight:600">${esc(x.label)}</div><div class="small muted" style="font-family:var(--mono,ui-monospace,monospace);overflow-wrap:anywhere;user-select:all;-webkit-user-select:all">${esc(folderPath(x.dir))}</div></div></div>`).join("");
    html = sheetFrame(esc(h.dir || ""), `Handouts · ${esc(c.name)}`, files + `<div class="k" style="margin:18px 0 0">Folder on the NAS</div>${copies}`,
      `<p class="small muted" style="margin:0;text-align:center">Each file opens in a new tab, to read or print. A copied path pastes into Finder's Go to Folder (⇧⌘G).</p>`);
  } else if (s.t === "qscore") {
    const f = findCol(s.cid); if (!f) { S.sheet = null; host.innerHTML = ""; return; }
    const { c, col } = f, comp = isComp(col), out = qOut(c, col), ro = S.save === "ro" ? " disabled" : "";
    const opts = comp ? [["done", "✓", "Done"], ["partial", "½", "Partial"], ["notin", "✗", "Not in"], ["absent", "–", "Away"]] : [["missing", "M", "Missing"], ["absent", "A", "Absent"]];
    const body = `<div class="qhead"><label class="k" for="qout">${comp ? "Accuracy out of" : "Out of"}</label><input id="qout" data-qs="out" inputmode="decimal" value="${esc(out)}"${ro}>
        <span class="small muted">${comp ? "Leave a score blank to count it on completion alone." : col.kind === "TEST" ? "The whole test, so blanks count against it." : ""}</span></div>
      ${c.students.map((st, i) => { const m = mark(col.id, st.id) || {};
        return `<div class="qrow"><span class="qn">${esc(st.name)}${isClaude(m) ? ' <span class="dia"></span>' : ""}</span>
          <div class="xseg ${comp ? "hwseg" : "qseg"}">${opts.map(([v, tx, l]) => `<button class="${v === "missing" ? "notin" : v}" data-act="qstat" data-v="${v}" data-sid="${st.id}" data-cid="${col.id}" aria-pressed="${m.status === v}" aria-label="${esc(st.name)}: ${l}"${ro}>${tx}</button>`).join("")}</div>
          <input class="qp" data-qs="pts" data-i="${i}" data-sid="${st.id}" data-cid="${col.id}" inputmode="decimal" enterkeyhint="next" value="${m.pts ?? ""}" placeholder="—" aria-label="${esc(st.name)}: score out of ${esc(out)}"${ro}>
          <input class="qnote" type="text" data-qs="note" data-sid="${st.id}" data-cid="${col.id}" value="${esc(m.note || "")}" placeholder="Note on ${esc(first(st.name))}'s ${esc(ABBR[col.kind] === "WS" ? "sheet" : (KIND[col.kind] || "work").toLowerCase())}" aria-label="${esc(st.name)}: note"${ro}></div>`; }).join("")}`;
    html = sheetFrame(`${esc(KIND[col.kind] || col.kind)} · ${esc(c.name)}${col.week != null ? " · Week " + col.week : ""}`, esc(col.title), body,
      `<p class="small muted" style="margin:0;text-align:center">Type a score and press Enter for the next student. Each one saves. A blank stays blank, never zero.</p><button class="btn primary block" data-act="close">Done</button>`);
  } else if (s.t === "newcol") {
    const test = s.kind === "TEST", iso = isoOf(), cls = Object.entries(school().classes || {}).find(([, x]) => x.course === S.course);
    html = sheetFrame(`${esc((courseOf(S.course) || {}).name || "")}`, test ? "New test" : "New homework",
      `<div class="stack"><label class="k" for="nct">What it is</label><input type="text" id="nct" maxlength="120" placeholder="${test ? "e.g. Unit 3 test" : "e.g. Workbook pg 52–53"}" enterkeyhint="done">
        ${test ? `<label class="k" for="ncd">Date</label><input type="date" id="ncd" value="${iso}">
          <label class="k" for="nco">Out of</label><input type="text" id="nco" inputmode="decimal" value="100">`
        : `<label class="k" for="nca">Handed out</label><input type="date" id="nca" value="${iso}"><label class="k" for="ncd">Due</label><input type="date" id="ncd" value="${cls ? nextMeet(cls[0], iso) : isoAdd(iso, 1)}">`}
        <p class="small muted" style="margin:0">${test ? "Tests count toward the grade. Next, you score it here, student by student." : "Homework counts on completion, plus accuracy when you give it a score."}</p></div>`,
      `<button class="btn primary block" data-act="colsave" data-v="${test ? "TEST" : "HW"}">Add and score it</button>`);
  } else if (s.t === "hwedit") {
    const f = findCol(s.cid); if (!f) { S.sheet = null; host.innerHTML = ""; return; }
    const { c, col } = f, marked = c.students.filter(st => mark(col.id, st.id)).length, ro = S.save === "ro" ? " disabled" : "";
    html = sheetFrame(`${esc(KIND[col.kind] || "Homework")} · ${esc(c.name)}`, "Edit homework",
      `<div class="stack"><label class="k" for="hwe-t">What it is</label><input type="text" id="hwe-t" maxlength="120" value="${esc(col.title)}"${ro}>
        <label class="k" for="hwe-a">Handed out</label><input type="date" id="hwe-a" value="${esc(col.assigned || "")}"${ro}>
        <label class="k" for="hwe-d">Due</label><input type="date" id="hwe-d" value="${esc(col.due || "")}"${ro}>
        <p class="small muted" style="margin:0">Today shows <b>Hand out</b> on the first date and <b>Collect</b> on the second. ${marked ? `${marked} of ${c.students.length} already checked in; their marks stay as they are.` : "Nobody is checked in yet."}</p></div>`,
      `<button class="btn primary block" data-act="hwesave" data-cid="${col.id}"${ro}>Save</button>
       ${marked ? `<p class="small muted" style="margin:0;text-align:center">It can't be removed once anyone is checked in. Excuse it for the class instead, from its page.</p>` : `<button class="btn sunk block" data-act="hwedel" data-cid="${col.id}"${ro}>Remove this homework</button>`}`);
  } else if (s.t === "snote") {
    const f = findStudent(s.sid); if (!f) { S.sheet = null; host.innerHTML = ""; return; }
    const recent = notesFor(f.c, s.sid).slice(0, 3);
    html = sheetFrame(`Note · ${esc(f.c.name)}`, esc(f.s.name),
      `<textarea id="snq" style="min-height:120px" placeholder="What you're seeing. It's kept for report cards, and Claude reads it."></textarea>
       ${recent.length ? `<div class="k" style="margin:14px 0 4px">Lately</div>${recent.map(n => `<div class="small" style="padding:6px 0;border-top:1px solid var(--line)">${esc(n.text)}${n.col ? ` <span class="muted">· ${esc(short(n.col.title))}</span>` : ""}</div>`).join("")}` : ""}`,
      `<button class="btn primary block" data-act="snsave" data-sid="${s.sid}">Save note</button><button class="link small" style="text-align:center" data-act="student" data-sid="${s.sid}">Open ${esc(first(f.s.name))}'s page</button>`);
  } else if (s.t === "conflict") {
    const cf = S.conflicts[0]; if (!cf) { S.sheet = null; host.innerHTML = ""; return; }
    const f = findStudent(cf.sid), col = findCol(cf.col);
    const show = m => !m ? "no mark" : isScored(m) && m.pts != null ? `${m.pts}/${m.outOf || (col && col.col.outOf)}` : LABEL[m.status] || m.status;
    const mineText = cf.mine && cf.mine.del ? "no mark" : show({ ...(cf.mark || {}), ...((cf.mine && cf.mine.patch) || {}) });
    html = sheetFrame("Changed elsewhere", esc(f ? f.s.name : cf.sid) + " · " + esc(col ? col.col.title : cf.col),
      `<p class="lede">${cf.mark && cf.mark.by === "claude" ? "Claude" : "Another device"} changed this mark to <b>${esc(show(cf.mark))}</b> while you made it <b>${esc(mineText)}</b>.</p><p class="small muted">Only this one mark is asking. Everything else saved.</p>`,
      `<button class="btn inkb block" data-act="cfmine">Keep mine · ${esc(mineText)}</button><button class="btn sunk block" data-act="cftheirs">Use theirs · ${esc(show(cf.mark))}</button>`);
  }
  host.innerHTML = html;
  if (s.t === "qscore") { const el = host.querySelector(".sheet"); if (el) el.classList.add("wide"); }
  const sb = host.querySelector(".sb"); if (sb) sb.scrollTop = top;
}

/* ---------------------------------------------------------------- scoring a whole class */
// The "out of" a quick-score sheet writes with: what the teacher typed in the sheet, else the
// column's, else what the marks already carry, else 10 for a homework's accuracy.
function qOut(c, col) {
  if (S.sheet && S.sheet.t === "qscore" && S.sheet.outOf != null) return S.sheet.outOf;
  if (col.outOf) return col.outOf;
  for (const st of c.students) { const m = mark(col.id, st.id); if (m && m.outOf) return m.outOf; }
  return isComp(col) ? 10 : "";
}
function qSave(t) {
  const col = colOf(t.dataset.cid), sid = t.dataset.sid, m = mark(col.id, sid) || {}, f = findCol(col.id);
  if (t.dataset.qs === "note") { if ((m.note || "") !== t.value) writeMark(col, sid, { note: t.value }, { toast: "Note saved" }); return; }
  const v = t.value.trim();
  if (v === "") { if (m.pts != null) writeMark(col, sid, { pts: null }, { toast: "Score cleared" }); return; }
  const n = Number(v), out = Number(qOut(f.c, col));
  if (!(n >= 0) || n > 1000) { toast("That isn't a score"); t.value = m.pts ?? ""; return; }
  if (!(out > 0)) { toast("Fill in “out of” first"); t.value = m.pts ?? ""; return; }
  if (m.pts === n && m.outOf === out) return;
  const patch = isComp(col) ? { pts: n, outOf: out, ...(COMP[m.status] == null || m.status === "notin" ? { status: "done" } : {}) } : { status: "scored", pts: n, outOf: out };
  writeMark(col, sid, patch, { toast: `${first((f.c.students.find(x => x.id === sid) || {}).name)} · ${n}/${out}${n > out ? " (over the top)" : ""} · saved` });
}

/* ---------------------------------------------------------------- actions */
function go(view, extra = {}) {
  Object.assign(S, { view, showAll: false, allNotes: false, editProfile: false, buf: "" }, extra);
  S.sheet = null; $("#sheethost").innerHTML = "";
  render(); window.scrollTo(0, 0);
}
function colOf(cid) { const f = findCol(cid); return f && f.col; }
function setPts(col, sid, pts) {
  const m = mark(col.id, sid) || {};
  writeMark(col, sid, { pts: Math.max(0, pts), ...(m.outOf || !col.outOf ? {} : { outOf: col.outOf }), ...(isScored(m) ? {} : { status: "scored" }) }, { toast: `${(findStudent(sid) || {}).s?.name || ""} · ${short(col.title)} saved` });
}
async function scoreXT(cls, sid, v) {
  const it = dayList(S.day).find(x => x.k === cls), d = planDay(cls, S.day) || {}, pd = planDays().find(x => x.key === S.day) || {};
  const course = it.c.course, c = courseOf(course), id = `xt-${course}-${pd.iso}`;
  if (!c.columns.some(x => x.id === id)) {
    const j = await post("api/xt", { course, date: pd.iso, week: S.d.week, title: "Exit ticket · " + String(d.focus || it.c.name).replace(/<[^>]+>/g, ""), q: d.exit && d.exit.q, a: d.exit && d.exit.a });
    if (!j) return;
    c.columns.push({ id, week: S.d.week, kind: "XT", title: "Exit ticket · " + String(d.focus || it.c.name).replace(/<[^>]+>/g, ""), due: pd.iso, outOf: 2 });
  }
  const col = c.columns.find(x => x.id === id);
  const patch = v === "a" ? { status: "absent", pts: null, outOf: null } : { status: "scored", pts: v === "r" ? 2 : v === "h" ? 1 : 0, outOf: 2 };
  writeMark(col, sid, patch, { toast: `${first((c.students.find(s => s.id === sid) || {}).name)} · ${{ r: "Right", h: "Half", w: "Wrong", a: "Away" }[v]} · saved` });
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const a = t.dataset.act, v = t.dataset.v, sid = t.dataset.sid, cid = t.dataset.cid;
  if (t.tagName === "A" && t.getAttribute("href")) return;
  switch (a) {
    case "go": go(v, v === "students" || v === "grades" ? { sid: null, cid: null } : {}); break;
    case "reload": load(); break;
    case "theme": LS.set("btb.theme", THEMES[(THEMES.indexOf(btbTheme.mode()) + 1) % THEMES.length]); btbTheme.apply(); render(); break;
    case "day": S.day = v; S.cls = defaultCls(v); render(); break;
    case "cls": S.cls = v; render(); break;
    case "openday": go("today", { day: t.dataset.day, cls: t.dataset.cls }); break;
    case "grades-toggle": S.gradesOpen = !S.gradesOpen; LS.set("btb.grades", S.gradesOpen ? "1" : "0"); render(); break;
    case "course": S.course = v; S.sel = null; S.gweek = null; render(); break;
    case "gmode": S.gmode = v; LS.set("btb.gmode", v); render(); break;
    case "gweek": if (v !== "") { S.gweek = +v; S.sel = null; render(); } break;
    case "weeknav": if (v !== "") { S.week = +v; load(); } break;
    case "wtab": S.wtab = v; render(); break;
    case "lib": S.lib = v; render(); break;
    case "filter": S.filter = v; render(); break;
    case "sort": S.sort = S.sort === "low" ? "name" : "low"; render(); break;
    case "showall": S.showAll = !S.showAll; render(); break;
    case "allnotes": S.allNotes = !S.allNotes; render(); break;
    case "student": go("student", { sid, back: S.view === "grades" ? "grades" : S.view === "student" ? S.back : "students" }); break;
    case "sheetcol": if (cid) go("sheet", { cid }); break;
    case "cell": openSheet({ t: "edit", sid, week: +t.dataset.week }); break;
    case "edit": openSheet({ t: "edit", sid, cid }); break;
    case "editnav": S.sheet.sid = sid; renderSheet(); break;
    case "wcell": if (desk()) { S.sel = { sid, cid }; S.buf = ""; render(); } else openSheet({ t: "edit", sid, cid }); break;
    case "status": { const col = colOf(cid), m = mark(cid, sid) || {}; if (m.status === v) break;
      writeMark(col, sid, { status: v }, { toast: `${short(col.title)} · ${LABEL[v]} · saved` }); break; }
    case "ptsstep": { const col = colOf(cid), m = mark(cid, sid) || {}; setPts(col, sid, (m.pts || 0) + +v); break; }
    case "code": { const col = colOf(cid), m = mark(cid, sid) || {}; const codes = (m.r || col.items.map(() => "-").join(" ")).split(" ");
      const i = +v, order = ["2", "1", "0", "-"]; codes[i] = order[(order.indexOf(codes[i] || "-") + 1) % 4];
      const tried = codes.filter(k => k !== "-").length, pts = codes.reduce((s, k) => s + (k === "-" ? 0 : +k), 0);
      writeMark(col, sid, { r: codes.join(" "), pts, outOf: tried * 2, status: "scored" }); break; }
    case "accept": writeMark(colOf(cid), sid, { checked: true }, { toast: "Checked" }); break;
    case "useprop": { const m = mark(cid, sid); writeMark(colOf(cid), sid, { pts: m.proposed.pts, outOf: m.proposed.outOf, status: "scored", ...(m.proposed.note ? { note: m.proposed.note } : {}) }, { toast: "Claude's score used" }); break; }
    case "acceptall": { const col = colOf(cid), c = findCol(cid).c; const list = c.students.map(s => ({ s, m: mark(cid, s.id) })).filter(x => isClaude(x.m) && x.m.conf === "high" && x.m.status !== "nopage");
      writeMany(list.map(x => ({ col, sid: x.s.id, patch: { checked: true } }))); toast(`${list.length} checked`); break; }
    case "weekabs": { const f = findStudent(sid); for (const col of f.c.columns.filter(x => x.week === +t.dataset.week)) writeMark(col, sid, { status: "absent" }, { noUndo: true }); toast(`${first(f.s.name)} absent for week ${t.dataset.week}`); break; }
    case "xt": { const col = colOf(cid); writeMark(col, sid, { pts: v === "r" ? 2 : v === "h" ? 1 : 0, outOf: 2 }); break; }
    case "xtscore": scoreXT(t.dataset.cls, sid, v); break;
    case "score": openSheet({ t: "score", cls: t.dataset.cls }); break;
    case "hwin": openSheet({ t: "hwin", cid }); break;
    case "hwnew": openSheet({ t: "hwnew", cls: t.dataset.cls }); break;
    case "hwset": { const col = colOf(cid), m = mark(cid, sid) || {}, f = findStudent(sid); if (m.status === v) break;
      writeMark(col, sid, { status: v }, { toast: `${first(f && f.s.name)} · ${LABEL[v]} · saved` }); break; }
    case "hwrest": { const f = findCol(cid), rest = f.c.students.filter(st => !mark(cid, st.id));
      writeMany(rest.map(st => ({ col: f.col, sid: st.id, patch: { status: v } }))); toast(`${rest.length} marked ${LABEL[v].toLowerCase()}`); break; }
    case "hwsave": { const cls = t.dataset.cls, cl = school().classes[cls], title = ((document.getElementById("hwt") || {}).value || "").trim(), due = (document.getElementById("hwd") || {}).value || "";
      const assigned = dayIso(S.day) || isoOf();
      if (!title) { toast("Say what the homework is"); break; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due < assigned) { toast("Pick a due date on or after today"); break; }
      post("api/hw", { course: cl.course, title, due, assigned, week: S.d.week }, j => { const c = courseOf(cl.course); if (c && !c.columns.some(x => x.id === j.col.id)) c.columns.push(j.col); closeSheet(); toast(`Set · ${dueTxt(due, assigned)}`); }); break; }
    case "warmup": openSheet({ t: "warmup", cls: t.dataset.cls }); break;
    case "handouts": openSheet({ t: "handouts", cls: t.dataset.cls }); break;
    case "copyfolder": { const h = handFor(t.dataset.cls, S.day), x = h && h.copies[+t.dataset.i]; if (!x) break;
      copyText(folderPath(x.dir)).then(ok => toast(ok ? x.label + " copied" : "Couldn't copy. Press and hold the path to select it.")); break; }
    case "swap": post("api/override", { week: S.d.week, cls: t.dataset.cls, day: S.day, warmup: v || null }, j => { S.d.overrides = j.overrides; toast(v ? "Warm-up swapped" : "Back to the planned game"); render(); }); break;
    case "excuse": { const col = colOf(cid), now = !colX(col); post("api/column", { col: cid, excused: now }, () => { (S.d.marks[cid] = S.d.marks[cid] || { students: {} }).excused = now; render(); }); break; }
    case "profedit": S.editProfile = true; render(); break;
    case "profcancel": S.editProfile = false; render(); break;
    case "profsave": { const val = id => (document.getElementById(id) || {}).value || "", split = s => s.split(",").map(x => x.trim()).filter(Boolean);
      const data = { focus: val("pf").trim(), solid: split(val("ps")), work: split(val("pw")) };
      api("PUT", "api/profile", { sid, data, force: true }).then(j => { S.d.profiles[sid] = j.profile; S.editProfile = false; setSave("saved"); render(); }).catch(err => toast("Couldn't save: " + err.message)); break; }
    case "jump": { const el = document.getElementById("step-" + v); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); break; }
    case "akind": S.akind = v; LS.set("btb.akind", v); render(); break;
    case "amiss": S.amiss = !S.amiss; render(); break;
    case "asgmiss": S.gmode = "asg"; S.amiss = true; LS.set("btb.gmode", "asg"); render(); window.scrollTo(0, 0); break;
    case "qscore": openSheet({ t: "qscore", cid }); break;
    case "qstat": { const col = colOf(cid), m = mark(cid, sid) || {}, f = findStudent(sid); if (m.status === v) break;
      writeMark(col, sid, { status: v }, { toast: `${first(f && f.s.name)} · ${LABEL[v]} · saved` }); break; }
    case "newcol": openSheet({ t: "newcol", kind: v }); break;
    case "colsave": { const val = id => ((document.getElementById(id) || {}).value || "").trim(), title = val("nct"), due = val("ncd"), c = courseOf(S.course);
      if (!title) { toast("Say what it is"); break; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) { toast("Pick a date"); break; }
      const wk = (S.d.weeks || []).find(w => w.startsOn && due >= w.startsOn && due <= (w.endsOn || w.startsOn)), week = wk ? wk.week : S.d.week;
      const done = j => { if (c && !c.columns.some(x => x.id === j.col.id)) c.columns.push(j.col); toast("Added"); openSheet({ t: "qscore", cid: j.col.id }); };
      if (v === "TEST") { const outOf = Number(val("nco")); if (!(outOf > 0)) { toast("Out of needs a number"); break; } post("api/test", { course: S.course, title, due, outOf, week }, done); }
      else { const assigned = val("nca"); if (!/^\d{4}-\d{2}-\d{2}$/.test(assigned) || due < assigned) { toast("Due has to be on or after the day it's handed out"); break; } post("api/hw", { course: S.course, title, due, assigned, week }, done); }
      break; }
    case "snote": openSheet({ t: "snote", sid }); break;
    case "hwedit": openSheet({ t: "hwedit", cid }); break;
    case "hwesave": { const f = findCol(cid); if (!f) break;
      const val = id => ((document.getElementById(id) || {}).value || "").trim(), title = val("hwe-t"), assigned = val("hwe-a"), due = val("hwe-d");
      if (!title) { toast("Say what the homework is"); break; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || (assigned && !/^\d{4}-\d{2}-\d{2}$/.test(assigned))) { toast("Pick the dates"); break; }
      if (assigned && due < assigned) { toast("Due has to be on or after the day it's handed out"); break; }
      post("api/hwedit", { course: f.cid, col: cid, title, due, ...(assigned ? { assigned } : {}) }, j => { Object.assign(f.col, j.col); closeSheet(); toast(`Saved · ${dueTxt(j.col.due, isoOf())}`); }); break; }
    case "hwedel": { const f = findCol(cid); if (!f) break;
      post("api/hwedit", { course: f.cid, col: cid, del: true }, () => { f.c.columns = f.c.columns.filter(x => x.id !== cid); closeSheet(); if (S.view === "sheet" && S.cid === cid) go("grades"); toast("Homework removed"); }); break; }
    case "snsave": case "snadd": { const ta = document.getElementById(a === "snsave" ? "snq" : "sn-" + sid), text = ((ta || {}).value || "").trim();
      const col = a === "snadd" ? ((document.getElementById("snc-" + sid) || {}).value || null) : null;
      if (!text) { toast("Write the note first"); break; }
      post("api/snote", { sid, text, col }, j => { (S.d.snotes = S.d.snotes || {})[sid] = j.doc; if (a === "snsave") closeSheet(); else render(); toast("Note kept"); }); break; }
    case "sndel": post("api/snote", { sid, id: v, del: true }, j => { (S.d.snotes = S.d.snotes || {})[sid] = j.doc; render(); toast("Note removed"); }); break;
    case "copynotes": { const f = findStudent(sid); if (!f) break;
      const txt = f.s.name + "\n" + notesFor(f.c, sid).map(n => `- ${n.at ? new Date(n.at).toLocaleDateString([], { month: "short", day: "numeric" }) + ": " : ""}${n.text}${n.col ? " (" + n.col.title + ")" : ""}`).join("\n");
      copyText(txt).then(ok => toast(ok ? "Notes copied" : "Couldn't copy")); break; }
    case "print": window.print(); break;
    case "scan": $("#scanin").click(); break;
    case "undo": undo(); break;
    case "close": closeSheet(); break;
    case "cfmine": { const cf = S.conflicts.shift(); const col = colOf(cf.col); if (cf.mine) writeMark(col, cf.sid, cf.mine.patch || {}, { del: cf.mine.del, force: true, noUndo: true }); S.conflicts.length ? renderSheet() : closeSheet(); break; }
    case "cftheirs": { const cf = S.conflicts.shift(); const doc = S.d.marks[cf.col] || (S.d.marks[cf.col] = { students: {} }); if (cf.mark) doc.students[cf.sid] = cf.mark; else delete doc.students[cf.sid]; S.conflicts.length ? renderSheet() : closeSheet(); render(); break; }
  }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.f && t.dataset.cid) {
    const col = colOf(t.dataset.cid), sid = t.dataset.sid, f = t.dataset.f;
    if (f === "inc") writeMark(col, sid, { inc: t.checked });
    else if (f === "note") { if ((mark(col.id, sid) || {}).note !== t.value) writeMark(col, sid, { note: t.value }, { toast: "Note saved" }); }
    else { const n = t.value.trim() === "" ? null : Number(t.value); if (n !== null && !(n >= 0)) { toast("That isn't a number"); render(); return; }
      const m = mark(col.id, sid) || {};
      // A homework score is its accuracy; it keeps the homework's done/partial, it never becomes "scored".
      const st = isComp(col) ? (n != null && (COMP[m.status] == null || m.status === "notin") ? { status: "done" } : {}) : isScored(m) ? {} : { status: "scored" };
      writeMark(col, sid, { [f]: n, ...st }, { toast: "Saved" }); }
  } else if (t.dataset.qs) {
    if (t.dataset.qs === "out") { const n = Number(t.value); if (n > 0) { S.sheet.outOf = n; toast("Out of " + n); } else { toast("Out of needs a number"); t.value = qOut(findCol(S.sheet.cid).c, colOf(S.sheet.cid)); } }
    else qSave(t);
  } else if (t.dataset.cnote) {
    post("api/classnote", { cls: t.dataset.cnote, date: t.dataset.date, week: S.d.week, day: S.day, text: t.value }, j => { (S.d.cnotes = S.d.cnotes || {})[t.dataset.cnote] = j.doc; toast(t.value.trim() ? "Note saved for Claude" : "Note removed"); });
  } else if (t.dataset.prep) {
    post("api/prep", { week: S.d.week, id: t.dataset.prep, on: t.checked }, j => { S.d.prep = j.prep; render(); });
  } else if (t.dataset.req !== undefined && t.dataset.req) {
    post("api/request", { key: t.dataset.req, label: t.dataset.label, text: t.value.trim() }, j => { S.d.requests = j.requests; toast(t.value.trim() ? "Claude will see this next time" : "Note removed"); });
  } else if (t.dataset.sheetnote) {
    post("api/column", { col: t.dataset.sheetnote, sheetNote: t.value }, () => { (S.d.marks[t.dataset.sheetnote] = S.d.marks[t.dataset.sheetnote] || { students: {} }).sheetNote = t.value; toast("Class note saved"); });
  } else if (t.id === "scanin") {
    const files = [...t.files]; t.value = "";
    (async () => { let n = 0; for (const f of files) { try { await api("POST", "api/scan", await f.arrayBuffer(), { "content-type": f.type || "image/jpeg", "x-course": S.course || "" }); n++; } catch (err) { toast("A scan didn't send: " + err.message); } }
      if (n) { toast(`${n} scan${n > 1 ? "s" : ""} sent to the inbox for Claude`); load(); } })();
  }
});
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.req !== undefined) { e.target.blur(); return; }
  // Quick score: Enter saves this student and moves to the next one's score.
  if (e.key === "Enter" && e.target.dataset && (e.target.dataset.qs === "pts" || e.target.dataset.qs === "out")) {
    e.preventDefault(); const i = e.target.dataset.qs === "out" ? -1 : +e.target.dataset.i; e.target.blur();
    setTimeout(() => { const nx = document.querySelector(`#sheethost [data-qs="pts"][data-i="${i + 1}"]`); if (nx) { nx.focus(); nx.select(); } }, 0); return; }
  if (e.key === "Escape" && S.sheet) { closeSheet(); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); undo(); return; }
  if (typing || S.sheet || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key.toLowerCase() === "g" && S.view === "today" && desk()) { S.gradesOpen = !S.gradesOpen; LS.set("btb.grades", S.gradesOpen ? "1" : "0"); render(); return; }
  if (!(S.view === "grades" && S.gmode === "week" && desk() && S.sel)) return;
  const c = courseOf(S.course), w = gweekOf(c), cols = c.columns.filter(x => x.week === w);
  let r = c.students.findIndex(s => s.id === S.sel.sid), k = cols.findIndex(x => x.id === S.sel.cid);
  const col = cols[k], sid = S.sel.sid, m = mark(col.id, sid);
  const move = (dr, dk) => { r = Math.max(0, Math.min(c.students.length - 1, r + dr)); k = Math.max(0, Math.min(cols.length - 1, k + dk)); S.sel = { sid: c.students[r].id, cid: cols[k].id }; S.buf = ""; render(); };
  const commit = () => { if (S.buf !== "") { const n = Number(S.buf); S.buf = ""; if (n >= 0) { if (isComp(col)) return; setPts(col, sid, n); } } else if (isClaude(m)) writeMark(col, sid, { checked: true }, { toast: "Checked" }); };
  const key = e.key;
  if (/^[0-9.]$/.test(key) && !isComp(col) && col.kind !== "XT") { e.preventDefault(); S.buf += key; render(); return; }
  if (key === "Backspace" && S.buf) { e.preventDefault(); S.buf = S.buf.slice(0, -1); render(); return; }
  if (key === "Enter") { e.preventDefault(); commit(); move(1, 0); return; }
  if (key === "Tab") { e.preventDefault(); commit(); move(0, e.shiftKey ? -1 : 1); return; }
  if (key === "ArrowDown") { e.preventDefault(); move(1, 0); return; } if (key === "ArrowUp") { e.preventDefault(); move(-1, 0); return; }
  if (key === "ArrowRight") { e.preventDefault(); move(0, 1); return; } if (key === "ArrowLeft") { e.preventDefault(); move(0, -1); return; }
  if (key === "Escape") { S.buf = ""; render(); return; }
  const lk = key.toLowerCase();
  const stat = isComp(col) ? { d: "done", p: "partial", i: "notin", a: "absent", x: "excused" } : { m: "missing", a: "absent", x: "excused" };
  if (stat[lk]) { e.preventDefault(); writeMark(col, sid, { status: stat[lk] }, { toast: `${LABEL[stat[lk]]} · saved` }); move(1, 0); return; }
  if (lk === "n") { e.preventDefault(); const ta = document.querySelector(".inspector textarea"); if (ta) ta.focus(); }
});
document.addEventListener("focusout", () => setTimeout(() => { if (S.pending && !busyIn("#app") && !sheetBusy()) load(); }, 50));

/* ---------------------------------------------------------------- live */
async function poll() {
  if (document.hidden || !S.d) return;
  try {
    const j = await api("GET", "api/rev");
    if (j.rev == null) { if (S.save !== "ro") { S.d = { ok: false, error: "not_mounted" }; S.save = "ro"; render(); } return; }
    if (!S.d.ok) { load(); return; }
    if (j.rev !== S.d.rev && !S.q.length && !S.flushing) {
      if (busyIn("#app") || sheetBusy()) S.pending = true; else load();
    }
  } catch {}
}
function tick() {
  retheme();                                   // sunset passes without a new sun reading
  if (!S.d || !S.d.ok) return;
  const day = todayKey(), live = day ? (liveInfo(day).live || {}).k || null : null;
  if (S.lastLive !== undefined && live && live !== S.lastLive && S.gradesOpen) { S.gradesOpen = false; LS.set("btb.grades", "0"); }  // a new class: grades go away
  S.lastLive = live;
  if (S.view === "today" && !busyIn("#app") && !S.sheet) render();
}
setInterval(poll, 4000); setInterval(tick, 20000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
window.btbTheme?.mq.addEventListener?.("change", retheme);
setInterval(fetchSun, 600e3);
window.matchMedia("(min-width: 900px)").addEventListener?.("change", () => render());

(function start() {
  try { const [v, course, id] = decodeURIComponent(location.hash.slice(1)).split("/");
    if (v) S.view = v; if (course) S.course = course; if (v === "student") S.sid = id; if (v === "sheet") S.cid = id; } catch {}
  fetchSun();
  load().then(() => { if (S.q.length) flush(); tick(); });
})();
