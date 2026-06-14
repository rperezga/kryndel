/**
 * web.test.ts — A10: kryndel web port validation y shell:true fix.
 *
 * Bug A10: en Windows, spawn('pnpm', ...) sin shell:true lanza ENOENT porque pnpm
 * es un archivo .cmd, no un binario ELF. Fix aplicado: shell:true en cli/src/index.ts.
 *
 * Tests de la lógica de validación de puerto (pure, sin efectos secundarios).
 * Importamos desde utils.ts (no desde index.ts que ejecuta program.parse()).
 */

import { describe, it, expect } from 'vitest';
import { validatePort } from '../src/utils.js';

describe('[A10] validatePort — validación de puerto para kryndel web', () => {

  it('acepta puerto válido 3000', () => {
    expect(validatePort('3000')).toBe(3000);
  });

  it('acepta puerto mínimo 1', () => {
    expect(validatePort('1')).toBe(1);
  });

  it('acepta puerto máximo 65535', () => {
    expect(validatePort('65535')).toBe(65535);
  });

  it('rechaza 0 (fuera de rango)', () => {
    expect(() => validatePort('0')).toThrow(RangeError);
  });

  it('rechaza 65536 (fuera de rango)', () => {
    expect(() => validatePort('65536')).toThrow(RangeError);
  });

  it('rechaza string no numérico — previene args corruptos al spawn', () => {
    expect(() => validatePort('abc')).toThrow(RangeError);
  });

  it('rechaza número negativo', () => {
    expect(() => validatePort('-1')).toThrow(RangeError);
  });

  it('rechaza string vacío', () => {
    expect(() => validatePort('')).toThrow(RangeError);
  });

});
