# Backlog e integración respecto al plan

Este documento cruza el [Plan](./docs/deckspire.plan.md) con el estado actual de **Deckspire** y recoge ideas opcionales para ampliar el juego.

## Resumen

| Área | En el plan | En el código hoy |
| --- | --- | --- |
| Reliquias “de verdad” (pasivos + activos) | Fase 15 / todos `pending` | **Parcial**: solo IDs en estado, compra en tienda, recompensa post-boss, chips en barra de estado |

Lo que falta no es “crear el juego desde cero”, sino **profundizar el sistema de reliquias** y, si se desea, otras expansiones de contenido o sistemas.

---

## Qué falta integrar (respecto al plan)

### 1. Modelo de dominio de reliquias

- Añadir `domain/models/relic.model.ts` con:
  - `RelicDefinition` (nombre, descripción, rareza, efectos).
  - `RelicPassiveHook` y uniones de `RelicEffectPayload` alineadas con efectos de carta / combate.
  - `RelicInstance` si hace falta estado por reliquia (cooldown, usos por combate); hoy `GameState.relics` es solo `string[]`.

### 2. Datos estáticos ricos

- Evolucionar `domain/data/relics.data.ts`: de un simple array de IDs a un catálogo `as const` con definiciones completas (o un `Record<RelicId, RelicDefinition>`).
- Mantener IDs en kebab-case y una sola fuente de verdad para tienda, tooltips y motor.

### 3. Motor de hooks (RelicEngine o extensión de CombatEngine)

- Evaluar pasivos en puntos del combate ya existentes: inicio de combate / turno, carta jugada, daño infligido, robo, fin de turno, etc.
- Respetar orden determinista y `SeededRandom` donde haya azar.
- **Hoy** `combat-engine.ts` no referencia reliquias: los IDs no alteran reglas.

### 4. Caso de uso `ActivateRelicUseCase`

- Puerto inbound + implementación: validar fase, energía opcional, cooldown, límites por combate.
- Conectar con `CombatRendererPort` (p. ej. `animateRelicActivate`) si se añade feedback visual.

### 5. UI de reliquias

- Sustituir o complementar los chips que muestran el ID crudo en `player-status-bar` por:
  - iconos o iniciales, **tooltip** con nombre y descripción desde datos;
  - botón o tecla para **activos** (estado listo / enfriamiento / agotado en este combate).

### 6. Persistencia y recompensas

- `save` / `load` ya serializan `relics: string[]`; al añadir instancias con contadores, extender el esquema y resetear flags al entrar en combate según el plan.
- Revisar `RewardGenerator`, cofres y eventos para ofrecer reliquias desde el catálogo nuevo (no solo tienda y boss).

### 7. Tests

- Por regla del proyecto: `.spec.ts` junto a servicios públicos nuevos y tests de caso de uso con spies (sin `TestBed` en dominio/use cases).

---

## Brecha plan ↔ código (checklist rápida)

- [ ] `relic.model.ts` con tipos de hooks y payloads.
- [ ] Catálogo en `relics.data.ts` con efectos declarativos.
- [ ] Integración en combate (pasivos).
- [ ] `ActivateRelicUseCase` + registro en DI + store.
- [ ] Barra/tooltip/activos en UI.
- [ ] Renderer opcional para animación de activación.
- [ ] Tests unitarios nuevos.

---

## Ideas para ampliar el juego (fuera o más allá del plan)

### Contenido y progresión

- **Personajes / clases** con mazos iniciales y reliquias exclusivas de inicio (estilo STS).
- **Más actos o modos** (diario con reglas mutantes, ascensión con penalizaciones escalonadas).
- **Logros y desbloqueos** metaprogresión cosmética (dorso de cartas, temas de UI) sin pay-to-win.

### Combate y deck

- **Palabras clave** adicionales (retener, canalizar X, dual cast) con reglas claras en dominio.
- **Condiciones de victoria alternativas** en encuentros especiales (sobrevivir N turnos, proteger un objetivo).
- **Pociones** como objeto de inventario de uso limitado por combate.

### Mapa y nodos

- **Nodos de evento** más ramificados con flags de run (`metiste` al NPC del piso 3).
- **Llaves / rutas secretas** que abren caminos extra con riesgo/recompensa.

### Meta y calidad de vida

- **Semillas** compartibles ya apoyadas por `SeededRandom`; exponer en menú copiar/pegar seed.
- **Historial de run** (duración, daño total, cartas más jugadas) en IndexedDB.
- **Accesibilidad**: atajos rebinding, modo alto contraste, reducción de flash/shake.

### Multijugador / comunidad (ambicioso)

- **Desafíos semanales** con la misma seed global y tabla local.
- **Mods** vía datos JSON cargados en runtime (solo si se define un esquema estable).

### Narrativa y tono

- **Facciones o afinidades** que cambian diálogos en eventos según cartas o reliquias llevadas.
- **Final múltiple** ligado a decisiones de evento (ligero, sin convertir el juego en novela visual).

---

## Notas

- Priorizar **reliquias con efectos** antes de inflar solo el listado de IDs: pocas reliquias bien cableadas dan más partidas memorables que treinta sin reglas.
- Cualquier sistema nuevo debería seguir la **regla de dependencia** hexagonal descrita en `.cursor/rules/project-hexagonal.mdc`.
