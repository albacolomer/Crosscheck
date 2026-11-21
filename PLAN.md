# Crosscheck — Plan para la hackathon

## Idea

Una aplicación que acompaña una entrevista y ayuda a verificar las afirmaciones que aparecen durante la conversación. Antes se prepara el contexto; durante se muestran verificaciones con fuentes; al terminar se genera un resumen que permite revisar cada afirmación y su evidencia.

El objetivo es ayudar a contrastar información sin interrumpir la entrevista. La herramienta evalúa afirmaciones concretas, no la honestidad de una persona: una afirmación falsa no demuestra que exista intención de mentir.

## Las tres fases

### 1. Preparar la entrevista

El usuario crea una sesión e introduce:

- Título y tema de la entrevista.
- Participantes y sus roles.
- Contexto relevante: país, período temporal y asuntos previstos.
- Documentos o enlaces de referencia, si los tiene.

La aplicación muestra una ficha de contexto que se puede revisar antes de empezar. Este contexto ayuda a interpretar nombres, cifras y referencias; no se considera evidencia de que las afirmaciones sean ciertas.

**Resultado:** una sesión preparada y un botón para iniciar la entrevista.

### 2. Verificar durante la entrevista

La aplicación recibe audio, lo transcribe y detecta afirmaciones que se pueden contrastar. Para cada una, busca evidencia y publica una tarjeta de verificación vinculada al momento de la conversación.

La pantalla tiene dos zonas principales:

- Transcripción en directo, con la afirmación que se está analizando resaltada.
- Tarjetas de verificación, con estado, explicación breve y fuentes consultables.

Estados propuestos:

| Estado | Significado |
| --- | --- |
| Verificando | Se está buscando y evaluando evidencia. |
| Respaldada | Las fuentes encontradas respaldan la afirmación en su contexto. |
| Refutada | Las fuentes encontradas contradicen la afirmación. |
| Necesita contexto | La afirmación omite matices relevantes o mezcla elementos correctos e incorrectos. |
| Sin evidencia suficiente | No se puede llegar a una conclusión con las fuentes disponibles. |

Las opiniones, predicciones y juicios de valor no reciben un veredicto factual. Una misma intervención puede contener varias afirmaciones que deben evaluarse por separado.

**Resultado:** una lista de afirmaciones con marcas de tiempo, estado y evidencia. La transcripción puede ser inmediata; las verificaciones llegan de forma asíncrona unos segundos después. La interfaz debe hacer visible esa diferencia.

### 3. Revisar al terminar

Al finalizar la entrevista se presenta:

- Resumen de los temas tratados.
- Recuento de afirmaciones por estado.
- Lista cronológica con filtros por estado.
- Detalle de cada afirmación: cita original, participante si se conoce, momento, explicación y fuentes.
- Verificaciones pendientes o inconclusas claramente identificadas.

El resumen se construye a partir de las verificaciones guardadas. No debe introducir nuevos veredictos sin evidencia.

**Resultado:** un informe revisable de la entrevista. La exportación se puede añadir si queda tiempo.

## MVP recomendado

Construir primero un recorrido completo y pequeño: preparar una sesión, introducir una entrevista, verificar unas pocas afirmaciones y consultar el resumen.

Incluido:

- Aplicación web con las tres pantallas.
- Formulario de contexto sencillo.
- Un único idioma inicial: español.
- Entrada de texto como alternativa para probar el flujo sin depender del micrófono.
- Audio en directo con transcripción si el equipo consigue integrarlo a tiempo.
- Detección de afirmaciones factuales y eliminación de duplicados.
- Búsqueda de fuentes y verificación con enlaces.
- Estados de espera, error y evidencia insuficiente.
- Resumen final generado con los resultados de la sesión.

Fuera del MVP:

- Identificación automática de múltiples hablantes.
- Extensión de navegador o integración con plataformas de videollamada.
- Análisis de vídeo, gestos o emociones.
- Puntuación global de credibilidad de una persona.
- Registro de usuarios, pagos y colaboración entre organizaciones.
- Cobertura exhaustiva de todas las afirmaciones de una entrevista.

