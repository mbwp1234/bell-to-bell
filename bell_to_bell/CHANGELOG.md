## 0.7.0
The UX audit, as approved on the mockup canvas.
- **One app bar that never moves.** Today · Week · Grades · Students · Review, then the save
  status and a theme icon. Page actions (+ Test, Scan, the day and week steppers, Show grades)
  sit with the page title. "Saved" no longer shows the seconds; hover it for the time.
- **Review** replaces From Claude and is a section of its own, with its count. Claude's marks are
  reviewed by *change*: the same student excused across 26 assignments for one reason is one
  card and one **Approve 26**. Scored marks stay grouped by assignment; the ones Claude isn't
  sure of are always listed one by one, with the scan. "Looks right" is now **Approve**.
  Dates and assignment ids in Claude's notes read as "Thu Nov 19" and the assignment's title.
- **"Now" is the accent colour.** Rust only ever means a problem. The current class is filled,
  the bar fills to the present, and the step running now is tinted, with no second progress bar.
- **Today:** the day is a stepper beside the title, so the classes are the only row under it.
  Worksheets are all one weight, with a readable name and the file as a caption; the one the
  print list names says *Print today*. The week's note lives on Week.
- **Week:** five day columns on a laptop, today tinted and past days quieter. "Needs a plan" is a
  button, and the subtitle's count jumps to the notes for Claude. Ticked prep folds into one line.
- **Grades:** "How the grade counts" opens the policy instead of it always being on screen. The
  dot grid has a legend, solid colours and a ring for missing work; a week with nothing set shows
  as a hatched "no work" column instead of disappearing. Trends are numbers (↗ +6 pts), not
  "Improving". Slipping says what its number is and shows the grade beside it.
- **Assignments:** columns grouped by week with the type under it; columns that don't count are
  shaded. The name and the Owes / Grade columns are solid with an edge, and the grid snaps to
  whole columns. Scores under 70 are bold rust and the 70s amber ink, no pale greens. Owes shows
  0, not a dash. "Only students who owe work" is a switch of its own.
- **One week:** homework is marked right in the cell (Done / Partial / Not in, ⋯ for the rest),
  with **Mark the other N done**. Columns size to their content. The Week column shows the
  homework's share done, or Ex. The status picker is one row of five.
- **Students:** homework squares are only the marked ones (excused and away are counted in
  words); the dashed line is the class average; a card that needs a check-in says why; filter
  chips plus a Sort menu (name, lowest grade, most missing).

## 0.6.1
- The week's note moves out of the eyebrow onto its own line, so the class name sits right under a short label.
- The homework and print boxes in the side column match the worksheets card, and the column is a touch wider.
- The highlighted worksheet is the one today's print list names, not just the first file.
- **Edit homework**: click a homework's title on Today (or Edit on its page) to change what it
  is, the day it's handed out and the day it's due (`POST api/hwedit`). One nobody has been
  checked in on can be removed; one with check-ins can't, so no mark is orphaned.

## 0.6.0
- **Sidebar says Bell to Bell** instead of School.
- **Today, laptop first.** The plan reads in a wide column in larger type. A bar across the top
  shows every section at its share of the period, the running one lit and filling; click one to
  jump to it. The worksheets sit top right for every class (one click opens the PDF to print
  another copy), with the print list, homework and the exit ticket under them. On a phone those
  come first and a **Worksheet** button sits above the tab bar.
- **Notes for Claude** at the bottom of every class: one note per class per day, saved to
  `Notes/<class>.json`, with the earlier ones folded underneath.
- **The grade that counts.** Tests and homework only, weighted by `school.json` `grading`
  (default tests 60 / homework 40). A test is points over the whole test, added up across tests.
  A homework is 70% completion (done 1, partial ½, not in 0) and 30% accuracy when it has a
  score; one with no score counts on completion alone. Absent, excused, unsorted and unmarked are
  left out, never zero; a missing test is left out of the average and counted as missing.
  Worksheets, sub days, extra practice and exit tickets are still shown and never counted.
- **Grades overview:** class average (tests and homework), what's missing and who owes most, and
  the slipping students with their own graphs and a **+ Note** button. The grid's last column is
  the grade.
- **Assignments grid:** every student against every assignment, missing work boxed in red,
  filters by kind and "only who owes something", and an Owes and a Grade column.
- **Score the class:** a sheet to type a score per student with Enter to move down, missing /
  absent (or done / partial / not in / away for homework), and a note per student. **+ Test**
  (`POST api/test`) and **+ Homework** add the assignment and open it. Homework takes an optional
  accuracy score.
- **Notes for report cards** on each student's page: notes added there or from the Slipping card
  (`Gradebook/notes/<student>.json`, `POST api/snote`), merged with every note on their marks,
  newest first, with Copy all.

## 0.5.0
- **Lighter by day.** New light theme (Mist: soft grey-green, off-white cards) replaces the bright
  white one. A device in dark mode now gets **Dim**, Mist one step darker, while the sun is up,
  and the old dark theme only after sunset, from HA's `sun.sun` (new `GET api/sun`). It flips at
  sunset and sunrise without a reload.
- A **theme button** in the header: Auto / Light / Dim / Night, kept per device.

## 0.4.0
- **Homework on Today.** Each gradebook class's day card has a Homework box: **Hand out** on the
  day a homework column's `assigned` date falls, **Collect** on its `due` date (with how many are
  checked in), and **Still out** for homework from the last two weeks that has students not in or
  was never checked in. Names only show where grades may.
- **Check in** sheet: Done / Partial / Not in / Away per student, one tap each, plus "the rest:
  done" and "the rest: not in". Nobody is marked until you tap.
- **+ Set homework** adds a completion column (`assigned` = that day, `due` defaults to the next
  time the class meets).
- Class pills and the Week list mark days with homework to collect or hand out; the bell heads-up
  notification adds "Collect: … · Hand out: …".

## 0.3.0
- A plan day can carry `print`: a list of what to print for that class (file, pages, copies). It shows
  as a **Print** box at the top of the day card, above the rail.

## 0.2.0
- Handouts sheet: every file opens in a new tab to read or print (served inline, under its own name).
- **Copy** buttons for the week's folder and the class folder, as the path your computer sees
  (`folderRoot` in `school.json`). The path is also shown, selectable, if copying is blocked.
- A plan day can name its own `folder`; the sheet then offers that day's folder first.
- The Handouts button shows whenever a folder is set, even an empty one ("Folder").

## 0.1.0
- First release: Today rail, Week (plan, prep, library), Grades (all weeks / one week with keyboard
  entry), assignment and student pages, exit-ticket scoring, From Claude review, scans inbox,
  saving queue with undo and conflicts, `sensor.bell_to_bell_now`, bell heads-up notifications.
