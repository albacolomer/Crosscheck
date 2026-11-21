# TEAM TASK BREAKDOWN — Interview Copilot

## 1. Team Organization

**Team size:** 5 people  
**Total hackathon time:** 4 hours  
**Development time:** 3 hours  
**Final hour:** Testing, polishing, demo preparation.

The goal is to build a working end-to-end MVP, not five independent modules.

Each team member owns a specific area of the codebase. Work should happen in parallel whenever possible, with clearly defined interfaces between modules.

### Team responsibilities

| Person | Role | Main responsibility |
|---|---|---|
| Person 1 | Frontend — Preparation | Setup page, interview configuration and navigation |
| Person 2 | Frontend — Live Dashboard | Live interview interface, transcript, fact-check cards and suggested questions |
| Person 3 | Audio & Transcription | Microphone access, audio streaming and live transcription |
| Person 4 | AI & Fact-checking | Claim extraction, web search, evidence analysis and follow-up questions |
| Person 5 | Backend & Integration | API endpoints, shared state, module integration and end-to-end reliability |

**Important:** Person 5 must coordinate integration from the beginning, not wait until everyone finishes their tasks.

---

# 2. Shared Rules — READ BEFORE CODING

To avoid duplicated work, conflicting changes and integration problems, everyone must follow these rules.

### Ownership rules

1. Each person owns the files and components assigned to them.
2. Do not modify another person's files without coordinating first.
3. Do not create a second implementation of an existing feature.
4. Do not install additional dependencies without informing the team.
5. Do not change shared interfaces or data structures without informing everyone.
6. Commit working changes frequently.
7. Prioritize functional implementations over complex abstractions.

### Codex workflow

Each person should:

1. Read `AGENTS.md` before starting.
2. Check the current project structure.
3. Implement only their assigned tasks.
4. Avoid modifying files outside their ownership.
5. Test their module independently.
6. Communicate when their module is ready for integration.

**Do not ask Codex to build the entire application.** Give it small, specific tasks with clear expected outputs.

### Local PC setup — all five people

Every person uses the same project dependencies; there are no per-role global packages to install. Each PC needs Node.js 22.12 or newer (with npm), Git, and an editor such as VS Code. React, Vite, Tailwind, shadcn/ui, Express, OpenAI SDK, and Tavily SDK are installed from the repository lockfile, not globally.

From PowerShell, each person clones the team's repository once, then prepares their local checkout:

```powershell
git clone <REPOSITORY_URL>
cd Crosscheck
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

If the repository is already cloned, skip `git clone` and `cd`. Frontend is at `http://localhost:5173`; backend is at `http://localhost:3001`. Verify backend at `http://localhost:3001/api/health`. Do not overwrite an existing `.env`.

| Person | Extra local setup/actions |
|---|---|
| 1 — Preparation UI | No API keys needed while using mock data. Run `npm run dev` and build against the shared types. |
| 2 — Live dashboard UI | No API keys needed while using mock data. Run `npm run dev`; use mock transcript and claim cards until integrations arrive. |
| 3 — Audio | Test in a browser and grant microphone permission. If running the OpenAI transcription backend locally, add the provided `OPENAI_API_KEY` to `.env`. |
| 4 — AI pipeline | Add the provided `OPENAI_API_KEY` and `TAVILY_API_KEY` to the local `.env` to run live extraction and search. |
| 5 — Backend/integration | Run both services with `npm run dev`. Add the keys needed by any connected services in the local `.env`; coordinate with Person 4. |

The demo PC needs the keys for every live service used in the demo. The team coordinator must provide credentials through an approved secure channel. Never commit `.env`, paste secrets into source code, or use `VITE_*` variables for secrets. If keys are unavailable, keep using mocks and report which secret is missing; do not fabricate credentials.

### What Codex should do when this guide is read

Codex should prepare the current checkout without asking the team to repeat setup steps: inspect available Node/npm and Git versions, run `npm ci`, create `.env` from `.env.example` only when `.env` does not exist, and start `npm run dev` so the person can begin work. It may run `npm run build` to check a change. It must preserve existing `.env` contents and must not invent, expose, or commit secrets. If a required global tool or API credential is absent, explain exactly what the person must install or obtain, and continue any work that does not depend on it. Follow the person's assigned role and file ownership when making code changes.

---

# 3. Phase 0 — Team Setup (ALL TEAM MEMBERS)

**Time: 00:00–00:15**

Before coding, everyone must agree on the architecture and shared contracts.

### Task 0.1 — Define the architecture

Agree on the following data flow:

Microphone → Transcription → Claim Extraction → Web Search → Evidence Analysis → Live Dashboard → Interview Summary

### Task 0.2 — Agree on the technology stack

