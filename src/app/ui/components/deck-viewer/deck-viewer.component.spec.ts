import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { DeckViewerComponent } from './deck-viewer.component';
import { GameStateStore } from '../../game-state.store';
import type { Card } from '../../../domain/models/card.model';
import type { CombatState } from '../../../domain/models/combat.model';
import type { Player } from '../../../domain/models/player.model';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(id: string, type: Card['type'] = 'attack'): Card {
  return {
    id,
    name: id,
    type,
    rarity: 'common',
    cost: 1,
    description: `${id} description`,
    upgraded: false,
    effects: [],
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    hp: 70,
    maxHp: 70,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 0,
    deck: [],
    hand: [],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
    ...overrides,
  };
}

function makeCombatState(player: Player): CombatState {
  return {
    player,
    enemies: [],
    turn: 1,
    phase: 'player-turn',
    cardsPlayedThisTurn: [],
    damageDealt: 0,
  };
}

// ---------------------------------------------------------------------------
// Mock del store
// ---------------------------------------------------------------------------

function buildMockStore() {
  const deckViewerOpenSig = signal(false);
  const combatSig = signal<CombatState | null>(null);
  const deckSig = signal<Card[]>([]);
  const relicsSig = signal<string[]>([]);

  const store = {
    deckViewerOpen: deckViewerOpenSig,
    combat: combatSig,
    deck: deckSig,
    relics: relicsSig,
    closeDeckViewer: jasmine.createSpy('closeDeckViewer'),
  };

  return { store, deckViewerOpenSig, combatSig, deckSig, relicsSig };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckViewerComponent', () => {
  let fixture: ComponentFixture<DeckViewerComponent>;
  let component: DeckViewerComponent;
  let deckViewerOpenSig: ReturnType<typeof signal<boolean>>;
  let combatSig: ReturnType<typeof signal<CombatState | null>>;
  let deckSig: ReturnType<typeof signal<Card[]>>;
  let relicsSig: ReturnType<typeof signal<string[]>>;
  let mockStore: ReturnType<typeof buildMockStore>['store'];

  beforeEach(async () => {
    const built = buildMockStore();
    mockStore = built.store;
    deckViewerOpenSig = built.deckViewerOpenSig;
    combatSig = built.combatSig;
    deckSig = built.deckSig;
    relicsSig = built.relicsSig;

    await TestBed.configureTestingModule({
      imports: [DeckViewerComponent],
      providers: [{ provide: GameStateStore, useValue: mockStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(DeckViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Visibilidad ────────────────────────────────────────────────────────────

  it('no debe renderizar el panel cuando visible es false', () => {
    const backdrop = fixture.debugElement.query(By.css('.deck-viewer__backdrop'));
    expect(backdrop).toBeNull();
  });

  it('debe renderizar el panel cuando visible es true', () => {
    deckViewerOpenSig.set(true);
    fixture.detectChanges();
    const backdrop = fixture.debugElement.query(By.css('.deck-viewer__backdrop'));
    expect(backdrop).toBeTruthy();
  });

  // ── Fuente de cartas ──────────────────────────────────────────────────────

  it('allCards usa el mazo maestro cuando no hay combate activo', () => {
    deckSig.set([makeCard('strike'), makeCard('defend', 'skill')]);
    expect(component.allCards().length).toBe(2);
  });

  it('allCards combina mano + pila de robo + descarte + exhaust durante combate', () => {
    const player = makePlayer({
      hand: [makeCard('a')],
      deck: [makeCard('b'), makeCard('c')],
      piles: {
        discard: [makeCard('d')],
        exhaust: [makeCard('e')],
      },
    });
    combatSig.set(makeCombatState(player));
    expect(component.allCards().length).toBe(5);
  });

  it('allCards ignora el mazo maestro cuando hay combate activo', () => {
    deckSig.set([makeCard('x'), makeCard('y'), makeCard('z')]);
    const player = makePlayer({ hand: [makeCard('a')] });
    combatSig.set(makeCombatState(player));
    // Solo la carta en la mano, no las 3 del mazo maestro
    expect(component.allCards().length).toBe(1);
  });

  // ── Filtros ────────────────────────────────────────────────────────────────

  it('el filtro inicial es "all"', () => {
    expect(component.activeFilter()).toBe('all');
  });

  it('filteredCards devuelve todas las cartas con filtro "all"', () => {
    deckSig.set([
      makeCard('a', 'attack'),
      makeCard('b', 'skill'),
      makeCard('c', 'power'),
    ]);
    expect(component.filteredCards().length).toBe(3);
  });

  it('filteredCards devuelve solo ataques con filtro "attack"', () => {
    deckSig.set([
      makeCard('a', 'attack'),
      makeCard('b', 'attack'),
      makeCard('c', 'skill'),
    ]);
    component.setFilter('attack');
    expect(component.filteredCards().length).toBe(2);
    expect(component.filteredCards().every(c => c.type === 'attack')).toBeTrue();
  });

  it('filteredCards devuelve solo habilidades con filtro "skill"', () => {
    deckSig.set([makeCard('a', 'attack'), makeCard('b', 'skill')]);
    component.setFilter('skill');
    expect(component.filteredCards().length).toBe(1);
    expect(component.filteredCards()[0].type).toBe('skill');
  });

  it('filteredCards devuelve solo poderes con filtro "power"', () => {
    deckSig.set([makeCard('a', 'power'), makeCard('b', 'attack')]);
    component.setFilter('power');
    expect(component.filteredCards().length).toBe(1);
  });

  it('filteredCards devuelve vacío cuando no hay cartas del tipo filtrado', () => {
    deckSig.set([makeCard('a', 'attack')]);
    component.setFilter('power');
    expect(component.filteredCards().length).toBe(0);
  });

  it('setFilter actualiza activeFilter correctamente', () => {
    component.setFilter('skill');
    expect(component.activeFilter()).toBe('skill');
    component.setFilter('all');
    expect(component.activeFilter()).toBe('all');
  });

  // ── Contadores ────────────────────────────────────────────────────────────

  it('cardCount refleja el total de cartas en allCards', () => {
    deckSig.set([makeCard('a'), makeCard('b'), makeCard('c')]);
    expect(component.cardCount()).toBe(3);
  });

  it('filteredCount refleja el número de cartas filtradas', () => {
    deckSig.set([makeCard('a', 'attack'), makeCard('b', 'skill')]);
    component.setFilter('attack');
    expect(component.filteredCount()).toBe(1);
  });

  it('countByType devuelve las cantidades correctas por tipo', () => {
    deckSig.set([
      makeCard('a', 'attack'),
      makeCard('b', 'attack'),
      makeCard('c', 'skill'),
      makeCard('d', 'power'),
      makeCard('e', 'power'),
    ]);
    const counts = component.countByType();
    expect(counts.attack).toBe(2);
    expect(counts.skill).toBe(1);
    expect(counts.power).toBe(2);
  });

  // ── filterLabel / filterCount ─────────────────────────────────────────────

  it('filterLabel devuelve la etiqueta correcta para cada filtro', () => {
    expect(component.filterLabel('all')).toBe('Todas');
    expect(component.filterLabel('attack')).toBe('Ataques');
    expect(component.filterLabel('skill')).toBe('Habilidades');
    expect(component.filterLabel('power')).toBe('Poderes');
  });

  it('filterCount("all") devuelve el total de cartas', () => {
    deckSig.set([makeCard('a'), makeCard('b')]);
    expect(component.filterCount('all')).toBe(2);
  });

  it('filterCount por tipo devuelve conteo del tipo correspondiente', () => {
    deckSig.set([makeCard('a', 'skill'), makeCard('b', 'skill')]);
    expect(component.filterCount('skill')).toBe(2);
    expect(component.filterCount('attack')).toBe(0);
  });

  // ── Cierre del modal ──────────────────────────────────────────────────────

  it('close() llama a store.closeDeckViewer', () => {
    component.close();
    expect(mockStore.closeDeckViewer).toHaveBeenCalled();
  });

  it('onBackdropClick cierra el modal al hacer clic en el backdrop', () => {
    deckViewerOpenSig.set(true);
    fixture.detectChanges();

    const fakeEvent = {
      target: { classList: { contains: (cls: string) => cls === 'deck-viewer__backdrop' } },
    } as unknown as MouseEvent;

    component.onBackdropClick(fakeEvent);
    expect(mockStore.closeDeckViewer).toHaveBeenCalled();
  });

  it('onBackdropClick NO cierra si el clic fue en un elemento interior', () => {
    const fakeEvent = {
      target: { classList: { contains: () => false } },
    } as unknown as MouseEvent;

    component.onBackdropClick(fakeEvent);
    expect(mockStore.closeDeckViewer).not.toHaveBeenCalled();
  });

  // ── Template: botones de filtro ────────────────────────────────────────────

  it('debe renderizar 4 botones de filtro cuando el panel está abierto', () => {
    deckViewerOpenSig.set(true);
    fixture.detectChanges();
    const btns = fixture.debugElement.queryAll(By.css('.deck-viewer__filter-btn'));
    expect(btns.length).toBe(4);
  });

  it('el botón del filtro activo debe tener la clase --active', () => {
    deckViewerOpenSig.set(true);
    fixture.detectChanges();
    component.setFilter('skill');
    fixture.detectChanges();

    const activeBtn = fixture.debugElement.query(By.css('.deck-viewer__filter-btn--active'));
    expect(activeBtn).toBeTruthy();
    expect(activeBtn.nativeElement.textContent).toContain('Habilidades');
  });

  // ── Reliquias ────────────────────────────────────────────────────────────

  it('debe renderizar la sección de reliquias cuando hay reliquias', () => {
    deckViewerOpenSig.set(true);
    relicsSig.set(['burning-blood']);
    fixture.detectChanges();

    const chips = fixture.debugElement.queryAll(By.css('.deck-viewer__relic-chip'));
    expect(chips.length).toBe(1);
    expect(chips[0].nativeElement.textContent).toContain('Burning Blood');

    const wrap = fixture.debugElement.query(By.css('.deck-viewer__relic-chip-wrap'));
    const tooltip = wrap?.nativeElement.getAttribute('data-tooltip') ?? '';
    expect(tooltip).toContain('cura 6 HP');
  });

  // ── Template: mensaje vacío ────────────────────────────────────────────────

  it('debe mostrar el mensaje vacío cuando filteredCards está vacío', () => {
    deckViewerOpenSig.set(true);
    deckSig.set([makeCard('a', 'attack')]);
    component.setFilter('power');
    fixture.detectChanges();

    const empty = fixture.debugElement.query(By.css('.deck-viewer__empty'));
    expect(empty).toBeTruthy();
  });

  it('NO debe mostrar el mensaje vacío cuando hay cartas filtradas', () => {
    deckViewerOpenSig.set(true);
    deckSig.set([makeCard('a', 'attack')]);
    component.setFilter('attack');
    fixture.detectChanges();

    const empty = fixture.debugElement.query(By.css('.deck-viewer__empty'));
    expect(empty).toBeNull();
  });
});
