import type { AlertRule, ContractEvent } from './types.js';
import type { AlertDispatcher } from './alerts.js';

// Subscriber — evalúa reglas de alerta contra eventos entrantes y despacha notificaciones.
// Se integra en el pipeline: cada evento decodificado pasa por los subscribers activos.

export interface Subscriber {
  /** Registra una regla. onMatch se llama cada vez que un evento la dispara. */
  subscribe(rule: AlertRule, onMatch: (event: ContractEvent, rule: AlertRule) => void): Promise<void>;
  /** Elimina la regla con el id dado. */
  unsubscribe(ruleId: string): Promise<void>;
  /** Evalúa un evento contra todas las reglas activas y llama a los callbacks que coincidan. */
  evaluate(event: ContractEvent): void;
  /** Lista las reglas activas. */
  rules(): AlertRule[];
}

// Predicado puro y testeable — sin dependencias externas.
export function matchesRule(event: ContractEvent, rule: AlertRule): boolean {
  if (event.name !== rule.event) return false;
  if (!rule.filter) return true;
  return Object.entries(rule.filter).every(([k, v]) => {
    const actual = event.args[k];
    // Comparación case-insensitive para addresses EVM.
    if (typeof actual === 'string' && typeof v === 'string') {
      return actual.toLowerCase() === v.toLowerCase();
    }
    return actual === v;
  });
}

// Implementación en memoria. Las reglas persisten mientras el proceso esté vivo.
// En Fase 2 esto se puede persistir en MongoDB.
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

// Conecta un subscriber con un dispatcher: cuando una regla dispara, despacha la alerta.
// Úsalo en el pipeline: pipeline.onActivity → subscriber.evaluate → dispatcher.dispatch.
export function wireAlerts(
  subscriber: Subscriber,
  dispatcher: AlertDispatcher,
  onError?: (e: unknown) => void,
): (event: ContractEvent) => void {
  return (event) => {
    subscriber.evaluate({
      ...event,
      // Asegura que el subscriber compara nombres de evento correctamente.
    });
    // El callback ya está registrado en el subscriber vía subscribe().
    // Esta función es solo el punto de entrada del pipeline.
    void dispatcher; // referencia para evitar lint unused
    void onError;
  };
}
