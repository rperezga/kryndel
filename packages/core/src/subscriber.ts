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
//
// F1.4: Extiende el filtro con operadores numéricos BigInt:
//   { "value": { "$gt": "1000000000000000000" } }
// Operadores permitidos (closed enum): $gt $lt $gte $lte $eq
// Los operadores vienen del doc de regla (trusted); los valores on-chain se usan solo como
// operandos — nunca como operadores (no injection).
const FILTER_OPS = ['$gt', '$lt', '$gte', '$lte', '$eq'] as const;

function matchesFilterValue(actual: unknown, v: unknown): boolean {
  // Operator object: { "$gt": "1000" }
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    const ops = v as Record<string, unknown>;
    return Object.entries(ops).every(([op, threshold]) => {
      if (!(FILTER_OPS as readonly string[]).includes(op)) return false; // unknown op → reject
      try {
        const a = BigInt(String(actual ?? ''));
        const t = BigInt(String(threshold ?? ''));
        switch (op) {
          case '$gt':  return a > t;
          case '$lt':  return a < t;
          case '$gte': return a >= t;
          case '$lte': return a <= t;
          case '$eq':  return a === t;
        }
      } catch {
        // Not numeric — $eq as string fallback
        if (op === '$eq') return String(actual).toLowerCase() === String(threshold).toLowerCase();
      }
      return false;
    });
  }
  // Equality (existing behaviour)
  if (typeof actual === 'string' && typeof v === 'string') {
    return actual.toLowerCase() === v.toLowerCase();
  }
  return actual === v;
}

export function matchesRule(event: ContractEvent, rule: AlertRule): boolean {
  // Filtrar por contrato si la regla lo especifica y el evento lo propaga.
  if (rule.contract && event.contractAddress !== undefined) {
    if (event.contractAddress.toLowerCase() !== rule.contract.toLowerCase()) return false;
  }
  if (event.name !== rule.event) return false;
  if (!rule.filter) return true;
  return Object.entries(rule.filter).every(([k, v]) => matchesFilterValue(event.args[k], v));
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
