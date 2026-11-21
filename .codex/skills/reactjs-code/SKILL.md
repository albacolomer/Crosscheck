---
name: reactjs-code
description: Apply Crosscheck's React, Vite, and TypeScript code structure when creating, changing, or reviewing pages, components, hooks, services, and shared frontend utilities.
metadata:
  short-description: React frontend code structure
---

# React Code Structure

Follow the existing files and the ownership boundaries in the team task breakdown. Add directories as their features need them.

```text
src/
  main.tsx         React entry point
  App.tsx          App shell and interview phase navigation
  pages/           Preparation, live dashboard, and results screens
  components/      Components grouped by feature, with shadcn/ui in ui/
  hooks/           Reusable React state and side effects
  services/        Browser API, audio, and streaming clients
  lib/             Pure utilities
shared/types.ts    Contracts used by React and Express
```

- Keep one substantial component per file. Use PascalCase for component names and files, and start hook names with `use`. Pages compose feature components and shared primitives.
- Keep screen state with its owner. Put state used across interview phases in the nearest shared parent or context. Use hooks to encapsulate reusable React logic and manage the lifetime of subscriptions and requests.
- Put HTTP requests and streaming connections in domain modules under `src/services/`. Services own transport, error handling, and response normalization. Components render typed data and hooks coordinate the services.
- Reuse the generated shadcn/ui primitives under `src/components/ui/` and compose them in feature components. Keep pure helpers in `src/lib/`.
- Reuse the contracts in `shared/types.ts` and coordinate changes with the team. Keep OpenAI and Tavily calls and their credentials in the Express backend.
- Keep this skill focused on source structure. Skip creating, configuring, or running automated tests.
