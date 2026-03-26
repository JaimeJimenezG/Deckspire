import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MainMenuComponent } from './main-menu.component';
import { GameStateStore } from '../../game-state.store';
import type { GameStats } from '../../../domain/models/game-state.model';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPTY_STATS: GameStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  highestFloorReached: 0,
  totalGoldEarned: 0,
  totalDamageDealt: 0,
};

const STATS_WITH_DATA: GameStats = {
  gamesPlayed: 10,
  wins: 4,
  losses: 6,
  highestFloorReached: 12,
  totalGoldEarned: 850,
  totalDamageDealt: 3200,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createStoreSpy(hasSave: boolean, stats: GameStats = EMPTY_STATS) {
  const spy = jasmine.createSpyObj<GameStateStore>('GameStateStore', [
    'checkSavedGame',
    'getStats',
    'newGame',
    'loadGame',
  ]);
  spy.checkSavedGame.and.returnValue(Promise.resolve(hasSave));
  spy.getStats.and.returnValue(Promise.resolve(stats));
  spy.newGame.and.returnValue(Promise.resolve());
  spy.loadGame.and.returnValue(Promise.resolve(true));
  return spy;
}

async function createComponent(
  hasSave = false,
  stats: GameStats = EMPTY_STATS,
): Promise<{ fixture: ComponentFixture<MainMenuComponent>; store: jasmine.SpyObj<GameStateStore> }> {
  const store = createStoreSpy(hasSave, stats);

  await TestBed.configureTestingModule({
    imports: [MainMenuComponent],
    providers: [{ provide: GameStateStore, useValue: store }, provideRouter([])],
  }).compileComponents();

  const fixture = TestBed.createComponent(MainMenuComponent);
  fixture.detectChanges();
  // Resolver las promesas del ngOnInit
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, store };
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

describe('MainMenuComponent', () => {
  // ── Renderizado básico ──────────────────────────────────────────────────

  describe('renderizado inicial', () => {
    it('debe mostrar el título del juego', async () => {
      const { fixture } = await createComponent();
      const title = fixture.debugElement.query(By.css('.menu__title'));
      expect(title.nativeElement.textContent).toContain('Dungeon');
    });

    it('debe mostrar el botón "Nueva partida"', async () => {
      const { fixture } = await createComponent();
      const btn = fixture.debugElement.query(By.css('.menu__btn--primary'));
      expect(btn).toBeTruthy();
      expect(btn.nativeElement.textContent).toContain('Nueva partida');
    });

    it('debe mostrar el botón "Estadísticas"', async () => {
      const { fixture } = await createComponent();
      const btn = fixture.debugElement.query(By.css('.menu__btn--tertiary'));
      expect(btn).toBeTruthy();
    });
  });

  // ── Botón "Continuar" ───────────────────────────────────────────────────

  describe('botón Continuar', () => {
    it('no debe mostrar "Continuar" cuando no hay partida guardada', async () => {
      const { fixture } = await createComponent(false);
      const btn = fixture.debugElement.query(By.css('.menu__btn--secondary'));
      expect(btn).toBeNull();
    });

    it('debe mostrar "Continuar" cuando hay una partida guardada', async () => {
      const { fixture } = await createComponent(true);
      const btn = fixture.debugElement.query(By.css('.menu__btn--secondary'));
      expect(btn).toBeTruthy();
      expect(btn.nativeElement.textContent).toContain('Continuar');
    });

    it('debe llamar a store.loadGame() al hacer clic en "Continuar"', async () => {
      const { fixture, store } = await createComponent(true);
      const btn = fixture.debugElement.query(By.css('.menu__btn--secondary'));
      btn.nativeElement.click();
      await fixture.whenStable();
      expect(store.loadGame).toHaveBeenCalledTimes(1);
    });
  });

  // ── Acción "Nueva partida" ──────────────────────────────────────────────

  describe('acción Nueva partida', () => {
    it('debe llamar a store.newGame() al hacer clic', async () => {
      const { fixture, store } = await createComponent();
      const btn = fixture.debugElement.query(By.css('.menu__btn--primary'));
      btn.nativeElement.click();
      await fixture.whenStable();
      expect(store.newGame).toHaveBeenCalledTimes(1);
    });

    it('no debe llamar a store.newGame() si ya hay una carga en curso', fakeAsync(async () => {
      const { fixture, store } = await createComponent();
      const component = fixture.componentInstance;
      component.loading.set(true);
      fixture.detectChanges();

      const btn = fixture.debugElement.query(By.css('.menu__btn--primary'));
      btn.nativeElement.click();
      tick();

      expect(store.newGame).not.toHaveBeenCalled();
    }));
  });

  // ── Panel de estadísticas ───────────────────────────────────────────────

  describe('panel de estadísticas', () => {
    it('no debe mostrar el panel de stats inicialmente', async () => {
      const { fixture } = await createComponent();
      const panel = fixture.debugElement.query(By.css('.menu__stats'));
      expect(panel).toBeNull();
    });

    it('debe mostrar el panel de stats al pulsar el botón "Estadísticas"', async () => {
      const { fixture } = await createComponent(false, STATS_WITH_DATA);
      const btn = fixture.debugElement.query(By.css('.menu__btn--tertiary'));
      btn.nativeElement.click();
      fixture.detectChanges();
      const panel = fixture.debugElement.query(By.css('.menu__stats'));
      expect(panel).toBeTruthy();
    });

    it('debe ocultar el panel de stats al pulsar de nuevo el botón', async () => {
      const { fixture } = await createComponent(false, STATS_WITH_DATA);
      const btn = fixture.debugElement.query(By.css('.menu__btn--tertiary'));
      btn.nativeElement.click();
      fixture.detectChanges();
      btn.nativeElement.click();
      fixture.detectChanges();
      const panel = fixture.debugElement.query(By.css('.menu__stats'));
      expect(panel).toBeNull();
    });

    it('debe mostrar el número de partidas jugadas', async () => {
      const { fixture } = await createComponent(false, STATS_WITH_DATA);
      fixture.componentInstance.toggleStats();
      fixture.detectChanges();
      const panel = fixture.debugElement.query(By.css('.menu__stats'));
      expect(panel.nativeElement.textContent).toContain('10');
    });

    it('debe mostrar las victorias y derrotas', async () => {
      const { fixture } = await createComponent(false, STATS_WITH_DATA);
      fixture.componentInstance.toggleStats();
      fixture.detectChanges();
      const values = fixture.debugElement.queryAll(By.css('.menu__stat-value'));
      const texts = values.map(v => v.nativeElement.textContent.trim());
      expect(texts).toContain('4');
      expect(texts).toContain('6');
    });

    it('debe mostrar la tasa de victoria cuando hay partidas jugadas', async () => {
      const { fixture } = await createComponent(false, STATS_WITH_DATA);
      fixture.componentInstance.toggleStats();
      fixture.detectChanges();
      const winrate = fixture.debugElement.query(By.css('.menu__stats-winrate'));
      expect(winrate).toBeTruthy();
      expect(winrate.nativeElement.textContent).toContain('40');
    });

    it('no debe mostrar la tasa de victoria cuando no hay partidas jugadas', async () => {
      const { fixture } = await createComponent(false, EMPTY_STATS);
      fixture.componentInstance.toggleStats();
      fixture.detectChanges();
      const winrate = fixture.debugElement.query(By.css('.menu__stats-winrate'));
      expect(winrate).toBeNull();
    });
  });

  // ── Init: llamadas al store ─────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('debe llamar a store.checkSavedGame() al inicializar', async () => {
      const { store } = await createComponent();
      expect(store.checkSavedGame).toHaveBeenCalledTimes(1);
    });

    it('debe llamar a store.getStats() al inicializar', async () => {
      const { store } = await createComponent();
      expect(store.getStats).toHaveBeenCalledTimes(1);
    });
  });

  // ── toggleStats() ───────────────────────────────────────────────────────

  describe('toggleStats()', () => {
    it('debe alternar showStats entre true y false', async () => {
      const { fixture } = await createComponent();
      const component = fixture.componentInstance;
      expect(component.showStats()).toBeFalse();
      component.toggleStats();
      expect(component.showStats()).toBeTrue();
      component.toggleStats();
      expect(component.showStats()).toBeFalse();
    });
  });
});
