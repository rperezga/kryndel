# FASE 1 — Lista detallada de tareas (desglose granular)
### Kryndel · observabilidad y alertas para contratos del XRPL · objetivo: repo público `v0.1.0`

> **Qué es.** Desglose granular y marcable de la Fase 1 del **pivote a observabilidad**
> (watcher → decoder → indexer → recorder → subscriber → alerts → explorer). Núcleo 100% TS, sin Rust.
> Espejo del runbook `fase-1-runbook-pasos.md`; ver también `DELTA.md` y `PLAN.md`.
>
> **Cómo usarlo.** En orden de etapa; no avances sin la compuerta ✅. Marca `[x]` al completar.
> `[verificar]` = dato técnico a confirmar antes de codificar (no asumir). _Reescrito: 2026-06-07._

---

## Leyenda
- 🟦 setup · 🟩 build · 🟨 test · 🟪 docs · 🟥 release
- ✅ **Aceptación** = compuerta del grupo · ⭐ = crítico · `[verificar]` = confirmar antes de asumir

---

## Transversal (módulos y secretos compartidos)
- [ ] ⭐ **Tipos** (`packages/core/src/types.ts`): `Surface`, `ContractRef`, `DecodedCall`, `ContractEvent`, `EmittedTx`, `StateChange`, `Trace`, `AlertRule`. Único punto de verdad. *(scaffold ya creado)*
- [ ] ⭐ **Recorder reutilizado** (`recorder.ts`): patrón del simulador viejo, ahora para *llamada → eventos → tx emitidas → estado*. *(scaffold creado)*
- [ ] ⭐ **Variables de entorno (secretos, NO en el repo):** `ALPHANET_WS`, `EVM_RPC_URL`, `MONGODB_URI`, `TELEGRAM_BOT_TOKEN`. Usar `.env` + `dotenv`; documentar en `.env.example`.
- [ ] ⭐ `[verificar]` **Modelo de tx/eventos nativos**: ¿`ContractCreate`/`ContractCall` o `EscrowCreate`/`EscrowFinish` con WASM (XLS-100d)? Confirmar contra `xls.xrpl.org` / `ripple/xrpl-wasm-stdlib` antes de codificar watcher/decoder nativos.
- [ ] **Simulación opcional**: si se ofrece preview, **envolver `ripple/craft`** (no reimplementar). El simulador viejo vive en `packages/core/legacy/hooks-sim/`.

---

## ETAPA 0 — Entorno + endpoints  🟦
- [ ] Node ≥ 20, pnpm, git configurados *(hecho)*
- [ ] Repo público `kryndel` *(hecho)*
- [ ] Endpoint de **AlphaNet** (rippled/Clio WS) a mano `[verificar]` disponibilidad pública
- [ ] **RPC del XRPL EVM Sidechain** (mainnet) a mano
- [ ] **Bot de Telegram** creado (token) para las alertas
- [ ] `.env.example` con las 4 variables (sin valores reales)

✅ **Aceptación:** herramientas verificadas y los 3 endpoints/secretos a mano.

## ETAPA 1 — Reorg del monorepo + CI  🟦
- [ ] Mover simulador de Hooks a `packages/core/legacy/hooks-sim/` *(hecho; pendiente `git mv` limpio en máquina del owner)*
- [ ] Núcleo nuevo en `packages/core/src/` (watcher, decoder, indexer, recorder, subscriber, alerts, types, index) *(scaffold creado)*
- [ ] `packages/web` (Next.js) creado *(placeholder creado)*
- [ ] CLI reescrita a `watch/trace/alert/web` *(scaffold creado)*
- [ ] ⭐ `pnpm install` para refrescar el lockfile con `viem`/`mongodb`/`ws`
- [ ] `pnpm lint && pnpm test` en verde (el smoke test del núcleo nuevo pasa)
- [ ] CI en verde (push y PR)

✅ **Aceptación:** monorepo reorganizado, deps instaladas, CI en verde.

## ETAPA 2 — Watcher de contratos nativos (AlphaNet)  🟩
- [ ] Conexión WebSocket a Clio/rippled de AlphaNet (`xrpl` / `ws`)
- [ ] Suscribirse al stream de transacciones y **filtrar tx de contrato** `[verificar]` tipos reales
- [ ] Loguear las detectadas con su pseudo-cuenta y datos crudos
- [ ] `createNativeWatcher()` implementado (sustituye el TODO del scaffold)

✅ **Aceptación:** el watcher detecta y registra llamadas a contrato en AlphaNet.

## ETAPA 3 — Watcher del EVM Sidechain (mainnet)  🟩
- [ ] Conexión al RPC del sidechain con `viem`
- [ ] Elegir un **contrato DeFi real** ya desplegado `[verificar]` cuál (p. ej. un money market del ecosistema)
- [ ] Escuchar sus `logs`/eventos (`getLogs`/`watchEvent`) y registrarlos
- [ ] `createEvmWatcher()` implementado

