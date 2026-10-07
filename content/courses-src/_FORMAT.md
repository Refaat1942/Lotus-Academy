# Lotus Academy — course authoring format

All learning material is © Lotus Pharmacies / Lotus Academy. Do **not** write copyright footers (the platform adds them).
Each course is a folder `content/courses-src/NN-slug/` containing the files below. Validate with:

    npx tsx scripts/validate-course.ts content/courses-src/NN-slug

Fix every ERROR before finishing. Warnings should be fixed too when reasonable.

## Hard content rules
1. **No personal names, ever** — not of real people, not invented ones (no "Ahmed", "Sara", "Dr. X"). Use roles: "the customer", "a mother", "the pharmacist", "the pharmacy manager", "the technician".
2. Audience: pharmacists and pharmacy staff working in **Lotus pharmacies in Egypt** (retail, walk-in customers, OTC, dermocosmetics, EGP prices, WhatsApp/phone orders, delivery, insurance/corporate customers, busy branches, Arabic-speaking customers). Ground examples in this reality. Never invent statistics, laws, regulator rules, prices or clinical claims. When regulation matters say "follow the current rules of the Egyptian Drug Authority / Ministry of Health and the Lotus SOP" without citing article numbers.
3. Brand and product names may appear only where the topic needs them (dermocosmetics). Do not mention competitor pharmacy chains.
4. Medical statements must be conservative, general and safe; add "refer to a doctor/dermatologist" triggers where appropriate. Pharmacists counsel, they do not diagnose.
5. Arabic = clear professional Arabic (Modern Standard, simple wording) suitable for Egypt; short customer phrases may be in Egyptian colloquial inside quotation marks. Not machine-literal: write it as a native trainer would. Keep drug/brand names in Latin script.
6. Quizzes: exactly **10 questions per lesson, 20 in the final exam**, each with exactly **4 options and one ✓**. Test understanding and application (scenarios), not trivia. Distractors must be plausible. Vary the position of the correct answer (use a, b, c and d roughly equally). The Arabic file must have the same questions in the same order with the ✓ on the same option position.
7. No HTML, no images, no links, no phone numbers/emails. Markdown only: headings, paragraphs, bullet/numbered lists, tables, bold/italic, blockquotes.

## Files per course
```
course-overview.md          English overview
course-overview.ar.md       Arabic overview
lesson-01-<slug>.md         English lesson (+ its quiz)
lesson-01-<slug>.ar.md      Arabic lesson (+ the same quiz in Arabic)
lesson-01-<slug>.video.md   Video production scripts (English + Arabic)
...
final-exam.md               English final exam (20 questions)
final-exam.ar.md            Arabic final exam
```
4–6 lessons per course, 60–120 minutes each (as stated in the metadata).

### course-overview.md
```
# Course 9 Overview: Pharmacy Selling Skills
# نظرة عامة — مهارات البيع في الصيدلية

| Field | Value |
|---|---|
| **Course ID** | EG-RET-01 |
| **Total lessons** | 6 |
| **Duration** | 8 hours |
| **Pass mark** | 70% |
| **Language** | English and Arabic |

## Course description

Two or three paragraphs: who it is for, what changes in their daily work, how the course is organised.

## Learning outcomes

1. Outcome one (starts with a verb)
2. ... (5–7 outcomes)

## Lesson index

| # | File | Topic |
|---|---|---|
| 1 | lesson-01-<slug>.md | Topic title |
```
(Keep the first H1 exactly in the form `# Course N Overview: <English title>` and the second H1 in the form `# نظرة عامة — <Arabic title>`.)

### course-overview.ar.md
```
# نظرة عامة — مهارات البيع في الصيدلية

## وصف الدورة
(Arabic description — same content as English)

## مخرجات التعلم
1. ... (same number of outcomes, same order)
```

### lesson-NN-slug.md (English)
```
# Lesson 1.1: Title in English
# الدرس 1.1: العنوان بالعربية

| | |
|---|---|
| **Duration** | 90 minutes |
| **Lesson ID** | EG-RET-01-L01 |
| **Prerequisites** | None |

---

## Learning objectives

After completing this lesson, you will be able to:

1. Objective (verb first)
2. ...

---

## 1. First section title
Teaching content: explanations, tables, worked examples, short scripts of what to say to the customer
(use "Customer:" / "Pharmacist:" role labels), checklists, common mistakes.

## 2. Second section ...

## Scenario
A realistic Egyptian-pharmacy scenario with a model approach.

## Key takeaways

- 5–7 bullets

---

## Lesson Quiz (10 questions)

**Q1.** Question text?
- a) Option
- b) Option ✓
- c) Option
- d) Option

(Q2 ... Q10)
```
Lesson ID format: `<COURSE-ID>-L01`, `-L02` … English body ≥ 600 words recommended (validator minimum 350).

### lesson-NN-slug.ar.md (Arabic)
```
# الدرس 1.1: العنوان بالعربية

## أهداف التعلم

بعد إتمام هذا الدرس ستكون قادرًا على:

1. ... (same number and order as English)

## 1. عنوان القسم الأول
(Arabic teaching content — same structure and substance as the English lesson, ≥ 450 words)

## سيناريو
...

## أهم النقاط

- ...

## اختبار الدرس (10 أسئلة)

**Q1.** نص السؤال؟
- a) ...
- b) ... ✓
- c) ...
- d) ...
```
(Keep the question marker as `**Q1.**` and option letters `a)`–`d)` in the Arabic file too; ✓ placement identical to English.)

### lesson-NN-slug.video.md
A production script a Lotus team can record (3–5 minutes per language). Two sections exactly named `## English` and `## العربية`; each ≥ 120 words, written as narration with scene cues in [square brackets]. Do not use `---` lines inside.

### final-exam.md / final-exam.ar.md
```
# Final Exam — <Course title>

## Final Exam (20 questions)

**Q1.** ...
- a) ...
```
Arabic file: `# الاختبار النهائي — <العنوان>` then `## الاختبار النهائي (20 سؤالًا)` and the same 20 questions. Cover all lessons, weighted evenly, scenario-heavy.
