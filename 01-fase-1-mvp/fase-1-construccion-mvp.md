# FASE 1 — Construcción del MVP open-source (M1)
### "Kryndel" · el explorador, trazador y monitor de la lógica programable del XRP Ledger
**Duración objetivo:** 3–4 semanas · 30–40 h/semana · 1 desarrollador
**Resultado:** un repo open-source con una demo grabable que sirve de *traction* para la aplicación al grant (Fase 2).

> **CAMBIO IMPORTANTE respecto a la versión anterior (resultado del estudio profundo):**
> El plan original proponía construir un *simulador local de WASM*. Eso **ya existe oficialmente**: Ripple publica `ripple/craft`, que incluye un `wasm-host-simulator` para probar módulos WASM en local. No tiene sentido reconstruirlo. Por eso el wedge de Kryndel se mueve hacia donde **sí hay un hueco real y que además encaja 100% con tu stack (JS/TS, sin Rust)**: la **observabilidad** — indexar, decodificar, trazar y **alertar** sobre contratos desplegados, usando los ABIs on-chain y el sistema nativo de eventos. La simulación, si se ofrece, se hace **envolviendo `craft`**, no reescribiéndolo.

---

## 0. Por qué esta fase existe primero

El grant pide, idealmente, un MVP que capte demanda y **acceso al código**. No se aplica con una idea: se aplica con un repo que funciona. Esta fase produce eso en el alcance más pequeño que aún provoca el "oh" en una demo.

Regla de oro: **construir lo mínimo que demuestre el wedge de observabilidad, no la versión completa.**

---

## 1. Qué construye el MVP (el wedge corregido)

Un **indexer + decodificador + explorador visual mínimo + alerta** para la lógica del XRPL. En concreto, el MVP:

1. **Observa** transacciones de contrato: `ContractCreate` / `ContractCall` en la red de contratos nativos (AlphaNet) **y/o** contratos en el **XRPL EVM Sidechain** (que ya está en mainnet, donde hay actividad DeFi real hoy).
2. **Decodifica** esas llamadas usando los **ABIs on-chain** (los contratos nativos del XRPL almacenan su ABI en el ledger; los del EVM usan ABI estándar).
3. **Traza** el efecto de una llamada: eventos emitidos, transacciones que el contrato dispara contra las primitivas del XRPL, cambios de estado.
4. **Alerta**: un botón "vigilar este contrato/evento" → notificación a Telegram/Discord/webhook, **suscribiéndose a los eventos nativos** que emiten los contratos (push, sin polling constante).

**Lo que el MVP NO hace** (y por qué): no reimplementa un simulador (lo hace `craft`), no reimplementa un explorador genérico de XRPL (eso lo hacen XRPScan/Bithomp para pagos/tokens/NFT) — se enfoca **solo en la capa de contratos**, que los incumbentes aún no cubren.

---

## 2. Definición de "Hecho" (Definition of Done)

La Fase 1 está terminada cuando puedo, desde una terminal limpia:

1. Instalar la herramienta (`npx kryndel ...`).
2. Apuntar a un contrato desplegado (AlphaNet nativo y/o EVM sidechain) y obtener un **trace estructurado en JSON**: llamadas decodificadas, eventos emitidos, transacciones disparadas, cambios de estado.
3. Abrir un **explorador web** que renderiza ese trace de forma visual (la "radiografía").
4. Configurar **una alerta** sobre un evento de contrato y recibir la notificación en Telegram.
5. Tener el repo público con README, licencia Apache-2.0, tests y CI en verde.
6. Tener un **GIF/clip de ≤40 s** del flujo completo.

---

## 3. La decisión técnica clave (y su límite honesto)

