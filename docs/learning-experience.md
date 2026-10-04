# Learning experience: pathway, checkpoints, materials, assistant

## Course pathway designer (Admin → Courses → course)
Modules are the stages of the route; lessons run in order inside each stage. Admins can add/rename/describe/reorder
modules, add lessons to a module, move a lesson between modules, and reorder lessons. Lesson numbering is recomputed
after every change so the learner path always follows module order. A course can be **sequential** (default): each
lesson unlocks only when the previous one is complete.

## Checkpoint questions ("check your understanding")
At the end of each lesson the learner must answer 2 questions correctly to complete it and unlock the next lesson.
* Questions are drawn from the lesson's quiz bank. Where the source quiz only has the correct answer, distractors are
  borrowed deterministically from other answers in the same lesson (auto-generated; author real distractors in
  *Admin → Quizzes* for better quality — those are used automatically).
* Enforced on the server: opening a locked lesson redirects to the first incomplete one; manual completion is refused
  while a checkpoint is required; correct answers never reach the browser. A wrong answer draws a fresh pair.
* Per lesson switch: *Admin → lesson → "Require a check-your-understanding question"*.

## Materials and video
Each lesson can hold videos (YouTube/Vimeo/HTTPS links), uploaded files (PDF, DOCX, PPTX, XLSX, images ≤ 15 MB, validated
by content; macro-enabled Office files rejected) and external links. Files are stored in PostgreSQL and served only to
enrolled learners and staff as sandboxed attachments.

## Study assistant
A floating chat on every lesson. It answers from the current lesson (plus course outline up to the next lesson), is limited
to enrolled learners on unlocked lessons, rate-limited (30/hour, 150/day per user), refuses to reveal checkpoint/quiz answers,
and is framed as a learning aid (not patient-specific advice). Conversations are stored per learner and course.
Set `ANTHROPIC_API_KEY` to enable Claude; without it the assistant returns the most relevant lesson section.
