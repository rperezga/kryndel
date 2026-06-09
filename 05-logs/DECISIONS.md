# DECISIONS — Decisiones técnicas y de producto

> Registro de decisiones importantes tomadas durante el proyecto.
> Cada decisión incluye: contexto, opciones consideradas, decisión tomada y razón.
> Esto evita repetir debates en sesiones futuras.

---

## DEC-001 — Enfoque del simulador: harness local vs nodo completo

**Fecha:** 2026-06-06
**Contexto:** Para "simular" la ejecución de un Hook hay dos enfoques.
**Opciones:**
- A) Envolver un nodo rippled/Clio en local o testnet
- B) Harness local: cargar el .wasm en Node, implementar las host functions, usar estado en memoria

**Decisión:** B — Harness local.

**Razón:** Portable (no requiere nodo), instantáneo de iterar, y es el diferenciador real del producto: un sandbox de ejecución con buena DX. La fidelidad total a la VM de consenso es roadmap (Fase 2+), no M1.

**Límite declarado:** El simulador NO reimplementa el consenso ni todas las reglas de fees. Se documenta honestamente en el README.

---

## DEC-002 — Stack del proyecto

**Fecha:** 2026-06-06
**Decisión:**
- Lenguaje: TypeScript + Node ≥ 20
- Monorepo: pnpm workspaces
- WASM runtime: WebAssembly nativa de Node (sin dependencias externas en M1)
- XRPL parsing: xrpl.js + ripple-binary-codec
- CLI: commander + picocolors
- Tests: vitest
- Licencia: Apache-2.0

**Razón:** Stack mínimo de dependencias para M1. Apache-2.0 requerido por el grant.

---

## DEC-003 — Nombre del producto y paquetes

**Fecha:** 2026-06-06
**Contexto:** El proyecto tenía nombre provisional "Kryndel". El repo GitHub se llamará "kryndel".
**Decisión:**
- Nombre de producto: **Kryndel** (el simulador/visor)
- Nombre del repo/CLI: **kryndel**
- Paquetes npm: `@kryndel/core`, `@kryndel/cli`, `@kryndel/viewer`
- Comando CLI: `kryndel simulate`

---

## DEC-004 — Subconjunto de host functions para M1

**Fecha:** 2026-06-06
**Decisión:** Implementar solo las host functions que los hooks de ejemplo realmente llaman:
- `accept` / `rollback`
- `otxn_field` / `otxn_type` / `otxn_id`
- `hook_account` / `hook_param`
- `state` / `state_set`
- `trace` / `trace_num` / `trace_float`
- `util_keylet` / `util_sha512h` / `util_accid`
- `float_set` / `float_multiply` / `float_compare` / `float_sum` / `float_divide`
- `emit` / `etxn_reserve` / `etxn_fee_base`

**Funciones no implementadas:** devuelven código claro de "no soportado en MVP" (no crashean).

---

## DEC-005 — Patrón para detener la ejecución del hook

**Fecha:** 2026-06-06
**Contexto:** En WASM, `accept()` y `rollback()` terminan la ejecución del hook sin retornar al caller. En un harness JS, ¿cómo implementar esto?
**Decisión:** Lanzar una excepción JS específica (`HookResult extends Error`) desde la host function. `simulate()` la captura con try/catch y usa el resultado.
**Razón:** Es el patrón estándar para terminar WASM desde el host en JavaScript.

> **Nota (2026-06-07):** DEC-001 a DEC-005 pertenecen a la dirección VIEJA (simulador de Hooks). Se conservan
> como historial; el código asociado vive ahora en `packages/core/legacy/hooks-sim/`. El proyecto pivotó (ver DEC-006+).

---

## DEC-006 — Pivote: de simulador de WASM a observabilidad

**Fecha:** 2026-06-07
**Contexto:** Estudio profundo del ecosistema (jun 2026). El wedge "simular antes de desplegar" ya lo cubre
`ripple/craft` (incluye `wasm-host-simulator`, en Rust) ✅ verificado.
**Opciones:**
- A) Seguir construyendo el simulador de Hooks (competir con `craft`).
- B) Pivotar a observabilidad: indexar, decodificar, trazar y **alertar** sobre contratos desplegados.

**Decisión:** B — observabilidad y alertas.
**Razón:** Hueco real (los exploradores no decodifican contratos ni alertan), encaja 100% con stack JS/TS sin Rust,
y se demuestra valor HOY sobre el EVM sidechain (mainnet). `craft` se envuelve, no se reescribe.
**Implicaciones:** núcleo nuevo (watcher/decoder/indexer/subscriber/alerts); el simulador pasa a `legacy/`.

---

## DEC-007 — Superficies objetivo: EVM Sidechain (mainnet) + nativo (AlphaNet)

**Fecha:** 2026-06-07
**Decisión:** Cubrir dos superficies: **XRPL EVM Sidechain** (mainnet desde 30-jun-2025 ✅ verificado, DeFi real hoy)
y **contratos nativos WASM** (AlphaNet, XLS-0101) `[verificar fecha exacta de mainnet nativo y modelo de tx]`.
**Razón:** el EVM demuestra actividad on-chain ya; lo nativo deja a Kryndel listo para el mainnet nativo.

---

## DEC-008 — Stack: núcleo 100% TypeScript, sin Rust

**Fecha:** 2026-06-07
**Decisión:** Todo el núcleo en TS (xrpl.js + WS para nativo, `viem` para EVM, MongoDB, Next.js, Telegram).
La simulación opcional **envuelve `ripple/craft`**; no se reimplementa nada en Rust.
**Razón:** encaja con el perfil del dev (Node/TS/Next/Mongo/bots) y elimina el punto más pesado del plan viejo.

---

## DEC-009 — Encuadre del grant: habilitar DeFi/actividad on-chain

**Fecha:** 2026-06-07
**Decisión:** Posicionar Kryndel como **tooling que habilita DeFi/RWA/pagos** (no un caso de uso financiero en sí):
contratos observables y vigilables → despliegues más rápidos y seguros → más actividad on-chain.
**Razón:** alinea con la prioridad declarada del programa. URL de envío: `submit.xrplgrants.org/submit`.

---

<!-- TEMPLATE para nuevas decisiones:

## DEC-XXX — [título]

**Fecha:** YYYY-MM-DD
**Contexto:** 
**Opciones:**
- A) 
- B) 
**Decisión:** 
**Razón:** 
**Implicaciones:** 

-->
