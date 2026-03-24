import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CardComponent } from './card.component';
import type { Card } from '../../../domain/models/card.model';

// ---------------------------------------------------------------------------
// Fixtures de datos de prueba
// ---------------------------------------------------------------------------

const ATTACK_CARD: Card = {
  id: 'strike',
  name: 'Strike',
  type: 'attack',
  rarity: 'basic',
  cost: 1,
  upgraded: false,
  description: 'Deal 6 damage.',
  effects: [{ type: 'damage', value: 6 }],
};

const SKILL_CARD: Card = {
  id: 'defend',
  name: 'Defend',
  type: 'skill',
  rarity: 'common',
  cost: 1,
  upgraded: false,
  description: 'Gain 5 Block.',
  effects: [{ type: 'block', value: 5 }],
};

const POWER_CARD: Card = {
  id: 'inflame',
  name: 'Inflame',
  type: 'power',
  rarity: 'uncommon',
  cost: 1,
  upgraded: false,
  description: 'Gain 2 Strength.',
  effects: [{ type: 'apply-status', target: 'self', status: 'strength', stacks: 2 }],
};

const UPGRADED_CARD: Card = {
  ...ATTACK_CARD,
  id: 'strike+',
  name: 'Strike',
  upgraded: true,
  description: 'Deal 9 damage.',
  effects: [{ type: 'damage', value: 9 }],
};

