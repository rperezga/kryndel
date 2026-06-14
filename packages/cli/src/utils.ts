// A10: pure utilities exportadas y testeables sin efectos secundarios del CLI.

/**
 * Valida y parsea un número de puerto TCP.
 * Lanza RangeError si el valor no es un entero en el rango 1-65535.
 * Extraído aquí para ser testeable sin importar commander (que llama program.parse()).
 */
export function validatePort(raw: string): number {
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1 || n > 65535) throw new RangeError(`Invalid port: ${raw}`);
  return n;
}
