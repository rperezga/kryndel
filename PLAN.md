# PLAN — Kryndel (enfoque corregido: observabilidad y alertas)

> **Norte.** Kryndel es la capa de **observabilidad y alertas** para la lógica programable del XRPL:
> indexa, decodifica, traza y **alerta** sobre contratos desplegados (EVM Sidechain en mainnet + nativos en AlphaNet).
> Núcleo **100% TypeScript, sin Rust**. La simulación, si se ofrece, **envuelve `ripple/craft`** (no se reescribe).
> Encuadre del grant: Kryndel **habilita DeFi/RWA/pagos** al hacer los contratos observables → más actividad on-chain.
>
> Documento vivo. Casa con `01-fase-1-mvp/fase-1-runbook-pasos.md` (etapas) y `DELTA.md` (qué se reusa/cambia).
> _Actualizado: 2026-06-07._

---

## 0. Principios de ejecución
1. **Construir lo mínimo que demuestre el wedge de observabilidad**, no la versión completa.
2. **Sin Rust en el núcleo.** Todo TS. Simulación = envoltura opcional de `craft`.
3. **EVM sidechain (mainnet) demuestra valor HOY**; nativo (AlphaNet) demuestra el futuro. Usar ambos.
4. **No construir "otro explorador".** Diferenciación = decodificar contratos + **alertas** + workflow de dev.
5. **Honestidad técnica.** Lo no confirmado va como `[verificar]`; las notas de riesgo se conservan.
6. **Fuera de alcance = issue de GitHub.** No desviarse.

---

## 1. Estado de partida (resumen; detalle en DELTA.md)
- Monorepo TS real con CI; Etapas 0–7 construidas pero de la **dirección vieja** (simulador de Hooks).
- **Se reutiliza:** `recorder.ts`, `types.ts` (adaptar), shell de CLI, `mem/errors`.
- **A `legacy/hooks-sim/`:** `runtime/guard/simulate/ledger/fieldcodes/abi/*`.
- **Nuevo a construir:** `watcher`, `decoder`, `indexer` (Mongo), `subscriber`, `alerts`, explorador **Next.js** (`packages/web`), CLI `watch/trace/alert/web`.

---

## 2. Fases y milestones (12 meses, alineados al grant)

| Hito | Meses | Entregable | Aceptación | Tramo |
|---|---|---|---|---|
| **M1 (Fase 1)** | 0–2 | Indexer + decoder + explorador mínimo + **1 alerta** (EVM mainnet + AlphaNet) | repo `v0.1.0` + demo ≤40 s; alerta real a Telegram | $6.000 |
| **M2** | 3–4 | API pública de datos de contratos + decodificación robusta | endpoint documentado | $10.000 |
| **M3** | 5–7 | Dashboard de trazas/eventos en producción | app web pública con datos reales | $14.000 |
| **M4** | 8–9 | Motor de alertas/reglas (Telegram/Discord/webhook) a escala | suscripción a eventos en producción | $10.000 |
| **M5** | 10–12 | Cross-superficie + tier hospedado + docs/adopción | cobertura nativo+EVM + primeros usuarios | $14.000 |

**Total objetivo:** $54.000 (rango del programa $10k–$200k). Pago por hito contra entrega → colchón o XAO DAO al inicio.

---

## 3. Fase 1 (M1) — orden de ejecución por etapas
Espejo del runbook (`01-fase-1-mvp/fase-1-runbook-pasos.md`). No avanzar de etapa sin su compuerta.

