# legacy/hooks-sim — Simulador de XRPL Hooks (DIRECCIÓN VIEJA, preservado)

Este es el núcleo original de Kryndel cuando el producto era un **simulador local de WASM Hooks**
(Etapas 0–7). Tras el pivote a observabilidad (ver `/DELTA.md` y `/PLAN.md`, DEC-006) este código
**ya no es el núcleo activo**, pero se conserva intacto porque:

- Documenta trabajo real (runtime WASM, ABI de Hooks, recorder, trace JSON).
- Podría alimentar la **preview opcional** del producto, que **envuelve `ripple/craft`** (no lo reescribe).

**No se compila ni se testea en el build activo** (el `tsconfig.json` del paquete solo incluye `src/`).
Si quieres revivirlo, muévelo de vuelta a `src/` o dale su propio tsconfig/proyecto.
