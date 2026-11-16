#!/usr/bin/env node
// Privacy gate. This repo is public; the data it serves is not. Nothing that names a
// person, a place, a school or a home network may be committed or pushed.
//
// Two layers:
//   1. Generic patterns that are never right here: e-mail addresses, LAN IP addresses,
//      absolute home/NAS paths.
//   2. A private denylist of real names, kept OUTSIDE this repo (one term per line,
//      case-sensitive, whole-word). Path: $BTB_DENYLIST, else ../bell-to-bell-private/denylist.txt.
//      If the denylist is missing the check FAILS: a gate that silently skips is no gate.
//
// Modes (installed as git hooks by tools/install-hooks.sh):
//   --staged          pre-commit: every staged file, as staged
//   --msg <file>      commit-msg: the commit message
//   --push            pre-push: every commit about to leave (message, author, whole tree)
//   --all             everything: working tree files plus every commit in history
//   --text <file>     one file on disk (used by the tests)
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "buffer", maxBuffer: 256 << 20 });
const gits = (...a) => git(...a).toString("utf8");

const ALLOWED_EMAILS = [/@users\.noreply\.github\.com$/i, /^noreply@anthropic\.com$/i, /@example\.(com|org|net)$/i];
const ALLOWED_IPS = new Set(["127.0.0.1", "0.0.0.0", "172.30.32.2", "172.30.32.1", "255.255.255.255"]);
const ALLOWED_IDENTITY = /^(mbwp1234 <143548329\+mbwp1234@users\.noreply\.github\.com>|GitHub <noreply@github\.com>)$/;

function loadDeny() {
  const file = process.env.BTB_DENYLIST || path.resolve(ROOT, "..", "bell-to-bell-private", "denylist.txt");
  if (!existsSync(file)) { console.error(`privacy-check: denylist not found at ${file}. Refusing.`); process.exit(2); }
  const terms = readFileSync(file, "utf8").split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("#"));
  if (!terms.length) { console.error("privacy-check: denylist is empty. Refusing."); process.exit(2); }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return terms.map(t => ({ t, re: /^\w[\w ]*\w$|^\w$/.test(t) ? new RegExp(`(?<![\\w])${esc(t)}(?![\\w])`) : new RegExp(esc(t)) }));
}
const DENY = loadDeny();

// The denylist terms are never printed: a CI log is public too. Only where, and which line.
function scan(label, text, out) {
  if (text.includes("\u0000")) return;             // binary: no text to leak (images are refused below)
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const at = `${label}:${i + 1}`;
    for (const { re } of DENY) if (re.test(line)) out.push(`${at}  matches a private denylist term`);
    for (const m of line.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g))
      if (!ALLOWED_EMAILS.some(r => r.test(m[0]))) out.push(`${at}  e-mail address`);
    for (const m of line.matchAll(/(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])/g)) {
      const ip = m.slice(1, 5).map(Number);
      if (ip.some(n => n > 255) || ALLOWED_IPS.has(ip.join("."))) continue;
      if (ip[0] === 10 || ip[0] === 192 && ip[1] === 168 || ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31 || ip[0] === 100 && ip[1] >= 64)
        out.push(`${at}  LAN IP address`);
    }
    if (/\/Volumes\/|\/Users\/[a-z]|\\\\[A-Za-z0-9-]+\\|smb:\/\//.test(line)) out.push(`${at}  absolute local path`);
  });
}
const BINARY_OK = /\.(png|svg|ico)$/i;           // only our own icon/art may be binary
function scanFile(label, buf, out) {
  if (/\.(jpe?g|heic|pdf|docx?|xlsx?|csv|mov|mp4)$/i.test(label)) { out.push(`${label}  file type that can carry personal data`); return; }
  if (buf.includes(0) && !BINARY_OK.test(label)) { out.push(`${label}  unexpected binary file`); return; }
  scan(label, buf.toString("utf8"), out);
}
function scanCommit(sha, out) {
  const ident = gits("show", "-s", "--format=%an <%ae>%n%cn <%ce>", sha).trim().split("\n");
  for (const id of ident) if (!ALLOWED_IDENTITY.test(id)) out.push(`${sha.slice(0, 8)}  author/committer identity is not the anonymous one`);
  scan(`${sha.slice(0, 8)} message`, gits("show", "-s", "--format=%B", sha), out);
  for (const f of gits("ls-tree", "-r", "--name-only", sha).split("\n").filter(Boolean))
    scanFile(`${sha.slice(0, 8)}:${f}`, git("show", `${sha}:${f}`), out);
}

const [mode, arg] = process.argv.slice(2);
const problems = [];
if (mode === "--staged") {
  for (const f of gits("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").split("\0").filter(Boolean))
    scanFile(f, git("show", `:${f}`), problems);
  const id = `${gits("config", "user.name").trim()} <${gits("config", "user.email").trim()}>`;
  if (!ALLOWED_IDENTITY.test(id)) problems.push("git identity is not the anonymous one (see tools/install-hooks.sh)");
} else if (mode === "--msg") {
  scan("commit message", readFileSync(arg, "utf8").split("\n").filter(l => !l.startsWith("#")).join("\n"), problems);
} else if (mode === "--push") {
  const input = readFileSync(0, "utf8").trim();
  for (const line of input.split("\n").filter(Boolean)) {
    const [, local] = line.split(" ");
    if (/^0+$/.test(local)) continue;               // a delete
    for (const sha of gits("rev-list", local, "--not", "--remotes").split("\n").filter(Boolean)) scanCommit(sha, problems);
    for (const t of gits("tag", "--points-at", local).split("\n").filter(Boolean)) scan(`tag ${t}`, gits("tag", "-l", "--format=%(contents)", t), problems);
  }
} else if (mode === "--all") {
  for (const f of gits("ls-files", "-z").split("\0").filter(Boolean)) scanFile(f, readFileSync(path.join(ROOT, f)), problems);
  let shas = ""; try { shas = gits("rev-list", "--all"); } catch {}
  for (const sha of shas.split("\n").filter(Boolean)) scanCommit(sha, problems);
} else if (mode === "--text") {
  scanFile(arg, readFileSync(arg), problems);
} else {
  console.error("usage: privacy-check.mjs --staged | --msg <file> | --push | --all | --text <file>"); process.exit(2);
}
if (problems.length) {
  console.error(`privacy-check: REFUSED — ${problems.length} problem(s):\n  ` + [...new Set(problems)].join("\n  "));
  process.exit(1);
}
console.error(`privacy-check: clean (${mode}, ${DENY.length} private terms checked)`);
