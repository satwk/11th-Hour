# 11th Hour

> **Your AI doesn't remind you. It re-plans your day for you — and tells you why.**

Built for the **Vibe2Ship Hackathon** by Google Developers × Coding Ninjas.

Most productivity apps wait for you to organize yourself. 11th Hour doesn't. It ingests your unstructured thoughts, reads your cognitive capacity for the day, watches your calendar, and autonomously decides what you should be doing right now — rescheduling, downgrading, and drafting action items on your behalf without you having to open the app.

---

## The problem with every task app you've used

TickTick, Todoist, Notion — they're beautifully built containers for human-driven organization. You type the task, drag the card, set the reminder. The app waits. It never decides. It never initiates. It just holds your list while you slip past your deadlines anyway.

11th Hour is built on a different premise: **the AI is the planner, not you.**

---

## What it actually does

### Brain Capture
Drop unstructured text — "need to fix the auth bug today, call mom sometime this week, submit the ML assignment by Thursday night" — and the Gemini 2.0 Flash pipeline parses it into structured tasks with Eisenhower quadrant placement, a numeric cognitive load score (1–5), estimated duration, dynamic date anchoring for relative terms like "Thursday night," and an `externallyDependent` flag for tasks that involve another person.

### Daily Readiness Score
Log your morning state in 5 seconds: sleep hours, energy level (1–5), small wins from yesterday. The backend calculates a Readiness Score (0–100). If your score drops below 60, the autonomous re-plan agent automatically defers your high cognitive-load tasks — it doesn't ask, it decides, and it tells you why.

### The Autonomous Re-Plan Loop
This is the differentiator. A scheduled agent wakes up each morning (or on demand), pulls every pending task, fetches your real free/busy windows from Google Calendar, checks your readiness score and daily cognitive load budget, and sends all of it to Gemini with one instruction: *decide what needs to change today, and explain every decision in plain language.*

The result is a `PlanRevision` — a list of changes with one-sentence human-readable reasons for each:

> *"Moved 'Refactor auth module' to 4pm — readiness score 48, high-load tasks deferred until afternoon."*
> *"Today's cognitive load is at 14/15 — 'Write ML report' cascaded to tomorrow."*

No calendar event is touched until you confirm. You see the proposals, approve, and the system commits.

### Escalation Ladder
When a scheduled task's window passes and it's still pending, the agent acts autonomously:
1. Re-slots it into the next available gap today.
2. If no gap exists, downgrades and queues it for tomorrow's re-plan.
3. If the task involves another person (`externallyDependent: true`), Gemini drafts a short, contextual message — surfaced as "Ready to send." Never auto-sent. You review and send it yourself.

### Focus Mode
When a task window goes active, the UI collapses into a single-task execution view — no distractions, just the task, its micro-steps, and a timer. One thing at a time.

### Smart Calendar Sync
Real bi-directional Google Calendar integration. Free/busy queries find your actual open slots. Constraint-aware placement respects time-of-day hints from your brain dump ("evening", "morning"). All calendar writes are confirm-gated.

---

## Tech stack

**Frontend** — React + Vite + TypeScript, Tailwind CSS v4, Framer Motion, dnd-kit, Lucide React

**Backend** — Node.js + Express + TypeScript

**Database** — MongoDB via Mongoose

**AI** — Google Gemini 3.1 Flash (text + vision multimodal endpoint) via `@google/generative-ai`

**Auth & Integrations** — Firebase Authentication (Google OAuth 2.0 with Calendar scopes), Google Calendar API v3

**Scheduling** — node-cron (daily re-plan + escalation check loops)

**Deploy** — Google Cloud Run (In progress)

---

## Project structure

```
11th-hour-workspace/
├── backend/
│   └── src/
│       ├── config/
│       │   ├── db.ts               # MongoDB connection
│       │   └── cron.ts             # Scheduled agent loops
│       ├── models/
│       │   ├── User.ts
│       │   ├── Task.ts
│       │   ├── ReadinessLog.ts
│       │   └── PlanRevision.ts     # The autonomous re-plan output
│       ├── routes/
│       │   ├── authRoutes.ts
│       │   ├── taskRoutes.ts       # Brain dump + micro-chunking
│       │   ├── calendarRoutes.ts   # Free/busy read + confirm-gated write
│       │   ├── readinessRoutes.ts  # Tap-in + optional vision path
│       │   └── agentRoutes.ts      # Daily re-plan + escalation ladder
│       ├── services/
│       │   └── replanService.ts    # Core autonomous planning logic
│       └── index.ts
└── frontend/
    └── src/
        ├── components/
        │   ├── BrainDump.tsx
        │   ├── EisenhowerMatrix.tsx
        │   ├── MatrixQuadrant.tsx
        │   ├── TaskCard.tsx
        │   ├── AgentReviewDeck.tsx     # The "Today's plan, revised" card stack
        │   ├── PlanRevisionStack.tsx
        │   ├── ReadinessLogger.tsx
        │   ├── FocusMode.tsx
        │   └── Layout.tsx
        └── pages/
            ├── LandingPage.tsx
            ├── DashboardPage.tsx
            ├── CapturePage.tsx
            ├── ReadinessPage.tsx
            ├── SyncPage.tsx
            └── FocusPage.tsx
```

---

## Getting started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- A Google Cloud project with Calendar API enabled
- Firebase project with Google Sign-In enabled
- Gemini API key (Google AI Studio)

### Backend

```bash
cd 11th-hour-workspace/backend
npm install
```

Create `.env`:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
```

```bash
npm run dev
```

### Frontend

```bash
cd 11th-hour-workspace/frontend
npm install
```

Create `.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

```bash
npm run dev
```

---

## Key engineering decisions

**Dynamic temporal anchoring** — The backend injects the server's exact ISO datetime into every Gemini system prompt as a mathematical anchor, letting the model resolve relative terms ("this Sunday", "next week") into precise timestamps without hallucinating dates.

**Lazy API initialization** — All Gemini and Google API clients are instantiated inside route handlers, not at module load time. This prevents the `undefined` key failures that occur when environment variables aren't yet hydrated at startup.

**Defensive parsing** — Every Gemini response passes through a validation wrapper before touching the database. Malformed JSON or schema mismatches fall back to safe empty objects rather than crashing the Express server.

**Cognitive load budgeting** — Tasks carry a numeric 1–5 load score (not just LOW/MEDIUM/HIGH). The re-plan agent treats the daily ceiling (default: 15 points) as a hard constraint — excess weight cascades automatically to days with open capacity, with the specific numbers stated as justification.

**Confirm-gated calendar writes** — The agent never mutates the live calendar. Every proposed change is written as a `PlanRevision` document first. Calendar events are inserted only after explicit user confirmation, preventing the app from silently reorganizing someone's actual schedule.

---

## Why this isn't another to-do app

The standard critique: "TickTick/Todoist already does this." It doesn't. Every major task app is a well-built input/display layer — it holds your data and waits for you to act on it. The agent loop in 11th Hour is a different architecture: a system that reads state, reasons about constraints, produces a decision, and acts on confirmation. That's the gap. Passive tools accumulate tasks. This one re-plans around your actual human capacity, daily, without being asked.

---

## Built by

**Satwik** — solo build, Vibe2Ship Hackathon (Google Developers × Coding Ninjas)

[@satwk](github.com/satwk)
