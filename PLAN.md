# Crosscheck — Implementation Plan

## Objective

Build a research copilot for journalists in a four-hour hackathon. During an interview, the app transcribes audio, identifies factual claims, searches for reliable evidence, and suggests follow-up questions. When the interview ends, it presents the key findings.

Prioritize a working flow from preparation to results. Live transcription and claim verification come first. The interview should keep running while checks are in progress.

## Scope and Timeline

- Five people.
- Three hours for development and integration.
- One final hour for rehearsal, polish, and demo preparation.
- Keep state in memory for the MVP. Authentication, a database, and persistent storage are out of scope.
- Add infrastructure or dependencies only when needed to complete the interview flow.

## Agreed Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, and shadcn/ui |
| Backend | Node.js and Express |
| Transcription | OpenAI Realtime API |
| Analysis | OpenAI API |
| Web search | Tavily Search API |
| State | React state or Context in the frontend, and in-memory state in the backend |

Configure API keys through environment variables on the backend.

## Product Flow

### 1. Preparation

Use a short form to collect the interview title, interviewee name and role or organization, background, topics to investigate, and key questions or angles. Pass this context to the analysis pipeline. The primary action is **Start Interview**.

### 2. Live Interview

When the interview starts, request microphone permission and stream captured audio for live transcription. The dashboard has three areas.

- **Transcript** shows recent conversation, highlights detected claims, and separates speakers when possible.
- **Fact checks** show one card per relevant claim with the original wording, verdict, short explanation, supporting or contradicting evidence, source links, and confidence.
- **Suggested questions** show concise questions linked to each claim. Label them as challenge, follow-up, or context and provide a copy button.

Use `SUPPORTED`, `CONTRADICTED`, `MISLEADING`, and `UNVERIFIED` as verdicts. Show `UNVERIFIED` when evidence is insufficient. Include loading and error states.

Keep transcription running while claim extraction, search, and analysis happen asynchronously. Deduplicate claims and filter out opinions, rhetoric, and filler. Search for supporting and contradicting evidence and prioritize reliable primary sources. Use only sources, figures, and URLs found in the evidence.

### 3. Interview Insights

When the user selects **End Interview**, show the total number of claims and the count for each verdict. Highlight controversial statements, significant contradictions, claims that need more research, unanswered questions, and key takeaways. Use short lists and count cards.

## Technical Flow

```text
Preparation and context ─────────────────────┐
                                             v
Microphone -> OpenAI Realtime -> transcript -> claim extraction
                                            -> async verification queue
                                            -> Tavily (supporting and contradicting evidence)
                                            -> OpenAI analysis (verdict and questions)
                                            -> live dashboard -> final insights
```

Use structured outputs for extraction and verification. Share TypeScript contracts between the frontend and backend. Links must come from actual search results. Return `UNVERIFIED` when reliable evidence is unavailable. A failed fact check must leave transcription running.

## Minimum Contracts

- **Interview context** contains the title, interviewee, role or organization, background, topics, and key questions or angles.
- **Transcript segment** contains an ID, text, a final or partial status, and an optional speaker.
- **Claim** contains an ID, original quote, normalized claim, category or context, and priority.
- **Fact check** contains the claim ID, verdict, explanation, confidence, evidence, and suggested questions.
- **Evidence** contains a title, URL, summary, and stance (`supporting` or `contradicting`).
- **Summary** contains counts calculated from fact checks and lists of findings.

Agree on shared types and events early so the modules can be built in parallel.

## Priorities

### P0 — Essential

1. Microphone capture.
2. Live transcription.
3. Factual claim extraction.
4. Web search through Tavily.
5. Evidence-based verification.
6. Live dashboard updates.

### P1 — Important

1. Interview preparation screen.
2. Suggested follow-up questions.
3. Interview context in the analysis.
4. Final summary.

### P2 — After P0 and P1 Work

Speaker identification, advanced statistics, animations, persistent history, and export.

## Team Assignments

| Person | Area | Deliverable |
| --- | --- | --- |
| 1 | Preparation and results | Context form and final insights |
| 2 | Live dashboard | Transcript, fact-check cards, and questions |
| 3 | Audio | Microphone capture and Realtime integration |
| 4 | Analysis | Claim extraction, Tavily, evidence, and suggested questions |
| 5 | Backend and integration | Express, contracts, in-memory state, and module integration |

Agree on shared types and integration events before building the modules. Reuse working code.

## Person 4 — Parallel Delivery Plan

**Status: planned work, not implemented functionality.** Person 4 remains accountable for analysis, but can delegate the packages below to teammates who have finished their original areas. Assign one human owner to each package before starting. A contributor's original team number does not change the edit boundaries of their assigned package.

