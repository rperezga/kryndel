# DELTA — Reconciliación del pivote (simulador de Hooks → observabilidad)

> **Qué es esto.** Auditoría honesta del estado del repo el 2026-06-07, al reconciliar lo construido
> (simulador WASM de Hooks, Etapas 0–7) con el **enfoque corregido** tras el estudio profundo del
> ecosistema XRPL: **observabilidad y alertas** sobre contratos desplegados, todo TypeScript (sin Rust),
> sobre **XRPL EVM Sidechain (mainnet)** + **contratos nativos (AlphaNet)**, con encuadre **DeFi/actividad on-chain**.
>
> **Leyenda:** ✅ verificado · `[verificar]` dato técnico no confirmado (no afirmar como hecho) · ⚠️ contradicción.
>
> **Hechos verificados por web (2026-06-07):**
> - ✅ XRPL EVM Sidechain en **mainnet desde el 30-jun-2025** (Ripple/CoinDesk); ~1.400 contratos en la 1.ª semana.
> - ✅ `ripple/craft` existe e incluye `wasm-host-simulator` (Rust) para módulos WASM (XLS-100d / Smart Escrows).
> - ✅ Existe la spec **XLS-0101 (Smart Contracts)** y `ripple/xrpl-wasm-stdlib`; contratos nativos en **AlphaNet**.
> - `[verificar]` fechas exactas (nativo "7-nov-2025", Smart Escrows "Q1-2026") y los **tipos de transacción**
>   `ContractCreate`/`ContractCall` (el modelo nativo actual parece girar en torno a **Smart Escrows / XLS-100d**;
>   confirmar nombres reales de tx y del sistema de eventos antes de codificar el decoder).

---

## Tabla maestra

| Área | ✅ Ya hecho / decidido | ⚠️ Obsoleto o a cambiar por el pivote | 🆕 Nuevo a construir |
|---|---|---|---|
| **Wedge / narrativa** | Producto "Kryndel", marca, estética osciloscopio, licencia Apache-2.0, repo público | "Simulador local de WASM" como producto central (lo cubre `craft`) | Observabilidad: indexar · decodificar · trazar · **alertar**; encuadre "habilita DeFi/actividad on-chain" |
| **Stack** | TS + Node ≥20, pnpm monorepo, vitest, ESLint/Prettier, CI Actions | — (nunca hubo Rust; el núcleo ya era TS) ✅ | + `viem`/`ethers` (RPC EVM), `ws` (Clio/rippled), `mongodb`, Next.js (web), bot de Telegram |
| **Superficies** | — | "Hooks" como única superficie | **EVM Sidechain (mainnet, DeFi hoy)** + **contratos nativos (AlphaNet)** `[verificar]` modelo nativo |
| **`packages/core`** | Reutilizable: `recorder.ts`, `types.ts` (adaptar), `mem.ts`, `errors.ts` | Simulador de Hooks: `runtime.ts`, `guard.ts`, `simulate.ts`, `ledger.ts`, `fieldcodes.ts`, `abi/*` | `watcher.ts`, `decoder.ts`, `indexer.ts`, `subscriber.ts`, `alerts.ts`; `types.ts` re-tipado a contratos |
| **`packages/cli`** | Shell reutilizable (commander + picocolors, lectura JSON, pretty-print) | Comandos `simulate`/`view` (Hooks) | Comandos `watch` · `trace` · `alert` · `web` |
| **`packages/viewer`** | Paquete vacío (placeholder) | Nombre/idea "viewer" estático de traces de Hooks | `packages/web` (explorador **Next.js**) |
| **`examples/`** | — | `accept-all.wasm`, `firewall.wasm`, `firewall-seed.json`, `payment.json` (Hooks) | Contrato real del **EVM sidechain** + módulo de `ripple/craft` (nativo) |
| **Docs de planificación** | Estructura de carpetas, LOG/DECISIONS, dashboard interactivo (motor reutilizable) | Todo el contenido "Hooks simulator": plan, construcción, runbook, tareas, grant, PROYECTO, CLAUDE | Reescritos al pivote (ya migrados desde `NEW/`); DELTA.md + PLAN.md |
| **Grant (Fase 2)** | $54k en 5 milestones, 3 vías (Grants/XAO/Commons), Apache-2.0 | Milestones centrados en cobertura de ABI de Hooks | Milestones: indexer+decoder+alerta → API → dashboard → motor de alertas → cross-superficie; URL `submit.xrplgrants.org/submit` |
| **DoD Fase 1** | Repo `v0.1.0`, CI verde, clip ≤40 s, README honesto | "trace de ≥2 hooks reales + visor de la radiografía del hook" | `kryndel trace` sobre ≥1 contrato nativo (AlphaNet) + ≥1 EVM; explorador web; **1 alerta real a Telegram** |

