# Backend integration — Person 5

This branch adds REST routes, in-memory interview state, an asynchronous verification queue, and live interview snapshots. The domain types in `shared/types.ts` stay as they are. The envelopes in `shared/api.ts` are proposed for frontend integration and can be reviewed independently of the UI.

## API

| Method | Path | Input | Output |
| --- | --- | --- | --- |
| GET | `/api/health` | — | API status and pipeline availability |
| POST | `/api/interviews` | `InterviewContext` | 201 `Interview` |
| GET | `/api/interviews/:id` | — | `InterviewSnapshot` |
| POST | `/api/transcript` | `{ interviewId, segment }` | 202 accepted, 200 duplicate |
| POST | `/api/fact-check` | `{ interviewId, claim, originalQuote? }` | 202 `FactCheckResponse`, 200 duplicate |
| GET | `/api/interviews/:id/events` | EventSource | SSE `{ type: 'snapshot', data: InterviewSnapshot }` |
| GET | `/api/interviews/:id/summary` | — | `SummaryResponse` |
| POST | `/api/interviews/:id/end` | — | Snapshot with `endedAt` |
| POST | `/api/interviews/:id/jobs/:jobId/retry` | — | 202 `ProcessingJob` for a previously failed job |

Create an interview with `title` and `intervieweeName`. Other context fields default to empty strings or arrays. Keep the returned ID for recording, dashboard and summary calls. Errors use `{ error: { code, message } }`.

Send transcript updates under a stable segment ID. Partial segments update the transcript only. The first final segment queues extraction, duplicate inputs do not enqueue extra work, and late partials do not replace a final. Checks are deduplicated per interview by normalized claim text. Formatting variations are covered. Claims with different wording can still be checked separately.

Subscribe to the event stream with the interview ID. Each message contains the current transcript, fact checks and jobs. Reconnecting returns the latest state. A job can be queued, running, completed or failed. A failed check has an explanatory placeholder and a failed job. It is excluded from verdict counts. Confidence uses 0–1.

Stop recording and flush the final transcript before ending the interview. Ending rejects new input and lets existing work finish. Use `isComplete` and `pendingJobs` to show that the summary is still updating. The current summary aggregates completed checks from that interview, and lists failed jobs separately. A job may be retried after the interview ends without reopening it. State resets when the server restarts.

## Person 3 — transcription

The existing Realtime bridge sends finalized audio segments to the interview store when a socket supplies the interview ID. The browser can also submit segments through `POST /api/transcript`. The WebSocket still delivers partials directly to the audio client. Keep the same interview and segment IDs on both paths so the store can deduplicate finals. When using Realtime for finals, the browser only needs to submit partials if other live views should see them before finalization.

## Person 4 — verification

The adapter accepts the proposed contract from `PIPELINE_BACKEND_HANDOFF.md`. Extraction takes `{ context, segment }` and returns claims with `id`, `originalQuote`, `normalizedClaim` and `timestampMs`. Checking takes `{ context, claim }` and returns a terminal `ClaimCheck` with the same ID. An optional second `AbortSignal` argument lets providers cancel after the backend timeout.

Set `AI_PIPELINE_MODULE` in the local backend environment to the module exposing both functions, either as named exports or under a single `pipeline` or default export. For example, use `./server/services/factCheckPipeline.ts` if that file exports both. Use `OPENAI_API_KEY` and `TAVILY_API_KEY` only on the backend. Without a configured module, the backend still accepts and displays transcripts, and marks analysis jobs as failed with an explicit configuration error.

## Local verification

Install the dependencies with `npm ci`, start the application with `npm run dev`, and run `npm run lint` and `npm run build`. Check `GET /api/health`, create an interview, and submit one segment first as a partial and then as a final. Replay the final with the same ID and verify the job count stays unchanged. End the interview and confirm the summary includes only completed checks from that interview.
