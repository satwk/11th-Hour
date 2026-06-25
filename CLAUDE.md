# 11TH HOUR WORKSPACE - MASTER INSTRUCTIONS & PRD

## STEERING DIRECTIVES
Always use:
1. `vercel-react-best-practices`, `tailwind-4-docs` and `web-design-guidelines` skills for all frontend development.
2. STRICT UI ADHERENCE: Read and strictly follow `DESIGN.md` for the entire visual theme and the specific custom UI interactions.
3. STRICT GOOGLE GEN AI SDK USAGE: Utilize `@google/generative-ai` inside the backend. Do NOT fall back on deprecated packages.
4. CORE PRINCIPLE: The "Daily Agent Loop" (`PlanRevision` model + `/api/agent/*` routes) is the main structural differentiator. Fully build out and test this backend logic BEFORE polishing the user interface.

## ARCHITECTURE
Monorepo Setup.
- Frontend: React + Vite + Tailwind v4 + dnd-kit (for Eisenhower matrix manipulation) + framer-motion.
- Backend: Node.js + Express + TypeScript + MongoDB (Mongoose) + node-cron (for daily evaluation tasks).
- Auth: Firebase Auth (Google Sign-In with Calendar Scopes).

## CORE MODELS (MONGOOSE)
1. **User:** `firebaseId`, `email`, `googleAccessToken`, `calendarSyncEnabled`
2. **Task:** `title`, `quadrant` (Do, Schedule, Delegate, Delete), `cognitiveLoad` (Low, Medium, High), `estimatedDuration`, `status`, `externallyDependent` (boolean).
3. **ReadinessLog:** `energyLevel` (1-5), `sleepHours`, `dailyWinsCount`, `calculatedScore`.
4. **PlanRevision (THE AGENT LOGIC):** Records autonomous daily changes. Fields: `triggerType`, `changes` (array of `taskId`, `action`, `reason`, `proposedSlot`, `draftMessage`), `userConfirmed` (boolean).

## CRITICAL BACKEND ROUTES
- `POST /api/tasks/brain-dump`: Accepts unstructured raw text, uses Gemini 1.5 Flash to output structured JSON mapping tasks directly onto the Eisenhower Matrix.
- `POST /api/agent/daily-replan`: The automated cron trigger. Re-evaluates open tasks against today's `ReadinessLog` score. Bumps down high-load items if readiness drops below 60. Saves records into the `PlanRevision` collection.
- `POST /api/calendar/commit`: Synchronizes verified updates with the Google Calendar API. NEVER write to a user's calendar without an active `userConfirmed: true` state on the frontend dashboard.

## BUILD ORDER (Follow Strictly)
1. Scaffold backend Mongoose schemas and connect database connections.
2. Construct the `/api/tasks/brain-dump` endpoint with deep Gemini integration.
3. Develop the autonomous `/api/agent/daily-replan` engine and its associated models.
4. Create the frontend client: Eisenhower Matrix layout (using `dnd-kit`) and the Plan Revision interactive dashboard cards.
5. Wire up the Google Calendar read/write OAuth synchronization.