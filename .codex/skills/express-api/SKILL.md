---
name: express-api
description: Apply Crosscheck's Express 5 and TypeScript conventions when adding or reviewing backend routes, middleware, services, and WebSocket endpoints.
metadata:
  short-description: Express API structure for Crosscheck
---

# Express API

Read the root [AGENTS.md](../../../AGENTS.md) for ownership and repository rules. Keep backend logic in `server/` and follow the existing TypeScript and ES module style.

## Structure

- `server/index.ts` loads environment configuration, creates the Express app and Node HTTP server, installs middleware, mounts routes, attaches WebSocket handlers, and starts the listener.
- Place new domain HTTP routes in `server/routes/<domain>.ts` and mount each router once under `/api`. Keep request parsing and response handling in the route and move domain logic and provider calls into `server/services/<domain>/`.
- Put request, response, and event contracts used by both the browser and server in `shared/`. Coordinate changes to these contracts with the team.
- Match existing named exports, two-space indentation, English identifiers, and relative `.ts` imports. Use `import type` for type-only imports. The backend runs through `tsx` under the repository's NodeNext configuration.

## Request boundaries

- Treat params, query strings, bodies, and WebSocket messages as untrusted. Validate and narrow them at the transport boundary before handing values to a service. TypeScript request types describe the contract and have no runtime validation effect.
- Use the existing response contract for each transport. Send a useful status and a safe error message without exposing secrets, stacks, raw provider errors, or transcript contents in diagnostics.
- Enforce access to private or privileged resources on the server. Treat an origin allowlist as a browser restriction and validate an interview ID and its ownership before associating it with stored data.
- Read provider credentials on the server and pass them into the services that need them. Keep API keys out of the browser, shared types, responses, logs, and Git.

## Live transcription

- Attach the upgrade handler to the HTTP server used by Express. Match the path and allowed origin before upgrading, since Express HTTP middleware does not handle WebSocket upgrades.
- Reuse the route, sample rate, and events in `shared/audio-transcription.ts`. Validate audio frames and commands before forwarding them to OpenAI.
- Keep the OpenAI connection, audio turn handling, and transcript events in `server/services/audio/`. Forward partial segments to the browser and pass final segments to the optional pipeline consumer. Drain pending transcript events when recording stops and close the provider connection when the client disconnects.

Review the resulting diff with `git diff --check`. Do not write or run tests or use test frameworks.
