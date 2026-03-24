import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { RestSiteComponent } from './rest-site.component';
import { GameStateStore } from '../../game-state.store';
import type { Card } from '../../../domain/models/card.model';
import type { Player } from '../../../domain/models/player.model';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(id: string, upgraded = false): Card {
  return {
    id,
    name: id,
    type: 'attack',
    rarity: 'basic',
    cost: 1,
    description: '',
    upgraded,
    effects: [],
  };
}

function makePlayer(hp: number, maxHp: number): Player {
  return {
    hp,
    maxHp,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 0,
    deck: [],
    hand: [],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
  };
}

// ---------------------------------------------------------------------------
// Helper para crear el entorno de test
// ---------------------------------------------------------------------------

function buildMockStore() {
  const playerSignal = signal<Player>(makePlayer(60, 80));
  const deckSignal = signal<Card[]>([]);

  const store = {
    player: playerSignal,
    deck: deckSignal,
    rest: jasmine.createSpy('rest').and.returnValue(Promise.resolve()),
    smith: jasmine.createSpy('smith').and.returnValue(Promise.resolve()),
  };

  return { store, playerSignal, deckSignal };
}

// ---------------------------------------------------------------------------
// Tests del componente
// ---------------------------------------------------------------------------

describe('RestSiteComponent', () => {
  let fixture: ComponentFixture<RestSiteComponent>;
  let component: RestSiteComponent;
  let playerSignal: ReturnType<typeof signal<Player>>;
  let deckSignal: ReturnType<typeof signal<Card[]>>;
  let mockStore: ReturnType<typeof buildMockStore>['store'];

  beforeEach(async () => {
    const built = buildMockStore();
    mockStore = built.store;
    playerSignal = built.playerSignal;
    deckSignal = built.deckSignal;

    await TestBed.configureTestingModule({
      imports: [RestSiteComponent],
      providers: [{ provide: GameStateStore, useValue: mockStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(RestSiteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Estado inicial ────────────────────────────────────────────────────────

  it('debe mostrar la acción "none" por defecto', () => {
    expect(component.selectedAction()).toBe('none');
  });

  it('no debe marcar la acción como hecha al inicio', () => {
    expect(component.actionDone()).toBeFalse();
  });

  it('debe mostrar el HP actual del jugador', () => {
    playerSignal.set(makePlayer(55, 80));
    fixture.detectChanges();
    const hpEl = fixture.debugElement.query(By.css('.rest-site__hp-value'));
    expect(hpEl.nativeElement.textContent).toContain('55');
    expect(hpEl.nativeElement.textContent).toContain('80');
  });

  it('debe mostrar las opciones cuando no se ha tomado ninguna acción', () => {
    const options = fixture.debugElement.queryAll(By.css('.rest-site__option'));
    expect(options.length).toBe(2);
  });

  // ── healAmount ────────────────────────────────────────────────────────────

  it('healAmount debe ser el 30% del HP máximo redondeado hacia abajo', () => {
    playerSignal.set(makePlayer(40, 80));
    fixture.detectChanges();
    expect(component.healAmount()).toBe(24); // floor(80 * 0.3)
  });

  it('healedHp no puede exceder el HP máximo', () => {
    playerSignal.set(makePlayer(75, 80));
    fixture.detectChanges();
    // heal = floor(80 * 0.3) = 24; 75 + 24 = 99 → tope 80
    expect(component.healedHp()).toBe(80);
  });

  // ── upgradableCards ───────────────────────────────────────────────────────

  it('upgradableCards excluye cartas ya mejoradas', () => {
    deckSignal.set([makeCard('strike', false), makeCard('defend', true), makeCard('bash', false)]);
    fixture.detectChanges();
    expect(component.upgradableCards().length).toBe(2);
    expect(component.upgradableCards().every(({ card }) => !card.upgraded)).toBeTrue();
  });

  it('upgradableCards mantiene los índices originales del mazo', () => {
    deckSignal.set([makeCard('a'), makeCard('b', true), makeCard('c')]);
    fixture.detectChanges();
    const [first, second] = component.upgradableCards();
    expect(first.idx).toBe(0);
    expect(second.idx).toBe(2);
  });

  // ── Selección de acciones ─────────────────────────────────────────────────

  it('selectRest() debe cambiar selectedAction a "rest"', () => {
    component.selectRest();
    expect(component.selectedAction()).toBe('rest');
  });

  it('selectSmith() debe cambiar selectedAction a "smith"', () => {
    component.selectSmith();
    expect(component.selectedAction()).toBe('smith');
  });

  it('cancelSelection() debe volver a "none"', () => {
    component.selectRest();
    component.cancelSelection();
    expect(component.selectedAction()).toBe('none');
  });

  it('selectRest() no hace nada cuando actionDone es true', () => {
    component.actionDone.set(true);
    component.selectRest();
    expect(component.selectedAction()).toBe('none');
  });

  it('selectSmith() no hace nada cuando actionDone es true', () => {
    component.actionDone.set(true);
    component.selectSmith();
    expect(component.selectedAction()).toBe('none');
  });

  // ── Descansar ─────────────────────────────────────────────────────────────

  it('confirmRest() debe llamar a store.rest() y marcar actionDone', async () => {
    component.selectRest();
    await component.confirmRest();

    expect(mockStore.rest).toHaveBeenCalled();
    expect(component.actionDone()).toBeTrue();
  });

  // ── Forjar ────────────────────────────────────────────────────────────────

  it('smithCard(idx) debe llamar a store.smith() con el índice correcto y marcar actionDone', async () => {
    deckSignal.set([makeCard('strike'), makeCard('bash')]);
    fixture.detectChanges();

    component.selectSmith();
    await component.smithCard(1);

    expect(mockStore.smith).toHaveBeenCalledWith(1);
    expect(component.actionDone()).toBeTrue();
  });

  // ── Template: opción Forjar deshabilitada ─────────────────────────────────

  it('el botón Forjar debe estar deshabilitado cuando no hay cartas mejorables', () => {
    deckSignal.set([makeCard('strike', true)]); // ya mejorada
    fixture.detectChanges();
    const smithBtn = fixture.debugElement.query(By.css('.rest-site__option--smith'));
    expect(smithBtn.nativeElement.disabled).toBeTrue();
  });

  it('el botón Forjar debe estar habilitado cuando hay cartas mejorables', () => {
    deckSignal.set([makeCard('strike', false)]);
    fixture.detectChanges();
    const smithBtn = fixture.debugElement.query(By.css('.rest-site__option--smith'));
    expect(smithBtn.nativeElement.disabled).toBeFalse();
  });
});
