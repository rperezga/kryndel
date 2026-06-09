# KRYNDEL — Índice Maestro del Proyecto
> **Para Claude:** lee este archivo al inicio de cada sesión. Es el mapa de todo el proyecto.
> **Para Roger:** aquí está el estado actualizado, los próximos pasos y dónde vive cada documento.

---

## ¿Qué es este proyecto?

**Kryndel** es la capa de **observabilidad y alertas** para la lógica programable del XRP Ledger.
Indexa, decodifica, traza y **alerta** sobre contratos desplegados: **XRPL EVM Sidechain** (mainnet, DeFi real hoy)
y **contratos nativos WASM** (AlphaNet, XLS-0101) `[verificar fecha exacta de mainnet nativo]`.

Una frase: **"el Etherscan + monitor que el XRPL aún no tiene para su capa de contratos."**

> **Pivote (jun 2026):** el proyecto nació como *simulador local de WASM Hooks* (Etapas 0–7 construidas). Tras un
> estudio del ecosistema cambió a **observabilidad**, porque Ripple ya publica `ripple/craft` con un
> `wasm-host-simulator`. No reescribimos craft: lo envolvemos si se ofrece preview. Detalle en `DELTA.md` y `PLAN.md`.

---

## Estado actual del proyecto

| Fase | Estado | Descripción |
|---|---|---|
| Visión y plan | ✅ Reescrito al pivote | Observabilidad/alertas, EVM + AlphaNet, encuadre DeFi |
| Código base | ✅ Núcleo implementado | watcher+decoder+indexer+subscriber+alerts compilados y probados |
| Fase 1 — MVP | 🔄 En construcción (~60%) | Etapas 0–6 completas; faltan trace CLI, explorador web, tests, demo |
| Fase 2 — Grant | ⏳ Esperando M1 | Borrador reencuadrado (DeFi/actividad on-chain); requiere repo v0.1.0 |

### Etapas completadas (Fase 1)

| Etapa | Estado | Detalle |
|---|---|---|
| 0 — Entorno | ✅ | Node 26, pnpm, git, repo público, `.env` con secrets |
| 1 — Monorepo + CI | ✅ | core/cli/web scaffoldeados, lockfile con viem/mongodb/xrpl |
| 2 — Watcher nativo | ✅ | `createNativeWatcher()` — WS Node ≥ 22, reconexión, filtro XLS-0101 |
| 3 — Watcher EVM | ✅ **CONFIRMADO EN MAINNET** | `getLogs` polling cada 4s, filtro client-side; eventos en vivo capturados |
| 4 — Decoder + Indexer | ✅ | `createEvmDecoder()` vía viem, `createMongoIndexer()` — MongoDB Atlas conectado |
| 5 — Recorder / trace | ⏳ | `kryndel trace` stub; recorder legacy reutilizable |
| 6 — Subscriber + Alerts | ✅ | `createSubscriber()`, `matchesRule()`, `createTelegramDispatcher()` |
| 7 — Pipeline completo | ✅ | `createPipeline()` une todas las piezas; `kryndel alert` funcional |
| 8 — Tests | ⏳ | vitest configurado; tests unitarios pendientes |
| 9 — Explorador Next.js | ⏳ | stub `packages/web`; pendiente scaffold |
| 10 — OSS docs | ⏳ | CONTRIBUTING.md, LIMITATIONS.md pendientes |
| 11 — Demo clip | ⏳ | Requiere flujo end-to-end Telegram confirmado |
| 12 — v0.1.0 tag | ⏳ | Requiere CI verde + demo |

---

## Estructura de carpetas