- El núcleo es **JS/TS puro**: conectarse a `rippled`/Clio (JSON-RPC/WebSocket) y al RPC del EVM sidechain, indexar transacciones de contrato, decodificar con ABIs, almacenar en MongoDB, servir por API y pintar en Next.js. **No requiere Rust** — ese era el punto más pesado del plan viejo y desaparece.
- Para "previsualizar/simular" una llamada antes de enviarla, **se invoca `craft`** (de Ripple) y se parsea/visualiza su salida. Kryndel aporta la UI y la integración, no el motor.

> **Límite honesto (va también en el README):** los contratos nativos del XRPL están en **AlphaNet, todavía no en mainnet** (Smart Escrows apuntaba a Q1 2026). Por eso el MVP indexa AlphaNet para lo nativo y usa el **EVM sidechain (mainnet)** para demostrar valor sobre actividad real **hoy**. El monitoreo "en producción de contratos nativos en mainnet" se activa cuando la enmienda llegue a mainnet. Esto se declara abiertamente; no se vende humo.

---

## 4. Arquitectura (encaja con tu stack)

```
   rippled/Clio (AlphaNet)         XRPL EVM Sidechain (mainnet)
            │                                │
            ▼                                ▼
   ┌──────────────────────────────────────────────┐
   │                @kryndel/core                  │
   │  watcher  →  decoder (ABIs on-chain/std ABI)  │
   │     │              │                          │
   │     ▼              ▼                          │
   │  indexer (MongoDB)   trace recorder           │
   │     │              │                          │
   │     ▼              ▼                          │
   │  event subscriber  →  alert dispatcher        │
   └───────────────┬───────────────┬──────────────┘
                   │ API REST       │ alertas
                   ▼                ▼
   @kryndel/web (Next.js explorer)   Telegram/Discord/webhook
                   ▲
            (opcional) preview vía `ripple/craft`
```

**Stack concreto**
- **Lenguaje:** TypeScript en todo. Node ≥ 20.
- **XRPL:** `xrpl` (xrpl.js) + conexión WS a `rippled`/Clio. Para EVM: `viem`/`ethers` contra el RPC del sidechain.
- **Datos:** MongoDB (tu stack).
- **API:** REST/GraphQL.
- **Web:** Next.js (tu stack) para el explorador.
- **Alertas:** workers en cron + bots de Telegram/Discord (tu zona de automation).
- **Simulación (opcional):** envoltura de `ripple/craft`.
- **Tests:** vitest. **CI:** GitHub Actions. **Licencia:** Apache-2.0.

---

## 5. Estructura del repositorio

```
kryndel/
├─ README.md            # qué es, demo, límites honestos, posición vs craft/exploradores
├─ LICENSE              # Apache-2.0
├─ packages/
│  ├─ core/
│  │  ├─ src/
│  │  │  ├─ watcher.ts      # observa ContractCreate/ContractCall + eventos
│  │  │  ├─ decoder.ts      # decodifica con ABIs on-chain / ABI estándar EVM
│  │  │  ├─ indexer.ts      # persiste en MongoDB
│  │  │  ├─ recorder.ts     # arma el trace estructurado
│  │  │  ├─ subscriber.ts   # suscripción a eventos nativos
│  │  │  ├─ alerts.ts       # despacho a Telegram/Discord/webhook
│  │  │  └─ types.ts
│  │  └─ test/
│  ├─ cli/  └─ src/index.ts     # kryndel watch / trace / alert
│  └─ web/  (Next.js explorer)
└─ examples/   # contratos de ripple/craft + un contrato del EVM sidechain
```

---

## 6. El núcleo: lo que hay que implementar (todo TS, sin Rust)

| Pieza | Qué hace | Notas |
|---|---|---|
| **watcher** | escucha `ContractCreate`/`ContractCall` (nativo) y logs/eventos (EVM) | WS a Clio + RPC EVM |
| **decoder** | traduce datos crudos a llamadas/eventos legibles | usa ABI on-chain (nativo) y ABI estándar (EVM) |
| **indexer** | guarda contratos, llamadas y eventos | MongoDB |
| **recorder** | arma el `trace.json` (llamada → eventos → tx emitidas → estado) | el "producto" |
| **subscriber** | se suscribe a eventos de contrato | push, no polling |
| **alerts** | envía la notificación cuando dispara una regla | Telegram primero |

