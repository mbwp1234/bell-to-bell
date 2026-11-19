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

## Theme

The header's theme button cycles **Auto → Light → Dim → Night**; the choice is kept per device.
Auto follows the device: a device in light mode gets Light; a device in dark mode gets **Dim** (the
light theme one step down) while the sun is up and **Night** after sunset. Sunset comes from
Home Assistant's `sun.sun`; if that can't be read, a dark device gets Night. A class `color` pair
uses its dark half only in Night.

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
Gradebook/notes/<id>.json       { items:[{id, at, by, text, col?}] } notes on one student, for report cards
Notes/<class>.json              { notes:[{date, week, day, text, by, at}] } the teacher's note on each class day
requests.json                   notes typed into the app for whoever plans next
activity.jsonl                  one line per change
```

`school.json` → `classes.<key>`: `name`, `short`, `kind` (a key of `rails`), `color` `[light, dark]`,
`start` `"HH:MM"`, `len` minutes, `meets` `["mon",…]`, `course` (a gradebook course id or null),
`folder` (handouts, relative, `{week}` is replaced).
`folderRoot` (top level, optional): where your own computer sees the data folder (on a Mac,
the mounted share's path). The Handouts sheet's **Copy** buttons copy `folderRoot` + the
folder, so the path pastes straight into Finder (⇧⌘G) or Explorer. Without it they copy the relative path.
`rails.<kind>`: `[{ k, from, to, name, tag }]` in minutes from the bell.

A plan day (`Plans/week-NN.json` → `classes.<key>.days.<day>`) carries `focus`, `sub`, and one field
per rail step key (`warm`, `board {cap, lines}`, `group`, `exit {q, a}`, …), plus `watch []`,
`warmup` (a game key), `folder` (that day's own handouts folder, relative, instead of the class's), `print []` (what to print that day, shown as a Print box on the day card) and `gap: true` for a day without a plan. `<b>`, `<strong>`, `<em>` render.

A homework column (`kind` `HW` or `XP`, in the course file) may carry `assigned` and `due`
(`YYYY-MM-DD`). On Today, the class's day card says **Hand out** on `assigned` and **Collect** on
`due`, with a Check in list, and **Still out** for the last two weeks' homework that has students
not in or was never checked in. **+ Set homework** on the card writes a new one.

A mark: `status` (`scored missing absent excused nopage` / homework `done partial notin`), `pts`,
`outOf` (2 × problems tried), `inc`, `note`, `r` (one code per item: `2` right, `1` method, `0`
wrong, `-` blank), and `by`/`at`/`checked`/`conf`. A mark written by another tool with
`by: "claude"` and `checked: false` shows a diamond until it is checked in the app. A blank is
never zero.

## Grading

`school.json` → `grading` (optional): `{ "tests": 60, "homework": 40, "completion": 70, "accuracy": 30 }`.
The grade counts `TEST` and `HW` columns only. A test is `pts` over the whole test (the larger of
the column's and the mark's `outOf`), summed across tests. A homework is completion (`done` 1,
`partial` ½, `notin` 0) mixed with accuracy (`pts / outOf`) by `completion : accuracy`; with no
`pts` it counts on completion alone. `absent`, `excused`, `nopage` and no mark are left out, never
zero. A `missing` test is left out of the average and counted as missing. `CW`, `SUB`, `XP` and
`XT` are shown and never counted.