```
KRYNDEL/
├── PROYECTO.md                      ← este archivo (leer primero)
├── DELTA.md                         ← reconciliación del pivote (hecho/obsoleto/nuevo)
├── PLAN.md                          ← plan accionable (fases, milestones, orden)
│
├── 00-vision/plan-kryndel-xrpl.md   ← plan maestro 12 meses (observabilidad)
├── 01-fase-1-mvp/
│   ├── fase-1-construccion-mvp.md   ← spec técnico del MVP (observabilidad)
│   ├── fase-1-runbook-pasos.md      ← runbook ejecutable, paso a paso
│   └── fase-1-tareas-detalladas.md  ← desglose granular marcable
├── 02-fase-2-grant/fase-2-aplicacion-grant.md   ← borrador para XRPL Grants
├── 03-ideas-alternativas/           ← exploración (referencia)
├── 04-assets/
│   ├── kryndel-pitch.html           ← landing/pitch (observabilidad)
│   └── fase1-dashboard.html         ← dashboard de progreso Fase 1
├── 05-logs/{DECISIONS,LOG}.md
└── packages/
    ├── core/  (watcher, decoder, indexer, recorder, subscriber, alerts)
    │   └── legacy/hooks-sim/   ← simulador de Hooks viejo (preservado)
    ├── cli/   (watch · trace · alert · web)
    └── web/   (explorador Next.js)
```

---

## Decisiones técnicas clave (para no repetir contexto)

- **Stack:** TypeScript + Node ≥ 20 + pnpm workspaces. **Núcleo 100% TS, SIN Rust.**
- **XRPL nativo:** `xrpl` (xrpl.js) + WS a `rippled`/Clio (AlphaNet).
- **EVM sidechain:** `viem` contra el RPC del sidechain (mainnet).
- **Datos:** MongoDB. **Web:** Next.js. **Alertas:** Telegram primero.
- **Simulación (opcional):** envuelve `ripple/craft`. NO se reimplementa.
- **CLI:** `commander` + `picocolors`. **Tests:** `vitest`. **Licencia:** Apache-2.0.

---

## Próximos pasos inmediatos (Fase 1)

Runbook completo en `01-fase-1-mvp/fase-1-runbook-pasos.md`. En resumen:

1. **Etapa 0:** entorno + endpoints (AlphaNet WS, RPC EVM, bot de Telegram).
2. **Etapa 1:** reorg del monorepo al pivote (core/cli/web) + CI en verde.
3. **Etapa 2:** watcher nativo (AlphaNet) detecta tx de contrato `[verificar tipos de tx]`.
4. **Etapa 3:** watcher EVM (mainnet) recibe eventos de un contrato real.
5. **Etapas 4–12:** decoder + indexer, recorder, alertas, API+CLI, tests, explorador, demo, `v0.1.0`.

**Compuerta de salida de Fase 1:**
- [ ] Repo público `kryndel` con `v0.1.0` etiquetada
- [ ] `kryndel trace` produce trace decodificado sobre ≥1 contrato nativo (AlphaNet) y ≥1 del EVM sidechain
- [ ] Explorador web dibuja la radiografía
- [ ] Una alerta real llega a Telegram
- [ ] Tests en verde, CI en verde; README con posición honesta y límites
- [ ] Clip de demo ≤40 s grabado y enlazado

---

## Presupuesto y financiación objetivo

| Vía | Monto | Plazo |
|---|---|---|
| XRPL Grants (principal) | $54.000 en milestones | 3–4 meses proceso · `submit.xrplgrants.org/submit` |
| XAO DAO (microgrant) | TBD | Rápido, baja fricción |
| XRPL Commons | Apoyo/incubadora | Email a adoption@xrpl-commons.org |

---

## Riesgo principal (sin maquillar)

(a) Los contratos nativos **aún no están en mainnet** → el valor inmediato depende del **EVM sidechain (mainnet)**.
(b) Exploradores incumbentes (XRPScan/Bithomp) podrían extenderse a contratos → foco defendible: **alertas + workflow de dev**, no exploración genérica. (c) `craft` ya simula → Kryndel no compite; lo envuelve.

---

## Notas de sesión