- Frontend: React + Vite + TypeScript
- Styling: Tailwind CSS + shadcn/ui
- Backend: Node.js + Express
- AI: OpenAI API
- Live transcription: OpenAI Realtime API or an available streaming transcription alternative
- Web search: Tavily API
- State management: React Context or a simple shared state solution
- Storage: In-memory state for the MVP

### Task 0.3 — Define shared data structures

Everyone must use the same interfaces.

```typescript
interface Interview {
  id: string;
  title: string;
  interviewee: string;
  role: string;
  organization: string;
  background: string;
  topics: string[];
  keyQuestions: string[];
}

interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  speaker?: string;
}

type Verdict =
  | "SUPPORTED"
  | "CONTRADICTED"
  | "MISLEADING"
  | "UNVERIFIED";

interface Evidence {
  title: string;
  url: string;
  source: string;
  summary: string;
  supportsClaim: boolean;
}

interface FactCheck {
  id: string;
  claim: string;
  verdict: Verdict;
  explanation: string;
  confidence: number;
  evidence: Evidence[];
  suggestedQuestions: string[];
  timestamp: number;
}

interface InterviewSummary {
  totalClaims: number;
  supported: number;
  contradicted: number;
  misleading: number;
  unverified: number;
  keyFindings: string[];
  unansweredQuestions: string[];
}
```

### Task 0.4 — Establish API contracts

Person 5 creates the shared API structure.

Agree on these endpoints:

| Endpoint | Method | Responsibility |
|---|---|---|
| `/api/interviews` | POST | Create interview |
| `/api/transcript` | POST | Receive transcript segments |
| `/api/fact-check` | POST | Process a claim |
| `/api/interviews/:id/summary` | GET | Retrieve interview summary |

The frontend must not implement its own AI or web-search logic.

The AI pipeline must not implement its own UI.

---

# 4. Phase 1 — Parallel Development

**Time: 00:15–01:00**

All five people work independently on their assigned modules.

## PERSON 1 — Frontend: Interview Preparation

**Ownership:** Preparation page and interview configuration.

### Tasks

- [ ] Create the preparation page.
- [ ] Add an interview title input.
- [ ] Add interviewee name input.
- [ ] Add role and organization inputs.
- [ ] Add background/context textarea.
- [ ] Add topics to investigate.
- [ ] Add key questions / angles to explore.
- [ ] Add a clear "Start Interview" button.
- [ ] Validate required fields.
- [ ] Store the interview configuration in the shared application state.
- [ ] Connect the Start Interview button to the live dashboard.

### Expected output

A functional preparation page that produces an `Interview` object and navigates to the live interview dashboard.

### Files owned

```text
src/pages/PreparationPage.tsx
src/components/preparation/
```

Do not modify the live dashboard or backend.

---

## PERSON 2 — Frontend: Live Dashboard & Results

**Ownership:** All live interview UI components and post-interview results.

### Tasks

- [ ] Create the live interview dashboard.
- [ ] Build a three-column layout.

**Column 1 — Live Transcript**
- Display transcript segments in chronological order.
- Show timestamps.
- Visually distinguish new transcript segments.
- Highlight potential factual claims.

**Column 2 — Fact-check Feed**
- Create reusable fact-check cards.
- Display the original claim.
- Display the verdict.
- Show the explanation.
- Show confidence level.
- Display supporting and contradicting evidence.
- Include clickable source links.

**Column 3 — Suggested Questions**
- Display AI-generated follow-up questions.
- Categorize them as:
  - Challenge
  - Follow-up
  - Context
- Add a copy button.

**Post-interview results**
- [ ] Create a summary page.
- [ ] Display total claims checked.
- [ ] Display verdict breakdown.
- [ ] Show key findings.
- [ ] Show unanswered questions.
- [ ] Add a clear "End Interview" action.

### Expected output

A complete dashboard that can receive transcript segments and fact-check results through props, context or the agreed shared state.

**Important:** Use mock data initially. Do not wait for the AI pipeline to be ready.

### Files owned

```text
src/pages/LiveDashboard.tsx
src/pages/ResultsPage.tsx
src/components/dashboard/
src/components/fact-check/
src/components/transcript/
```

Do not implement microphone recording, API endpoints or AI logic.

---

## PERSON 3 — Audio & Live Transcription

**Ownership:** Microphone access and transcription.

### Tasks

- [ ] Implement microphone permission handling.
- [ ] Create Start Recording functionality.
- [ ] Create Stop Recording functionality.
- [ ] Connect the audio stream to the selected transcription solution.
- [ ] Receive transcription results incrementally.
- [ ] Convert transcription results into `TranscriptSegment` objects.
- [ ] Send transcript segments to the backend.
- [ ] Handle microphone permission errors.
- [ ] Handle connection interruptions.
- [ ] Ensure recording can be stopped cleanly.

