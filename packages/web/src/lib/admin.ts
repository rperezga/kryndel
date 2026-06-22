/**
 * Admin gating — restringe rutas/datos sensibles al/los admin(s) del proyecto.
 *
 * El admin se define por email vía la env var ADMIN_EMAIL (lista separada por comas).
 * Si ADMIN_EMAIL no está definida, por defecto solo el owner (rperezga@gmail.com).
 *
 * Para añadir más admins en el futuro: ADMIN_EMAIL="a@x.com,b@y.com"
 */
import { currentUser } from './current-user';

const DEFAULT_ADMINS = ['rperezga@gmail.com'];

/** Lista de emails admin (lowercase), desde ADMIN_EMAIL o el default. */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAIL;
  const list = raw
    ? raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ADMINS;
  return list;
}

/** ¿Este email es admin? */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/**
 * Devuelve el KUser si está autenticado Y es admin; si no, null.
 * Llamar desde Server Components / route handlers que deban gatear por admin.
 */
export async function currentAdmin() {
  const user = await currentUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