_Última actualización: 2026-06-08 (sesión 2)_
- **Etapas 4, 6, 7 completadas e integradas:**
  - Decoder EVM (`createEvmDecoder`) con ERC-20 ABI completo vía viem `decodeEventLog`/`decodeFunctionData`.
  - Indexer MongoDB (`createMongoIndexer`) con Atlas cloud, índices únicos, upsert idempotente.
  - Subscriber (`createSubscriber`, `matchesRule`) con filtro case-insensitive para addresses.
  - Dispatcher Telegram (`createTelegramDispatcher`) con `fetch` nativo Node ≥ 18.
  - Pipeline (`createPipeline`) conectando todas las piezas; watcher → decoder → indexer → alerts.
  - CLI `kryndel alert` completamente funcional con validación de entorno.
- **Watcher EVM confirmado end-to-end en mainnet:**
  - Descubrimiento: XRPL EVM Sidechain rechaza `eth_newFilter` y también `eth_getLogs` con `address` + block range simultáneos.
  - Solución implementada: polling con `getLogs` SIN address filter + filtrado client-side por contrato.
  - **Eventos capturados en vivo:** topic `0xb4c22d60…`, múltiples tx en tiempo real.
  - Contrato de referencia activo: `0x2585B2226939DB7cb543eE8b1187bD3212e8A84D` (staking/DeFi).
- **Infraestructura:**
  - MongoDB Atlas M0 configurado (`cluster0.cotfddz.mongodb.net`).
  - Telegram bot token + chat_id configurados en `.env`.
  - Ambos paquetes compilan sin errores TypeScript (`tsc` limpio).
- **Pendientes inmediatos:**
  - Confirmar alerta Telegram end-to-end (pipeline corriendo, esperando próximo evento del contrato).
  - Etapa 5: `kryndel trace` (integrar recorder con decoder+indexer).
  - Etapa 8: tests vitest (decoder, matchesRule, e2e con fixtures).
  - Etapa 9: Next.js explorer scaffold.

_Sesión anterior: 2026-06-08 (sesión 1)_
- **Etapas 0–2 confirmadas completas** (revisión de código):
  - Etapa 0: Node, pnpm, git, repo público. AlphaNet WS en `.env.example` (`wss://alphanet.nerdnest.xyz`).
  - Etapa 1: monorepo reorganizado, todos los scaffolds compilados, lockfile con viem/mongodb/xrpl/ws.
  - Etapa 2: `createNativeWatcher()` completamente implementado — WS global (Node ≥ 22), reconexión
    automática, filtrado por CONTRACT_TX_TYPES (6 tipos XLS-0101 verificados), `parseTransactionMessage()`
    testeable sin red. CLI `kryndel watch --net alphanet` funcional.
- **Etapa 3 completada (esta sesión):** `createEvmWatcher()` implementado con viem —
  `createPublicClient` + `watchEvent` con polling HTTP cada 4 s, fallback a `getLogs`, smoke-check
  del RPC al arrancar, soporte de filtro por address. CLI `kryndel watch --net evm` integrado.
- **Dashboard actualizado** (fase1-dashboard.html): refleja progreso real, pre-carga ítems confirmados.
- **Pendiente del owner para desbloquear Etapa 3 en producción:**
  - `EVM_RPC_URL` real en `.env` (confirmar RPC público del XRPL EVM Sidechain mainnet).
  - Elegir contrato DeFi a monitorear (buscar en https://explorer.xrplevm.org).
- **Próximo paso (Etapa 4):** decoder EVM (`decodeFunctionData`/`decodeEventLog` vía viem con ABI
  del contrato elegido) + indexer MongoDB (`createMongoIndexer`).

_Sesión anterior: 2026-06-07_
- Etapa 0 completada (Node 26, pnpm, git, repo público github.com/rperezga/kryndel).
- Etapa 1 (monorepo + CI) construida en la dirección vieja (simulador de Hooks, Etapas 0–7).
- **Pivote a observabilidad** tras estudio del ecosistema: docs reescritos in situ, `NEW/` migrado y eliminado,
  `DELTA.md` y `PLAN.md` creados, metadatos y README actualizados, código reorganizado (Hooks → `legacy/`,
  núcleo de observabilidad scaffoldeado). Pendiente del owner: modelo de tx nativo `[verificar]`, endpoints/secretos,
  `pnpm install` para refrescar el lockfile con `viem`/`mongodb`/`ws`.
