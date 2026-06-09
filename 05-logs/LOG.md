# LOG — Registro de sesiones de trabajo

> Añadir una entrada al inicio de cada sesión con lo que se hizo y el resultado.
> Formato: `## YYYY-MM-DD — [resumen breve]`

---

## 2026-06-07 — Pivote a observabilidad (reconciliación del repo)

**Sesión:** Reconciliar lo construido (simulador de Hooks, Etapas 0–7) con el enfoque corregido tras el estudio del ecosistema.

**Lo que se hizo:**
- Inspección del estado real: monorepo TS con código del simulador de Hooks y carpeta `NEW/` con docs del pivote.
- Verificación web: EVM sidechain en mainnet 30-jun-2025 ✅; `ripple/craft` + `wasm-host-simulator` ✅; XLS-0101 / AlphaNet ✅.
- Creados `DELTA.md` (hecho/obsoleto/nuevo) y `PLAN.md` (fases, milestones, orden).
- Docs reescritos in situ desde `NEW/` (plan, construcción, runbook, grant, pitch); `NEW/` eliminado.
- Actualizados `README.md`, `CLAUDE.md`, `PROYECTO.md`, `package.json` (raíz/core/cli) al pivote; DECISIONS DEC-006..009.
- Reconstruidos `fase-1-tareas-detalladas.md` y `fase1-dashboard.html` para las etapas de observabilidad.
- Código reorganizado: simulador de Hooks → `packages/core/legacy/hooks-sim/`; scaffolding del núcleo nuevo (watcher/decoder/indexer/subscriber/alerts); CLI → watch/trace/alert/web.

**Decisiones tomadas:** DEC-006 (pivote), DEC-007 (EVM+AlphaNet), DEC-008 (TS sin Rust), DEC-009 (encuadre DeFi).

**Pendiente de confirmación del owner:**
- `[verificar]` modelo real de tx/eventos de contratos nativos (afecta watcher/decoder).
- Endpoints/secretos (AlphaNet WS, RPC EVM, MongoDB URI, Telegram token) como variables de entorno.
- `pnpm install` para refrescar el lockfile con `viem`/`mongodb`/`ws` (si no, CI con --frozen-lockfile falla).

**Estado al cierre:** docs coherentes con el pivote; núcleo nuevo en scaffold (stubs con TODOs); código viejo preservado.

---

## 2026-06-06 — Planificación completa y estructura del proyecto

**Sesión:** Planificación inicial del proyecto Kryndel.

**Lo que se hizo:**
- Definido el producto: simulador y trazador de XRPL Hooks (Kryndel).
- Creado `plan-kryndel-xrpl.md` — plan maestro de 12 meses.
- Creado `fase-1-construccion-mvp.md` — spec técnico completo del MVP.
- Creado `fase-1-runbook-pasos.md` — runbook ejecutable con 13 etapas.
- Creado `fase-2-aplicacion-grant.md` — borrador completo para XRPL Grants.
- Creados `ideas-para-chatgpt.md` y `reporte-para-chatgpt.md` — exploración de alternativas.
- Organizada la estructura de carpetas del proyecto (00-vision → 06-logs).
- Creado `PROYECTO.md` como índice maestro.
- Creado `fase1-dashboard.html` — dashboard interactivo con 40 pasos y prompts.

**Estado al cierre:**
- Toda la planificación está completa.
- El código no existe todavía (04-codigo/ vacío).
- Próximo paso: Etapa 0 del runbook (entorno + repo GitHub).

**Archivos creados/modificados:**
- `PROYECTO.md`
- `00-vision/plan-kryndel-xrpl.md`
- `01-fase-1-mvp/fase-1-construccion-mvp.md`
- `01-fase-1-mvp/fase-1-runbook-pasos.md`
- `02-fase-2-grant/fase-2-aplicacion-grant.md`
- `03-ideas-alternativas/ideas-para-chatgpt.md`
- `03-ideas-alternativas/reporte-para-chatgpt.md`
- `05-assets/fase1-dashboard.html`
- `05-assets/kryndel-pitch.html`
- `06-logs/LOG.md` (este archivo)
- `06-logs/DECISIONS.md`

---

<!-- TEMPLATE para sesiones futuras:

## YYYY-MM-DD — [título]

**Sesión:** [contexto]

**Lo que se hizo:**
- 

**Problemas encontrados:**
- 

**Decisiones tomadas:**
- (ver también DECISIONS.md)

**Estado al cierre:**
- Etapa actual: X.Y
- Próximo paso: 

**Archivos creados/modificados:**
- 

-->
