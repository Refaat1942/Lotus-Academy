# Learning experience: pathway, assessments, tracks, materials, assistant

## Course pathway designer (Admin → Courses → course)
Modules are the stages of the route; lessons run in order inside each stage. Admins can add/rename/describe/reorder
modules, add lessons to a module, move a lesson between modules, and reorder lessons. Lesson numbering is recomputed
after every change so the learner path always follows module order. A course can be **sequential** (default): each
lesson unlocks only when the previous one is complete.

## Assessment model (lesson quiz + final exam)
Each lesson ends with **one lesson quiz**; each course ends with a **final exam**. There is no separate checkpoint.
* **Lesson quiz** — every attempt draws `drawCount` questions (default 5) at random from the lesson's bank (10), with
  options shuffled per attempt. The served set is stored on the attempt (`QuizAttempt.questionIds/optionOrder`), so a
  reload shows the same questions and grading uses only what was served. Passing (default 70%) completes the lesson
  and unlocks the next one. When *"Require the lesson quiz"* is on (default) the learner cannot mark the lesson done
  manually. Retries are unlimited but each retry draws a new set.
* **Final exam** — unlocked only when every lesson is complete; 20 questions drawn from the bank, `maxAttempts` 3
  (default). Passing it is required for the certificate.
* **Answers** — the browser never receives correct answers while taking a quiz. The result page shows the learner's own
  choices only; correct answers are revealed after a pass.
* **Integrity** — starting and submitting are serialised per learner+quiz with a PostgreSQL advisory lock, so parallel
  tabs cannot exceed the attempt limit or submit an attempt twice.
* **Admin** — *Admin → Quizzes → quiz*: pass mark, max attempts, questions per attempt. *Admin → Enrollments →
  "Reset attempts"* clears failed attempts for a learner who ran out.

## Job-role tracks, mandatory training and compliance
* **Job roles** (*Admin → Job roles*): Pharmacist, Branch manager, Area manager, Department manager are seeded; more
  can be added. Each user has a job role plus branch/area/department (*Admin → Users → user*).
* **Targeting** (*Admin → Courses → course → "Who is this course for?"*): tick roles to target; mark a role
  *Mandatory* with optional *due days*. Visibility **All staff** keeps the course in the public catalogue; **Selected
  roles only** hides it from everyone else (staff/admin still see it).
* **Assignment** — mandatory courses are auto-enrolled (source "assigned", with due date) when a course is saved, a
  user is imported/activated, or a user's role changes. Learners see them in *Dashboard → Required training* with
  due/overdue badges. The catalogue has a *Learning track* filter.
* **Compliance** (*Admin → Compliance*): per course/role/branch/area, status Completed / In progress / Not started /
  Overdue, exportable as CSV.

## Staff onboarding
* *Admin → Users → "+ Add / import staff"*: single user, or a CSV with columns
  `email,name,job_role,branch,area,department,phone` (job role by key e.g. `BRANCH_MANAGER` or by name). New accounts
  get a temporary password (download the generated CSV once — it is not stored) and must change it at first login.
* *Admin → Settings → Self-registration*: **approval** (default without SMTP: sign-ups wait as Pending until an admin
  activates them), **email** (verification link; needs SMTP), or **closed**.

## Materials and video
Each lesson can hold videos (YouTube/Vimeo/HTTPS links), uploaded files (PDF, DOCX, PPTX, XLSX, images ≤ 15 MB, validated
by content; macro-enabled Office files rejected) and external links. Files are stored in PostgreSQL and served only to
enrolled learners and staff as sandboxed attachments.

## Study assistant
A floating chat on every lesson. It answers from the current lesson (plus course outline up to the next lesson), is limited
to enrolled learners on unlocked lessons, rate-limited (30/hour, 150/day per user), refuses to reveal quiz answers,
and is framed as a learning aid (not patient-specific advice). Conversations are stored per learner and course.
Set `ANTHROPIC_API_KEY` to enable Claude; without it the assistant returns the most relevant lesson section.

## Managers: "My team" (`/team`)
Branch managers see everyone in their branch, area managers their area (with a per-branch league table), department
managers their department — based on the job role and branch/area/department on each profile. Training admins
(reports.read) see the whole company with branch/area/department filters. Per member: mandatory courses done,
overdue count, average progress, certificates and last activity, with a drill-down page. **Remind** sends an in-app
notification and email (at most once per person per day); **Remind all overdue** does it for the whole list.

## Automatic reminders (hourly job)
`src/lib/reminders.ts`, started by `src/instrumentation.ts` in the production server (disable with
`REMINDERS_DISABLED=1`). Every reminder has a unique key in `ReminderLog`, so nothing is sent twice:
* 7 days and 1 day before a mandatory course is due; weekly while overdue.
* 30 days before a certificate expires: a renewal opens (see below).
* Weekly digest to each manager listing team members with overdue training.
*Admin → Notifications* shows last run, counts for the past week and a **Run reminders now** button.

## Learning paths (`/paths`, *Admin → Learning paths*)
An ordered set of courses (e.g. new-hire onboarding). Each course unlocks when the previous one is completed —
enforced on the lesson, quiz and exam pages. Path courses are added as mandatory training with the path's due date.
**Auto-assign** gives the path to new staff of the job role (created, imported or activated after the path was
created); **Assign to all current …** gives it to existing staff. Learners can also start any published path open to
their role.

## Certificate validity and renewal
*Admin → Courses → course → Certificate valid for (months)*. Saving recalculates the expiry of existing certificates.
30 days before expiry the learner's enrolment re-opens as a renewal: lessons stay complete, the final exam gets a
fresh set of attempts, and passing it renews the same certificate (same ID and QR code, new expiry). Verification
shows *Valid until* and reports expired certificates. Compliance counts an open renewal as unfinished training.

## Learning insights (*Admin → Learning insights*)
From every answered quiz/exam question: hardest questions with the most-picked wrong answer (the misconception),
lessons with the lowest quiz pass rate, and a course × branch heat map of correct-answer rates. Filter by course,
job role, area, branch and period.

## Narrated lesson videos
Until a recorded video is attached to a lesson, its video script (`lesson-NN-*.video.md`) plays as a narrated,
scene-by-scene video in Arabic or English using the device's speech voice, with captions, speed and scene controls.
If the device has no voice for the language, captions play on their own. Attaching a YouTube/Vimeo/MP4 video in the
lesson editor replaces it.

## Question of the day, points and leaderboard
Each day learners get one review question from lessons they have completed (questions they got wrong before come
first). Points: lesson +10, certificate +100, correct daily answer +5 (+1 for answering). `/leaderboard` ranks
learners (company / my area / my branch, all time / this month) and branches by average points per member, and shows
the daily-question streak.

## Install as an app (PWA)
`/manifest.webmanifest`, service worker `/sw.js` (static assets cached, pages always fresh, offline page). The app
icon is generated from the logo uploaded in *Admin → Branding* (`/api/app-icon/...`). Browsers only allow installing
over **HTTPS** — on a plain `http://IP:port` address the site works but cannot be installed.

## Certificate design
*Admin → Settings → Certificate design*: **Lotus gold** (default — bilingual, green panel with the uploaded logo, gold
seal with the course icon, QR verification, validity, two signatures) or **Classic**. The two signature names and
titles (EN/AR) are set in the same page.

## Self-registration by company email
*Admin → Settings → Allowed email domains* (e.g. `lotuspharmacies.com`) restricts self-registration to those domains.
