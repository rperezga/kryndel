/**
 * cn() — merge de clases Tailwind con clsx + tailwind-merge.
 * Patrón shadcn/ui: elimina conflictos (e.g. bg-ds-green vs bg-ds-shell).
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