This section organizes tasks; [PIPELINE_BACKEND_HANDOFF.md](./PIPELINE_BACKEND_HANDOFF.md) remains the **only cross-role technical contract**. Put definitive signatures, payloads, error semantics, and contract revisions there, not in a second integration document. Existing `shared/types.ts` takes precedence over the illustrative minimum contracts above.

### Baseline and dependency rule

- Juan coordinates one agreed starting commit based on the latest integrated `main`, retaining the isolated installation fix if still needed. The last main reviewed for audio compatibility was `7d886e3`; do not assume later branches are integrated or change other owners' work automatically.
- Use `JuanCarlosVallejoRuiz` as the Person 4 integration base. Publish/share the agreed starting commit explicitly before teammates branch from it; the currently local feature branch is not an assumed shared remote base.
- **P4-0 is the single initial prerequisite.** After it lands on the agreed base, P4-A through P4-E can be developed and checked independently. P4-F is intentionally dependent: real integration cannot happen before its modules exist.
- Each package imports the same module-local types and uses injected dependencies or synthetic fixtures. Do not import another unfinished package's implementation, copy its type declarations, or create a second implementation to unblock yourself.
- Keep interview storage, ordering, scheduling, cross-segment deduplication, routes, and transport with Person 5. Person 3 owns audio segmentation. No analysis package edits their modules, the frontend, `shared/types.ts`, or package/configuration files without explicit coordination.
- No new packages or globally installed tools are required. Follow `AGENTS.md`: use lint/build and manual functional checks; do not add or run automated tests or test frameworks.

### Package map

All paths below are planned edit surfaces, not a claim that the files already exist. Branch names are recommendations, not branches already created.

| ID | Priority | Responsibility | Exclusive edit surface | Suggested branch |
| --- | --- | --- | --- | --- |
| P4-0 | First | Juan: freeze types and the execution boundary | `server/services/pipeline/contracts.ts`; coordination document edits reserved to Juan | `feat/p4-contract-baseline` |
| P4-A | P0, parallel | Contextual claim extraction | `server/services/claimExtractor.ts`, `server/services/pipeline/context.ts` | `feat/p4-context-extraction` |
| P4-B | P0, parallel | Tavily evidence retrieval | `server/services/webSearch.ts` | `feat/p4-evidence-search` |
| P4-C | P0, parallel | Evidence evaluation and follow-up questions | `server/services/evidenceAnalyzer.ts` | `feat/p4-evidence-analysis` |
| P4-D | P1, parallel | Deterministic interview summary | `server/services/summaryGenerator.ts` | `feat/p4-summary` |
| P4-E | P0, parallel | Provider adapter and pipeline composition | `server/services/pipeline/openaiProvider.ts`, `server/services/factCheckPipeline.ts` | `feat/p4-pipeline-composition` |
| P4-F | Final | Juan with Person 5: assemble and verify the real modules | Person 4 composition glue and coordination document; Person 5 integrates only in their owned backend files | `feat/p4-integration` |

A contributor may read other files for context, but must not edit them. Extra helpers or fixture files require an explicit, disjoint path assignment first. `PLAN.md` and `PIPELINE_BACKEND_HANDOFF.md` have one editor, Juan, to avoid competing documentation edits. Contributors send proposed changes in their handoff rather than editing the contracts themselves.

### P4-0 — Freeze one common starting point

**Objective:** remove ambiguity once, before parallel coding. This task does not build another application layer.

- Read the existing handoff, `shared/types.ts`, and the actual audio/backend entry points on the agreed base. Reconcile the documented proposal with the new work before declaring it ready.
- Record the chosen contract revision in the sole handoff and implement its small module-local type file. Do not modify `shared/types.ts` unilaterally.
- Define extracted-claim provenance, recent-conversation input, neutral search-source records, final-check results, summary input/output, provider function types, and sanitized failure results. Search records do not assign a verdict or supporting/contradicting stance in advance.
- Fix the treatment of incomplete references, claim IDs/source IDs, recording-relative timestamps, confidence range, pending results, and partial failures. Keep the exact original quote separate from its contextual normalization.
- Define dependency signatures for injected extraction, search, and structured generation, so P4-E can run without importing P4-A/B/C implementations. Define a separate composition point for connecting the real functions later.
- Specify named synthetic inputs and expected outcomes in the handoff. Include split statements, ambiguous references, empty evidence, provider failure, and mixed final/pending checks. These fixtures are not live research.

**Ready when:** every package can identify its input, output, failure behavior, and exclusive paths from the same contract revision; the type file compiles; the agreed starting commit is available to all contributors. Until then, downstream package implementation is not advertised as unblocked.

### P4-A — Interpret conversation and extract claims