## Estructura técnica propuesta

Mantener una sola aplicación web y un backend pequeño. Evitar separar servicios que el equipo tenga que desplegar y coordinar durante la hackathon.

```text
Contexto de la sesión
        |
Audio -> Transcripción -> Segmentos de texto
                              |
                    Detección de afirmaciones
                              |
                    Cola de verificaciones
                              |
                    Búsqueda de evidencia
                              |
                    Evaluación con fuentes
                              |
                    Tarjetas en la interfaz
                              |
                    Resumen de la sesión
```

El navegador captura audio y muestra los resultados. El backend gestiona las credenciales, llama a los proveedores de transcripción, búsqueda y evaluación, y guarda el estado de la sesión.

La cola limita las verificaciones simultáneas para controlar la latencia y el coste. Si una verificación falla, el resto de la entrevista debe continuar. Las afirmaciones repetidas reutilizan el resultado existente cuando mantienen el mismo contexto.

Elegir las tecnologías concretas según lo que ya domine el equipo. La primera decisión técnica debe ser comprobar que los proveedores elegidos permiten transcribir audio y recuperar evidencia consultable.

## APIs de OpenAI propuestas

Propuesta consultada en OpenAI Docs el 21 de noviembre de 2026. Es una arquitectura para validar durante la hackathon; todavía no se han probado las APIs con las credenciales del equipo. Confirmar acceso a modelos, límites y presupuesto antes de implementar.

### Selección por fase

| Fase / tarea | API o herramienta | Uso propuesto en Crosscheck |
| --- | --- | --- |
| Preparación | Responses API | Convertir el contexto introducido en una ficha de temas, entidades y referencias temporales. |
| Entrevista: audio | Realtime API en modo transcripción, con `gpt-live-transcribe` | Obtener texto incremental para la pantalla y texto final para procesar afirmaciones. |
| Entrevista: extracción | Responses API con Structured Outputs | Producir una lista de afirmaciones autocontenidas, sus citas originales y los segmentos de origen. |
| Entrevista: evidencia | Responses API con la herramienta `web_search` | Buscar información externa para contrastar cada afirmación y recuperar sus citas y fuentes. |
| Entrevista: veredicto | Responses API con Structured Outputs | Convertir la evidencia recuperada en el contrato de verificación de la aplicación. |
| Cierre | Responses API con Structured Outputs | Redactar el resumen a partir de las verificaciones guardadas. Los recuentos los calcula el backend. |

