# Crosscheck — Plan de implementación

## Objetivo

Construir en una hackathon de cuatro horas un copiloto de investigación para periodistas. Durante una entrevista, la aplicación transcribe el audio, identifica afirmaciones factuales, busca evidencia fiable y propone preguntas para profundizar. Al terminar, presenta los hallazgos principales.

La prioridad es un recorrido funcional de principio a fin. La transcripción y la verificación son el núcleo; mantener la entrevista en marcha tiene prioridad sobre añadir funciones secundarias.

## Alcance y tiempo

- Equipo de cinco personas.
- Tres horas para desarrollo e integración.
- Última hora reservada para pruebas, pulido y preparación de la demo.
- Sin autenticación, base de datos ni almacenamiento persistente. El estado vive en memoria.
- No añadir infraestructura ni dependencias salvo que sean necesarias para completar el recorrido.

## Stack acordado

| Capa | Tecnología |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS y shadcn/ui |
| Backend | Node.js y Express |
| Transcripción | OpenAI Realtime API |
| Análisis | OpenAI API |
| Búsqueda web | Tavily Search API |
| Estado | React state o Context en frontend; memoria en backend |

Las claves de API permanecen en el backend y se configuran mediante variables de entorno.

## Experiencia del producto

### 1. Preparación

Formulario breve con título de la entrevista, nombre y rol/organización de la persona entrevistada, información de contexto, temas a investigar y preguntas o enfoques clave. Todo este contexto debe llegar al flujo de análisis. Acción principal: **Iniciar entrevista**.

### 2. Entrevista en directo

Al iniciar, solicitar permiso para el micrófono, capturar audio y transmitirlo para obtener transcripción progresiva. El panel en directo tendrá tres áreas:

- **Transcripción:** conversación reciente visible, afirmaciones detectadas resaltadas y separación de hablantes cuando sea posible.
- **Verificación:** una tarjeta por afirmación relevante con afirmación original, estado, explicación breve, evidencia a favor o en contra, enlaces a las fuentes y nivel de confianza.
- **Preguntas sugeridas:** preguntas concisas vinculadas a la afirmación, clasificadas como desafío, seguimiento o contexto, con botón para copiar.

Estados de verificación: `SUPPORTED`, `CONTRADICTED`, `MISLEADING` y `UNVERIFIED`. La falta de evidencia se presenta como `UNVERIFIED`, nunca como falsedad. Mostrar estados de carga y error.

La transcripción no debe esperar a la extracción, búsqueda o análisis. Procesar afirmaciones de forma asíncrona, descartar duplicados e ignorar opiniones, retórica y muletillas. Buscar tanto evidencia que respalde como que contradiga; priorizar fuentes primarias y fiables. No inventar fuentes, cifras ni URL.

### 3. Insights al finalizar

Al pulsar **Terminar entrevista**, mostrar tarjetas KPI con el total de afirmaciones y recuentos por estado. Incluir hallazgos clave: declaraciones más controvertidas, contradicciones importantes, afirmaciones que requieren investigación adicional, preguntas sin responder y conclusiones principales. Mantenerlo en listas claras; sin gráficos complejos.

## Flujo técnico

```text
Preparación y contexto ───────────────────────────────────────────┐
                                                                  v
Micrófono -> OpenAI Realtime -> transcripción -> extracción de afirmaciones
                                             -> cola asíncrona (sin bloquear audio)
                                             -> Tavily (evidencia a favor y en contra)
                                             -> análisis OpenAI (veredicto y preguntas)
                                             -> dashboard en directo -> insights finales
```

Usar respuestas estructuradas para extracción y verificación. Mantener contratos TypeScript compartidos entre frontend y backend. Los enlaces mostrados deben proceder de resultados reales de búsqueda. Si no se encuentran pruebas fiables, devolver `UNVERIFIED`. El flujo debe tolerar errores de una verificación sin detener la transcripción.

## Contratos mínimos