**Input:** interview context, a final segment, and the bounded preceding conversation supplied by Person 5. **Output:** complete factual claims with exact quotes and source-segment references, using the P4-0 contract.

- Ignore provisional segments, opinions, rhetoric, and filler. Remove duplicate candidates within one extraction result.
- Use a pure context helper, not a global interview store. Retain provenance and distinguish recording-relative time from wall-clock time; session chronology is provided by Person 5.
- Resolve references only when explicit context supports them. Do not invent a subject, date, unit, or comparison. Ambiguous/incomplete input must not become a false claim or an `UNVERIFIED` verdict; follow the agreed pending-context behavior.
- Treat transcript/provider text as data, not instructions. Validate structured output before returning it.

**Independent checks:** a partial segment triggers no extraction; an opinion yields no claim; an explicit preceding question resolves a pronoun; an ambiguous reference does not invent a fact. With successive synthetic segments “In 2024 our emissions fell by” and “20%, per unit produced.”, do not emit an incomplete first claim or silently interpret the final statement as an absolute reduction. Check provenance and unchanged original wording.

**Does not own:** voice identification, microphone capture, Tavily, evidence verdicts, persistent context, or cross-interview state. Inject a fake structured-generation function for offline checks; a live check needs a backend OpenAI key.

### P4-B — Retrieve evidence without deciding the verdict

**Input:** a complete normalized claim and interview context. **Output:** validated, deduplicated neutral source records, using the P4-0 contract.

- Implement the Tavily adapter through the already declared SDK. Search for material that could support or contradict the claim, keeping its period, scope, and units.
- Preserve actual titles, URLs, and relevant source content. Prefer primary and authoritative sources, without claiming a domain alone proves reliability.
- Reject unusable records and unsafe URL schemes. Do not invent source content, fill gaps with model knowledge, or assign the final evidence stance/verdict here.
- Distinguish a successful empty search from missing credentials, timeouts, provider errors, and malformed responses. Use bounded requests and sanitized errors as agreed in P4-0.

**Independent checks:** inject search responses containing duplicates, missing fields, unsafe links, no results, and a provider failure. Confirm the returned source set, no invented links, and the exact agreed failure behavior. Live Tavily verification is separate and needs its backend key.

### P4-C — Evaluate evidence and generate questions

**Input:** one complete claim, context, and retrieved source records. **Output:** a final `ClaimCheck`, preserving claim identity and original wording, with an explanation and 1–3 useful categorized questions when appropriate.

- Use injected structured generation; do not perform Tavily searches or create a second OpenAI adapter in this file.
- Compare the same subject, time period, geography, denominator, and units. Distinguish contradiction from missing evidence and potentially misleading framing.
- Assign supporting/contradicting stance during evidence analysis. Every cited URL must come from the supplied retrieved sources; reject fabricated citations and invalid output.
- Return `UNVERIFIED` for insufficient reliable evidence, never for an operational failure. Apply the agreed confidence range and output validation. Do not return `CHECKING` as a final result.

**Independent checks:** synthetic source sets for all four verdicts, no evidence, an invented citation, invalid confidence, malformed output, and generation failure. Check that questions are linked to the claim and contain no unsupported factual premise. Fixtures demonstrate application behavior, not real-world model accuracy.

**Does not own:** search, audio, state, routes, or UI. A fake generation function removes dependency on P4-B/P4-E and API keys during development; a live check needs OpenAI access.

### P4-D — Summarize actual results deterministically

**Input:** final checks and any explicit question-answer state defined by P4-0. **Output:** the agreed module-local summary, without changing the frontend/shared contract on its own.

- Compute totals and each verdict count from actual final checks. Exclude `CHECKING` from final verdict counts and describe pending work separately if the contract includes it.
- Derive concise findings from existing results and explanations. Do not search again, require a language-model call, or invent conclusions.
- Do not label every suggested question as unanswered: that requires explicit answer-state input. Report only what the input establishes.

**Independent checks:** empty input, mixed verdicts, pending checks, and explicit answered/unanswered input. Counts must reconcile and repeated calls on identical input must produce identical output without modifying it.

**Does not own:** ending recording, deciding when pending work is drained, interview storage, HTTP endpoints, or result screens. No API credentials or other package implementations are needed.

### P4-E — Compose asynchronous work through injected functions

**Input:** the P4-0 callbacks, context, and final-segment input. **Output:** the agreed per-claim outcomes and optional progress notifications, without owning the interview lifecycle.

