# Crosscheck

Copiloto de investigación para periodistas durante entrevistas. Stack: React + Vite + TypeScript + Tailwind CSS y shadcn/ui en el cliente; Node.js + Express en el servidor. Monorepo sencillo, contratos TypeScript compartidos y estado temporal en memoria.

## Preparar el PC de cada integrante

Instala Node.js 22.12 o posterior (incluye npm), Git y un editor de TypeScript, por ejemplo VS Code. No hace falta instalar React, Vite, Tailwind, Express ni shadcn/ui globalmente: `npm ci` instala las versiones locales fijadas en `package-lock.json`.

En PowerShell, clona el repositorio y prepara la copia local:

```powershell
git clone <URL_DEL_REPOSITORIO>
cd Crosscheck
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Si el repo ya está clonado, omite `git clone` y `cd`. El formulario y la UI con datos de ejemplo no requieren claves API. Quienes ejecuten la integración de IA necesitan acceso a las claves de OpenAI y Tavily; el PC de demo necesita ambas. Añádelas solo en `.env` como `OPENAI_API_KEY` y `TAVILY_API_KEY`. No las escribas en código ni variables `VITE_*`, no las compartas por Git y no envíes el archivo `.env` al equipo. El equipo debe compartir credenciales mediante un canal seguro.

Arranca frontend y backend juntos:

```powershell
npm run dev
```

Frontend: `http://localhost:5173`. Backend: `http://localhost:3001`. Comprueba `http://localhost:3001/api/health`; debe responder `{"status":"ok","service":"crosscheck-api"}`. Cuando pruebes la captura de audio, permite el micrófono en el navegador.

### Instrucciones para Codex

Al leer este README en la copia de trabajo, Codex debe comprobar si Node.js/npm y Git están disponibles, instalar las dependencias del proyecto con `npm ci`, crear `.env` desde `.env.example` solo si todavía no existe, y dejar `npm run dev` iniciado para que el equipo pueda trabajar. Puede ejecutar `npm run build` para comprobar los cambios. No debe sobrescribir `.env`, inventar claves ni incluir secretos en código o commits. Si falta una herramienta global, o hacen falta credenciales, debe indicar exactamente qué falta y quién del equipo debe proporcionarlo de forma segura.

## Arquitectura de carpetas

```text
src/                    Interfaz React
  components/           Componentes reutilizables (por crear)
  features/              preparation/, live/, insights/ (por crear)
  lib/                   Cliente API y utilidades
shared/types.ts          Contratos compartidos frontend/backend
server/index.ts          API Express y rutas del servidor
server/routes/            Endpoints (por crear)
server/services/          OpenAI, Tavily y pipeline (por crear)
.env.example             Nombres de configuración, sin secretos
```

## Reparto para empezar

1. **Persona 1 — Preparación e insights:** implementar formulario y vista final. Usar `InterviewContext` de `shared/types.ts`. No necesita claves API para trabajar en UI con datos simulados.
2. **Persona 2 — Dashboard en directo:** construir transcripción, verificaciones y preguntas con `TranscriptSegment` y `ClaimCheck`. No necesita claves API para UI con datos simulados.
3. **Persona 3 — Audio:** integrar captura de micrófono y transcripción Realtime; emitir segmentos finales sin bloquear el audio. Necesita permiso de micrófono en su navegador. La clave OpenAI va solo en el backend de integración local si desarrolla/ejecuta allí ese servicio.
4. **Persona 4 — Pipeline:** implementar extracción, búsqueda Tavily, evaluación y preguntas usando los tipos compartidos. Necesita claves OpenAI y Tavily en el `.env` del backend local.
5. **Persona 5 — Backend e integración:** crear rutas REST/WebSocket y estado en memoria; mantener `npm run dev` operativo. El PC integrador necesita las claves necesarias para los servicios conectados.

Todos los PCs usan las mismas dependencias con `npm ci`; no hay instalaciones distintas por rol. Antes de cambiar `shared/types.ts` o nombres de eventos, acordad el cambio con el equipo. Usad ramas cortas y commits frecuentes.

## Flujo de ramas

- `main`: versión integrada y lista para la demo.
- Una rama corta por tarea, por ejemplo `feat/live-dashboard` o `feat/tavily-checks`.
- No confirmar `.env`, audio de entrevistas ni datos personales reales.

El alcance y los hitos están en [PLAN.md](./PLAN.md). El desglose del equipo está en [TEAM TASK BREAKDOWN.md](./TEAM%20TASK%20BREAKDOWN.md).
