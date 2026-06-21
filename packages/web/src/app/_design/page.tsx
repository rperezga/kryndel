/**
 * /_design — Galería del sistema de diseño Kryndel v2
 *
 * Página INTERNA: no indexada, no linkeada públicamente.
 * URL: /design (Next.js ignora el prefijo _ en carpetas de rutas)
 *
 * Muestra: tokens de color, tipografía, spacing, y todos los
 * componentes DS de Etapa 0 (Button, Card, Badge, Pill, LiveIndicator).
 */
import type { Metadata } from 'next';
import {
  Button,
  Card,
  Panel,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  StatusChip,
  Pill,
  LiveDot,
  LivePill,
} from '@/components/ds';
import { PhosphorPulseDemo } from './PhosphorPulseDemo';

export const metadata: Metadata = {
  title: 'Design System · Kryndel',
  robots: { index: false, follow: false },
};

/* ── Sección helper ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <h2
        className="font-ds-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ds-text-3 mb-4 pb-2"
        style={{ borderBottom: '1px solid var(--ds-border)' }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ── Token swatch ── */
function Swatch({ name, value, textClass }: { name: string; value: string; textClass?: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[120px]">
      <div
        className="h-12 w-full rounded-xl border border-ds-border"
        style={{ background: value }}
      />
      <span className="font-ds-mono text-[0.68rem] text-ds-text-2">{name}</span>
      <span className={`font-ds-mono text-[0.6rem] ${textClass ?? 'text-ds-text-3'}`}>{value}</span>
    </div>
  );
}

