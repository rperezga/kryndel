import type { AlertRule, ContractEvent } from './types.js';

// Subscriber — evalúa reglas de alerta contra eventos entrantes y despacha notificaciones.

export interface Subscriber {
  subscribe(rule: AlertRule, onMatch: (event: ContractEvent, rule: AlertRule) => void): Promise<void>;
  unsubscribe(ruleId: string): Promise<void>;
  evaluate(event: ContractEvent): void;
  rules(): AlertRule[];
}

// A2.4: matchesRule compara contract, event name y args (case-insensitive para addresses).
// Requiere que el evento lleve contractAddress (propagado por el pipeline/decoder).
export function matchesRule(event: ContractEvent, rule: AlertRule): boolean {
  // Filtrar por contrato si la regla lo especifica y el evento lo propaga.
  if (rule.contract && event.contractAddress !== undefined) {
    if (event.contractAddress.toLowerCase() !== rule.contract.toLowerCase()) return false;
  }
  if (event.name !== rule.event) return false;
  if (!rule.filter) return true;
  return Object.entries(rule.filter).every(([k, v]) => {
    const actual = event.args[k];
    if (typeof actual === 'string' && typeof v === 'string') {
      return actual.toLowerCase() === v.toLowerCase();
    }
    return actual === v;
  });
}

export function createSubscriber(): Subscriber {
  const rules = new Map<string, { rule: AlertRule; cb: (e: ContractEvent, r: AlertRule) => void }>();

  return {
    async subscribe(rule, onMatch) {
      rules.set(rule.id, { rule, cb: onMatch });
    },

    async unsubscribe(ruleId) {
      rules.delete(ruleId);
    },

    evaluate(event) {
      for (const { rule, cb } of rules.values()) {
        if (matchesRule(event, rule)) {
          cb(event, rule);
        }
      }
    },

    rules() {
      return Array.from(rules.values()).map(({ rule }) => rule);
    },
  };
}
// wireAlerts() eliminada — era un no-op (A2.8 / B5).
