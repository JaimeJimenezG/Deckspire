import {
  clampDragPointToViewport,
  fanTransform,
  fanZIndex,
  HandComponent,
} from './hand.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import type { Card } from '../../../domain/models/card.model';
import type { CombatState } from '../../../domain/models/combat.model';
import { GameStateStore } from '../../game-state.store';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(id: string, cost: number, exhaust = false): Card {
  return {
    id,
    name: id,
    type: 'attack',
    rarity: 'basic',
    cost,
    description: '',
    upgraded: false,
    effects: exhaust ? [{ type: 'exhaust-self' as const }] : [],
  };
}

// ---------------------------------------------------------------------------
// Pure helper tests (no Angular, no TestBed)
// ---------------------------------------------------------------------------

describe('fanTransform', () => {
  it('should return empty string for an empty hand', () => {
    expect(fanTransform(0, 0, false)).toBe('');
  });

  it('should return zero rotation for a single card', () => {
    const result = fanTransform(0, 1, false);
    expect(result).toContain('rotate(0deg)');
  });

  it('should rotate the first card negatively (left) in a multi-card hand', () => {
    const result = fanTransform(0, 5, false);
    // First card is left of center → negative rotation
    expect(result).toMatch(/rotate\(-\d+(\.\d+)?deg\)/);
  });

  it('should rotate the last card positively (right) in a multi-card hand', () => {
    const result = fanTransform(4, 5, false);
    // Last card is right of center → positive rotation
    expect(result).toMatch(/rotate\(\d+(\.\d+)?deg\)/);
  });

  it('should give zero rotation to the center card when hovered', () => {
    const result = fanTransform(2, 5, true);
    expect(result).toContain('rotate(0deg)');
  });

  it('should include a negative translateY when hovered (card lifts)', () => {
    const defaultResult = fanTransform(2, 5, false);
    const hoveredResult = fanTransform(2, 5, true);

    // Extract translateY values
    const defaultY = parseFloat(defaultResult.match(/translateY\(([^p]+)px\)/)?.[1] ?? '0');
    const hoveredY = parseFloat(hoveredResult.match(/translateY\(([^p]+)px\)/)?.[1] ?? '0');

    expect(hoveredY).toBeLessThan(defaultY);
  });

  it('should have larger arc dip for edge cards than center card', () => {
    const centerResult = fanTransform(2, 5, false);
    const edgeResult = fanTransform(0, 5, false);

    const centerY = parseFloat(centerResult.match(/translateY\(([^p]+)px\)/)?.[1] ?? '0');
    const edgeY = parseFloat(edgeResult.match(/translateY\(([^p]+)px\)/)?.[1] ?? '0');

    expect(edgeY).toBeGreaterThan(centerY);
  });
});

describe('fanZIndex', () => {
  it('should return 200 for the hovered card', () => {
    expect(fanZIndex(0, 5, true)).toBe(200);
  });

  it('should give the center card a higher z-index than edge cards', () => {
    const centerZ = fanZIndex(2, 5, false);
    const edgeZ = fanZIndex(0, 5, false);
    expect(centerZ).toBeGreaterThan(edgeZ);
  });

  it('should return identical z-index for symmetric positions', () => {
    const leftZ = fanZIndex(0, 5, false);
    const rightZ = fanZIndex(4, 5, false);
    expect(leftZ).toBe(rightZ);
  });
});

describe('clampDragPointToViewport', () => {
  it('should keep the pointer position when already inside safe viewport bounds', () => {
    const result = clampDragPointToViewport(200, 300, 1080, 1920);
    expect(result.x).toBeCloseTo(200, 6);
    expect(result.y).toBeCloseTo(300, 6);
  });

  it('should clamp x when pointer goes beyond left and right edges', () => {
    const left = clampDragPointToViewport(-50, 300, 360, 640);
    const right = clampDragPointToViewport(9999, 300, 360, 640);
    expect(left.x).toBeGreaterThanOrEqual(0);
    expect(right.x).toBeLessThanOrEqual(360);
    expect(left.x).toBeLessThan(right.x);
  });

  it('should clamp y when pointer goes beyond top and bottom edges', () => {
    const top = clampDragPointToViewport(200, -120, 360, 640);
    const bottom = clampDragPointToViewport(200, 9999, 360, 640);
    expect(top.y).toBeGreaterThanOrEqual(0);
    expect(bottom.y).toBeLessThanOrEqual(640);
    expect(top.y).toBeLessThan(bottom.y);
  });
});

// ---------------------------------------------------------------------------
// Component integration tests (minimal TestBed)
// ---------------------------------------------------------------------------

