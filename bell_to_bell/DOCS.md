# Bell to Bell

The app reads and writes one folder, `data_dir` (default `/share/classes`, i.e. network storage
named `classes` with usage *Share*). If that folder is not mounted the app shows "Can't reach the
folder" and refuses every edit; it never writes to the container's own disk in its place.

## Options

| Option | Default | What |
|---|---|---|
| `data_dir` | `/share/classes` | the folder below |
| `now_sensor` | `true` | publishes `sensor.bell_to_bell_now` ("<class> · <step> until <time>") |
| `bell_notify` | `[]` | notify services (e.g. `mobile_app_my_phone`) for a heads-up before each class |
| `bell_minutes` | `2` | how many minutes before |

## The folder

```
school.json                     classes, rails, warm-up games, prompts
Plans/week-NN.json              one week
Gradebook/courses/<id>.json     { name, students:[{id,name}], columns:[{id,week,kind,title,due,outOf,items}] }
Gradebook/marks/<column>.json   { students:{ <id>: mark }, sheetNote, excused }
Gradebook/profiles/<id>.json    { focus, solid:[], work:[] }
Gradebook/inbox/                scans from the Scan button
Gradebook/scans/<column>/       scans that have been scored
state/                          prep ticks and warm-up swaps (the app's own)
requests.json                   notes typed into the app for whoever plans next
activity.jsonl                  one line per change
```

`school.json` → `classes.<key>`: `name`, `short`, `kind` (a key of `rails`), `color` `[light, dark]`,
`start` `"HH:MM"`, `len` minutes, `meets` `["mon",…]`, `course` (a gradebook course id or null),
`folder` (handouts, relative, `{week}` is replaced).
`rails.<kind>`: `[{ k, from, to, name, tag }]` in minutes from the bell.

A plan day (`Plans/week-NN.json` → `classes.<key>.days.<day>`) carries `focus`, `sub`, and one field
per rail step key (`warm`, `board {cap, lines}`, `group`, `exit {q, a}`, …), plus `watch []`,
`warmup` (a game key) and `gap: true` for a day without a plan. `<b>`, `<strong>`, `<em>` render.

A mark: `status` (`scored missing absent excused nopage` / homework `done partial notin`), `pts`,
`outOf` (2 × problems tried), `inc`, `note`, `r` (one code per item: `2` right, `1` method, `0`
wrong, `-` blank), and `by`/`at`/`checked`/`conf`. A mark written by another tool with
`by: "claude"` and `checked: false` shows a diamond until it is checked in the app. A blank is
never zero.
