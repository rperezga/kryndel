/**
 * watch-seed.mjs — Puebla el explorer con DATOS REALES corriendo el pipeline
 * real de Kryndel contra varios contratos activos del EVM Sidechain mainnet
 * durante un tiempo fijo, y luego sale. Nada fabricado: todo lo indexado es
 * actividad on-chain real (coherente con la postura de honestidad del proyecto).
 *
 * Uso (raíz del repo, tras `pnpm build`, con .env = MONGODB_URI + EVM_RPC_URL):
 *   node --env-file=.env scripts/watch-seed.mjs
 *   DURATION_MIN=60 node --env-file=.env scripts/watch-seed.mjs
 *   CONTRACTS=0xabc...,0xdef... node --env-file=.env scripts/watch-seed.mjs
 *
 * Encuentra más contratos activos en https://explorer.xrplevm.org (pestaña
 * "Contracts"/"Tokens"): copia direcciones con actividad reciente y pásalas en
 * CONTRACTS. Cuanto más tiempo corra, más eventos reales indexa.
 */
// Import directo al build del core (evita depender del linkeo workspace desde la raíz).
// Requiere `pnpm build` antes (genera packages/core/dist/).
import { createEvmDecoder, createMongoIndexer, createPipeline } from '../packages/core/dist/index.js';

const uri = process.env.MONGODB_URI;
const endpoint = process.env.EVM_RPC_URL;
if (!uri || !endpoint || endpoint.includes('<')) {
  console.error('❌  Falta MONGODB_URI o EVM_RPC_URL en .env');
  process.exit(1);
}

// Contratos verificados activos (06-14). Sustituye/añade con CONTRACTS=...
const DEFAULT_CONTRACTS = [
  '0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67', // activo, eventos ~cada 10 min
  '0x4ba8028bc62a1cecf98e2ba5da19c6a025485392', // LOOSH ERC-20
];

const requested = (process.env.CONTRACTS?.split(',').map((s) => s.trim()).filter(Boolean)) ?? DEFAULT_CONTRACTS;
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a);
const contracts = requested.filter((a) => {
  if (isAddr(a)) return true;
  console.warn(`  ⚠  dirección inválida, omitida: "${a}" (¿usaste el placeholder 0xTU_NUEVO?)`);
  return false;
});
if (contracts.length === 0) {
  console.error('❌  No hay direcciones válidas. Pasa contratos reales en CONTRACTS=0x…,0x…');
  process.exit(1);
}
const minutes = Number(process.env.DURATION_MIN ?? 45);

console.log(`▶  watch-seed: ${contracts.length} contrato(s) · ${minutes} min · ${endpoint}`);

const indexer = createMongoIndexer(uri);
const pipes = [];
let total = 0;

for (const address of contracts) {
  const contract = { surface: 'evm', address };
  const decoder = createEvmDecoder(contract);
  const p = await createPipeline({
    contract,
    watch: { endpoint, onStatus: () => {} },
    decoder,
    indexer,
    onActivity: (a, d) => {
      total++;
      console.log('  ●', d.name, 'tx=', (a.txHash?.slice(0, 12) ?? '—'), '@', address.slice(0, 10) + '…');
    },
    onError: (e) => console.error('  pipeline error:', e?.message ?? e),
  });
  await p.start();
  pipes.push(p);
  console.log(`  ✓ vigilando ${address}`);
}

const stopAll = async () => {
  for (const p of pipes) { try { await p.stop(); } catch { /* noop */ } }
  console.log(`\n✅  watch-seed terminado · ${total} eventos reales indexados en Atlas.`);
  console.log('   Abre tu URL de Vercel y busca cualquiera de los contratos vigilados.');
  process.exit(0);
};

setTimeout(stopAll, minutes * 60 * 1000);
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