- **Contexto de entrevista:** título, entrevistado, rol/organización, antecedentes, temas y preguntas/enfoques.
- **Segmento de transcripción:** identificador, texto, estado final/provisional y hablante opcional.
- **Afirmación:** identificador, cita original, afirmación normalizada, categoría/contexto e importancia.
- **Verificación:** identificador de afirmación, estado, explicación, confianza, evidencias y preguntas sugeridas.
- **Evidencia:** título, URL, resumen y postura (`supporting` o `contradicting`).
- **Resumen:** estadísticas calculadas a partir de verificaciones y listas de hallazgos.

Definir los tipos y eventos compartidos al inicio para que los módulos puedan integrarse en paralelo.

## Prioridades

### P0 — Imprescindible

1. Captura de micrófono.
2. Transcripción en tiempo real.
3. Extracción de afirmaciones factuales.
4. Búsqueda web mediante Tavily.
5. Verificación basada en evidencia.
6. Actualizaciones del dashboard en directo.

### P1 — Importante

1. Pantalla para preparar la entrevista.
2. Preguntas de seguimiento sugeridas.
3. Contexto de entrevista integrado en el análisis.
4. Resumen al finalizar.

### P2 — Solo si P0 y P1 funcionan

Identificación de hablantes, estadísticas avanzadas, animaciones, historial persistente y exportación.

## Reparto de trabajo

| Persona | Área | Entrega e integración |
| --- | --- | --- |
| 1 | Preparación y cierre | Formulario de contexto e insights finales |
| 2 | Dashboard en directo | Transcripción, tarjetas de verificación y preguntas |
| 3 | Audio | Captura de micrófono e integración con Realtime |
| 4 | Análisis | Extracción, Tavily, evidencia y preguntas sugeridas |
| 5 | Backend e integración | Express, contratos, estado en memoria y conexión de módulos |

Todo el equipo acuerda primero los tipos de datos y los eventos de integración. No reescribir código que ya funciona.

## Secuencia de trabajo

### 0:00–0:30 — Base compartida

- Confirmar el contrato de datos y las interfaces entre módulos.
- Preparar la aplicación y el backend con el stack acordado.
- Comprobar credenciales y una llamada mínima a los servicios externos.
- Acordar variables de entorno; no incluir claves en el frontend.

### 0:30–1:30 — Camino de verificación

- Implementar extracción de afirmaciones y deduplicación.
- Conectar búsqueda de Tavily y análisis de evidencia.
- Mostrar una tarjeta con estado, fuentes y preguntas.
- Mantener la transcripción independiente del trabajo asíncrono de verificación.

### 1:30–2:30 — Audio y pantallas

- Integrar captura y transcripción progresiva.
- Conectar la pantalla de preparación y pasar su contexto.
- Integrar las tres áreas del dashboard.
- Añadir acción de terminar y resumen sencillo.

### 2:30–3:00 — Integración completa

- Conectar los módulos y resolver fallos del recorrido principal.
- Añadir estados de carga, error y `UNVERIFIED`.
- Verificar que una búsqueda fallida no detiene la transcripción.

### 3:00–4:00 — Pruebas, pulido y demo

- Ensayar el flujo completo de preparación a insights.
- Pulir jerarquía visual, legibilidad y estados de carga.
- No iniciar funcionalidades P2 ni cambios de arquitectura en esta hora.
- Dejar preparada una alternativa de demo si falla la conectividad.

## Guion de demo

Preparar una entrevista breve que incluya una afirmación verificablemente cierta, una demostrablemente falsa y una engañosa o dependiente del contexto. Mostrar:

1. Creación de la entrevista con contexto.
2. Inicio de la grabación y transcripción progresiva.
3. Detección de una afirmación.
4. Resultado con evidencia y enlaces.
5. Pregunta sugerida copiable.
6. Fin de la entrevista e insights con recuentos.

La demo debe priorizar fiabilidad sobre cantidad de funciones.

## Criterios de éxito

- Se completa el flujo de preparación, entrevista en directo e insights.
- El audio sigue transcribiéndose mientras se verifican afirmaciones.
- Las tarjetas contienen fuentes consultables cuando hay evidencia disponible.
- La ausencia de pruebas suficientes aparece como `UNVERIFIED`.
- Las preguntas son específicas y están ligadas a afirmaciones.
- La aplicación sigue siendo comprensible y usable ante errores de API.
