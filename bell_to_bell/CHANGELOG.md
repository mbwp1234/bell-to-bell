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
