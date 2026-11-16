# Bell to Bell

A Home Assistant app that puts a classroom day planner and a gradebook in one sidebar panel.

- **Today**: the day's classes in clock order, each one as a timed rail (warm-up, worked example,
  small group, exit ticket…), with the live step marked. The small group is picked from the gradebook.
- **Week**: every class at a glance, a prep checklist shared across devices, and a library of
  warm-up games and prompts.
- **Grades**: a week-by-week grid, a one-week grid you can type into, one page per assignment
  (problem-by-problem, reteach notes) and one per student (printable for a conference).
- **Saves as you go**: every tap writes one mark to its own file. Edits queue on the device when the
  storage is unreachable, conflicting edits ask instead of overwriting, and there is undo.
- **Hidden by default on a big screen**: on a desktop the grades stay closed until you press **G**,
  and close again when the next class starts, so they never appear on a projector.

Everything lives as plain JSON files in a folder you choose (usually network storage), so other
tools, or an AI assistant, can read and add plans and scores by writing files. See
[`bell_to_bell/DOCS.md`](bell_to_bell/DOCS.md) for the folder layout.

## Install

1. Settings › System › Storage › **Add network storage**: name it `classes`, usage **Share**.
2. Settings › Apps › App store › ⋮ › Repositories › add `https://github.com/mbwp1234/bell-to-bell`.
3. Install **Bell to Bell**, start it. The panel is **School**, visible to admins only.

## Privacy

This repository contains code only. No names, schools or grades are ever committed. The tests use
invented data, and `tools/privacy-check.mjs` runs as pre-commit, commit-msg and pre-push hooks
(`sh tools/install-hooks.sh`) against a private list of real names that lives outside the repo.

## Develop

```
node test/smoke.mjs          # starts the server over invented data and drives the API
DATA_DIR=/path/to/folder INGRESS_ONLY=0 node bell_to_bell/server.mjs
```
No build step, no dependencies.
