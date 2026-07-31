# AI Phonics Buddy — Learning App with Clickstream Analytics

An AI-powered literacy learning web app for children aged 4–8. Learners log in, work through
interactive content (**text + video + quizzes + voice practice + games**), and **every action they
take is captured as clickstream data** and stored, viewable in-app and exportable as CSV in the same
shape as a Moodle log export.

Live demo: https://foryourchild.lovable.app

---

## 1. What the app does

| Area | Description |
|---|---|
| **Auth** | Email/password + Google sign-in. A "Skip for now" guest mode lets reviewers explore the prototype without an account. |
| **Learner profiles** | A parent account can hold several learner profiles (name, age, reading level, avatar), each with XP, coins, level, streak and a literacy score. |
| **Lessons (text + video + quiz)** | `/lessons/:childId` — three modules (short /a/, digraph *sh*, magic *e*). Each has reading text, a teaching video with full player tracking, and a multiple-choice quiz with scoring and retry. |
| **Voice reading coach** | `/learn/:childId` — the Web Speech API listens to the child read words and sentences; an AI model scores pronunciation and gives phoneme-level feedback. |
| **AI story studio** | `/story/:childId` — generates a decodable story starring the child, with read-aloud. |
| **Games** | `/games/:childId` — Rhyme Time, Letter Pop, Word Builder mini-games that award XP/coins. |
| **Virtual pet** | `/pet/:childId` — a pet that evolves as the learner levels up. |
| **Teacher dashboard** | `/teacher` — create classrooms, share join codes, view pupil progress. |
| **Activity & clickstream** | `/activity` — live event log, summary stats, per-component filters, CSV export. |

## 2. Clickstream tracking

Implemented in [`src/lib/clickstream.ts`](src/lib/clickstream.ts).

Every event is stored with Moodle-compatible fields:

```
Time | Event context | Component | Event name | Description | Origin | Route | Session
```

Events captured:

- **Navigation / page views** — dashboard viewed, module viewed, activity report viewed, link clicked
- **Clicks** — a global capture-phase listener logs every button/link click with its label
- **Video** — played, paused, seeked, speed changed, 25/50/75 % progress, completed, with playback position
- **Quiz** — answer selected, attempt submitted (score, total, duration, per-question answers), retried
- **Voice practice** — session started, pronunciation correct/incorrect (with what was heard and the AI score), session completed
- **Analytics** — log report exported

Storage:

- **Signed-in users** → `learning_events` table (Postgres/Supabase), row-level security so a user only
  reads their own events; teachers can read events for children in their own classrooms.
- **Guest/prototype mode** → buffered in `localStorage` so the demo still produces a full clickstream.

Tracking is fire-and-forget and never blocks or breaks the UI.

### Data model

```sql
learning_events(id, user_id, child_id, session_id, occurred_at,
                event_context, component, event_name, description,
                origin, target, action, route, meta jsonb)

quiz_attempts(id, user_id, child_id, quiz_id, score, total, duration_ms, answers jsonb)
```

Other tables: `profiles`, `user_roles` (parent/teacher/admin), `children`, `classrooms`,
`classroom_children`, `word_images`.

### CSV export

`/activity` → **Export CSV** downloads the currently filtered log with the Moodle column layout, so it
can be dropped straight into Excel / pandas for learning-analytics work.

## 3. Tech stack

- **Frontend**: React 19, TanStack Start (SSR + file-based routing), TypeScript, Tailwind CSS v4
- **Backend**: TanStack server functions (`createServerFn`) running on an edge runtime
- **Database & auth**: Supabase (Postgres, RLS, Google OAuth)
- **AI**: Lovable AI Gateway (Gemini) for lesson generation, pronunciation scoring and story writing
- **Speech**: Web Speech API (recognition) + SpeechSynthesis (text-to-speech)
- **Version control**: Git / GitHub

## 4. Running locally

```bash
git clone <your-repo-url>
cd ai-phonics-buddy
npm install          # or bun install
cp .env.example .env # add your Supabase + AI keys
npm run dev          # http://localhost:8080
```

Required environment variables:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LOVABLE_API_KEY=
```

Build for production:

```bash
npm run build
```

## 5. Project structure

```
src/
├── lib/
│   ├── clickstream.ts        # event tracking + CSV export
│   ├── learn.functions.ts    # AI lesson generation & pronunciation scoring
│   ├── story.functions.ts    # AI story generation
│   └── teacher.functions.ts  # classrooms, join codes, pupil progress
├── routes/
│   ├── index.tsx             # landing page
│   ├── auth.tsx              # sign in / sign up / guest
│   └── _authenticated/
│       ├── dashboard.tsx     # parent dashboard
│       ├── lessons.$childId.tsx  # text + video + quiz
│       ├── learn.$childId.tsx    # voice reading coach
│       ├── story.$childId.tsx
│       ├── games.$childId.tsx
│       ├── pet.$childId.tsx
│       ├── teacher.tsx
│       └── activity.tsx      # clickstream viewer + CSV export
└── integrations/supabase/    # generated client & auth middleware
```

## 6. Demo walkthrough (for the video)

1. Sign up / sign in (or **Skip for now**).
2. Add a learner profile on the dashboard.
3. Open **🎬 Lessons & quizzes** → read the text, play/pause/seek the video, answer the quiz.
4. Open **🎤 Start learning** → speak the words and sentences, get pronunciation feedback.
5. Try **📖 Story**, **🎮 Games**, **🐲 Pet**.
6. Open **📊 Activity** → see every one of those actions in the clickstream table, filter by component,
   and **Export CSV**.
7. Open **🍎 Teacher** → create a class, share the join code, view pupil progress.

## 7. License

MIT
