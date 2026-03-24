import { NewGameUseCaseImpl } from './new-game.usecase';
import { MapGenerator } from '../../domain/services/map-generator';
import { SeededRandom } from '../../domain/services/seeded-random';
import { STARTER_DECK } from '../../domain/data/cards.data';

describe('NewGameUseCaseImpl', () => {
  let useCase: NewGameUseCaseImpl;
  const FIXED_SEED = 42;

  beforeEach(() => {
    useCase = new NewGameUseCaseImpl(new MapGenerator());
  });

  // ── execute(): fase y estructura ─────────────────────────────────────────

  it('should return phase "map"', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.phase).toBe('map');
  });

  it('should have null combat and null shop on new game', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.combat).toBeNull();
    expect(state.shop).toBeNull();
  });

  it('should set act to 1 and floor to 0', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.act).toBe(1);
    expect(state.floor).toBe(0);
  });

  it('should start with empty relics', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.relics).toEqual([]);
  });

  // ── execute(): seed ───────────────────────────────────────────────────────

  it('should store the provided seed in state', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.seed).toBe(FIXED_SEED);
  });

  it('should use Date.now() as seed when none is provided', async () => {
    const before = Date.now();
    const state = await useCase.execute();
    const after = Date.now();
    expect(state.seed).toBeGreaterThanOrEqual(before);
    expect(state.seed).toBeLessThanOrEqual(after);
  });

  it('should produce the same map for the same seed', async () => {
    const state1 = await useCase.execute(FIXED_SEED);
    const state2 = await useCase.execute(FIXED_SEED);
    expect(state1.map!.bossId).toBe(state2.map!.bossId);
    expect(state1.map!.nodes.size).toBe(state2.map!.nodes.size);
    expect(state1.map!.currentNodeId).toBe(state2.map!.currentNodeId);
  });

  it('should produce different maps for different seeds', async () => {
    const state1 = await useCase.execute(1);
    const state2 = await useCase.execute(999999);
    // At least one of bossId or node count should differ across seeds
    const mapsAreIdentical =
      state1.map!.bossId === state2.map!.bossId &&
      state1.map!.nodes.size === state2.map!.nodes.size;
    // Not required to be different always but almost always will be
    expect(mapsAreIdentical).toBeFalsy();
  });

  // ── execute(): mapa ───────────────────────────────────────────────────────

  it('should generate a non-null map', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.map).not.toBeNull();
  });

  it('should generate a map with currentNodeId null (player has not started)', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.map!.currentNodeId).toBeNull();
  });

  it('should select a boss from the act-1 boss pool', async () => {
    const validBosses = ['the-guardian', 'hexaghost'];
    const state = await useCase.execute(FIXED_SEED);
    expect(validBosses).toContain(state.map!.bossId);
  });

  it('should have reachable nodes in row 0 on the generated map', async () => {
    const state = await useCase.execute(FIXED_SEED);
    const generator = new MapGenerator();
    const reachable = generator.getReachableNodes(state.map!);
    expect(reachable.length).toBeGreaterThan(0);
    for (const id of reachable) {
      const node = state.map!.nodes.get(id)!;
      expect(node.row).toBe(0);
    }
  });

  // ── execute(): jugador ───────────────────────────────────────────────────

  it('should create player with 80 HP', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.player.hp).toBe(80);
    expect(state.player.maxHp).toBe(80);
  });

  it('should create player with 3 energy', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.player.energy).toBe(3);
    expect(state.player.maxEnergy).toBe(3);
  });

  it('should create player with 0 block and no status effects', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.player.block).toBe(0);
    expect(state.player.statusEffects).toEqual([]);
  });

  it('should create player with empty combat piles (no active combat yet)', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.player.deck).toEqual([]);
    expect(state.player.hand).toEqual([]);
    expect(state.player.piles.discard).toEqual([]);
    expect(state.player.piles.exhaust).toEqual([]);
  });

  // ── execute(): mazo maestro ──────────────────────────────────────────────

  it('should set master deck to the starter deck (5× Strike + 4× Defend = 9 cards)', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.deck.length).toBe(STARTER_DECK.length);
  });

  it('should have 5 Strike cards in the starter deck', async () => {
    const state = await useCase.execute(FIXED_SEED);
    const strikes = state.deck.filter(c => c.id === 'strike');
    expect(strikes.length).toBe(5);
  });

  it('should have 4 Defend cards in the starter deck', async () => {
    const state = await useCase.execute(FIXED_SEED);
    const defends = state.deck.filter(c => c.id === 'defend');
    expect(defends.length).toBe(4);
  });

  // ── execute(): oro ───────────────────────────────────────────────────────

  it('should start with 99 gold', async () => {
    const state = await useCase.execute(FIXED_SEED);
    expect(state.gold).toBe(99);
    expect(state.player.gold).toBe(99);
  });

  // ── execute(): boss selection edge case ─────────────────────────────────

  it('should pass a valid bossId to the map generator', async () => {
    const mapGen = new MapGenerator();
    const capturedBossIds: string[] = [];
    const originalGenerate = mapGen.generateMap.bind(mapGen);

    spyOn(mapGen, 'generateMap').and.callFake(
      (act: number, r: SeededRandom, bossId?: string) => {
        if (bossId !== undefined) capturedBossIds.push(bossId);
        return originalGenerate(act, r, bossId);
      },
    );

    const uc = new NewGameUseCaseImpl(mapGen);
    await uc.execute(FIXED_SEED);

    expect(capturedBossIds.length).toBe(1);
    expect(['the-guardian', 'hexaghost']).toContain(capturedBossIds[0]);
  });
});
