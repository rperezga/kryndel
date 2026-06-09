# FASE 2 — Aplicación al grant
### "Kryndel" · borrador para los XRPL Grants (RippleX Ecosystem Programs)
**Insumo:** el repo `v0.1.0` y el clip de la Fase 1.

> **URL para aplicar:** https://submit.xrplgrants.org/submit (formulario unificado: un envío te considera para XRPL Grants —AI Fund, Brazil Fund, Korea & Japan Fund, Global Fund— y los programas de Aceleradora con DIFC/Tenity).
> **Contacto:** RippleXEcosystem@ripple.com · **Términos/elegibilidad:** https://xrplgrants.org/terms

> **Actualizado tras el estudio profundo.** Dos ajustes clave: (1) el encuadre se alinea con la prioridad declarada del programa —**DeFi, RWA y pagos que impulsen actividad on-chain**—; (2) el producto se posiciona como **observabilidad/alertas** (no simulador), porque `ripple/craft` ya cubre la simulación local.

---

## 1. Resumen ejecutivo
Kryndel es la capa de **observabilidad y alertas** para la lógica programable del XRP Ledger. Indexa, decodifica y traza los contratos —nativos (WASM) y del EVM sidechain— y permite **vigilar eventos en producción** con alertas. Reduce la fricción y el riesgo de construir y operar contratos, lo que **habilita y acelera DeFi, RWA y pagos on-chain** — exactamente la actividad que el programa busca. Es el "Etherscan + monitor" que el XRPL aún no tiene para su capa de contratos.

## 2. Alineación con la prioridad del programa (lo que ahora va al frente)
El programa financia sobre todo **casos de uso financieros que impulsan actividad on-chain (DeFi, RWA, pagos)**. Kryndel no es un caso de uso financiero en sí: es **el tooling que los habilita**. Un constructor de lending/pagos que puede *ver* y *vigilar* su contrato despliega antes, con menos miedo y menos fallos → más contratos en producción → más transacciones. Ese es el puente directo entre "developer tooling" y "actividad on-chain".

## 3. El problema (verificable)
- Contratos nativos del XRPL: en vivo en AlphaNet (7 nov 2025), con **ABIs on-chain** y **eventos** suscribibles; tooling de observabilidad casi inexistente.
- EVM sidechain: mainnet desde jun 2025 con DeFi real, pero la observabilidad/alertas específicas del ecosistema son débiles.
- Exploradores (XRPScan/Bithomp): no decodifican contratos ni alertan.

## 4. La solución y diferenciación
Explorar/decodificar · trazar · vigilar/alertar. Diferenciación:
- **vs `ripple/craft`:** craft = simulación local dev-time (Rust/terminal). Kryndel = observabilidad deploy-time + producción, visual, con alertas. Complementario (puede usar craft).
- **vs XRPScan/Bithomp:** exploradores de pagos/tokens; no contratos ni alertas.

## 5. Producto y traction
Repo `v0.1.0` open-source (Apache-2.0) con: indexer + decoder + explorador + 1 alerta funcionando sobre un contrato del **EVM sidechain (mainnet, actividad real)** y uno nativo (AlphaNet). Clip ≤40 s. CI en verde. *Esto es la prueba de código que el panel exige.*

## 6. Milestones y presupuesto (12 meses)

| # | Meses | Entregable | Aceptación | Tramo |
|---|---|---|---|---|
| M1 | 0–2 | Indexer + decoder + explorador + 1 alerta (Fase 1) | repo + demo sobre EVM mainnet y AlphaNet | $6.000 |
| M2 | 3–4 | API pública de datos de contratos | endpoint documentado | $10.000 |
| M3 | 5–7 | Dashboard de trazas/eventos | app web pública con datos reales | $14.000 |
| M4 | 8–9 | Motor de alertas/reglas en producción | alertas a Telegram/Discord/webhook | $10.000 |
| M5 | 10–12 | Cross-superficie + tier hospedado + docs | cobertura nativo+EVM + primeros usuarios | $14.000 |
| | | | **Total** | **$54.000** |

Composición por tramo: ~80% ingeniería, ~15% infra (nodos/indexación/hosting), ~5% herramientas. Rango del programa: $10k–$200k; $54k es modesto y bien justificado (versión ampliada disponible ~$84k si necesitas cubrir el año completo). **Se paga por hito, contra entrega** — ten colchón o usa XAO DAO al inicio.

## 7. Tres vías en paralelo
1. **XRPL Grants / Aceleradora** (formulario unificado, URL arriba). Individuos y equipos pre-incorporación aceptados para Grants; la Aceleradora reserva el venture posterior a entidades incorporadas.
2. **XAO DAO** microgrant "idea-in-testing" para un primer tramo rápido.
3. **XRPL Commons**: email a adoption@xrpl-commons.org (piden constructores de tooling/infra).

## 8. Equipo / por qué tú
Dev full-stack Node/TS/Next/Mongo/automation/APIs/bots — exactamente lo que Kryndel necesita. **Sin Rust en el núcleo**: la observabilidad es TS puro; la simulación (si se ofrece) envuelve a `craft`. Dedicación: 30–40 h/semana.

## 9. Sostenibilidad (open-core)
OSS (CLI/decoder/indexer/SDK) financiado por grant; negocio en la capa hospedada (monitoreo, alertas, API, equipo, institucional). Comprador con presupuesto: equipos que despliegan contratos e instituciones.

## 10. Riesgo (declararlo fortalece)
(a) Contratos nativos aún en AlphaNet → se demuestra valor en el EVM sidechain (mainnet) hoy. (b) Exploradores incumbentes podrían extenderse a contratos → diferenciación por **alertas + workflow de dev**. Mitigación general: cubrir ambas superficies; ser primero en la capa de contratos nativos.

## 11. Pitch deck (8–10 láminas)
Portada · Problema (las fechas verificables) · Solución (explorar/trazar/alertar) · Demo (la radiografía) · Por qué ahora · **Habilita DeFi/pagos → actividad on-chain** · Diferenciación (vs craft y exploradores) · Milestones · Modelo open-core · Equipo + ask.

## 12. Checklist previo al envío
- [ ] Repo público con `v0.1.0` y commits legibles.
- [ ] Clip enlazado.
- [ ] Narrativa con el ángulo "habilita DeFi/pagos → actividad on-chain" al frente.
- [ ] Milestones + presupuesto justificado.
- [ ] Pitch deck en PDF.
- [ ] Elegibilidad verificada (18+, no OFAC, no empleado de Ripple).
- [ ] Enviado en https://submit.xrplgrants.org/submit + XAO DAO + email a Commons.

## 13. El día después de enviar
Seguir construyendo el M2 y mostrarte en el XRP Ledger Developers Discord. Un repo que avanza es la mejor señal para el panel.