El `trace.json` es el corazón: la CLI lo imprime, el explorador lo pinta, la Fase 2 lo enseña.

---

## 7. CLI y explorador

```bash
kryndel watch <contractAddress> --net alphanet    # indexa un contrato
kryndel trace <txHashOrCall> --json > trace.json   # decodifica una llamada
kryndel alert <contractAddress> --event Transfer --to telegram
kryndel web                                        # abre el explorador
```

El explorador (Next.js) muestra: contrato + ABI legible, lista de llamadas decodificadas, timeline de una llamada con eventos y tx emitidas, y un botón "vigilar → alerta".

---

## 8. Plan día a día (3 semanas base)

**Semana 1 — observar y decodificar**
- D1: scaffolding del monorepo (pnpm, TS, vitest, CI), repo público, licencia.
- D2: watcher conectado a Clio (AlphaNet) escuchando ContractCreate/ContractCall.
- D3: watcher EVM sidechain (mainnet) escuchando eventos de un contrato real.
- D4: decoder con ABI on-chain (nativo) y ABI estándar (EVM).
- D5: indexer en MongoDB + recorder → primer `trace.json`.

**Semana 2 — alertar y exponer**
- D6: subscriber a eventos + alerts a Telegram.
- D7: API REST que sirve contratos/llamadas/eventos.
- D8: CLI pulida (`watch`, `trace`, `alert`).
- D9: tests (vitest) + CI en verde.
- D10: (opcional) envoltura mínima de `craft` para preview.

**Semana 3 — el gancho visual y el pulido**
- D11–12: explorador Next.js (contrato, llamadas, timeline, botón vigilar).
- D13: README serio (qué es, posición vs craft/XRPScan/Bithomp, límites honestos, roadmap).
- D14: grabar GIF/clip ≤40 s.
- D15: colchón, etiquetar `v0.1.0`.

---

## 9. Posición frente a lo que ya existe (clave, y honesta)

- **vs `ripple/craft` (wasm-host-simulator):** craft es **dev-time, local, terminal, Rust**. Kryndel es **deploy-time + producción**, visual, con alertas, y para quien NO escribió el contrato. Complementario: Kryndel puede *usar* craft para preview.
- **vs XRPScan / Bithomp / livenet.xrpl.org:** son exploradores maduros de pagos, tokens, NFT, AMM — **pero no decodifican contratos ni sus eventos** (los contratos nativos son nuevos/AlphaNet). Kryndel se enfoca solo en la capa de contratos y en **alertas** (que los exploradores no hacen). Riesgo real: estos incumbentes podrían extenderse a contratos cuando lleguen a mainnet — por eso el wedge defendible a largo plazo es **monitoreo/alertas + workflows de dev**, no "otro explorador".

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Contratos nativos aún en AlphaNet (sin actividad mainnet) | Demostrar valor con el **EVM sidechain (mainnet)**, que ya tiene DeFi real |
| `craft` cubre la simulación | No competir; envolverlo y enfocarse en observabilidad/alertas |
| XRPScan/Bithomp se extienden a contratos | Diferenciarse por **alertas + workflow de dev**, no por exploración pura |
| Spec XLS-0101 aún cambia (amendment voting) | Mantener el decoder modular; seguir el repo `ripple/xrpl-wasm-stdlib` |

---

## 11. Checklist de salida → Fase 2

- [ ] Repo público con `v0.1.0`.
- [ ] `kryndel trace` produce trace decodificado sobre ≥1 contrato nativo (AlphaNet) y ≥1 del EVM sidechain.
- [ ] Explorador web pinta la radiografía.
- [ ] Una alerta real llega a Telegram.
- [ ] Tests + CI en verde; README con posición honesta y límites.
- [ ] Clip ≤40 s grabado.
