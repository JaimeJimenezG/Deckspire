import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { ShopComponent } from './shop.component';
import { GameStateStore } from '../../game-state.store';
import type { Card } from '../../../domain/models/card.model';
import type { ShopItem, ShopState } from '../../../domain/models/shop.model';

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
    description: `${id} description`,
    upgraded: false,
    effects: [],
  };
}

function makeCardItem(id: string, price: number, sold = false): ShopItem {
  return { id, type: 'card', card: makeCard('strike'), price, sold };
}

function makeRelicItem(id: string, relicId: string, price: number, sold = false): ShopItem {
  return { id, type: 'relic', relicId, price, sold };
}

function makeShopState(overrides: Partial<ShopState> = {}): ShopState {
  return {
    items: [
      makeCardItem('card-0', 50),
      makeRelicItem('relic-0', 'burning-blood', 150),
    ],
    purgePrice: 75,
    purgeCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper para crear el entorno de test
// ---------------------------------------------------------------------------

function buildMockStore() {
  const shopSignal = signal<ShopState | null>(null);
  const goldSignal = signal(100);
  const deckSignal = signal<Card[]>([]);

  const store = {
    shop: shopSignal,
    gold: goldSignal,
    deck: deckSignal,
    buyCard: jasmine.createSpy('buyCard').and.returnValue(Promise.resolve()),
    buyRelic: jasmine.createSpy('buyRelic').and.returnValue(Promise.resolve()),
    purgeCard: jasmine.createSpy('purgeCard').and.returnValue(Promise.resolve()),
  };

  return { store, shopSignal, goldSignal, deckSignal };
}

// ---------------------------------------------------------------------------
// Tests del componente
// ---------------------------------------------------------------------------

describe('ShopComponent', () => {
  let fixture: ComponentFixture<ShopComponent>;
  let component: ShopComponent;
  let shopSignal: ReturnType<typeof signal<ShopState | null>>;
  let goldSignal: ReturnType<typeof signal<number>>;
  let deckSignal: ReturnType<typeof signal<Card[]>>;
  let mockStore: ReturnType<typeof buildMockStore>['store'];

  beforeEach(async () => {
    const built = buildMockStore();
    mockStore = built.store;
    shopSignal = built.shopSignal;
    goldSignal = built.goldSignal;
    deckSignal = built.deckSignal;

    await TestBed.configureTestingModule({
      imports: [ShopComponent],
      providers: [{ provide: GameStateStore, useValue: mockStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(ShopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Estado inicial / tienda nula ─────────────────────────────────────────

  it('debe mostrar mensaje vacío cuando no hay tienda activa', () => {
    const empty = fixture.debugElement.query(By.css('.shop__empty'));
    expect(empty).toBeTruthy();
  });

  it('debe mostrar la cantidad de oro del jugador', () => {
    goldSignal.set(250);
    fixture.detectChanges();
    const goldEl = fixture.debugElement.query(By.css('.shop__gold-amount'));
    expect(goldEl.nativeElement.textContent.trim()).toBe('250');
  });

  // ── Ítems de carta ───────────────────────────────────────────────────────

  it('debe mostrar los ítems de tipo carta cuando la tienda está activa', () => {
    shopSignal.set(makeShopState());
    fixture.detectChanges();
    const slots = fixture.debugElement.queryAll(By.css('.shop__card-slot'));
    expect(slots.length).toBe(1);
  });

  it('debe marcar el slot como vendido cuando el ítem está vendido', () => {
    shopSignal.set(makeShopState({
      items: [makeCardItem('card-0', 50, true)],
    }));
    fixture.detectChanges();
    const slot = fixture.debugElement.query(By.css('.shop__card-slot--sold'));
    expect(slot).toBeTruthy();
  });

  it('debe marcar el slot como inaccesible cuando no hay oro suficiente', () => {
    shopSignal.set(makeShopState({ items: [makeCardItem('card-0', 200)] }));
    goldSignal.set(50);
    fixture.detectChanges();
    const slot = fixture.debugElement.query(By.css('.shop__card-slot--unaffordable'));
    expect(slot).toBeTruthy();
  });

  // ── Compra de carta ───────────────────────────────────────────────────────

  it('debe llamar a store.buyCard con el id correcto cuando se compra', async () => {
    shopSignal.set(makeShopState());
    goldSignal.set(100);
    fixture.detectChanges();

    const item = component.cardItems()[0];
    await component.buyCard(item);

    expect(mockStore.buyCard).toHaveBeenCalledWith('card-0');
  });

  it('NO debe llamar a store.buyCard cuando el jugador no puede pagarlo', async () => {
    shopSignal.set(makeShopState());
    goldSignal.set(10);
    fixture.detectChanges();

    const item = component.cardItems()[0];
    await component.buyCard(item);

    expect(mockStore.buyCard).not.toHaveBeenCalled();
  });

  it('NO debe llamar a store.buyCard cuando la carta ya está vendida', async () => {
    shopSignal.set(makeShopState({
      items: [makeCardItem('card-0', 50, true)],
    }));
    fixture.detectChanges();

    const item = component.cardItems()[0];
    await component.buyCard(item);

    expect(mockStore.buyCard).not.toHaveBeenCalled();
  });

  // ── Compra de reliquia ────────────────────────────────────────────────────

  it('debe llamar a store.buyRelic con el id correcto cuando se compra', async () => {
    shopSignal.set(makeShopState());
    goldSignal.set(200);
    fixture.detectChanges();

    const item = component.relicItems()[0];
    await component.buyRelic(item);

    expect(mockStore.buyRelic).toHaveBeenCalledWith('relic-0');
  });

  it('NO debe llamar a store.buyRelic cuando no hay oro suficiente', async () => {
    shopSignal.set(makeShopState());
    goldSignal.set(10);
    fixture.detectChanges();

    const item = component.relicItems()[0];
    await component.buyRelic(item);

    expect(mockStore.buyRelic).not.toHaveBeenCalled();
  });

  // ── Modo purga ────────────────────────────────────────────────────────────

  it('debe empezar con purgeMode en false', () => {
    expect(component.purgeMode()).toBeFalse();
  });

  it('debe alternar purgeMode al llamar a togglePurgeMode()', () => {
    component.togglePurgeMode();
    expect(component.purgeMode()).toBeTrue();
    component.togglePurgeMode();
    expect(component.purgeMode()).toBeFalse();
  });

  it('debe llamar a store.purgeCard y cerrar el modo purga', async () => {
    shopSignal.set(makeShopState());
    deckSignal.set([makeCard('strike'), makeCard('defend')]);
    fixture.detectChanges();

    component.togglePurgeMode();
    await component.purgeCard(1);

    expect(mockStore.purgeCard).toHaveBeenCalledWith(1);
    expect(component.purgeMode()).toBeFalse();
  });

  // ── Computed signals ──────────────────────────────────────────────────────

  it('deckWithIndex debe incluir el índice correcto para cada carta', () => {
    const cards = [makeCard('a'), makeCard('b'), makeCard('c')];
    deckSignal.set(cards);
    fixture.detectChanges();

    const result = component.deckWithIndex();
    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ card: cards[0], idx: 0 });
    expect(result[2]).toEqual({ card: cards[2], idx: 2 });
  });

  it('purgePrice debe reflejar el valor de la tienda', () => {
    shopSignal.set(makeShopState({ purgePrice: 120 }));
    fixture.detectChanges();
    expect(component.purgePrice()).toBe(120);
  });

  it('purgePrice devuelve 75 por defecto si no hay tienda', () => {
    shopSignal.set(null);
    fixture.detectChanges();
    expect(component.purgePrice()).toBe(75);
  });

  // ── canAfford ────────────────────────────────────────────────────────────

  it('canAfford devuelve true cuando el oro es suficiente', () => {
    goldSignal.set(100);
    expect(component.canAfford(100)).toBeTrue();
  });

  it('canAfford devuelve false cuando el oro es insuficiente', () => {
    goldSignal.set(49);
    expect(component.canAfford(50)).toBeFalse();
  });

  // ── formatRelicName ──────────────────────────────────────────────────────

  it('formatRelicName convierte kebab-case a Title Case', () => {
    expect(component.formatRelicName('burning-blood')).toBe('Burning Blood');
    expect(component.formatRelicName('vajra')).toBe('Vajra');
    expect(component.formatRelicName('strange-spoon')).toBe('Strange Spoon');
  });
});