| Etapa | Qué se logra | Compuerta |
|---|---|---|
| 0 | Entorno + endpoints (AlphaNet WS, RPC EVM, bot Telegram) | herramientas y accesos a mano |
| 1 | Reorg del monorepo al pivote (core/cli/web/examples) + CI | CI en verde |
| 2 | **Watcher nativo** (AlphaNet): detecta tx de contrato | registra llamadas en AlphaNet `[verificar]` tipos de tx |
| 3 | **Watcher EVM** (mainnet): eventos de un contrato real | llegan eventos reales de mainnet |
| 4 | **Decoder + indexer** (ABIs → legible, MongoDB) | llamadas/eventos legibles en la base |
| 5 | **Recorder** | `kryndel trace <call>` → trace.json estructurado |
| 6 | **Subscriber + alerts** | una alerta real llega a Telegram |
| 7 | **API + CLI** (`watch`/`trace`/`alert`/`web`) | `npx kryndel trace …` imprime el trace |
| 8 | **Tests + CI** | suite en verde (decoder cruda→legible + e2e por red) |
| 9 | **Explorador web** (Next.js) | abrir un contrato real muestra su radiografía |
| 10 | **Docs OSS** | README con posición vs `craft`/exploradores + límites honestos |
| 11 | **Demo** | clip ≤40 s: trace → explorador → alerta a Telegram |
| 12 | **Release** | `v0.1.0` etiquetada; checklist de salida completo |

> Desglose granular marcable: `01-fase-1-mvp/fase-1-tareas-detalladas.md` y dashboard `04-assets/fase1-dashboard.html`.

---

## 4. Checklist de salida de Fase 1 → Fase 2
- [ ] Repo público con `v0.1.0`.
- [ ] `kryndel trace` produce trace decodificado sobre **≥1 contrato nativo (AlphaNet)** y **≥1 del EVM sidechain**.
- [ ] Explorador web pinta la radiografía (contrato → llamadas → eventos → tx emitidas).
- [ ] **Una alerta real llega a Telegram.**
- [ ] Tests + CI en verde; README con posición honesta y límites.
- [ ] Clip ≤40 s grabado y enlazado.

---

## 5. Arquitectura objetivo (toda TS)
```
 rippled/Clio (AlphaNet)        XRPL EVM Sidechain (mainnet)
        │ WS                            │ RPC (viem/ethers)
        ▼                               ▼
 ┌───────────────────────── @kryndel/core ─────────────────────────┐
 │ watcher → decoder (ABI on-chain / ABI estándar EVM) → indexer(Mongo)
 │                         → recorder (trace) → subscriber → alerts │
 └───────────────┬──────────────────────────────────┬──────────────┘
                 │ API REST                          │ alertas
                 ▼                                   ▼
        @kryndel/web (Next.js)            Telegram / Discord / webhook
                 ▲
        (opcional) preview vía ripple/craft
```

---

## 6. Riesgos y mitigaciones (se conservan; no maquillar)
| Riesgo | Mitigación |
|---|---|
| Contratos nativos aún en AlphaNet (sin actividad mainnet) | Demostrar valor con el **EVM sidechain (mainnet)**, DeFi real hoy |
| `craft` ya cubre la simulación | No competir; envolverlo y enfocarse en observabilidad/alertas |
| XRPScan/Bithomp se extienden a contratos | Diferenciarse por **alertas + workflow de dev**, no exploración pura |
| Spec XLS-0101 aún cambia (amendment voting) `[verificar]` | Decoder modular; seguir `ripple/xrpl-wasm-stdlib` |
| Modelo de tx/eventos nativo no confirmado `[verificar]` | Validar `ContractCreate/ContractCall` vs Smart Escrows antes de codificar el watcher/decoder |

---

## 7. Pendiente de confirmación del owner
- `[verificar]` modelo real de transacciones/eventos de contratos **nativos** (afecta `watcher`/`decoder`).
- Endpoints/secretos como variables de entorno: **AlphaNet WS**, **RPC EVM**, **MongoDB URI**, **Telegram bot token**.
- Contrato DeFi del EVM elegido para la demo. `[verificar]` cuál.

---

## 8. Próximo paso inmediato
Cerrar Etapa 0–1 del runbook con el código ya reorganizado (este cambio), luego Etapa 2 (watcher AlphaNet) y Etapa 3 (watcher EVM) en paralelo, que son la prueba de "actividad on-chain hoy".
