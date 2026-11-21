# Mandatory coordination: Person 4 pipeline and Person 5 backend

Read this document before implementing AI analysis or backend integration. The file ownership and non-overlap rules are mandatory for this work, as requested by Person 4. They let both contributors progress independently without creating duplicate implementations.

**Status:** contract revision `p4-0.1` is accepted and integrated on branch `feat/crosscheck-integration` (see §0). Sections 1–5 are kept as the original coordination record; where they describe a proposal, §0 supersedes them.

## 0. Accepted contract — revision p4-0.1

Types live in `server/services/pipeline/contracts.ts`; the backend boundary is `AiPipeline` in `server/types/pipeline.ts`.

```ts
interface AiPipeline {
  extractClaims(input: { context: InterviewContext; segment: TranscriptSegment; recentSegments?: TranscriptSegment[] }, signal?: AbortSignal): Promise<ExtractedClaim[]>
  checkClaim(input: { context: InterviewContext; claim: ExtractedClaim }, signal?: AbortSignal): Promise<ClaimCheck>
}
type ExtractedClaim = Pick<ClaimCheck, 'id' | 'originalQuote' | 'normalizedClaim' | 'timestampMs'>
```

- **Loading:** the backend imports `./server/services/factCheckPipeline.ts` (default export) unless `AI_PIPELINE_MODULE` names another module; `AI_PIPELINE_MODULE=none` runs without analysis. The module is imported after `dotenv/config`. Model: `OPENAI_ANALYSIS_MODEL`, default `gpt-5.4-mini`. Missing keys never stop startup.
- **`recentSegments`:** the store sends up to 6 preceding final segments of the same interview, oldest first, excluding `segment`. Used only to resolve references and statements split across segments. Non-final segments yield `[]` with no provider call.
- **Claims:** IDs are `${segment.id}:c${index}`; `timestampMs` is copied from the source segment; `originalQuote` is exact transcript wording.
- **Verdicts:** `checkClaim` resolves a terminal verdict, never `CHECKING`. Every evidence URL comes from a retrieved Tavily source; non-`UNVERIFIED` verdicts carry at least one evidence item. `confidence` is 0–1.
- **UNVERIFIED vs failure:** `UNVERIFIED` means the search succeeded but reliable evidence was insufficient (an empty search is not a failure). Operational problems reject with `PipelineError` and never become a verdict.
- **Error codes:** `CONFIGURATION` (missing/rejected key or model), `PROVIDER` (upstream outage or non-success), `TIMEOUT`, `ABORTED`, `INVALID_OUTPUT` (model/provider output failed validation). Messages are sanitized; the store shows them as `job.error = "<CODE>: <message>"`, marks the job `failed`, and gives the check a placeholder `UNVERIFIED` with confidence 0. Failed jobs can be retried through the retry route.
- **Timeouts:** Tavily 12 s, each OpenAI call 20 s. Extraction is one job (one call); a fact check is one job (search + one analysis call, ≤ 32 s). The store's per-job timeout is 45 s, counted from when the job starts running.
- **Summary:** `GET /api/interviews/:id/summary` returns `summarizeInterview` over checks whose job did not fail. `InterviewSummary` in `shared/api.ts` now also has `pendingClaims`, `contradictions`, `needsResearch`, and `followUpQuestions`. `unansweredQuestions` stays empty because no answer state is tracked.

## Quick path for Person 5 and their coding agent

1. Read `AGENTS.md`, this document, `README.md`, `PLAN.md`, and `shared/types.ts` before editing. Follow the existing repository rules, including English documentation and no test frameworks or test execution.
2. Work in `server/`; do not create a parallel `backend/` directory or copy the example interfaces from `TEAM TASK BREAKDOWN.md` over the actual shared contracts.
3. Build routes, interview state, scheduling, and transport in your owned files. Use a clearly labeled mock pipeline adapter until Person 4's modules are available.
4. Do not implement claim extraction, Tavily search, or evidence analysis. Those modules belong to Person 4.
5. Confirm or propose changes to the interfaces below in a PR comment or document update before wiring both modules together. Unresolved interface details do not block unrelated work in your own area.

Reading this file does not authorize package installation, service startup, shared-contract changes, or edits to someone else's files. Follow the scope authorized by your human teammate.

## 1. Verified repository baseline

| Area | Current state |
|---|---|
| Backend | `server/index.ts`, with Express and `GET /api/health`. |
| Analysis services | Not implemented in the reviewed main baseline; new modules belong in `server/services/`. |
| Shared contracts | `shared/types.ts` defines `InterviewContext`, `TranscriptSegment`, `ClaimCheck`, `Evidence`, `SuggestedQuestion`, `Verdict`, and `QuestionType`. |
| Transcript | `TranscriptSegment` uses `isFinal` and `timestampMs`. |
| Check | `ClaimCheck` includes `originalQuote`, `normalizedClaim`, `status`, evidence, and questions. Its status also permits `CHECKING`. |
| Summary | No shared summary contract exists yet. |
| Dependencies | OpenAI, Tavily, and WebSocket dependencies are already declared in `package.json`. |
| Validation | `AGENTS.md` prohibits writing/running tests and adding test frameworks. Lint, build, and manual functional checks are the available verification paths. |
| Audio integration | `AGENTS.md` describes audio feature-branch work, including an optional `onFinalSegment(segment, interviewId)` consumer. Do not assume those files or exports are merged into main. |

