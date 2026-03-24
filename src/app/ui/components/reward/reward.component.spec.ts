import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { RewardComponent } from './reward.component';
import { GameStateStore } from '../../game-state.store';
import type { Card } from '../../../domain/models/card.model';
import type { RewardState } from '../../../domain/models/reward.model';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(id: string): Card {
  return {
    id,
    name: id,
    type: 'attack',
    rarity: 'common',
    cost: 1,
    description: '',
    upgraded: false,
    effects: [],
  };
}

function makeReward(cardCount = 3, gold = 50): RewardState {
  return {
    cardOptions: Array.from({ length: cardCount }, (_, i) => makeCard(`card-${i}`)),
    gold,
  };
}

// ---------------------------------------------------------------------------
// Helper para crear el entorno de test
// ---------------------------------------------------------------------------

function buildMockStore() {
  const rewardSignal = signal<RewardState | null>(null);

  const store = {
    reward: rewardSignal,
    pickRewardCard: jasmine.createSpy('pickRewardCard').and.returnValue(Promise.resolve()),
    skipReward: jasmine.createSpy('skipReward').and.returnValue(Promise.resolve()),
  };

  return { store, rewardSignal };
}

// ---------------------------------------------------------------------------
// Tests del componente
// ---------------------------------------------------------------------------

describe('RewardComponent', () => {
  let fixture: ComponentFixture<RewardComponent>;
  let component: RewardComponent;
  let rewardSignal: ReturnType<typeof signal<RewardState | null>>;
  let mockStore: ReturnType<typeof buildMockStore>['store'];

  beforeEach(async () => {
    const built = buildMockStore();
    mockStore = built.store;
    rewardSignal = built.rewardSignal;

    await TestBed.configureTestingModule({
      imports: [RewardComponent],
      providers: [{ provide: GameStateStore, useValue: mockStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(RewardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Estado sin recompensa ─────────────────────────────────────────────────

  it('debe mostrar mensaje vacío cuando reward es null', () => {
    const empty = fixture.debugElement.query(By.css('.reward__empty'));
    expect(empty).toBeTruthy();
  });

  it('NO debe mostrar la sección de cartas cuando reward es null', () => {
    const section = fixture.debugElement.query(By.css('.reward__cards-section'));
    expect(section).toBeNull();
  });

  // ── Con recompensa activa ─────────────────────────────────────────────────

  it('debe mostrar el título de victoria cuando hay recompensa', () => {
    rewardSignal.set(makeReward());
    fixture.detectChanges();
    const title = fixture.debugElement.query(By.css('.reward__title'));
    expect(title.nativeElement.textContent).toContain('Victoria');
  });

  it('debe mostrar la cantidad de oro ganado', () => {
    rewardSignal.set(makeReward(3, 75));
    fixture.detectChanges();
    const goldEl = fixture.debugElement.query(By.css('.reward__gold-amount'));
    expect(goldEl.nativeElement.textContent).toContain('75');
  });

  it('NO debe mostrar el bloque de oro cuando el oro es 0', () => {
    rewardSignal.set(makeReward(3, 0));
    fixture.detectChanges();
    const goldEl = fixture.debugElement.query(By.css('.reward__gold'));
    expect(goldEl).toBeNull();
  });

  it('debe renderizar una carta por cada opción ofrecida', () => {
    rewardSignal.set(makeReward(3));
    fixture.detectChanges();
    const cards = fixture.debugElement.queryAll(By.css('app-card'));
    expect(cards.length).toBe(3);
  });

  it('debe renderizar 4 cartas cuando hay 4 opciones (boss reward)', () => {
    rewardSignal.set(makeReward(4));
    fixture.detectChanges();
    const cards = fixture.debugElement.queryAll(By.css('app-card'));
    expect(cards.length).toBe(4);
  });

  it('debe mostrar el botón de omitir', () => {
    rewardSignal.set(makeReward());
    fixture.detectChanges();
    const skipBtn = fixture.debugElement.query(By.css('.reward__skip'));
    expect(skipBtn).toBeTruthy();
  });

  // ── Delegación al store ───────────────────────────────────────────────────

  it('pickCard() debe llamar a store.pickRewardCard() con la carta correcta', async () => {
    const reward = makeReward(3, 50);
    rewardSignal.set(reward);
    fixture.detectChanges();

    const card = reward.cardOptions[1];
    await component.pickCard(card);

    expect(mockStore.pickRewardCard).toHaveBeenCalledWith(card);
  });

  it('skip() debe llamar a store.skipReward()', async () => {
    rewardSignal.set(makeReward());
    fixture.detectChanges();

    await component.skip();

    expect(mockStore.skipReward).toHaveBeenCalled();
  });

  // ── Caso límite: sin opciones de carta ────────────────────────────────────

  it('debe mostrar cero cartas cuando cardOptions está vacío', () => {
    rewardSignal.set({ cardOptions: [], gold: 30 });
    fixture.detectChanges();
    const cards = fixture.debugElement.queryAll(By.css('app-card'));
    expect(cards.length).toBe(0);
  });
});
