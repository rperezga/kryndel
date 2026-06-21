'use client';

import * as React from 'react';
import { Drawer } from 'vaul';
import { cn } from './cn';
import { Button } from './Button';

export interface BottomFilterSheetProps {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  onApply?: () => void;
  onClear?: () => void;
}

export function BottomFilterSheet({
  trigger,
  title,
  description,
  children,
  onApply,
  onClear,
}: BottomFilterSheetProps) {
  const [open, setOpen] = React.useState(false);

  const handleApply = () => {
    if (onApply) onApply();
    setOpen(false);
  };

  const handleClear = () => {
    if (onClear) onClear();
    setOpen(false);
  };

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        {trigger}
      </Drawer.Trigger>
      <Drawer.Portal>
        {/* Overlay */}
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-xs" />
        
        {/* Content Container */}
        <Drawer.Content className="bg-ds-panel border-t border-0 border-solid border-ds-border flex flex-col rounded-t-[10px] h-[80dvh] fixed bottom-0 left-0 right-0 z-[101] outline-none font-ds-sans">
          
          {/* Header handle drag decoration */}
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-ds-border my-4" />

          {/* Heading info */}
          <div className="px-6 mb-4">
            <Drawer.Title className="text-base font-bold text-ds-text font-ds-sans">{title}</Drawer.Title>
            {description && (
              <Drawer.Description className="text-xs text-ds-text-3 font-ds-sans mt-0.5">
                {description}
              </Drawer.Description>
            )}
          </div>

          {/* Scrolling Child Contents */}
          <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar">
            {children}
          </div>

          {/* Footer Action buttons */}
          <div className="border-t border-solid border-ds-border p-6 flex gap-4 bg-ds-panel-2/30 select-none pb-safe">
            {onClear && (
              <Button
                variant="secondary"
                onClick={handleClear}
                className="flex-1 font-ds-mono text-xs uppercase"
              >
                Clear all
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleApply}
              className="flex-1 font-ds-mono text-xs uppercase"
            >
              Apply Filters
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
