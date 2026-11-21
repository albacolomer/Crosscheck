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