const RARE_CARD: Card = {
  id: 'limit-break',
  name: 'Limit Break',
  type: 'power',
  rarity: 'rare',
  cost: 1,
  upgraded: false,
  description: 'Double your Strength.',
  effects: [{ type: 'apply-status', target: 'self', status: 'strength', stacks: 0 }],
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function createComponent(
  card: Card,
  playable = false,
): Promise<{ fixture: ComponentFixture<CardComponent>; component: CardComponent }> {
  await TestBed.configureTestingModule({
    imports: [CardComponent],
  }).compileComponents();

  const fixture = TestBed.createComponent(CardComponent);
  fixture.componentRef.setInput('card', card);
  fixture.componentRef.setInput('playable', playable);
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

describe('CardComponent', () => {
  // ── Renderizado básico ──────────────────────────────────────────────────

  describe('renderizado de contenido', () => {
    it('debe mostrar el nombre de la carta', async () => {
      const { fixture } = await createComponent(ATTACK_CARD);
      const name = fixture.debugElement.query(By.css('.card__name'));
      expect(name.nativeElement.textContent).toContain('Strike');
    });

    it('debe mostrar el coste de energía', async () => {
      const { fixture } = await createComponent(ATTACK_CARD);
      const cost = fixture.debugElement.query(By.css('.card__cost'));
      expect(cost.nativeElement.textContent.trim()).toBe('1');
    });

    it('debe mostrar la descripción de la carta', async () => {
      const { fixture } = await createComponent(ATTACK_CARD);
      const desc = fixture.debugElement.query(By.css('.card__description'));
      expect(desc.nativeElement.textContent).toContain('Deal 6 damage.');
    });

    it('debe mostrar la etiqueta de tipo "Ataque" para cartas attack', async () => {
      const { fixture } = await createComponent(ATTACK_CARD);
      const label = fixture.debugElement.query(By.css('.card__type-label'));
      expect(label.nativeElement.textContent.trim()).toBe('Ataque');
    });

    it('debe mostrar la etiqueta de tipo "Habilidad" para cartas skill', async () => {
      const { fixture } = await createComponent(SKILL_CARD);
      const label = fixture.debugElement.query(By.css('.card__type-label'));
      expect(label.nativeElement.textContent.trim()).toBe('Habilidad');
    });

    it('debe mostrar la etiqueta de tipo "Poder" para cartas power', async () => {
      const { fixture } = await createComponent(POWER_CARD);
      const label = fixture.debugElement.query(By.css('.card__type-label'));
      expect(label.nativeElement.textContent.trim()).toBe('Poder');
    });
  });

  // ── Clases CSS por tipo ─────────────────────────────────────────────────

  describe('clases CSS de tipo', () => {
    it('debe aplicar la clase card--attack para cartas de ataque', async () => {
      const { fixture } = await createComponent(ATTACK_CARD);
      const article = fixture.debugElement.query(By.css('article'));
      expect(article.nativeElement.classList).toContain('card--attack');
    });

    it('debe aplicar la clase card--skill para cartas de habilidad', async () => {
      const { fixture } = await createComponent(SKILL_CARD);
      const article = fixture.debugElement.query(By.css('article'));
      expect(article.nativeElement.classList).toContain('card--skill');
    });

    it('debe aplicar la clase card--power para cartas de poder', async () => {
      const { fixture } = await createComponent(POWER_CARD);
      const article = fixture.debugElement.query(By.css('article'));
      expect(article.nativeElement.classList).toContain('card--power');
    });
  });

  // ── Clases CSS por rareza ───────────────────────────────────────────────

  describe('clases CSS de rareza', () => {
    it('debe aplicar card--basic para cartas básicas', async () => {
      const { fixture } = await createComponent(ATTACK_CARD);
      const article = fixture.debugElement.query(By.css('article'));
      expect(article.nativeElement.classList).toContain('card--basic');
    });

    it('debe aplicar card--common para cartas comunes', async () => {
      const { fixture } = await createComponent(SKILL_CARD);
      const article = fixture.debugElement.query(By.css('article'));
      expect(article.nativeElement.classList).toContain('card--common');
    });

    it('debe aplicar card--uncommon para cartas no comunes', async () => {
      const { fixture } = await createComponent(POWER_CARD);
      const article = fixture.debugElement.query(By.css('article'));
      expect(article.nativeElement.classList).toContain('card--uncommon');
    });

    it('debe aplicar card--rare para cartas raras', async () => {
      const { fixture } = await createComponent(RARE_CARD);
      const article = fixture.debugElement.query(By.css('article'));
      expect(article.nativeElement.classList).toContain('card--rare');
    });
  });

  // ── Estado upgrades ─────────────────────────────────────────────────────

  describe('carta mejorada (upgraded)', () => {
    it('debe mostrar el marcador "+" en el nombre cuando está mejorada', async () => {
      const { fixture } = await createComponent(UPGRADED_CARD);
      const mark = fixture.debugElement.query(By.css('.card__upgraded-mark'));
      expect(mark).toBeTruthy();
      expect(mark.nativeElement.textContent).toContain('+');
    });

    it('no debe mostrar el marcador "+" en cartas no mejoradas', async () => {
      const { fixture } = await createComponent(ATTACK_CARD);
      const mark = fixture.debugElement.query(By.css('.card__upgraded-mark'));
      expect(mark).toBeNull();
    });

    it('debe aplicar la clase card--upgraded cuando está mejorada', async () => {
      const { fixture } = await createComponent(UPGRADED_CARD);
      const article = fixture.debugElement.query(By.css('article'));
      expect(article.nativeElement.classList).toContain('card--upgraded');
    });
  });

  // ── Interacción: jugable ────────────────────────────────────────────────

  describe('interacción (playable)', () => {
    it('debe emitir cardClick al hacer clic cuando es jugable', async () => {
      const { fixture, component } = await createComponent(ATTACK_CARD, true);
      const emitted: Card[] = [];
      component.cardClick.subscribe((c) => emitted.push(c));

      const article = fixture.debugElement.query(By.css('article'));
      article.nativeElement.click();

      expect(emitted.length).toBe(1);
      expect(emitted[0].id).toBe('strike');
    });

    it('NO debe emitir cardClick al hacer clic cuando no es jugable', async () => {
      const { fixture, component } = await createComponent(ATTACK_CARD, false);
      const emitted: Card[] = [];
      component.cardClick.subscribe((c) => emitted.push(c));

      const article = fixture.debugElement.query(By.css('article'));
      article.nativeElement.click();

      expect(emitted.length).toBe(0);
    });

    it('debe aplicar la clase card--playable cuando playable es true', async () => {
      const { fixture } = await createComponent(ATTACK_CARD, true);
      const article = fixture.debugElement.query(By.css('article'));
      expect(article.nativeElement.classList).toContain('card--playable');
    });

    it('NO debe aplicar card--playable cuando playable es false', async () => {
      const { fixture } = await createComponent(ATTACK_CARD, false);
      const article = fixture.debugElement.query(By.css('article'));
      expect(article.nativeElement.classList).not.toContain('card--playable');
    });

    it('debe tener tabindex=0 cuando es jugable para accesibilidad', async () => {
      const { fixture } = await createComponent(ATTACK_CARD, true);
      const article = fixture.debugElement.query(By.css('article'));
      expect(article.nativeElement.getAttribute('tabindex')).toBe('0');
    });

    it('debe tener tabindex=-1 cuando no es jugable', async () => {
      const { fixture } = await createComponent(ATTACK_CARD, false);
      const article = fixture.debugElement.query(By.css('article'));
      expect(article.nativeElement.getAttribute('tabindex')).toBe('-1');
    });
  });

  // ── typeLabel() y typeSymbol() ──────────────────────────────────────────

  describe('typeLabel (computed signal)', () => {
    it('retorna "Ataque" para tipo attack', async () => {
      const { component } = await createComponent(ATTACK_CARD);
      expect(component.typeLabel()).toBe('Ataque');
    });

    it('retorna "Habilidad" para tipo skill', async () => {
      const { component } = await createComponent(SKILL_CARD);
      expect(component.typeLabel()).toBe('Habilidad');
    });

    it('retorna "Poder" para tipo power', async () => {
      const { component } = await createComponent(POWER_CARD);
      expect(component.typeLabel()).toBe('Poder');
    });
  });

  describe('typeSymbol (computed signal)', () => {
    it('retorna el símbolo de espada para tipo attack', async () => {
      const { component } = await createComponent(ATTACK_CARD);
      expect(component.typeSymbol()).toBe('⚔');
    });

    it('retorna el símbolo de escudo para tipo skill', async () => {
      const { component } = await createComponent(SKILL_CARD);
      expect(component.typeSymbol()).toBe('🛡');
    });

    it('retorna el símbolo de destello para tipo power', async () => {
      const { component } = await createComponent(POWER_CARD);
      expect(component.typeSymbol()).toBe('✨');
    });
  });
});
