import { ChangeDetectionStrategy, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GameOverComponent } from './game-over.component';
import { GameStateStore } from '../../game-state.store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createStoreSpy(overrides: Partial<{
  gameOutcome: 'victory' | 'defeat' | null;
  floor: number;
  act: number;
  gold: number;
  deck: unknown[];
  relics: string[];
  player: { hp: number; maxHp: number };
}>): jasmine.SpyObj<GameStateStore> {
  const defaults = {
    gameOutcome: 'defeat' as const,
    floor: 5,
    act: 1,
    gold: 120,
    deck: [{}, {}],
    relics: ['relic-a'],
    player: { hp: 0, maxHp: 80, block: 0, energy: 3, maxEnergy: 3, gold: 120, deck: [], hand: [], piles: { discard: [], exhaust: [] }, statusEffects: [] },
  };
  const cfg = { ...defaults, ...overrides };

  const spy = jasmine.createSpyObj<GameStateStore>(
    'GameStateStore',
    ['newGame', 'returnToMenu'],
    {
      gameOutcome: signal(cfg.gameOutcome),
      floor: signal(cfg.floor),
      act: signal(cfg.act),
      gold: signal(cfg.gold),
      deck: signal(cfg.deck as never),
      relics: signal(cfg.relics),
      player: signal(cfg.player as never),
    },
  );
  spy.newGame.and.returnValue(Promise.resolve());
  spy.returnToMenu.and.stub();
  return spy;
}