### Expected output

A working recording module that produces transcript segments in real time.

### Files owned

```text
src/services/audio/
src/hooks/useAudioTranscription.ts
```

### Important implementation decisions

- Do not wait for the entire interview to finish before displaying the transcript.
- Transcription must continue even if fact-checking is slow.
- Avoid sending duplicate transcript segments.
- Handle partial and final transcription events correctly.
- Keep the implementation as simple as possible.

**Fallback:** If the Realtime API integration takes too long, use a simpler streaming or chunk-based transcription implementation. A working transcript is more important than a sophisticated audio architecture.

Do not implement claim extraction or fact-checking.

---

## PERSON 4 — AI Pipeline: Claim Extraction & Fact-checking

**Ownership:** All AI reasoning and web research.

### Tasks

**A. Claim extraction**

- [ ] Create a function that receives transcript segments.
- [ ] Extract verifiable factual claims.
- [ ] Ignore opinions, speculation and filler.
- [ ] Use the interview context to understand claims.
- [ ] Avoid extracting duplicate claims.
- [ ] Return structured JSON.

**B. Web search**

- [ ] Integrate Tavily Search API.
- [ ] Search for relevant evidence for each claim.
- [ ] Look for both supporting and contradicting evidence.
- [ ] Prioritize reliable and authoritative sources.
- [ ] Retrieve source titles, URLs and relevant content.

**C. Evidence analysis**

- [ ] Analyze the claim against the retrieved evidence.
- [ ] Determine the appropriate verdict.
- [ ] Generate a concise explanation.
- [ ] Assign a confidence score.
- [ ] Include evidence and source URLs.
- [ ] Generate 1–3 useful follow-up questions.

**D. Summary generation**

- [ ] Aggregate all fact-check results.
- [ ] Calculate verdict statistics.
- [ ] Identify the most important findings.
- [ ] Identify unanswered questions.
- [ ] Generate the final interview summary.

### Expected output

A backend-compatible AI pipeline that receives claims and returns structured `FactCheck` objects.

### Files owned

```text
backend/services/claimExtractor.ts
backend/services/webSearch.ts
backend/services/evidenceAnalyzer.ts
backend/services/summaryGenerator.ts
```

### Important rules

- Never invent evidence, statistics or URLs.
- Do not classify a claim as false simply because no evidence was found.
- Distinguish between contradictory evidence and missing evidence.
- Do not treat opinions as factual claims.
- Always provide source URLs when evidence is available.
- Return `UNVERIFIED` when evidence is insufficient.
- Keep AI responses structured and predictable.

**Do not implement frontend components or microphone functionality.**

---

## PERSON 5 — Backend, API & Integration

**Ownership:** Backend architecture, shared interfaces and integration.

This person is also responsible for making sure all modules work together.

### Tasks

**A. Initial setup**

- [ ] Create the Express backend.
- [ ] Configure environment variables.
- [ ] Configure CORS.
- [ ] Set up API routing.
- [ ] Create shared types/interfaces.
- [ ] Create a basic health-check endpoint.

**B. API implementation**

- [ ] Implement interview creation endpoint.
- [ ] Implement transcript ingestion endpoint.
- [ ] Implement fact-check endpoint.
- [ ] Implement interview summary endpoint.

**C. Integration**

- [ ] Connect Person 1's preparation page to interview state.
- [ ] Connect Person 3's transcription output to the backend.
- [ ] Connect Person 4's AI pipeline to the fact-check endpoint.
- [ ] Connect Person 2's dashboard to incoming transcript and fact-check results.
- [ ] Ensure results are displayed as soon as they become available.

**D. Reliability**

- [ ] Handle API errors.
- [ ] Prevent duplicate fact-check requests.
- [ ] Maintain interview state in memory.
- [ ] Ensure fact-checking runs asynchronously.
- [ ] Ensure transcription does not wait for fact-checking.
- [ ] Verify that the summary uses the actual interview results.

### Expected output

A working backend connecting all modules into one application.

### Files owned

```text
backend/server.ts
backend/routes/
backend/types/
backend/services/interviewStore.ts
```

Person 5 should coordinate changes to shared interfaces with the other four people.

---

# 5. Phase 2 — Integration

**Time: 01:00–02:00**

At this point, every person should have a working independent module or a functional mock implementation.

The team now connects everything.

### Integration checklist