describe('HandComponent', () => {
  let fixture: ComponentFixture<HandComponent>;
  let component: HandComponent;

  // Minimal mock store
  const mockCombatSignal = signal<CombatState | null>(null);

  const mockStore = {
    combat: mockCombatSignal,
  } as unknown as GameStateStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HandComponent],
      providers: [
        { provide: GameStateStore, useValue: mockStore },
        // Disable animations so tests do not depend on timing
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HandComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Derived signals ────────────────────────────────────────────────────────

  it('should expose an empty hand when combat is null', () => {
    mockCombatSignal.set(null);
    fixture.detectChanges();
    expect(component.hand()).toEqual([]);
  });

  it('should reflect the hand from active combat state', () => {
    const cards = [makeCard('strike', 1), makeCard('defend', 1)];
    mockCombatSignal.set(buildCombatState(cards, 3, 'player-turn'));
    fixture.detectChanges();
    expect(component.hand()).toEqual(cards);
  });

  it('should report isPlayerTurn = true when phase is player-turn', () => {
    mockCombatSignal.set(buildCombatState([], 3, 'player-turn'));
    fixture.detectChanges();
    expect(component.isPlayerTurn()).toBeTrue();
  });

  it('should report isPlayerTurn = false during enemy-turn', () => {
    mockCombatSignal.set(buildCombatState([], 3, 'enemy-turn'));
    fixture.detectChanges();
    expect(component.isPlayerTurn()).toBeFalse();
  });

  // ── isPlayable ─────────────────────────────────────────────────────────────

  it('should mark a card as playable when player has enough energy', () => {
    mockCombatSignal.set(buildCombatState([], 3, 'player-turn'));
    fixture.detectChanges();
    expect(component.isPlayable(makeCard('strike', 1))).toBeTrue();
  });

  it('should mark a card as unplayable when it costs more than current energy', () => {
    mockCombatSignal.set(buildCombatState([], 1, 'player-turn'));
    fixture.detectChanges();
    expect(component.isPlayable(makeCard('whirlwind', 2))).toBeFalse();
  });

  it('should mark a card as unplayable during the enemy turn', () => {
    mockCombatSignal.set(buildCombatState([], 3, 'enemy-turn'));
    fixture.detectChanges();
    expect(component.isPlayable(makeCard('strike', 1))).toBeFalse();
  });

  // ── Hover state ────────────────────────────────────────────────────────────

  it('onMouseEnter should set the hovered index', () => {
    component.onMouseEnter(2);
    expect(component.hoveredIndex()).toBe(2);
  });

  it('onMouseLeave should clear the hovered index when not dragging', () => {
    component.onMouseEnter(2);
    component.onMouseLeave();
    expect(component.hoveredIndex()).toBe(-1);
  });

  // ── getTransform / getZIndex delegates to pure helpers ────────────────────

  it('getTransform should match fanTransform for the current hand', () => {
    const cards = [makeCard('a', 1), makeCard('b', 1), makeCard('c', 1)];
    mockCombatSignal.set(buildCombatState(cards, 3, 'player-turn'));
    fixture.detectChanges();

    const expected = fanTransform(1, 3, false);
    expect(component.getTransform(1)).toBe(expected);
  });

  it('getZIndex should match fanZIndex for the current hand', () => {
    const cards = [makeCard('a', 1), makeCard('b', 1), makeCard('c', 1)];
    mockCombatSignal.set(buildCombatState(cards, 3, 'player-turn'));
    fixture.detectChanges();

    const expected = fanZIndex(0, 3, false);
    expect(component.getZIndex(0)).toBe(expected);
  });

  // ── isBeingDragged ─────────────────────────────────────────────────────────

  it('isBeingDragged should return false when no drag is active', () => {
    expect(component.isBeingDragged(0)).toBeFalse();
  });

  it('isBeingDragged should return true when that index is the active dragging index and drag is active', () => {
    component['draggingIndex'].set(2);
    component['isDragActive'].set(true);
    expect(component.isBeingDragged(2)).toBeTrue();
  });

  it('isBeingDragged should keep the played slot hidden while state is pending commit', () => {
    const card = makeCard('strike', 1);
    mockCombatSignal.set(buildCombatState([card], 3, 'player-turn'));
    fixture.detectChanges();

    component.pendingPlayed.set({ index: 0, card });
    expect(component.isBeingDragged(0)).toBeTrue();
  });

  it('should clear pendingPlayed once the played card leaves the hand', () => {
    const card = makeCard('strike', 1);
    mockCombatSignal.set(buildCombatState([card], 3, 'player-turn'));
    fixture.detectChanges();

    component.pendingPlayed.set({ index: 0, card });
    mockCombatSignal.set(buildCombatState([], 3, 'player-turn'));
    fixture.detectChanges();

    expect(component.pendingPlayed()).toBeNull();
  });

  // ── Animation state helpers ────────────────────────────────────────────────

  it('getCardWrapState should return "visible" for a card not being played', () => {
    const card = makeCard('test', 1);
    expect(component.getCardWrapState(card)).toBe('visible');
  });

  it('getDrawDelay should return 0 for the first card', () => {
    expect(component.getDrawDelay(0)).toBe(0);
  });

  it('getDrawDelay should increase linearly with index', () => {
    expect(component.getDrawDelay(2)).toBeGreaterThan(component.getDrawDelay(1));
  });

  it('getDiscardDelay should return 0 for the first card', () => {
    expect(component.getDiscardDelay(0)).toBe(0);
  });

  it('getDiscardDelay should increase linearly with index', () => {
    expect(component.getDiscardDelay(3)).toBeGreaterThan(component.getDiscardDelay(1));
  });

  // ── cardPlayed output ─────────────────────────────────────────────────────

  it('should emit cardPlayed synchronously on pointerup (quick click play)', () => {
    const cards = [makeCard('strike', 1)];
    mockCombatSignal.set(buildCombatState(cards, 3, 'player-turn'));
    fixture.detectChanges();

    const emitted: { card: Card; targetIdx: number }[] = [];
    component.cardPlayed.subscribe((ev) => emitted.push(ev));

    component['draggingIndex'].set(0);
    component['dragStartY'] = 900;
    component['dragPos'].set({ x: 100, y: 900 });
    component['isDragActive'].set(false);
    component['playThresholdY'] = 500;

    component['onPointerUp'](
      new PointerEvent('pointerup', { clientX: 100, clientY: 900 }),
    );

    expect(emitted.length).toBe(1);
    expect(emitted[0].card).toEqual(cards[0]);
    expect(emitted[0].targetIdx).toBe(-1);
  });

  it('should emit cardPlayed for exhaust-self cards immediately like any other', () => {
    const exhaustCard = makeCard('burn', 1, true);
    mockCombatSignal.set(buildCombatState([exhaustCard], 3, 'player-turn'));
    fixture.detectChanges();

    const emitted: { card: Card; targetIdx: number }[] = [];
    component.cardPlayed.subscribe((ev) => emitted.push(ev));

    component['draggingIndex'].set(0);
    component['dragStartY'] = 900;
    component['dragPos'].set({ x: 100, y: 900 });
    component['isDragActive'].set(false);
    component['playThresholdY'] = 500;

    component['onPointerUp'](
      new PointerEvent('pointerup', { clientX: 100, clientY: 900 }),
    );

    expect(emitted.length).toBe(1);
    expect(emitted[0].card).toEqual(exhaustCard);
  });

  it('should emit cardPlayed when drag is released above the play threshold', () => {
    const cards = [makeCard('strike', 1)];
    mockCombatSignal.set(buildCombatState(cards, 3, 'player-turn'));
    fixture.detectChanges();

    const emitted: { card: Card; targetIdx: number }[] = [];
    component.cardPlayed.subscribe((ev) => emitted.push(ev));

    component['draggingIndex'].set(0);
    component['dragStartY'] = 900;
    component['dragPos'].set({ x: 100, y: 200 });
    component['isDragActive'].set(true);
    component['playThresholdY'] = 500;

    component['onPointerUp'](
      new PointerEvent('pointerup', { clientX: 100, clientY: 200 }),
    );

    expect(emitted.length).toBe(1);
  });

  it('should NOT emit cardPlayed when drag is released below the play threshold', () => {
    const cards = [makeCard('strike', 1)];
    mockCombatSignal.set(buildCombatState(cards, 3, 'player-turn'));
    fixture.detectChanges();

    const emitted: { card: Card; targetIdx: number }[] = [];
    component.cardPlayed.subscribe((ev) => emitted.push(ev));

    component['draggingIndex'].set(0);
    component['dragStartY'] = 900;
    component['dragPos'].set({ x: 100, y: 800 });
    component['isDragActive'].set(true);
    component['playThresholdY'] = 500;

    component['onPointerUp'](
      new PointerEvent('pointerup', { clientX: 100, clientY: 800 }),
    );

    expect(emitted.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

import type { Player } from '../../../domain/models/player.model';

function buildCombatState(
  hand: Card[],
  energy: number,
  phase: CombatState['phase'],
): CombatState {
  const player: Player = {
    hp: 70,
    maxHp: 70,
    block: 0,
    energy,
    maxEnergy: 3,
    gold: 0,
    deck: [],
    hand,
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
  };

  return {
    player,
    enemies: [],
    turn: 1,
    phase,
    cardsPlayedThisTurn: [],
    damageDealt: 0,
  };
}
