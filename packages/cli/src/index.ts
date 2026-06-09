#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';

const program = new Command();
program
  .name('kryndel')
  .description('Observability & alerts for XRPL contracts (EVM Sidechain + native)')
  .version('0.0.1');

// Helper — barra de estado de la conexión uniforme para ambas superficies.
function makeStatusLogger(surface: string) {
  return (s: string, d?: string) => {
    if (s === 'connecting') console.log(pc.dim(`… conectando a ${d}`));
    if (s === 'open')       console.log(pc.green(`✓ conectado al ${surface}`));
    if (s === 'subscribed') console.log(pc.green('✓ escuchando'), pc.dim('— Ctrl+C para salir'));
    if (s === 'close')      console.log(pc.yellow('… conexión cerrada, reintentando'));
    if (s === 'error')      console.log(pc.red(`✖ error: ${d ?? ''}`));
  };
}

program
  .command('watch')
  .argument('[contractAddress]', 'contrato a vigilar (opcional; sin address, escucha todos)')
  .option('--net <net>', 'evm | alphanet', 'evm')
  .option('--no-index', 'no indexar en MongoDB (solo imprimir actividad)')
  .description("Watch a contract's calls and events, decode them, and index to MongoDB")
  .action(async (address: string | undefined, opts: { net: string; index: boolean }) => {

    const mongoUri = process.env.MONGODB_URI;
    const useIndex = opts.index && !!mongoUri;

    if (opts.net === 'alphanet' || opts.net === 'native') {
      // ── Superficie nativa (AlphaNet) ──────────────────────────────────────
      const endpoint = process.env.ALPHANET_WS;
      if (!endpoint) {
        console.error(pc.red('✖ Falta ALPHANET_WS en .env — usa: ALPHANET_WS=wss://alphanet.nerdnest.xyz'));
        process.exit(1);
      }

      const { createNativeWatcher, createNativeDecoder, createMongoIndexer, createPipeline } = await import('@kryndel/core');
      console.log(pc.cyan(`watch ${address ?? '(todos)'} --net alphanet`), pc.dim('→'), endpoint);

      let seen = 0;
      let pipe: { stop(): Promise<void> } | undefined;

      if (useIndex && address) {
        const contractRef = { surface: 'native' as const, address };
        const decoder  = createNativeDecoder(contractRef);
        const indexer  = createMongoIndexer(mongoUri!);
        const p = await createPipeline({
          contract: contractRef,
          watch:    { endpoint, onStatus: makeStatusLogger('AlphaNet') },
          decoder, indexer,
          onActivity: (a, d) => {
            seen++;
            console.log(pc.green('●'), pc.bold(d.name), pc.dim('tx='), a.txHash ?? '—', pc.dim(JSON.stringify(d.args).slice(0, 80)));
          },
          onError: (e) => console.error(pc.red('pipeline error:'), e),
        });
        pipe = p;
        await p.start();
      } else {
        // Sin indexer — solo watcher.
        if (!useIndex) console.log(pc.dim('ℹ sin MONGODB_URI — modo solo-lectura (--no-index)'));
        const w = createNativeWatcher({ surface: 'native', endpoint, contract: address, onStatus: makeStatusLogger('AlphaNet') });
        pipe = w;
        await w.start((a) => {
          seen++;
          const label = a.kind === 'call' ? a.txType : (a.name ?? 'event');
          console.log(pc.green('●'), pc.bold(label), pc.dim('contract='), a.contract, pc.dim('tx='), a.txHash ?? '—');
        });
      }

      const hb = setInterval(() => console.log(pc.dim(`· vivo — ${seen} actividad(es)`)), 30_000);
      const shutdown = (): void => { clearInterval(hb); void pipe!.stop().finally(() => process.exit(0)); };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

    } else {
      // ── Superficie EVM (XRPL EVM Sidechain mainnet) ───────────────────────
      const endpoint = process.env.EVM_RPC_URL;
      if (!endpoint || endpoint.includes('<')) {
        console.error(pc.red('✖ Falta EVM_RPC_URL en .env'));
        console.error(pc.dim('  Añade: EVM_RPC_URL=https://rpc.xrplevm.org'));
        process.exit(1);
      }

      const { createEvmWatcher, createEvmDecoder, createMongoIndexer, createPipeline } = await import('@kryndel/core');
      // A2.9: leer contrato demo desde env; fallback al hardcoded.
      const demo = process.env.EVM_DEMO_CONTRACT ?? '0x7C21a90E3eCD3215d16c3BBe76a491f8f792d4Bf';
      const target = address ?? (useIndex ? demo : undefined);
      console.log(pc.cyan(`watch ${target ?? '(todos)'} --net evm`), pc.dim('→'), endpoint);
      if (!address && useIndex) console.log(pc.dim(`ℹ sin address — usando demo: ${demo}`));
      if (!address && !useIndex) console.log(pc.dim('ℹ sin address — escuchando TODOS los contratos (--no-index)'));

      let seen = 0;
      let pipe: { stop(): Promise<void> } | undefined;

      if (useIndex) {
        const contractRef = { surface: 'evm' as const, address: (address ?? demo) };
        const decoder  = createEvmDecoder(contractRef);
        const indexer  = createMongoIndexer(mongoUri!);
        const p = await createPipeline({
          contract: contractRef,
          watch:    { endpoint, onStatus: makeStatusLogger('XRPL EVM Sidechain') },
          decoder, indexer,
          onActivity: (a, d) => {
            seen++;
            if (d.name === 'Transfer') {
              const { from, to, value } = d.args as { from?: string; to?: string; value?: string };
              console.log(
                pc.green('●'), pc.bold('Transfer'),
                pc.dim('from='), String(from ?? '?').slice(0, 10) + '…',
                pc.dim('to='),   String(to   ?? '?').slice(0, 10) + '…',
                pc.dim('val='),  value ?? '?',
                pc.dim('tx='), a.txHash?.slice(0, 12) ?? '—',
              );
            } else {
              console.log(pc.green('●'), pc.bold(d.name), pc.dim(JSON.stringify(d.args).slice(0, 80)), pc.dim('tx='), a.txHash?.slice(0, 12) ?? '—');
            }
          },
          onError: (e) => console.error(pc.red('pipeline error:'), e),
        });
        pipe = p;
        await p.start();
      } else {
        if (!useIndex) console.log(pc.dim('ℹ sin MONGODB_URI — modo solo-lectura (--no-index)'));
        const w = createEvmWatcher({ surface: 'evm', endpoint, contract: target, onStatus: makeStatusLogger('XRPL EVM Sidechain') });
        pipe = w;
        await w.start((a) => {
          seen++;
          const label = a.kind === 'event' && a.name ? `event ${a.name.slice(0, 10)}…` : 'event';
          console.log(pc.green('●'), pc.bold(label), pc.dim('tx='), a.txHash ?? '—');
        });
      }

      const hb = setInterval(() => console.log(pc.dim(`· vivo — ${seen} evento(s) EVM`)), 30_000);
      const shutdown = (): void => { clearInterval(hb); void pipe!.stop().finally(() => process.exit(0)); };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    }
  });

