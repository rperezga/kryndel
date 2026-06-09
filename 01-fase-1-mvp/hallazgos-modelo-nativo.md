# Hallazgos — Modelo de contratos nativos del XRPL (AlphaNet)

> Verificado 2026-06-07 vía la documentación oficial de AlphaNet (D. Angell, 7-nov-2025),
> `xls.xrpl.org` (XLS-0101) y `ripple/xrpl-wasm-std`. Resuelve varios `[verificar]` del proyecto.

## Conexión a AlphaNet
- **WSS:** `wss://alphanet.nerdnest.xyz` · **RPC:** `https://alphanet.rpc.nerdnest.xyz`
- Network ID: **21465** · Faucet: `https://alphanet.faucet.nerdnest.xyz/accounts`
- Explorer: `explorer.xrplf.org` · Web IDE: `https://ide.alphanet.nerdnest.xyz`
- SDK específico de AlphaNet: `@transia/xrpl` (usamos WS crudo + `subscribe`, agnóstico de SDK).

## Tipos de transacción (XLS-0101)
- Implementados: **`ContractCreate`**, **`ContractCall`**, **`ContractModify`**, **`ContractDelete`**.
- **NOT IMPLEMENTED** (existen en la spec, aún no en AlphaNet): `ContractUserDelete`, `ContractClawback`.
- Los contratos viven en una **pseudo-cuenta**; se disparan con `ContractCall`.

## Estado / datos
- Ledger entries nuevos: **`ContractSource`** (bytecode, deduplicado), **`Contract`** (instancia), **`ContractData`** (estado).
- Almacenamiento: get/set, estructuras anidadas, arrays; datos a nivel contrato y por-usuario.

## ABI on-chain  → Etapa 4 (decoder)
- Los contratos almacenan **ABIs legibles on-chain**. Parámetros tipados (tipos serializados del XRPL:
  STAmount, STAccount, STUInt32, …), máx. 4 por función, todos obligatorios. El decoder nativo lee de ahí.

## Emisión de transacciones
- Los contratos **emiten** Payment/TrustSet/OfferCreate/NFTokenMint/Escrow*/… desde su pseudo-cuenta.
- El fee de las emitidas va incluido en el fee del `ContractCall`.

## Eventos / alertas  → Etapas 5/6 (recorder, subscriber, alerts)
- Los contratos **emiten eventos** (nombre + payload, varios por llamada, indexados, en la historia del ledger).
- Suscripción **`eventEmitted`** (push, sin polling): filtrar por contrato / tipo de evento.  ⟵ mecanismo de alertas.
- RPC **`event_history`**: consultas históricas (filtro por contrato/tiempo/tipo, paginado).

## Implicación para Kryndel
- **Etapa 2 (watcher):** `subscribe streams:["transactions"]` + filtro por los 4 tipos de contrato (hecho).
- **Etapa 4 (decoder/indexer):** leer ABI on-chain; indexar `Contract`/`ContractData`.
- **Etapa 6 (subscriber/alerts):** usar `eventEmitted` (live) + `event_history` (backfill).  `[verificar]` forma exacta del mensaje.

## Recursos
- XLS-0101: https://xls.xrpl.org/xls/XLS-0101-smart-contracts.html
- WasmSTD (Rust): https://github.com/ripple/xrpl-wasm-std
- Contratos de ejemplo: https://github.com/Transia-RnD/craft-toolkit-ts/tree/main/contracts