---

## Detalle por área (específico y honesto)

### 1. Código construido (Etapas 0–7) vs pivote
El historial git muestra 12 commits que implementan **íntegramente el simulador de Hooks**: `runtime` (carga `.wasm`, namespace `env`, guard `_g`), `abi/{control,otxn,state,emit,float,hook,trace,util,stubs}`, `ledger`, `recorder`, `simulate`, más `mem/errors/fieldcodes/types`. Grep confirma **0 referencias** a EVM/Mongo/watcher/alert/sidechain en el código → es 100% la dirección vieja.

- **Reutilizable (decisión: reutilizar piezas):** `recorder.ts` (el patrón de "trace estructurado de eventos" se mantiene, ahora para *llamadas a contrato → eventos → tx emitidas → estado*), el **shell de la CLI** (commander, pretty-print), y `types.ts` (re-tipado). `mem.ts`/`errors.ts` se conservan sin daño aunque dejen de usarse.
- **A `legacy/hooks-sim/`:** `runtime/guard/simulate/ledger/fieldcodes/abi/*`. No se borran (preservan el trabajo y podrían alimentar la *preview opcional vía `craft`*), pero salen del núcleo activo.

### 2. ⚠️ Contradicción "Hooks" vs "contratos nativos"
La dirección vieja asume **XRPL Hooks** (enmienda Hooks, host functions, `SetHook`). El pivote habla de **contratos nativos WASM (XLS-0101 / Smart Escrows)** y **EVM sidechain**. Son features **distintas**. El decoder nuevo NO reutiliza el ABI de Hooks. `[verificar]` el modelo de transacciones/eventos nativo real (¿`ContractCreate`/`ContractCall` o `EscrowCreate`/`EscrowFinish` con WASM?) antes de implementar el watcher/decoder.

### 3. ⚠️ Docs duplicados (resuelto)
Existían dos juegos: raíz (Hooks) y `NEW/` (pivote). **Acción tomada:** se reescribieron in situ las ubicaciones canónicas con el contenido del pivote (`plan`, `construcción`, `runbook`, `grant`, `pitch`), y se **eliminará `NEW/`**. Pendientes de reconstrucción manual (sin contraparte en `NEW/`): `fase-1-tareas-detalladas.md` y `04-assets/fase1-dashboard.html` → se rehacen para las etapas de observabilidad.

### 4. Notas de riesgo (se conservan, no se maquillan)
- (a) Los contratos nativos **aún no están en mainnet** → el valor inmediato depende del **EVM sidechain (mainnet)**.
- (b) Exploradores incumbentes (**XRPScan/Bithomp**) podrían extenderse a contratos → foco defendible = **alertas + workflow de dev**, no exploración genérica.
- (c) `craft` ya cubre la simulación → Kryndel **no compite**; la envuelve si acaso.
- (d) `[verificar]` XLS-0101 aún en *amendment voting* / spec puede cambiar → decoder modular, seguir `ripple/xrpl-wasm-stdlib`.

### 5. Metadatos a corregir
`package.json` (raíz, cli, core) describen "XRPL Hooks simulation"; `keywords` incluye `hooks`. Se actualizan a observabilidad. `README.md` se reescribe con el posicionamiento vs `craft`/exploradores.

---

## Pendiente de tu confirmación
- `[verificar]` modelo de transacción/eventos de contratos **nativos** (afecta `watcher.ts` y `decoder.ts`).
- Endpoints concretos: WS de **AlphaNet** (Clio/rippled) y **RPC del EVM sidechain**; **token del bot de Telegram**; URI de **MongoDB**. Necesarios para que el watcher/alertas corran de verdad (van como variables de entorno, no en el repo).
- Contrato DeFi del EVM elegido para la demo (p. ej. un money market del ecosistema). `[verificar]` cuál.
