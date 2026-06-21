/**
 * PhosphorPulseDemo — client component para demostrar PhosphorPulse
 * en la galería /_design (requiere interacción del usuario)
 */
'use client';

import * as React from 'react';
import { PhosphorPulse, Card, CardContent, Button, StatusChip } from '@/components/ds';

export function PhosphorPulseDemo() {
  const [active, setActive] = React.useState(false);
  const [eventCount, setEventCount] = React.useState(0);

  function simulateEvent() {
    setActive(true);
    setEventCount((n) => n + 1);
    // PhosphorPulse reset — el componente maneja su propio timeout
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <PhosphorPulse active={active}>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <StatusChip status={active ? 'ok' : 'neutral'} label="Transfer" />
              <span className="font-ds-mono text-ds-text-3 text-xs tabular-nums">
                #{eventCount.toString().padStart(6, '0')}
              </span>
            </div>
            <p className="font-ds-mono text-ds-text-2 text-xs truncate">
              from: 0x4ba8cfa93f78aDeb6bB9c0bF4e97B5e7a3C1d2E
            </p>
            <p className="font-ds-mono text-ds-text-2 text-xs truncate">
              value: 1,000,000.00 USDC
            </p>
          </CardContent>
        </Card>
      </PhosphorPulse>
      <Button
        variant="secondary"
        size="sm"
        onClick={simulateEvent}
        className="self-start"
      >
        Simular evento nuevo
      </Button>
    </div>
  );
}