program
  .command('trace')
  .argument('<txHash>', 'hash de la transacción EVM (0x…)')
  .option('--net <net>', 'evm | alphanet', 'evm')
  .option('--json', 'imprime el trace como JSON limpio (stdout)')
  .description('Decode one EVM transaction into a structured trace')
  .action(async (txHash: string, opts: { net: string; json?: boolean }) => {
    if (opts.net !== 'evm') {
      console.error(pc.yellow('ℹ trace nativo (AlphaNet) pendiente [verificar tipos de tx XLS-0101].'));
      process.exit(2);
    }

    const endpoint = process.env.EVM_RPC_URL;
    if (!endpoint || endpoint.includes('<')) {
      console.error(pc.red('✖ Falta EVM_RPC_URL en .env'));
      process.exit(1);
    }

    if (!opts.json) {
      console.log(pc.cyan(`trace ${txHash} --net evm`), pc.dim('→'), endpoint);
    }

    const { traceEvmTx } = await import('@kryndel/core');

    try {
      const trace = await traceEvmTx(txHash, { endpoint });

      if (opts.json) {
        // Salida limpia para redirigir: kryndel trace <hash> --json > trace.json
        console.log(JSON.stringify(trace, (_k, v) =>
          typeof v === 'bigint' ? v.toString() : v, 2));
        return;
      }

      // Salida legible para el terminal.
      console.log(pc.bold('\n── Trace ──────────────────────────────────────'));
      console.log(pc.dim('tx      '), txHash);
      console.log(pc.dim('contract'), trace.contract.address);
      console.log(pc.dim('call    '), pc.bold(trace.call?.name ?? '?'), JSON.stringify(trace.call?.args ?? {}).slice(0, 120));
      console.log(pc.bold('\n── Eventos ─────────────────────────────────────'));
      for (const ev of trace.events) {
        const icon = ev.kind === 'call' ? '→' : ev.kind === 'event' ? '◆' : '✓';
        console.log(pc.green(icon), pc.bold(ev.label), pc.dim(JSON.stringify(ev.data ?? {}).slice(0, 100)));
      }
      console.log(pc.bold('\n────────────────────────────────────────────────'));
      console.log(pc.dim(`completado en ${trace.durationMs} ms`));
    } catch (e) {
      console.error(pc.red('✖ trace falló:'), (e as Error)?.message ?? String(e));
      process.exit(1);
    }
  });

