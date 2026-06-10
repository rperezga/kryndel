'use server';
// A4.4 — Server action: register an AlertRule in Mongo `rules`.
// A4.5 — Validate all inputs; SSRF protection for URLs.
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { isPrivateHost } from '@/lib/validate';

export interface WatchState {
  error?: string;
  success?: string;
}

export async function watchEvent(
  _prevState: WatchState,
  formData: FormData,
): Promise<WatchState> {
  const contract = (formData.get('contract') as string | null)?.trim() ?? '';
  const event    = (formData.get('event')    as string | null)?.trim() ?? '';
  const channel  = (formData.get('channel')  as string | null)?.trim() ?? '';
  const target   = (formData.get('target')   as string | null)?.trim() ?? '';

  if (!contract || !event || !channel || !target) {
    return { error: 'All fields are required.' };
  }

  if (!['telegram', 'discord', 'webhook'].includes(channel)) {
    return { error: 'Invalid channel. Use: telegram, discord, or webhook.' };
  }

  if (channel === 'telegram') {
    // Chat ID: integer, can be negative (groups/channels)
    if (!/^-?\d{5,15}$/.test(target)) {
      return { error: 'Telegram Chat ID must be an integer (e.g. -1001234567890).' };
    }
  } else {
    let url: URL;
    try { url = new URL(target); }
    catch { return { error: 'Invalid URL.' }; }

    if (url.protocol !== 'https:') {
      return { error: 'Webhook URL must use HTTPS.' };
    }
    if (isPrivateHost(url.hostname)) {
      return { error: 'URL points to a private address — not allowed.' };
    }
    if (channel === 'discord' && !url.hostname.endsWith('discord.com')) {
      return { error: 'Discord webhook must point to discord.com.' };
    }
  }

  // Event name: safe chars only (letters, digits, _, -, or 0x topic hash)
  if (!/^[0-9A-Za-z_\-x]{1,80}$/.test(event) && !/^0x[0-9a-fA-F]{64}$/.test(event)) {
    return { error: 'Invalid event name.' };
  }

  try {
    const db = await getDb();
    await db.collection('rules').insertOne({
      id:       randomUUID(),
      contract: contract.toLowerCase(),
      event,
      channel,
      target,
      createdAt: new Date(),
    });
    return { success: `Rule saved: alerts for "${event}" → ${channel}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Error saving rule: ${msg}` };
  }
}