If this baseline becomes stale, report the discrepancy before changing a contract. Do not automatically migrate existing code to match old examples or this document.

## 2. Mandatory file ownership and non-overlap rules

The paths below reserve responsibilities; files described as new are planned deliverables, not available modules. Sharing `server/services/` does not mean sharing every file inside it.

**Delegation within Person 4's area:** Person 4 may assign the analysis packages in [PLAN.md](./PLAN.md) to teammates who have finished their original work. Each assigned contributor may edit only that package's listed paths; this is not permission to modify other Person 4 packages or their original frontend/audio/backend neighbors. Person 4 remains accountable for the combined result. Juan alone edits this contract and the task plan; contributors report proposed contract changes instead of editing those documents concurrently. P4-0 freezes the common baseline before P4-A through P4-E begin independent implementation.

| Surface | Owner | Responsibility |
|---|---|---|
| `server/services/claimExtractor.ts` | Person 4 | Claim extraction using interview context. New. |
| `server/services/webSearch.ts` | Person 4 | Tavily queries and source retrieval. New. |
| `server/services/evidenceAnalyzer.ts` | Person 4 | OpenAI evidence evaluation and follow-up questions. New. |
| `server/services/factCheckPipeline.ts` | Person 4 | Search/evaluation composition and provider adapters. New. |
| `server/services/summaryGenerator.ts` | Person 4 | Summary statistics and findings. New. |
| `server/services/pipeline/contracts.ts` | Person 4 / P4-0 | Single module-local type baseline for analysis packages. New. |
| `server/services/pipeline/context.ts` | Person 4 / P4-A | Pure recent-context preparation; no interview store. New. |
| `server/services/pipeline/openaiProvider.ts` | Person 4 / P4-E | Shared server-only structured-generation adapter. New. |
| `server/index.ts` and `server/routes/` | Person 5 | Startup, request validation, HTTP routes, and responses. |
| `server/services/interviewStore.ts` | Person 5 | In-memory interview state. New. |
| Queue, per-interview deduplication, REST/WebSocket transport | Person 5 | Use separate owned files, not Person 4's analysis modules. |
| `shared/types.ts` and event names/payloads | Person 5 coordinates | Agree changes with affected consumers before editing. |
| `package.json`, `package-lock.json`, shared configuration | Person 5 coordinates | Notify the team before changes; avoid competing lockfile updates. |
| `src/` | Persons 1, 2, and 3, by their area | Outside both roles unless its owner explicitly coordinates a change. |

Do not edit another owner's files, create a second implementation, or change shared contracts merely because the other module is not ready. Use a mock adapter within your own area instead. Read existing ownership and feature-branch work before reserving additional paths.

## 3. Proposed integration contract — confirmation required

These signatures are an initial proposal, not existing exports, a frozen parallel-development contract, or an approved change to `shared/types.ts`. P4-0 in [PLAN.md](./PLAN.md) must first record the agreed revision here and implement its module-local types, including conversation context, provenance, injected dependencies, summary, and failure behavior. After that baseline is shared, all packages import the same definitions rather than copying them. Contributors must not infer missing interfaces from these illustrative signatures.

```ts
// Proposed module-local contract, not yet implemented.
interface ExtractedClaim {
  id: string
  originalQuote: string
  normalizedClaim: string
  timestampMs: number
}

declare function extractClaims(input: {
  context: InterviewContext
  segment: TranscriptSegment
}): Promise<ExtractedClaim[]>

declare function checkClaim(input: {
  context: InterviewContext
  claim: ExtractedClaim
}): Promise<ClaimCheck>
```

### Inputs and results

- Person 5 identifies the interview, retrieves its `InterviewContext`, and supplies final segments for analysis. Partial segments remain display-only.
- Person 4 also ignores `isFinal: false` at extraction entry and returns `[]` when no factual claims are found. Context informs both extraction and evaluation.
- Person 4 assigns a claim ID and preserves it in the final `ClaimCheck`. `timestampMs` comes from the transcript segment, not provider completion time.
- Person 5 stores interview/segment/claim associations without adding shared fields unilaterally.
- Person 5 may publish `CHECKING` under the same claim ID, then update it with the final result. Agree event names and payloads with Person 2 first.
- `checkClaim` returns a final verdict, never `CHECKING`. Person 4 validates structured model output at runtime; a TypeScript assertion alone is insufficient.
- Proposed confidence scale: 0 to 1, when included. The shared type only says `number`; confirm the range with Persons 5 and 2 before displaying percentages.
- Person 5 owns endpoint and event envelopes. Person 4 does not create routes or WebSocket connections.

