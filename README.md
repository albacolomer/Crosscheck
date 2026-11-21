# Crosscheck

Crosscheck is a research copilot for journalists conducting interviews. The React frontend uses Vite, TypeScript, Tailwind CSS, and shadcn/ui. The backend uses Node.js and Express. Both live in one repository, share TypeScript contracts, and keep session state in memory.

## Local Setup

Install Node.js 22.12 or later (which includes npm), Git, and a TypeScript editor such as VS Code. `npm ci` installs the project dependencies at the versions pinned in `package-lock.json`.

In PowerShell, clone the repository and prepare your local copy.

```powershell
git clone <REPOSITORY_URL>
cd Crosscheck
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

If the repository is already cloned, skip `git clone` and `cd`. The form and UI can use mock data without API keys. Anyone running the AI integration, including the demo operator, needs OpenAI and Tavily keys. Put them in `.env` as `OPENAI_API_KEY` and `TAVILY_API_KEY`. Share credentials with the team through a secure channel. Keep them out of source code, Git, and `VITE_*` variables.

Start the frontend and backend together.

```powershell
npm run dev
```

The frontend runs at `http://localhost:5173` and the backend at `http://localhost:3001`. The health endpoint at `http://localhost:3001/api/health` returns `{"status":"ok","service":"crosscheck-api"}`. Allow microphone access in your browser when trying audio capture.

### Codex Setup Instructions

When Codex reads this README in the working copy, it should check that Node.js, npm, and Git are available, install project dependencies with `npm ci`, create `.env` from `.env.example` if needed, and start `npm run dev` so the team can work. It can run `npm run build` to check changes. Preserve any existing `.env` and keep secrets out of code and commits. If a global tool or credential is missing, identify it and explain how the team can provide it securely.

## Project Structure

Add directories as their features need them.

```text
src/                    React frontend
  pages/                Preparation, live dashboard, and results
  components/           Feature components and shadcn/ui primitives
  hooks/                Reusable React state and side effects
  services/             Browser API, audio, and streaming clients
  lib/                  Pure utilities
shared/types.ts         Shared frontend and backend contracts
server/index.ts         Express entry point and server routes
server/routes/          API endpoints
server/services/        OpenAI, Tavily, and the fact-checking pipeline
.env.example            Configuration names with empty credential values
```

## Getting Started by Role

1. **Person 1 — Preparation and insights.** Build the form and final view using `InterviewContext` from `shared/types.ts`. Use mock data while working on the UI.
2. **Person 2 — Live dashboard.** Build the transcript, fact checks, and questions using `TranscriptSegment` and `ClaimCheck`. Use mock data while working on the UI.
3. **Person 3 — Audio.** Integrate microphone capture and Realtime transcription. Emit final segments while audio capture continues. Grant browser microphone access and keep the OpenAI key in the local backend if you run the transcription service.
4. **Person 4 — Pipeline.** Implement extraction, Tavily search, evidence evaluation, and questions using the shared types. Add the OpenAI and Tavily keys to the local backend's `.env`.
5. **Person 5 — Backend and integration.** Build the REST and WebSocket routes and manage in-memory state. Keep `npm run dev` working and configure keys for the services on the integration machine.

Everyone installs the same dependencies with `npm ci`. Coordinate with the team before changing `shared/types.ts` or event names. Use short-lived branches and commit frequently.

## Branch Workflow

- Keep `main` integrated and ready for the demo.
- Use a short-lived branch for each task, such as `feat/live-dashboard` or `feat/tavily-checks`.
- Keep `.env`, interview audio, and real personal data outside Git.

See the [implementation plan](./PLAN.md) for scope and milestones and the [team task breakdown](./TEAM%20TASK%20BREAKDOWN.md) for assignments.
