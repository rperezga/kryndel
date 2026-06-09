# PLAN DE PROYECTO — "Kryndel"
## La capa de observabilidad y alertas para la lógica programable del XRP Ledger

> *Actualizado tras un estudio profundo del ecosistema (junio 2026).* El plan original se apoyaba en "simular antes de desplegar". Resultó que Ripple ya publica `craft` con un `wasm-host-simulator`, así que ese ya no es el wedge. El wedge corregido —más defendible y mejor encajado con tu stack JS/TS— es la **observabilidad**: indexar, decodificar, trazar y **alertar** sobre contratos desplegados.

---

## 1. La idea en una frase
**El explorador y monitor de la lógica on-ledger del XRPL:** observa, decodifica y traza los contratos (nativos WASM + EVM sidechain), y te **avisa** cuando algo pasa o se rompe.

## 2. El gancho
Apuntas a un contrato → ves sus llamadas decodificadas, los eventos que emite y las transacciones que dispara contra las primitivas del XRPL, en una **radiografía visual**. Un botón: "vigilar este evento" → alerta a Telegram/Discord. Lo que Etherscan + un monitor hacen en Ethereum, y que el XRPL aún no tiene para su capa de contratos.

## 3. Por qué es defendible (con evidencia verificable)
- **Contratos nativos del XRPL**: en vivo en AlphaNet desde el 7 nov 2025; Smart Escrows apuntaban a Q1 2026. Almacenan su **ABI on-chain** y **emiten eventos** suscribibles (XLS-0101). Tooling de observabilidad: prácticamente inexistente.
- **XRPL EVM Sidechain**: en mainnet desde el 30 jun 2025, con DeFi real (money markets, lending, derivados, bridges). Actividad on-chain **hoy**.
- **Exploradores actuales (XRPScan, Bithomp, livenet.xrpl.org)**: maduros para pagos/tokens/NFT/AMM, pero **no decodifican contratos ni sus eventos**, y no hacen alertas.

## 4. Qué hace
1. **Explorar/decodificar** contratos (ABI on-chain nativo + ABI estándar EVM).
2. **Trazar** una llamada: eventos, tx emitidas, cambios de estado.
3. **Vigilar/Alertar** vía suscripción a eventos nativos (push, no polling).
*(Simulación previa opcional, envolviendo `ripple/craft` — no se reescribe.)*

## 5. Por qué al ecosistema le conviene (ángulo grant)
El programa prioriza **DeFi, RWA y pagos** porque buscan **actividad on-chain**. Kryndel reduce la fricción y el riesgo de operar con contratos (los desarrolladores ven y vigilan lo que pasa), lo que **habilita y acelera** justo esos casos de uso. Es infraestructura que se traduce en más actividad.

## 6. Arquitectura (tu stack)
Watcher (Clio/rippled WS + RPC EVM) → decoder (ABIs) → indexer (MongoDB) → recorder (trace) → subscriber → alert dispatcher; API REST + explorador Next.js. **Todo TS, sin Rust.** Simulación opcional vía `craft`.

## 7. Monetización (open-core)
- **Gratis/OSS:** CLI, decoder, indexer self-host, SDK TS.
- **Hospedado:** explorador persistente, monitoreo y alertas en producción, API de datos, asientos de equipo, plan institucional. Comprador: equipos/proyectos que despliegan contratos e instituciones.

## 8. Pre-respuesta a objeciones
- **"`craft` ya simula."** Sí — y por eso Kryndel **no es un simulador**. craft es dev-time/local/terminal/Rust; Kryndel es deploy-time + producción, visual, con alertas, y puede *usar* craft.
- **"XRPScan/Bithomp ya exploran el XRPL."** No decodifican contratos ni sus eventos, ni alertan. Kryndel se enfoca solo en la capa de contratos + alertas.
- **"Esos exploradores se extenderán a contratos."** Posible cuando lleguen a mainnet — por eso el foco defendible es **alertas + workflow de dev**, no exploración pura.
- **"Los contratos nativos no están en mainnet."** Cierto; por eso se demuestra valor sobre el **EVM sidechain (mainnet)** ya, y se queda listo para mainnet nativo.

## 9. Plan de 12 meses (milestones de grant)
- **M1 (0–2):** indexer + decoder + explorador mínimo + 1 alerta (nativo AlphaNet + EVM mainnet). *MVP de la Fase 1.*
- **M2 (3–4):** API pública de datos de contratos + decodificación robusta.
- **M3 (5–7):** dashboard de trazas/eventos en producción.
- **M4 (8–9):** motor de alertas y reglas (Telegram/Discord/webhook), suscripción a eventos a escala.
- **M5 (10–12):** cobertura cross-superficie + tier hospedado + docs y adopción.

## 10. El riesgo real (sin maquillar)
Doble: (a) los contratos nativos aún no están en mainnet, así que el valor inmediato depende del EVM sidechain; (b) los exploradores incumbentes podrían extenderse a contratos. Mitigación: liderar con **alertas + workflow de dev** (no exploración pura), cubrir ambas superficies, y ser primero en la capa de contratos nativos.

## 11. Próximo paso
Construir el M1 (Fase 1) en 3–4 semanas → aplicar a XRPL Grants con el repo → en paralelo XAO DAO + email a XRPL Commons.
