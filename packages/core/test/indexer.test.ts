import { describe, it, expect } from 'vitest';
import { sanitizeKeys } from '../src/indexer.js';

// ── sanitizeKeys ──────────────────────────────────────────────────────────────
describe('sanitizeKeys — A2.3 MongoDB injection prevention', () => {
  // A2.3 CA: args con $set y a.b no producen operadores MongoDB
  it('reemplaza $ por ＄ en claves de primer nivel', () => {
    const result = sanitizeKeys({ '$set': 1, '$where': 'evil' }) as Record<string, unknown>;
    expect(result['＄set']).toBe(1);
    expect(result['＄where']).toBe('evil');
    expect(result['$set']).toBeUndefined();
  });

  it('reemplaza . por _ en claves anidadas', () => {
    const result = sanitizeKeys({ 'a.b': 2, 'x.y.z': 3 }) as Record<string, unknown>;
    expect(result['a_b']).toBe(2);
    expect(result['x_y_z']).toBe(3);
  });

  it('sanitiza recursivamente objetos anidados', () => {
    const result = sanitizeKeys({ outer: { '$ne': null, 'key.dot': true } }) as Record<string, unknown>;
    const inner = result['outer'] as Record<string, unknown>;
    expect(inner['＄ne']).toBeNull();
    expect(inner['key_dot']).toBe(true);
  });

  it('sanitiza elementos dentro de arrays', () => {
    const result = sanitizeKeys([{ '$gt': 0 }]) as Array<Record<string, unknown>>;
    expect(result[0]['＄gt']).toBe(0);
  });

  it('no modifica claves sin $ ni .', () => {
    const input = { from: '0xabc', to: '0xdef', value: '100' };
    expect(sanitizeKeys(input)).toEqual(input);
  });

  it('pasa valores primitivos sin modificar', () => {
    expect(sanitizeKeys(42)).toBe(42);
    expect(sanitizeKeys('hello')).toBe('hello');
    expect(sanitizeKeys(null)).toBeNull();
  });
});