| Task | Responsible | Status |
|---|---|---|
| Preparation page creates interview configuration | Person 1 + 5 | [ ] |
| Start Interview navigates to dashboard | Person 1 + 2 | [ ] |
| Microphone starts and stops correctly | Person 3 | [ ] |
| Transcript appears in real time | Person 2 + 3 | [ ] |
| Transcript reaches backend | Person 3 + 5 | [ ] |
| Claims are extracted from transcript | Person 4 + 5 | [ ] |
| Claims are sent to Tavily | Person 4 | [ ] |
| Evidence is analyzed | Person 4 | [ ] |
| Fact-check results reach frontend | Person 4 + 5 + 2 | [ ] |
| Follow-up questions appear | Person 2 + 4 | [ ] |
| End Interview generates summary | Person 2 + 4 + 5 | [ ] |

### Critical integration rule

**Always keep a working version of the application.**

If a module is not ready, use mock data or a temporary fallback.

Never block the entire application waiting for one component.

### Integration priority

1. Preparation → Live Dashboard.
2. Microphone → Transcript.
3. Transcript → Backend.
4. Backend → Claim Extraction.
5. Claim Extraction → Web Search.
6. Web Search → Evidence Analysis.
7. Fact-check results → Dashboard.
8. Dashboard → Final Summary.

---

# 6. Phase 3 — End-to-End Testing & Bug Fixing

**Time: 02:00–02:40**

Everyone tests the complete application together.

### Test scenario

Prepare a demo interview containing:

1. One clearly true factual statement.
2. One clearly false factual statement.
3. One misleading statement requiring additional context.
4. One opinion that should not be fact-checked.
5. One claim for which evidence is difficult to find.

### End-to-end checklist

- [ ] Can the journalist configure an interview?
- [ ] Does Start Interview navigate correctly?
- [ ] Does microphone permission work?
- [ ] Does recording start and stop?
- [ ] Does the transcript update continuously?
- [ ] Are factual claims extracted correctly?
- [ ] Are duplicate claims avoided?
- [ ] Are supporting and contradicting sources retrieved?
- [ ] Are verdicts displayed correctly?
- [ ] Are source URLs clickable?
- [ ] Are useful follow-up questions generated?
- [ ] Does the dashboard remain responsive while fact-checking?
- [ ] Does End Interview generate the correct summary?

### Bug-fixing ownership

| Area | Responsible |
|---|---|
| Preparation and navigation | Person 1 |
| Dashboard and visual bugs | Person 2 |
| Recording and transcription | Person 3 |
| AI accuracy and search | Person 4 |
| Backend, state and integration | Person 5 |

Fix critical bugs before adding new features.

---

# 7. Phase 4 — Final Polish & Demo

**Time: 03:00–04:00**

No new major features should be implemented during this phase.

### Product polish

- [ ] Remove unnecessary UI elements.
- [ ] Improve loading states.
- [ ] Add clear error messages.
- [ ] Ensure fact-check cards are easy to understand.
- [ ] Ensure source links work.
- [ ] Check responsive layout.
- [ ] Verify that the application does not crash.
- [ ] Ensure the demo environment has all required API keys.

### Demo preparation

The demo should follow this exact flow:

1. Introduce the journalist's problem.
2. Configure a new interview.
3. Start recording.
4. Show the live transcript.
5. Show a factual claim being detected.
6. Show supporting or contradicting evidence.
7. Show the AI-generated follow-up question.
8. End the interview.
9. Show the final interview insights.

**The main wow moment:** The AI detects a questionable statement and suggests a specific, intelligent follow-up question that the journalist can immediately ask.

Prepare a backup recording or preloaded transcript in case live transcription fails during the demo.

---

# 8. Critical Priorities

If time becomes limited, follow this priority order.

| Priority | Feature | Importance |
|---|---|---|
| P0 | Working interview preparation | Essential |
| P0 | Working microphone/transcription | Essential |
| P0 | Claim extraction | Essential |
| P0 | Web search and evidence retrieval | Essential |
| P0 | Fact-check verdicts | Essential |
| P0 | Live dashboard | Essential |
| P1 | Suggested follow-up questions | Very high |
| P1 | Final interview summary | High |
| P2 | Advanced statistics and visualizations | Low |
| P2 | Speaker identification | Low |
| P2 | Authentication and database | Not needed |
| P2 | Complex animations | Not needed |

### If something breaks

- If live transcription fails, use a pre-recorded audio file or simulated transcript.
- If Tavily fails, use a small set of predefined sources for the demo.
- If AI processing is too slow, process fewer claims.
- If the final summary fails, calculate the verdict statistics directly from the available fact-check results.

Never sacrifice the core end-to-end flow for secondary features.

---

# 9. Final Definition of Done

The MVP is considered complete when a journalist can:

1. Configure an interview.
2. Start recording.
3. See the transcript updating live.
4. See relevant factual claims extracted.
5. See evidence retrieved from the web.
6. See an understandable fact-check verdict.
7. Receive useful follow-up questions.
8. End the interview.
9. See a summary of the interview's key findings.

**Final principle: Build one working product together, not five separate demos.**
