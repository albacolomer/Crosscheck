# Crosscheck

Crosscheck is an interview research copilot. This repository contains a React browser app and a Node.js API that share TypeScript contracts.

## Working rules

- Use English for documentation, skill instructions, code identifiers, comments, commit messages, and UI copy.
- Follow the [implementation plan](./PLAN.md) and the file ownership in the [team task breakdown](./TEAM%20TASK%20BREAKDOWN.md). Coordinate changes to shared types and event payloads with the team.
- Use the [Git skill](./.codex/skills/git/SKILL.md) for repository workflows and the [React code structure skill](./.codex/skills/reactjs-code/SKILL.md) for frontend work.
- Do not write or run tests. Do not install, configure, or use test frameworks. Lint and build are the available static checks.

## Repository layout

The live transcription paths marked as feature work are proposed on the backend and browser transcription branches.

```text
src/                         React, TypeScript, Tailwind CSS, and shadcn/ui
  main.tsx                   React entry point
  App.tsx                    App shell and current API status screen
  index.css                  Global styles and theme
  assets/                    Assets imported by frontend modules
  pages/                     Preparation, live interview, and insights (planned)
  components/                UI grouped by feature, with shadcn primitives in ui/ (planned)
  hooks/                     React state and lifecycles (live transcription feature work)
  services/audio/            Microphone, AudioWorklet, and WebSocket transport (feature work)
  lib/                       Pure utilities
public/                      Static browser assets
server/                      Node.js and Express API
  index.ts                   HTTP entry point, CORS, and health
  routes/                    Express routers by API domain (planned)
  services/                  Provider integrations and domain logic
    audio/                   OpenAI Realtime bridge and audio turn handling (feature work)
shared/
  types.ts                   Interview, transcript, evidence, claim check, and question types
  audio-transcription.ts     Audio route, sample rate, and WebSocket messages (feature work)
vite.config.ts               Frontend build and same-origin development API proxy
.env.example                 Backend configuration names and placeholders
```

Pages compose feature components. Keep screen state with its owner and state shared across interview phases in a shared parent or context. Hooks manage React state and resource lifecycles. Put browser requests and streaming connections in `src/services/`, provider integrations and server state in `server/services/`, and cross-layer data contracts in `shared/`.

## Backend

- `npm run dev` starts Vite on `localhost:5173` and Express on `localhost:3001` with the default configuration. Vite proxies `/api` requests to Express so browser clients use the app's origin. `GET /api/health` reports API availability. Keep the proxy target and `CLIENT_ORIGIN` aligned with local port changes.
- Planned Express routes are `POST /api/interviews`, `POST /api/transcript`, `POST /api/fact-check`, and `GET /api/interviews/:id/summary`. Put request and response handling in `server/routes/` and domain work in `server/services/`. The MVP will keep interview state in memory.
- Configure `OPENAI_API_KEY` and `TAVILY_API_KEY` in the backend `.env` using `.env.example` as the template. Keep keys out of browser code, `VITE_*` variables, and Git.

## Live transcription feature branches

- The backend branch adds WebSocket upgrade handling at `/api/transcription/live`. The browser branch adds Vite WebSocket proxying and the `useAudioTranscription(interviewId)` hook, which exposes `start`, `stop`, `status`, `segments`, and `error`. Start capture from a user action when wiring the hook into the interview screens.
- The AudioWorklet sends mono 24 kHz PCM16 frames over the same-origin WebSocket. The server opens an OpenAI Realtime transcription session with `gpt-live-transcribe`, detects speech pauses, and returns `TranscriptSegment` updates under stable IDs. Use partial segments for display and final segments for analysis. Await `stop()` to let the final segments arrive before ending the interview. The server bridge accepts an optional `onFinalSegment(segment, interviewId)` consumer for pipeline integration. [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription)

## Planned analysis integrations

- Use the OpenAI Responses API with Structured Outputs to extract factual claims from final transcript segments and generate evidence-based verdicts and follow-up questions. Keep analysis asynchronous so transcription continues during verification. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- Use Tavily to find supporting and contradicting evidence. Cite URLs from actual results and return `UNVERIFIED` when reliable evidence is insufficient. The optional OpenAI Decisions API can prioritize claims for verification. Evidence analysis determines the verdict. [Decisions API](https://developers.openai.com/api/docs/guides/decisions)