Para arrancar, proponemos `gpt-6.2-astra` en las llamadas de texto: la guía oficial de búsqueda lo utiliza para nuevas integraciones. Es una elección inicial por simplicidad, no un resultado de pruebas de coste o latencia. Mantener los modelos configurables por tarea y ajustar después de medir el recorrido completo. [Documentación de búsqueda web](https://developers.openai.com/api/docs/guides/tools-web-search).

### Audio: integración concreta

Propuesta de MVP: navegador → backend por WebSocket → OpenAI por WebSocket. La clave estándar permanece en el servidor. El backend también distribuye transcripciones y resultados al navegador.

La conexión de transcripción del servidor utiliza `wss://api.openai.com/v1/realtime?intent=transcription`. Se configura una sesión de tipo `transcription` con `gpt-live-transcribe`. Este modelo requiere que la aplicación marque el cierre de los turnos; usar detección de silencio del cliente y enviar `input_audio_buffer.commit`. No configurar `server_vad` ni `semantic_vad` para este modelo.

Mostrar los eventos `conversation.item.input_audio_transcription.delta` y procesar los eventos `conversation.item.input_audio_transcription.completed`. Relacionarlos mediante `item_id`, ya que los turnos pueden terminar de transcribirse fuera de orden. Las marcas de tiempo de la aplicación deben proceder del audio capturado, sin asumir alineación exacta por palabra. [Documentación de transcripción en tiempo real](https://developers.openai.com/api/docs/guides/realtime-transcription).

### Evidencia y veredicto: dos pasos

1. Buscar con Responses API y `tools: [{ type: "web_search" }]`. Pedir contraste explícito de la afirmación, respetando fecha, país y significado. Guardar las anotaciones de citas y las fuentes devueltas por la herramienta. No dar por completada una búsqueda si no aparece una llamada a la herramienta en la respuesta.
2. En una llamada independiente, pasar la evidencia recuperada al evaluador y solicitar JSON mediante Structured Outputs. Separar estos pasos permite revisar las fuentes antes de publicarlas y no depender de que búsqueda y formato estricto se puedan combinar en una sola petición.

Usar `gpt-6.2-astra` también para este primer evaluador es una propuesta del equipo pendiente de ensayo. Pedir que devuelva `insufficient_evidence` cuando la evidencia no permita concluir. La interfaz debe conservar enlaces consultables junto a cada resultado. Las fuentes web son datos externos: no deben poder cambiar las instrucciones del verificador.

### Contratos estructurados

En Responses API, definir `text.format` con `type: "json_schema"`, `strict: true` y un esquema compatible. Structured Outputs controla la forma de la respuesta; no garantiza la veracidad del contenido. Gestionar también rechazos y respuestas incompletas. [Documentación de Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Contratos propuestos:

- **Extractor:** `claims[]` con `originalQuote`, `normalizedClaim`, `segmentIds` y `needsMoreContext`.
- **Evaluador:** `claimId`, `status`, `explanation` y `evidenceRefs[]`.
- **Resumen:** `overview`, `topics[]` y `highlightedClaimIds[]`.

El backend asigna identificadores a las evidencias y valida que cada `evidenceRef` exista. Los enlaces publicados proceden del registro de fuentes recuperadas, no de URLs inventadas por el evaluador. También valida los identificadores de afirmaciones usados en el resumen.

### Qué integrar primero

1. Una llamada real de texto → afirmaciones estructuradas.
2. Una afirmación → búsqueda → evidencia → veredicto estructurado.
3. Varias verificaciones guardadas → resumen.
4. Conectar transcripción en directo al mismo flujo.

Al principio, mantener una cola con concurrencia baja y deduplicación. Medir latencia de transcripción, extracción y verificación por separado. Establecer límites por sesión y revisar el consumo real; no prometer una latencia ni un coste antes de probarlos.

No hace falta introducir embeddings, fine-tuning, una base vectorial ni un framework de agentes para este MVP. Si más adelante hay muchos documentos de contexto, evaluar File Search como ampliación; para empezar basta con contexto breve proporcionado por el usuario.

## Contrato mínimo de datos

Definir este contrato juntos antes de repartir la implementación:

### Sesión

- `id`, `title`, `topic`, `participants`, `context`.
- `status`: `draft`, `live` o `finished`.
- `startedAt`, `endedAt`.

### Segmento de transcripción

- `id`, `sessionId`, `text`.
- `startMs`, `endMs`, `speaker` opcional.
- `isFinal`: indica si el texto ya no es una transcripción provisional.

### Afirmación y verificación

- `id`, `sessionId`, `segmentIds`.
- `originalQuote`: cita literal de la entrevista.
- `normalizedClaim`: afirmación autocontenida que se puede contrastar.
- `speaker` opcional, `startMs`.
- `status`: `checking`, `supported`, `refuted`, `needs_context` o `insufficient_evidence`.
- `explanation`, `sources`, `checkedAt`.
- Cada fuente incluye `title`, `url`, `publisher`, `publishedAt` si se conoce y el fragmento de evidencia utilizado.

Mantener separados la cita original y el texto normalizado permite comprobar que la verificación responde a lo que realmente se dijo.

## Reparto para cinco personas

| Persona | Responsabilidad principal | Entrega |
| --- | --- | --- |
| 1 | Experiencia y frontend: preparación y resumen | Crear sesión, navegar entre fases y consultar el informe. |
| 2 | Frontend en directo | Transcripción, tarjetas de verificación, estados y conexión con eventos del backend. |
| 3 | Audio y transcripción | Captura de micrófono, integración de transcripción y segmentos finales con marcas de tiempo. |
| 4 | Detección y verificación | Extraer afirmaciones, buscar evidencia y producir resultados estructurados con fuentes. |
| 5 | Backend e integración | Sesiones, persistencia, cola, comunicación con el frontend, despliegue y coordinación de la demo. |

La persona 5 coordina la integración, pero cada persona integra y prueba su parte. Las personas 3 y 4 trabajan con el mismo contrato de segmentos; las personas 1 y 2 comparten componentes y el contrato de sesión.

## Orden de trabajo

### Hito 1 — Acordar y conectar

- Confirmar duración de la hackathon y experiencia del equipo.
- Elegir stack y proveedores; comprobar credenciales y una llamada real a cada servicio.
- Acordar contratos de datos y eventos.
- Montar el repositorio y una primera aplicación desplegada.
- Preparar datos de ejemplo compartidos para que el frontend avance en paralelo.

### Hito 2 — Completar el flujo con texto

- Crear una sesión con contexto.
- Introducir texto y detectar una afirmación.
- Buscar evidencia y mostrar un resultado con fuentes.
- Finalizar la sesión y mostrar su resumen.

Este es el primer punto de integración: debe existir antes de invertir tiempo en detalles visuales o funciones adicionales.

### Hito 3 — Conectar el audio

- Capturar el micrófono con consentimiento explícito.
- Mostrar transcripción provisional y final.
- Enviar únicamente segmentos finales a detección.
- Gestionar desconexiones y permitir continuar mediante texto.

### Hito 4 — Preparar la demo

- Probar el recorrido completo en el entorno desplegado.
- Ajustar legibilidad y estados de carga.
- Ensayar una entrevista breve con afirmaciones contrastables.
- Preparar una sesión de ejemplo con resultados guardados, identificada como demo, para fallos de conectividad.

Reservar aproximadamente el último 20 % del tiempo disponible para integración, pruebas y ensayo. No añadir nuevas funciones durante ese tramo salvo que sean necesarias para completar el recorrido.

## Criterios de éxito

- Se puede completar el recorrido de las tres fases sin asistencia técnica.
- Una afirmación queda vinculada a su cita original y momento de la entrevista.
- Cada veredicto concluyente presenta evidencia y fuentes accesibles.
- La ausencia de evidencia se muestra como tal, sin forzar una respuesta binaria.
- La entrevista continúa mientras hay verificaciones pendientes.
- El resumen conserva los resultados y fuentes mostrados durante la sesión.
- Los fallos de audio o de un proveedor tienen un estado visible y una alternativa para continuar.

## Riesgos y decisiones pendientes

- **Latencia:** medir el tiempo entre el segmento final y la tarjeta verificada. Priorizar pocas afirmaciones relevantes si se acumulan pendientes.
- **Calidad de evidencia:** preferir fuentes primarias, comprobar fechas y contexto geográfico y temporal. Una URL por sí sola no demuestra que la fuente respalde el veredicto.
- **Errores de transcripción:** permitir revisar la cita que originó cada resultado y evitar verificar texto provisional.
- **Privacidad:** informar de la captura y del envío de audio a proveedores; para el MVP, evitar conservar audio bruto por defecto.
- **Alcance:** decidir si la demo necesita audio en vivo o si puede empezar con una entrevista introducida como texto.
- **Tiempo y presupuesto:** quedan por confirmar la duración de la hackathon, los límites de API y las herramientas que ya conoce cada persona.

## Guion de demo sugerido

1. Crear una sesión indicando tema, participantes y contexto.
2. Iniciar una entrevista breve con dos o tres afirmaciones comprobables.
3. Mostrar la transcripción y la aparición progresiva de verificaciones.
4. Abrir una tarjeta para consultar su evidencia.
5. Finalizar y recorrer el resumen, incluyendo una afirmación sin evidencia suficiente si existe.

La propuesta central de Crosscheck es convertir una conversación en afirmaciones revisables con evidencia, durante y después de la entrevista.