export default function DesignPage() {
  return (
    <div
      style={{
        background: 'var(--ds-shell)',
        minHeight: '100dvh',
        color: 'var(--ds-text)',
        fontFamily: 'var(--font-inter, system-ui, sans-serif)',
      }}
    >
      {/* Header */}
      <header
        style={{ borderBottom: '1px solid var(--ds-border)', background: 'var(--ds-panel)' }}
        className="sticky top-0 z-20 px-8 py-4 flex items-center justify-between"
      >
        <div>
          <span
            className="font-ds-mono font-bold text-ds-green text-lg tracking-tight"
          >
            kryndel<span className="text-ds-text-3 font-normal">.dev</span>
          </span>
          <span className="ml-3 text-ds-text-3 text-sm">/ design system v2</span>
        </div>
        <div className="flex items-center gap-3">
          <LivePill />
          <Pill variant="mono">Etapa 0</Pill>
          <Pill variant="amber">Draft</Pill>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-12">

        {/* ── Tokens: Fondos ── */}
        <Section title="Tokens — Fondos">
          <div className="flex flex-wrap gap-4">
            <Swatch name="--ds-shell"   value="#050706" />
            <Swatch name="--ds-panel"   value="#090d0a" />
            <Swatch name="--ds-panel-2" value="#0d1410" />
          </div>
        </Section>

        {/* ── Tokens: Semáforo ── */}
        <Section title="Tokens — Semáforo operacional">
          <div className="flex flex-wrap gap-4">
            <Swatch name="--ds-green" value="#2bd96f" textClass="text-ds-green" />
            <Swatch name="--ds-amber" value="#ffb020" textClass="text-ds-amber" />
            <Swatch name="--ds-red"   value="#ff4d4f" textClass="text-ds-red" />
          </div>
          <p className="mt-4 font-ds-mono text-xs text-ds-text-3">
            Verde = live/ok/new · Ámbar = drift/lag/retries · Rojo = failed/revert/down
          </p>
        </Section>

        {/* ── Tokens: Texto ── */}
        <Section title="Tokens — Texto">
          <div className="flex flex-col gap-2">
            <span className="text-ds-text text-lg">--ds-text · #e8f5ec · Texto primario</span>
            <span className="text-ds-text-2 text-base">--ds-text-2 · #92a99a · Texto secundario</span>
            <span className="text-ds-text-3 text-sm">--ds-text-3 · #607467 · Texto muted</span>
          </div>
        </Section>

        {/* ── Tokens: Bordes ── */}
        <Section title="Tokens — Bordes">
          <div className="flex gap-6">
            <div
              className="h-16 w-32 rounded-xl"
              style={{ border: '1px solid var(--ds-border)' }}
            >
              <span className="font-ds-mono text-[0.6rem] text-ds-text-3 p-2 block">--ds-border</span>
            </div>
            <div
              className="h-16 w-32 rounded-xl"
              style={{ border: '1px solid var(--ds-border-on)' }}
            >
              <span className="font-ds-mono text-[0.6rem] text-ds-green p-2 block">--ds-border-on</span>
            </div>
          </div>
        </Section>

        {/* ── Tipografía ── */}
        <Section title="Tipografía — Inter (UI) + JetBrains Mono (datos)">
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-ds-mono text-[0.6rem] text-ds-text-3 mb-1">Inter · font-ds-sans</p>
              <p className="font-ds-sans text-4xl font-extrabold text-ds-text tracking-tight">Kryndel Observability</p>
              <p className="font-ds-sans text-xl font-semibold text-ds-text mt-1">Smart contract monitoring for XRPL</p>
              <p className="font-ds-sans text-base text-ds-text-2 mt-1">The observability and alerts layer for XRPL programmable logic. Real-time, on-chain.</p>
              <p className="font-ds-sans text-sm text-ds-text-3 mt-1">Caption · secondary text · status messages</p>
            </div>
            <div>
              <p className="font-ds-mono text-[0.6rem] text-ds-text-3 mb-1">JetBrains Mono · font-ds-mono · tabular-nums</p>
              <p className="font-ds-mono text-xl text-ds-text tabular-nums">0x4ba8cfa93f78aDeb6bB9c0bF4e97B5e7a3C1d2E</p>
              <p className="font-ds-mono text-base text-ds-green tabular-nums">+ Transfer(from=0x…, to=0x…, value=1,000,000.00)</p>
              <p className="font-ds-mono text-sm text-ds-amber tabular-nums">block #12,345,678 · lag 2.3s · gas 21,000</p>
              <p className="font-ds-mono text-xs text-ds-text-3 tabular-nums">0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48</p>
            </div>
          </div>
        </Section>

        {/* ── Button ── */}
        <Section title="Button — primary / secondary / ghost × sm / md / lg">
          <div className="flex flex-col gap-6">
            <div>
              <p className="font-ds-mono text-xs text-ds-text-3 mb-3">Primary</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="md">Monitor Contract</Button>
                <Button variant="primary" size="lg">Start Monitoring</Button>
                <Button variant="primary" size="md" disabled>Disabled</Button>
              </div>
            </div>
            <div>
              <p className="font-ds-mono text-xs text-ds-text-3 mb-3">Secondary</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="sm">View ABI</Button>
                <Button variant="secondary" size="md">Add Contract</Button>
                <Button variant="secondary" size="lg">Explore Events</Button>
              </div>
            </div>
            <div>
              <p className="font-ds-mono text-xs text-ds-text-3 mb-3">Ghost</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm">Cancel</Button>
                <Button variant="ghost" size="md">View raw</Button>
                <Button variant="ghost" size="lg">Back</Button>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Card / Panel ── */}
        <Section title="Card / Panel">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Contract Observer</CardTitle>
                <CardDescription>Monitoring 3 active contracts on EVM Sidechain</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-ds-text-2 text-sm">Last event: Transfer · 12s ago · block 12,345,678</p>
                <div className="mt-3 flex gap-2">
                  <StatusChip status="ok" label="LIVE" />
                  <Pill variant="mono">0x4ba8…deb6</Pill>
                </div>
              </CardContent>
            </Card>
            <Panel className="p-6">
              <p className="font-ds-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ds-text-3 mb-3">Panel (elevado)</p>
              <p className="text-ds-text-2 text-sm">Fondo --ds-panel-2 — para overlays, drawers, modals.</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="primary">Confirm</Button>
                <Button size="sm" variant="ghost">Cancel</Button>
              </div>
            </Panel>
          </div>
        </Section>

        {/* ── Badge / StatusChip ── */}
        <Section title="Badge / StatusChip">
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-ds-mono text-xs text-ds-text-3 mb-2">Badge variantes</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">default</Badge>
                <Badge variant="green">green</Badge>
                <Badge variant="amber">amber</Badge>
                <Badge variant="red">red</Badge>
                <Badge variant="outline">outline</Badge>
              </div>
            </div>
            <div>
              <p className="font-ds-mono text-xs text-ds-text-3 mb-2">StatusChip semáforo</p>
              <div className="flex flex-wrap gap-2">
                <StatusChip status="ok" label="ACTIVE" />
                <StatusChip status="ok" label="SYNCED" />
                <StatusChip status="warn" label="LAG 2.3s" />
                <StatusChip status="warn" label="RETRYING" />
                <StatusChip status="fail" label="FAILED" />
                <StatusChip status="fail" label="TIMEOUT" />
                <StatusChip status="neutral" label="UNKNOWN" />
                <StatusChip status="neutral" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Pill ── */}
        <Section title="Pill">
          <div className="flex flex-wrap gap-2">
            <Pill>EVM Sidechain</Pill>
            <Pill variant="green">AlphaNet</Pill>
            <Pill variant="amber">Testnet</Pill>
            <Pill variant="red">Mainnet</Pill>
            <Pill variant="mono">XLS-0101</Pill>
            <Pill variant="mono">v0.3.0</Pill>
            <Pill variant="mono">block #12,345,678</Pill>
          </div>
        </Section>

        {/* ── LiveIndicator ── */}
        <Section title="LiveIndicator — LiveDot · LivePill · PhosphorPulse">
          <div className="flex flex-col gap-6">
            <div>
              <p className="font-ds-mono text-xs text-ds-text-3 mb-3">LiveDot + LivePill</p>
              <div className="flex flex-wrap items-center gap-4">
                <LiveDot />
                <LivePill />
                <span className="flex items-center gap-2 text-ds-text-2 text-sm">
                  <LiveDot />
                  Streaming events from 0x4ba8…
                </span>
              </div>
            </div>
            <div>
              <p className="font-ds-mono text-xs text-ds-text-3 mb-3">PhosphorPulse — pulso fósforo en dato nuevo</p>
              <PhosphorPulseDemo />
            </div>
          </div>
        </Section>

        {/* ── Focus visible ── */}
        <Section title="Accesibilidad — :focus-visible + prefers-reduced-motion">
          <div className="flex flex-col gap-3">
            <p className="text-ds-text-2 text-sm">
              Navega con Tab para ver el ring de foco en todos los elementos interactivos.
              El anillo usa <code className="font-ds-mono text-ds-green text-xs">--ds-green</code> con{' '}
              <code className="font-ds-mono text-ds-green text-xs">ring-offset-ds-shell</code>.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Tab aquí →</Button>
              <Button variant="secondary">y aquí →</Button>
              <Button variant="ghost">y aquí</Button>
            </div>
            <p className="text-ds-text-3 text-xs font-ds-mono mt-2">
              prefers-reduced-motion: reduce → animate-none en LiveDot, PhosphorPulse, transiciones de hover.
            </p>
          </div>
        </Section>

        {/* ── Footer ── */}
        <footer className="mt-16 pt-6 border-t border-ds-border text-ds-text-3 font-ds-mono text-xs flex items-center justify-between">
          <span>Kryndel Design System v2 · Etapa 0 · {new Date().toISOString().split('T')[0]}</span>
          <span>NOINDEX · INTERNO</span>
        </footer>
      </main>
    </div>
  );
}
