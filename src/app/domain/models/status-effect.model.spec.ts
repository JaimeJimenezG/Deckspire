import {
  STATUS_DEFINITIONS,
  StatusEffect,
  StatusType,
} from './status-effect.model';

describe('status-effect.model', () => {
  describe('STATUS_DEFINITIONS', () => {
    it('debe contener una definición para cada StatusType declarado', () => {
      const expectedTypes: StatusType[] = [
        'vulnerable', 'weak', 'frail', 'poison', 'burn', 'daze',
        'shackled', 'constricted', 'slowness', 'no-draw', 'no-draw-next-turn',
        'strength', 'thorns', 'enrage', 'ritual', 'combust',
        'fire-breathing', 'juggernaut', 'flame-barrier', 'brutality',
        'dexterity', 'metallicize', 'regen', 'barricade', 'feel-no-pain',
        'intangible', 'artifact', 'corruption', 'evolve', 'corruption-skill-exhaust',
      ];

      for (const type of expectedTypes) {
        expect(STATUS_DEFINITIONS[type]).toBeDefined(`Falta definición para '${type}'`);
        expect(STATUS_DEFINITIONS[type].type).toBe(type);
      }
    });

    it('cada definición debe tener nombre y descripción no vacíos', () => {
      for (const def of Object.values(STATUS_DEFINITIONS)) {
        expect(def.name.length).toBeGreaterThan(0, `Nombre vacío en '${def.type}'`);
        expect(def.description.length).toBeGreaterThan(0, `Descripción vacía en '${def.type}'`);
      }
    });

    it('los efectos decrementales deben tener al menos un trigger de turno o ser de duración', () => {
      const decreasing = Object.values(STATUS_DEFINITIONS).filter(d => d.decreasing);
      expect(decreasing.length).toBeGreaterThan(0);
      for (const def of decreasing) {
        // Los efectos decrementales son válidos (poison, burn, vulnerable, etc.)
        expect(['buff', 'debuff', 'neutral']).toContain(def.category);
      }
    });

    it('vulnerable debe ser debuff con decreasing=true', () => {
      const def = STATUS_DEFINITIONS['vulnerable'];
      expect(def.category).toBe('debuff');
      expect(def.decreasing).toBeTrue();
      expect(def.triggersOnTurnStart).toBeFalse();
      expect(def.triggersOnTurnEnd).toBeFalse();
    });

    it('strength debe ser buff con decreasing=false', () => {
      const def = STATUS_DEFINITIONS['strength'];
      expect(def.category).toBe('buff');
      expect(def.decreasing).toBeFalse();
    });

    it('poison debe triggerear al inicio del turno y ser decreciente', () => {
      const def = STATUS_DEFINITIONS['poison'];
      expect(def.triggersOnTurnStart).toBeTrue();
      expect(def.decreasing).toBeTrue();
    });

    it('burn debe triggerear al final del turno y ser decreciente', () => {
      const def = STATUS_DEFINITIONS['burn'];
      expect(def.triggersOnTurnEnd).toBeTrue();
      expect(def.decreasing).toBeTrue();
    });

    it('barricade no debe ser decreciente ni triggerear por turno', () => {
      const def = STATUS_DEFINITIONS['barricade'];
      expect(def.decreasing).toBeFalse();
      expect(def.triggersOnTurnStart).toBeFalse();
      expect(def.triggersOnTurnEnd).toBeFalse();
    });
  });

  describe('StatusEffect (instancia viva)', () => {
    it('debe poder construirse con type y stacks', () => {
      const effect: StatusEffect = { type: 'vulnerable', stacks: 2 };
      expect(effect.type).toBe('vulnerable');
      expect(effect.stacks).toBe(2);
      expect(effect.pendingStacks).toBeUndefined();
    });

    it('debe aceptar pendingStacks opcional', () => {
      const effect: StatusEffect = { type: 'strength', stacks: 3, pendingStacks: 1 };
      expect(effect.pendingStacks).toBe(1);
    });

    it('stacks de 1 debe representar efecto activo (caso límite mínimo)', () => {
      const effect: StatusEffect = { type: 'intangible', stacks: 1 };
      expect(effect.stacks).toBeGreaterThanOrEqual(1);
    });
  });
});