✅ **Aceptación:** llegan eventos reales de un contrato vivo en mainnet (prueba de "actividad on-chain hoy").

## ETAPA 4 — Decoder + indexer  🟩
- [ ] Decoder EVM con la **ABI estándar** del contrato (`decodeFunctionData`/`decodeEventLog`)
- [ ] Decoder nativo con el **ABI on-chain** `[verificar]` formato/disponibilidad
- [ ] Indexer en **MongoDB**: colecciones `contracts`, `calls`, `events`
- [ ] `createMongoIndexer()` y `createEvmDecoder()`/`createNativeDecoder()` implementados

✅ **Aceptación:** en la base hay llamadas y eventos en forma **legible**, no cruda.

## ETAPA 5 — Recorder  🟩
- [ ] Armar `trace.json` de una llamada: llamada decodificada → eventos → tx emitidas → cambios de estado
- [ ] Integrar `Recorder` con decoder + indexer
- [ ] `kryndel trace <call>` devuelve el trace estructurado

✅ **Aceptación:** `kryndel trace` produce un trace estructurado y correcto.

## ETAPA 6 — Suscripción + alertas  🟩
- [ ] `subscriber`: suscribirse a un evento concreto (push, no polling)
- [ ] `matchesRule()` con filtros por args *(predicado ya scaffoldeado y testeado)*
- [ ] `alerts`: despachar a **Telegram** (`createTelegramDispatcher`) usando `TELEGRAM_BOT_TOKEN`
- [ ] Flujo extremo a extremo: regla → evento dispara → mensaje en Telegram

✅ **Aceptación:** configuras una alerta y **te llega a Telegram**.

## ETAPA 7 — API + CLI  🟩
- [ ] API REST: `GET /contracts`, `/contracts/:id/calls`, `/calls/:id/events`
- [ ] CLI funcional: `watch`, `trace --json`, `alert` (sustituir los TODO del scaffold)
- [ ] Probar con `npx kryndel trace ...`

✅ **Aceptación:** `npx kryndel trace …` imprime el trace; `kryndel alert …` registra una vigilancia.

## ETAPA 8 — Tests + CI  🟨
- [ ] Tests del **decoder** (crudo → legible) por superficie
- [ ] Test del `subscriber` (`matchesRule`) y del `recorder` *(smoke ya existe)*
- [ ] Un **e2e por red** (nativo y EVM) con datos de ejemplo/fixtures
- [ ] CI en verde (con secretos mockeados; no endpoints reales en CI)

✅ **Aceptación:** suite pasa local y en CI.

## ETAPA 9 — Explorador web (Next.js)  🟩
- [ ] Scaffold Next.js en `packages/web`
- [ ] Vista de contrato (ABI legible) + lista de llamadas decodificadas
- [ ] Timeline de una llamada (eventos + tx emitidas) con la estética del pitch (osciloscopio, verde/ámbar)
- [ ] Botón **"vigilar → alerta"**

✅ **Aceptación:** abrir un contrato real muestra su radiografía de forma legible.

## ETAPA 10 — Documentación OSS  🟪
- [ ] README con **posición vs `craft` y vs XRPScan/Bithomp** *(hecho)*, quickstart, límites honestos (AlphaNet vs mainnet), roadmap
- [ ] `CONTRIBUTING.md` + `LIMITATIONS.md` (lo que NO hace; `[verificar]` pendientes)
- [ ] `.env.example` documentado

✅ **Aceptación:** un dev externo entiende e instala Kryndel solo con el README.

## ETAPA 11 — Demo  🟥
- [ ] Clip ≤40 s: `kryndel trace` de un contrato EVM real → explorador con la radiografía → configurar alerta → llega a Telegram
- [ ] GIF enlazado en el README

✅ **Aceptación:** clip ≤40 s grabado y en el README.

## ETAPA 12 — Release  🟥
- [ ] Etiquetar `v0.1.0`; (opcional) publicar `@kryndel/core` y `@kryndel/cli`
- [ ] Verificar checklist de salida (construcción §11)

✅ **FASE 1 COMPLETA** → insumo para la Fase 2 (grant).

---

## Checklist de salida → Fase 2
- [ ] Repo público con `v0.1.0`
- [ ] `kryndel trace` decodifica ≥1 contrato nativo (AlphaNet) + ≥1 del EVM sidechain
- [ ] Explorador web pinta la radiografía
- [ ] **Una alerta real llega a Telegram**
- [ ] Tests + CI en verde; README con posición honesta y límites
- [ ] Clip ≤40 s grabado

## Riesgos (se conservan, sin maquillar)
- Contratos nativos aún en AlphaNet → demostrar valor con el **EVM sidechain (mainnet)** hoy.
- `craft` ya simula → envolver, no competir.
- XRPScan/Bithomp podrían extenderse a contratos → diferenciarse por **alertas + workflow de dev**.
- `[verificar]` XLS-0101 puede cambiar (amendment voting) → decoder modular.
