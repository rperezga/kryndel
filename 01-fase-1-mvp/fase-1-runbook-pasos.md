# FASE 1 — Runbook de ejecución
### Todos los pasos para dejar el MVP de "Kryndel" completado
Documento para **hacer y tachar**. No avances de etapa sin cumplir su compuerta.

> **Nota del estudio profundo:** el wedge cambió de "simulador local" (ya lo hace `ripple/craft`) a **observabilidad: indexar, decodificar, trazar y alertar** sobre contratos del XRPL — todo en JS/TS, sin Rust. La simulación, si se ofrece, envuelve a `craft`.

## Mapa de etapas
| Etapa | Qué se logra | Compuerta |
|---|---|---|
| 0 | Entorno listo | herramientas verificadas |
| 1 | Monorepo + repo público | CI en verde |
| 2 | Watcher nativo (AlphaNet) | detecta ContractCreate/ContractCall |
| 3 | Watcher EVM sidechain (mainnet) | detecta eventos de un contrato real |
| 4 | Decoder + indexer | llamadas/eventos decodificados en MongoDB |
| 5 | Recorder | primer trace.json |
| 6 | Suscripción + alertas | alerta real a Telegram |
| 7 | API + CLI | `npx kryndel trace/alert` funciona |
| 8 | Tests + CI | suite en verde |
| 9 | Explorador web | radiografía visual |
| 10 | Documentación OSS | README + licencia + posición honesta |
| 11 | Demo | clip ≤40 s |
| 12 | Release | `v0.1.0` |

---

## ETAPA 0 — Preparación del entorno
- [ ] Node ≥ 20 (`node -v`), pnpm (`npm i -g pnpm`), git configurado.
- [ ] Repo público en GitHub: `kryndel`.
- [ ] Acceso a un endpoint de **AlphaNet** (rippled/Clio) y al **RPC del XRPL EVM Sidechain** (mainnet).
- [ ] Bot de Telegram creado (token) para las alertas.

✅ *Compuerta:* herramientas verificadas y endpoints a mano.

## ETAPA 1 — Scaffolding del monorepo
- [ ] `pnpm init` + `pnpm-workspace.yaml` con `packages/core`, `packages/cli`, `packages/web`, `examples`.
- [ ] TypeScript, vitest, ESLint/Prettier, `LICENSE` (Apache-2.0), README inicial.
- [ ] CI en `.github/workflows/ci.yml` (`pnpm lint && pnpm test`).
- [ ] Primer commit + push (repo público).

✅ *Compuerta:* CI en verde.

## ETAPA 2 — Watcher de contratos nativos (AlphaNet)
- [ ] Conexión WebSocket a Clio/rippled de AlphaNet.
- [ ] Suscribirse al stream de transacciones y filtrar `ContractCreate` / `ContractCall`.
- [ ] Loguear las que aparezcan con su pseudo-cuenta y datos crudos.

✅ *Compuerta:* el watcher detecta y registra llamadas a contrato en AlphaNet.

## ETAPA 3 — Watcher del EVM Sidechain (mainnet)
- [ ] Conexión al RPC del XRPL EVM Sidechain con `viem`/`ethers`.
- [ ] Elegir un contrato DeFi real ya desplegado (p. ej. un money market del ecosistema) y escuchar sus `logs`/eventos.
- [ ] Registrar eventos entrantes.

✅ *Compuerta:* llegan eventos reales de un contrato vivo en mainnet (esto es tu prueba de "actividad on-chain hoy").

## ETAPA 4 — Decoder + indexer
- [ ] Decodificar llamadas/eventos nativos usando el **ABI on-chain**.
- [ ] Decodificar eventos EVM usando el **ABI estándar** del contrato.
- [ ] Persistir contratos, llamadas y eventos en MongoDB.

✅ *Compuerta:* en la base hay llamadas y eventos en forma legible, no cruda.

## ETAPA 5 — Recorder
- [ ] Armar el `trace.json` de una llamada: llamada decodificada → eventos emitidos → transacciones disparadas → cambios de estado.

✅ *Compuerta:* `kryndel trace <call>` devuelve un trace estructurado.

## ETAPA 6 — Suscripción + alertas
- [ ] Suscribirse a un evento concreto de un contrato.
- [ ] Despachar la notificación a Telegram cuando dispare.

✅ *Compuerta:* configuras una alerta y te llega a Telegram.

## ETAPA 7 — API + CLI
- [ ] API REST: contratos, llamadas, eventos.
- [ ] CLI: `watch`, `trace --json`, `alert`. Probar con `npx`.

✅ *Compuerta:* `npx kryndel trace ...` imprime el trace; `kryndel alert ...` registra una vigilancia.

## ETAPA 8 — Tests + CI
- [ ] Tests del decoder (cruda → legible) y un end-to-end por red (nativo y EVM).
- [ ] CI en verde.

✅ *Compuerta:* suite pasa local y en CI.

## ETAPA 9 — Explorador web (gancho visual)
- [ ] Next.js: vista de contrato (ABI legible), lista de llamadas, timeline de una llamada con eventos y tx emitidas, botón "vigilar → alerta".
- [ ] Estética de la landing (osciloscopio, verde/ámbar).

✅ *Compuerta:* abrir un contrato real muestra su radiografía de forma legible.

## ETAPA 10 — Documentación OSS
- [ ] README: pitch, quickstart, **posición vs `craft` y vs XRPScan/Bithomp**, límites honestos (AlphaNet vs mainnet), roadmap.
- [ ] CONTRIBUTING + licencia Apache-2.0.

✅ *Compuerta:* un dev externo entiende e instala Kryndel solo con el README.

## ETAPA 11 — Demo
- [ ] Clip ≤40 s: `kryndel trace` de un contrato real (EVM) → explorador con la radiografía → configurar alerta → llega a Telegram.

✅ *Compuerta:* clip grabado y en el README.

## ETAPA 12 — Release
- [ ] Etiquetar `v0.1.0`. (Opcional) publicar `@kryndel/core` y `@kryndel/cli`.
- [ ] Verificar checklist de salida (Etapa 11 del archivo de construcción).

✅ **FASE 1 COMPLETADA** → insumo listo para la Fase 2.

---

## Notas de disciplina
- **Sin Rust en el núcleo.** Todo es TS. La simulación, si acaso, envuelve a `craft`.
- **Lo nativo (AlphaNet) demuestra el futuro; el EVM sidechain (mainnet) demuestra actividad real hoy.** Usa ambos.
- **No construyas "otro explorador".** Tu diferencia es decodificar contratos + **alertas** + workflow de dev, no exploración genérica.
- **Fuera de alcance = issue.** No te desvíes.
