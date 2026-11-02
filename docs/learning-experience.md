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