program
  .command('alert')
  .argument('<contractAddress>', 'address EVM del contrato a vigilar')
  .requiredOption('--event <name>', 'nombre del evento a escuchar (ej. Transfer)')
  .option('--to <channel>', 'telegram | discord | webhook', 'telegram')
  .option('--filter <json>', 'filtro de args JSON (ej. \'{"to":"0x123…"}\')', '{}')
  .description('Watch a contract event and dispatch an alert')
  .action(async (address: string, opts: { event: string; to: string; filter: string }) => {
    // Validar entorno.
    const evmRpc  = process.env.EVM_RPC_URL;
    const mongoUri = process.env.MONGODB_URI;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId   = process.env.TELEGRAM_CHAT_ID;

    if (!evmRpc || evmRpc.includes('<')) {
      console.error(pc.red('✖ Falta EVM_RPC_URL en .env'));
      process.exit(1);
    }
    if (!mongoUri) {
      console.error(pc.red('✖ Falta MONGODB_URI en .env'));
      process.exit(1);
    }
    if (opts.to === 'telegram' && (!botToken || !chatId)) {
      console.error(pc.red('✖ Faltan TELEGRAM_BOT_TOKEN y/o TELEGRAM_CHAT_ID en .env'));
      console.error(pc.dim('  Obtén el chat_id desde: https://api.telegram.org/bot<TOKEN>/getUpdates'));
      process.exit(1);
    }

    // A2.5: --filter con JSON inválido → error fatal (nunca fallback silencioso).
    let filter: Record<string, unknown> = {};
    if (opts.filter && opts.filter !== '{}') {
      try {
        filter = JSON.parse(opts.filter);
      } catch {
        console.error(pc.red(`✖ --filter JSON inválido: ${opts.filter}`));
        console.error(pc.dim('  Ejemplo: --filter \'{"to":"0x1234…"}\''));
        process.exit(1);
      }
    }

    const {
      createEvmDecoder, createMongoIndexer, createPipeline,
      createSubscriber, createDispatcher,
    } = await import('@kryndel/core');

    const contractRef = { surface: 'evm' as const, address };
    const decoder    = createEvmDecoder(contractRef);
    const indexer    = createMongoIndexer(mongoUri);
    const subscriber = createSubscriber();
    const dispatcher = createDispatcher(opts.to, botToken);

    // Registrar la regla.
    const rule = {
      id:       `alert-${Date.now()}`,
      contract: address,
      event:    opts.event,
      channel:  opts.to as 'telegram' | 'discord' | 'webhook',
      target:   opts.to === 'telegram' ? chatId! : '',
      filter:   Object.keys(filter).length ? filter : undefined,
    };
    await subscriber.subscribe(rule, (_event, r) => {
      console.log(pc.green('🔔'), pc.bold('alerta disparada'), pc.dim(`regla=${r.id}`));
    });

    console.log(pc.cyan(`alert ${address} --event ${opts.event} --to ${opts.to}`));
    console.log(pc.dim(`  filtro: ${JSON.stringify(filter)}`));
    console.log(pc.yellow('⚡ Escuchando — esperando el primer evento para disparar la alerta…'));

    const pipe = await createPipeline({
      contract: contractRef,
      watch: {
        endpoint: evmRpc,
        onStatus: makeStatusLogger('XRPL EVM Sidechain'),
      },
      decoder, indexer, subscriber, dispatcher,
      onActivity: (_a, d) => {
        if (d.name === opts.event) {
          console.log(pc.green('●'), pc.bold(d.name), pc.dim(JSON.stringify(d.args).slice(0, 100)));
        }
      },
      onError: (e) => console.error(pc.red('error:'), e),
    });

    await pipe.start();

    const shutdown = (): void => { void pipe.stop().finally(() => process.exit(0)); };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program
  .command('web')
  .description('Open the Next.js explorer (packages/web)')
  .action(() => {
    console.error(pc.yellow('TODO(Etapa 9): explorador Next.js en packages/web.'));
    process.exit(2);
  });

program.parse();