function createComponent(storeSpy: jasmine.SpyObj<GameStateStore>) {
  TestBed.configureTestingModule({
    imports: [GameOverComponent],
    providers: [{ provide: GameStateStore, useValue: storeSpy }],
  }).overrideComponent(GameOverComponent, {
    set: { changeDetection: ChangeDetectionStrategy.Default },
  });
  const fixture = TestBed.createComponent(GameOverComponent);
  fixture.detectChanges();
  return fixture;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameOverComponent', () => {

  describe('defeat screen', () => {
    let storeSpy: jasmine.SpyObj<GameStateStore>;

    beforeEach(() => {
      storeSpy = createStoreSpy({ gameOutcome: 'defeat', floor: 7, act: 2, gold: 250, deck: new Array(12), relics: ['relic-a', 'relic-b'] });
    });

    it('should render the defeat title', () => {
      const fixture = createComponent(storeSpy);
      const title: HTMLElement = fixture.debugElement.query(By.css('.game-over__title')).nativeElement;
      expect(title.textContent).toContain('Derrotado');
    });

    it('should NOT add victory modifier class', () => {
      const fixture = createComponent(storeSpy);
      const root: HTMLElement = fixture.debugElement.query(By.css('.game-over')).nativeElement;
      expect(root.classList).not.toContain('game-over--victory');
    });

    it('should show floor stat', () => {
      const fixture = createComponent(storeSpy);
      const stats = fixture.debugElement.queryAll(By.css('.game-over__stat-value'));
      const texts = stats.map((el: ReturnType<typeof fixture.debugElement.query>) => (el.nativeElement as HTMLElement).textContent?.trim());
      expect(texts).toContain('7');
    });

    it('should show gold stat in gold color', () => {
      const fixture = createComponent(storeSpy);
      const goldEl: HTMLElement = fixture.debugElement.query(By.css('.game-over__stat-value--gold')).nativeElement;
      expect(goldEl.textContent).toContain('250');
    });

    it('should show deck size stat', () => {
      const fixture = createComponent(storeSpy);
      const stats = fixture.debugElement.queryAll(By.css('.game-over__stat-value'));
      const texts = stats.map((el: ReturnType<typeof fixture.debugElement.query>) => (el.nativeElement as HTMLElement).textContent?.trim());
      expect(texts).toContain('12');
    });

    it('should show relic count stat', () => {
      const fixture = createComponent(storeSpy);
      const stats = fixture.debugElement.queryAll(By.css('.game-over__stat-value'));
      const texts = stats.map((el: ReturnType<typeof fixture.debugElement.query>) => (el.nativeElement as HTMLElement).textContent?.trim());
      expect(texts).toContain('2');
    });

    it('should NOT show HP final stat on defeat screen', () => {
      const fixture = createComponent(storeSpy);
      const hpEl = fixture.debugElement.query(By.css('.game-over__stat-value--hp'));
      expect(hpEl).toBeNull();
    });

    it('should call store.returnToMenu when "Volver al menú" button is clicked', () => {
      const fixture = createComponent(storeSpy);
      const btn: HTMLButtonElement = fixture.debugElement.query(By.css('.game-over__btn--menu')).nativeElement;
      btn.click();
      expect(storeSpy.returnToMenu).toHaveBeenCalledTimes(1);
    });

    it('should call store.newGame when "Nueva partida" button is clicked', () => {
      const fixture = createComponent(storeSpy);
      const btn: HTMLButtonElement = fixture.debugElement.query(By.css('.game-over__btn--new')).nativeElement;
      btn.click();
      expect(storeSpy.newGame).toHaveBeenCalledTimes(1);
    });
  });

  describe('victory screen', () => {
    let storeSpy: jasmine.SpyObj<GameStateStore>;

    beforeEach(() => {
      storeSpy = createStoreSpy({
        gameOutcome: 'victory',
        floor: 15,
        act: 1,
        gold: 500,
        deck: new Array(20),
        relics: ['relic-a', 'relic-b', 'relic-c'],
        player: { hp: 42, maxHp: 80, block: 0, energy: 3, maxEnergy: 3, gold: 500, deck: [], hand: [], piles: { discard: [], exhaust: [] }, statusEffects: [] } as never,
      });
    });

    it('should render the victory title', () => {
      const fixture = createComponent(storeSpy);
      const title: HTMLElement = fixture.debugElement.query(By.css('.game-over__title')).nativeElement;
      expect(title.textContent).toContain('Victorioso');
    });

    it('should add victory modifier class', () => {
      const fixture = createComponent(storeSpy);
      const root: HTMLElement = fixture.debugElement.query(By.css('.game-over')).nativeElement;
      expect(root.classList).toContain('game-over--victory');
    });

    it('should show HP final stat with correct values', () => {
      const fixture = createComponent(storeSpy);
      const hpEl: HTMLElement = fixture.debugElement.query(By.css('.game-over__stat-value--hp')).nativeElement;
      expect(hpEl.textContent).toContain('42');
      expect(hpEl.textContent).toContain('80');
    });

    it('should show relic count', () => {
      const fixture = createComponent(storeSpy);
      const stats = fixture.debugElement.queryAll(By.css('.game-over__stat-value'));
      const texts = stats.map((el: ReturnType<typeof fixture.debugElement.query>) => (el.nativeElement as HTMLElement).textContent?.trim());
      expect(texts).toContain('3');
    });

    it('should apply victory modifier to "Nueva partida" button', () => {
      const fixture = createComponent(storeSpy);
      const btn: HTMLButtonElement = fixture.debugElement.query(By.css('.game-over__btn--new')).nativeElement;
      expect(btn.classList).toContain('game-over__btn--victory');
    });

    it('should call store.returnToMenu when "Volver al menú" button is clicked', () => {
      const fixture = createComponent(storeSpy);
      const btn: HTMLButtonElement = fixture.debugElement.query(By.css('.game-over__btn--menu')).nativeElement;
      btn.click();
      expect(storeSpy.returnToMenu).toHaveBeenCalledTimes(1);
    });

    it('should call store.newGame when "Nueva partida" button is clicked', () => {
      const fixture = createComponent(storeSpy);
      const btn: HTMLButtonElement = fixture.debugElement.query(By.css('.game-over__btn--new')).nativeElement;
      btn.click();
      expect(storeSpy.newGame).toHaveBeenCalledTimes(1);
    });
  });

  describe('null outcome (edge case)', () => {
    it('should default to defeat appearance when outcome is null', () => {
      const storeSpy = createStoreSpy({ gameOutcome: null });
      const fixture = createComponent(storeSpy);
      const root: HTMLElement = fixture.debugElement.query(By.css('.game-over')).nativeElement;
      expect(root.classList).not.toContain('game-over--victory');
    });
  });
});