### Deduplication and asynchronous scheduling

- Person 4 removes duplicates within one extraction result and returns a normalized claim.
- Person 5 tracks processed final segment IDs and pending/completed claims per interview. Initially, compare normalized claims to avoid identical repeated checks.
- Text equality does not guarantee semantic deduplication across different phrasings. Agree an extractor extension if needed; do not claim this is already solved.
- Person 4 does not maintain a global interview store or second queue. Person 5 owns scheduling and state cleanup, keeping interviews isolated.
- Transcript ingestion/publication must not wait for Tavily or OpenAI. One failed check must not stop other checks or transcription.

### Evidence and service failures

- Person 4 searches for supporting and contradicting evidence, prioritizes reliable sources, and returns URLs from actual retrieved results. Never invent sources, statistics, or URLs.
- Opinions and filler do not produce checks. Insufficient evidence produces `UNVERIFIED`, not `CONTRADICTED`.
- Missing credentials, provider outages, and invalid model output are service errors, not successful investigations with no evidence.
- Person 4 exposes sanitized errors; Person 5 catches and communicates them using the agreed error envelope. Do not invent an additional `Verdict` value for failures.
- Keys stay in the local backend `.env`, never frontend code or `VITE_*`. Never commit keys, real interview audio, or personal interview data.

### Final summary

- Person 4 derives statistics and findings from available checks, without repeating the entire investigation.
- Person 5 supplies the actual interview results and exposes the endpoint. Pending `CHECKING` entries are not final verdicts.
- Agree the summary type and behavior for checks still pending at interview end before integration. Do not add shared interfaces unilaterally.
- The summary screen belongs to frontend owners. Resolve the Person 1/Person 2 ownership discrepancy in the existing team documents without creating duplicate screens.

## 4. Independent delivery and verification

The planned Person 4 development branch is `feat/person-4-ai-pipeline`, created after publishing this document. Keep Person 5's backend work on a different branch. Do not assume either branch has been created or published just because it is named here.

| Stage | Person 4 | Person 5 |
|---|---|---|
| Contract | Confirm extraction/check exports or propose changes. | Confirm inputs, results, and error/event boundaries with consumers. |
| Independent work | Use synthetic final/partial transcript segments and mock provider adapters in owned modules. No microphone, UI, or live backend routes required. | Implement state and routes against a clearly labeled mock pipeline adapter. |
| First integration | Deliver one complete claim through search and evaluation. | Replace the mock adapter with imports; do not copy analysis logic. |
| Reliability | Manually check opinions, insufficient evidence, invalid output, and provider failure. | Manually check per-interview duplicates and transcript ingestion while checks run. |
| Closure | Deliver the summary using the agreed contract. | Connect the summary endpoint and run the complete user journey. |

Use lint/build for static verification when applicable. Do not add or run tests/frameworks against the current `AGENTS.md` policy. Keep synthetic smoke inputs and mock helpers within Person 4's agreed surface; coordinate any extra files or configuration changes first. Real OpenAI/Tavily smoke checks are separate, require local credentials, and must not expose secrets or assume deterministic web results.

Before integration, cover these manual scenarios together: supported, contradicted, misleading, opinion ignored, insufficient evidence, repeated final segment, and service failure without stopping transcription. Mock results must never be represented as live research in the real product.

## 5. Asynchronous handoff and contract changes

- Keep commits focused on one behavior with its documentation. Before delivery, inspect the diff for unrelated files, secrets, generated output, and accidental configuration changes.
- Do not add dependencies when declared packages cover the need. Coordinate real additions with Person 5.
- For a contract change, record the current contract, proposed change, affected consumers, and reason in the PR. Update this document when the change is accepted.
- Until a shared change is acknowledged, keep developing against the proposed boundary using mocks; do not silently change the other side.

Include this short handoff in each delivery:

```text
Role/task:
Branch and commit:
Files changed:
Exports and input/output contract:
Static/manual checks run and results:
Known limitations or missing credentials:
Integration action required from the other role:
```

## 6. Pending confirmations

Empty checkboxes are unresolved decisions, not implied consent. Mandatory ownership boundaries apply while interface details are being confirmed.

- [ ] Person 5 acknowledges the ownership boundaries and confirms or explicitly revises the proposed function signatures.
- [ ] Persons 4 and 5 agree the error envelope and input/context validation boundary.
- [ ] Person 5 coordinates event names, update payloads, and confidence scale with Person 2.
- [ ] Persons 4 and 5 agree the summary contract and pending-check behavior at interview end.

## Retrieve this document safely

Once this file has been published to main, Person 5 can read it from their existing clone without switching branches or disturbing their work:

```sh
git fetch origin
git show origin/main:PIPELINE_BACKEND_HANDOFF.md
```

Ask the coding agent to read that output alongside the current `AGENTS.md` and shared types. Reading from `origin/main` does not merge it into the working branch; integrate it later using the team's normal Git workflow. This document itself grants no commit, push, or PR authority.