- Implement the shared OpenAI Structured Outputs adapter with caller-supplied backend credentials/model, runtime validation, bounded timeout, and sanitized errors. No network call should happen merely by constructing an adapter.
- Compose injected extraction, search, and analysis functions. Synthetic callbacks must exercise the full path without P4-A/B/C imports or running services.
- Preserve IDs/provenance; publish successful results as they become available through the agreed callback boundary. A failed claim must not discard other completed outcomes.
- Do not add an interview store, second global queue, automatic retry loop, transport connection, or direct frontend update. The pipeline may await its own operations; Person 5 must schedule it without blocking transcript ingestion.
- Do not interpret stopping transcription as completion of all analysis. Document promise/progress/failure behavior for the integrator.

**Independent checks:** full synthetic success path; no claims; one failed search alongside a successful claim; rejected/malformed generation; and safe configuration failures with no secret leakage. Show that constructing an adapter makes no external call and that no error is disguised as a successful empty investigation.

### P4-F — Assemble once, after independent deliveries

Juan reviews and combines the accepted packages against the same contract revision, then connects their real functions in the Person 4 composition layer. This is the final dependency gate, not a parallel package pretending to be independent.

Person 5 owns live integration: one ingestion function for `onFinalSegment(segment, interviewId)` and optional REST text input, per-interview deduplication, ordered context snapshots, scheduling, storage, and output events. Do not send every live final segment twice through both a new frontend POST and the server callback.

The Person 3 demo reviewed at `7d886e3` expects interview creation and an SSE receipt stream; those backend routes/callback wiring were not mounted in that main entry point. Recheck Person 5's actual delivery before integration rather than rebuilding it. Receipt, transcription completion, and analysis completion are distinct events. Voice attribution and correction/version orchestration must not be claimed complete unless separately implemented and checked.

**Final checks:** complete synthetic path before live API smoke checks; the supported/contradicted/misleading/unverified scenarios; ambiguous context; duplicate segment delivery; one provider failure while transcription continues; recording restart chronology; summary counts and pending-analysis behavior. Run `npm run lint`, `npm run build`, and the authorized manual checks. Record live checks as unavailable when credentials, service access, or integration endpoints are missing; do not turn mock success into an end-to-end claim.

### Delivery rules for every contributor

1. Claim one package and use its suggested branch from the exact agreed baseline. Do not work directly on `main` or another contributor's branch.
2. Change only the assigned files. Keep runtime logic, prompts, and adapter behavior with their owning package; request an explicit path before adding a helper outside it.
3. Develop against the frozen contract with synthetic inputs/injected dependencies. No teammate has to finish their module for your package's own checks to run.
4. Keep credentials in the local backend environment, never source, `VITE_*`, fixtures, diagnostics, or Git. No contributor needs another person's editor or personal development setup.
5. Deliver package ID, branch/commit, contract revision, changed files, exported functions, exact checks/results, missing live proof, and proposed contract changes. Juan alone updates the sole handoff.
6. Completion means the package's output and checks were observed. A written function, successful build, or mocked response alone does not establish live verification accuracy or complete integration. Publishing, PRs, and merges require the team's explicit delivery decisions.

## Work Schedule

### 0:00–0:30 — Shared Foundation

- Confirm the data contracts and module interfaces.
- Set up the application and backend with the agreed stack.
- Confirm credentials and make a minimal call to each external service.
- Agree on environment variables and keep API keys on the backend.

### 0:30–1:30 — Verification Flow

- Implement claim extraction and deduplication.
- Connect Tavily search and evidence analysis.
- Show a card with a verdict, sources, and suggested questions.
- Keep transcription independent of asynchronous verification.

### 1:30–2:30 — Audio and Screens

- Integrate audio capture and live transcription.
- Connect the preparation screen and pass its context to the pipeline.
- Integrate the three dashboard areas.
- Add the end interview action and a simple summary.

### 2:30–3:00 — Full Integration

- Connect the modules and fix issues in the main flow.
- Add loading, error, and `UNVERIFIED` states.
- Verify that transcription continues after a search failure.

### 3:00–4:00 — Rehearsal, Polish, and Demo

- Rehearse the full flow from preparation to insights.
- Improve visual hierarchy, legibility, and loading states.
- Defer P2 work and architecture changes.
- Prepare a fallback demo in case connectivity fails.

## Demo Script

Prepare a short interview with a verifiably true claim, a demonstrably false claim, and a misleading or context-dependent claim. Walk through the interview in this order.

1. Create the interview and fill in its context.
2. Start recording and show the transcript updating.
3. Show the detection of a claim.
4. Open a fact check with evidence and source links.
5. Copy a suggested follow-up question.
6. End the interview and show the insights and verdict counts.

Prioritize a reliable demo of the core flow.

## Success Criteria

- The user can complete preparation, the live interview, and the final insights.
- Audio keeps transcribing while claims are checked.
- Cards include source links when evidence is available.
- Claims with insufficient evidence appear as `UNVERIFIED`.
- Suggested questions are specific and linked to claims.
- The application remains understandable and usable when an API call fails.
