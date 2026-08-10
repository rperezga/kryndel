/**
 * alert-templates — one-click "watch" presets that pre-fill the Alert builder.
 *
 * Each template maps to the existing AlertRule shape (eventName + optional arg
 * filter). The UI (rules builder + contracts "Vigilar" menu) reads this catalog;
 * the rule is still created through the normal addRuleAction, so all validation
 * and plan limits apply unchanged.
 *
 * Pure data — no React — so it can be imported by both client components and used
 * to build deep-links (/dashboard/rules?contract=<addr>&template=<id>).
 */
export interface AlertTemplate {
  /** Stable id used in deep-links (?template=<id>). */
  id: 'any' | 'large-transfer' | 'new-approval' | 'mint' | 'burn' | 'admin-activity' | 'silence';
  /** Short button label. */
  label: string;
  /** Material Symbols icon name. */
  icon: string;
  /** One-line description (tooltip / helper). */
  blurb: string;
  /** Event to match: '*' = all, else a specific event name. */
  eventName: string;
  /** Wizard trigger selected by the template. */
  triggerType?: 'event' | 'silence';
  /** Silence threshold in minutes for dead-man-switch templates. */
  silenceMinutes?: number;
  /** Whether the template sets an argument filter. */
  enableFilter: boolean;
  /** Filter argument name (when enableFilter). */
  filterArgName?: string;
  /** Filter operator (when enableFilter): one of > < >= <= =. */
  filterOp?: string;
  /** Preset filter value applied by the template; unlike a threshold, it is not user-editable. */
  filterValue?: string;
  /** If true, the user must still type a threshold value. */
  requiresThreshold?: boolean;
  /** Default rule name pre-filled in the builder. */
  defaultName: string;
}

export const ALERT_TEMPLATES: AlertTemplate[] = [
  {
    id: 'any',
    label: 'Any event',
    icon: 'notifications_active',
    blurb: 'Alert on any event the contract emits — the fastest way to start.',
    eventName: '*',
    enableFilter: false,
    defaultName: 'All activity',
  },
  {
    id: 'large-transfer',
    label: 'Large transfer',
    icon: 'trending_up',
    blurb: 'Transfer with value above a threshold you set (whale / treasury moves).',
    eventName: 'Transfer',
    enableFilter: true,
    filterArgName: 'value',
    filterOp: '>',
    requiresThreshold: true,
    defaultName: 'Large transfer',
  },
  {
    id: 'mint',
    label: 'Mints',
    icon: 'add_circle',
    blurb: 'New tokens minted (Transfer from 0x0).',
    eventName: 'Transfer',
    enableFilter: true,
    filterArgName: 'from',
    filterOp: '=',
    filterValue: '0x0000000000000000000000000000000000000000',
    defaultName: 'Mints',
  },
  {
    id: 'burn',
    label: 'Burns',
    icon: 'local_fire_department',
    blurb: 'Tokens burned (Transfer to 0x0).',
    eventName: 'Transfer',
    enableFilter: true,
    filterArgName: 'to',
    filterOp: '=',
    filterValue: '0x0000000000000000000000000000000000000000',
    defaultName: 'Burns',
  },
  {
    id: 'admin-activity',
    label: 'Admin activity',
    icon: 'admin_panel_settings',
    blurb: 'Owner/admin changes — the events you never want to miss.',
    eventName: 'OwnershipTransferred',
    enableFilter: false,
    defaultName: 'Admin activity',
  },
  {
    id: 'silence',
    label: 'Heartbeat / silence',
    icon: 'heart_check',
    blurb: 'Alert if the contract goes quiet for N hours',
    eventName: '*',
    triggerType: 'silence',
    silenceMinutes: 60,
    enableFilter: false,
    defaultName: 'Heartbeat / silence',
  },
  {
    id: 'new-approval',
    label: 'New approval',
    icon: 'verified_user',
    blurb: 'Approval event — someone granted a spender allowance (security signal).',
    eventName: 'Approval',
    enableFilter: false,
    defaultName: 'New approval',
  },
];

/** Look up a template by id (e.g. from a ?template= query param). */
export function getAlertTemplate(id?: string | null): AlertTemplate | undefined {
  return ALERT_TEMPLATES.find((t) => t.id === id);
}
