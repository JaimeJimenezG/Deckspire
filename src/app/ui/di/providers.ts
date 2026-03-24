import { InjectionToken, type Provider } from '@angular/core';
import type { NewGameUseCase } from '../../domain/ports/inbound/new-game.usecase';
import type { StartCombatUseCase } from '../../domain/ports/inbound/start-combat.usecase';
import type { PlayCardUseCase } from '../../domain/ports/inbound/play-card.usecase';
import type { EndTurnUseCase } from '../../domain/ports/inbound/end-turn.usecase';
import type { NavigateMapUseCase } from '../../domain/ports/inbound/navigate-map.usecase';
import type { ShopUseCase } from '../../domain/ports/inbound/shop.usecase';
import type { RestUseCase } from '../../domain/ports/inbound/rest.usecase';
import type { CollectRewardUseCase } from '../../domain/ports/inbound/collect-reward.usecase';
import type { SaveGameUseCase } from '../../domain/ports/inbound/save-game.usecase';
import type { LoadGameUseCase } from '../../domain/ports/inbound/load-game.usecase';
import type { ResolveEventUseCase } from '../../domain/ports/inbound/resolve-event.usecase';
import type { GameRepository } from '../../domain/ports/outbound/game-repository.port';
import type { CombatRendererPort } from '../../domain/ports/outbound/combat-renderer.port';

import { NewGameUseCaseImpl } from '../../application/use-cases/new-game.usecase';
import { StartCombatUseCaseImpl } from '../../application/use-cases/start-combat.usecase';
import { PlayCardUseCaseImpl } from '../../application/use-cases/play-card.usecase';
import { EndTurnUseCaseImpl } from '../../application/use-cases/end-turn.usecase';
import { NavigateMapUseCaseImpl } from '../../application/use-cases/navigate-map.usecase';
import { ShopUseCaseImpl } from '../../application/use-cases/shop.usecase';
import { RestUseCaseImpl } from '../../application/use-cases/rest.usecase';
import { CollectRewardUseCaseImpl } from '../../application/use-cases/collect-reward.usecase';
import { SaveGameUseCaseImpl } from '../../application/use-cases/save-game.usecase';
import { LoadGameUseCaseImpl } from '../../application/use-cases/load-game.usecase';
import { ResolveEventUseCaseImpl } from '../../application/use-cases/resolve-event.usecase';
import { IndexedDbGameRepository } from '../../infrastructure/persistence/indexed-db-game-repository';
import { CanvasCombatRenderer } from '../../infrastructure/canvas/canvas-combat-renderer';

import { CombatEngine } from '../../domain/services/combat-engine';
import { DeckManager } from '../../domain/services/deck-manager';
import { EnemyAI } from '../../domain/services/enemy-ai';
import { MapGenerator } from '../../domain/services/map-generator';
import { ShopManager } from '../../domain/services/shop-manager';

// ---------------------------------------------------------------------------
// Tokens de inyección para los puertos de salida
// ---------------------------------------------------------------------------

export const GAME_REPOSITORY = new InjectionToken<GameRepository>('GameRepository');

/**
 * Token para el adaptador de renderizado de combate.
 * En la fase actual se provee con un renderer nulo (no-op).
 * La implementación concreta (CanvasCombatRenderer) se enlazará en fase 9.
 */
export const COMBAT_RENDERER = new InjectionToken<CombatRendererPort>('CombatRendererPort');

// ---------------------------------------------------------------------------
// Tokens de inyección para los casos de uso (puertos inbound)
// ---------------------------------------------------------------------------

export const NEW_GAME_USE_CASE = new InjectionToken<NewGameUseCase>('NewGameUseCase');
export const START_COMBAT_USE_CASE = new InjectionToken<StartCombatUseCase>('StartCombatUseCase');
export const PLAY_CARD_USE_CASE = new InjectionToken<PlayCardUseCase>('PlayCardUseCase');
export const END_TURN_USE_CASE = new InjectionToken<EndTurnUseCase>('EndTurnUseCase');
export const NAVIGATE_MAP_USE_CASE = new InjectionToken<NavigateMapUseCase>('NavigateMapUseCase');
export const SHOP_USE_CASE = new InjectionToken<ShopUseCase>('ShopUseCase');
export const REST_USE_CASE = new InjectionToken<RestUseCase>('RestUseCase');
export const COLLECT_REWARD_USE_CASE = new InjectionToken<CollectRewardUseCase>('CollectRewardUseCase');
export const SAVE_GAME_USE_CASE = new InjectionToken<SaveGameUseCase>('SaveGameUseCase');
export const LOAD_GAME_USE_CASE = new InjectionToken<LoadGameUseCase>('LoadGameUseCase');
export const RESOLVE_EVENT_USE_CASE = new InjectionToken<ResolveEventUseCase>('ResolveEventUseCase');

// ---------------------------------------------------------------------------
// Renderer nulo (placeholder hasta que CanvasCombatRenderer esté implementado)
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Configuración de providers para bootstrapApplication / appConfig
// ---------------------------------------------------------------------------

/**
 * Conjunto de providers que conecta los tokens de inyección con sus implementaciones
 * concretas siguiendo la regla de dependencia hexagonal:
 *
 *   UI (tokens) → application (use cases) → domain (services)
 *                                         ↑
 *                                 infrastructure (adapters)
 *
 * Se incluyen en `appConfig.providers` o en el array de providers del módulo raíz.
 */
export const GAME_PROVIDERS: Provider[] = [
  // ── Adaptadores driven ────────────────────────────────────────────────────
  {
    provide: GAME_REPOSITORY,
    useFactory: () => new IndexedDbGameRepository(),
  },
  {
    provide: COMBAT_RENDERER,
    useFactory: () => new CanvasCombatRenderer(),
  },

  // ── Casos de uso ──────────────────────────────────────────────────────────
  {
    provide: NEW_GAME_USE_CASE,
    useFactory: () => new NewGameUseCaseImpl(new MapGenerator()),
  },
  {
    provide: START_COMBAT_USE_CASE,
    useFactory: () =>
      new StartCombatUseCaseImpl(new CombatEngine(new DeckManager()), new EnemyAI()),
  },
  {
    provide: PLAY_CARD_USE_CASE,
    deps: [COMBAT_RENDERER],
    useFactory: (renderer: CombatRendererPort) =>
      new PlayCardUseCaseImpl(new CombatEngine(new DeckManager()), renderer),
  },
  {
    provide: END_TURN_USE_CASE,
    deps: [COMBAT_RENDERER],
    useFactory: (renderer: CombatRendererPort) =>
      new EndTurnUseCaseImpl(new CombatEngine(new DeckManager()), new EnemyAI(), renderer),
  },
  {
    provide: NAVIGATE_MAP_USE_CASE,
    deps: [GAME_REPOSITORY],
    useFactory: (repo: GameRepository) =>
      new NavigateMapUseCaseImpl(new MapGenerator(), repo),
  },
  {
    provide: SHOP_USE_CASE,
    useFactory: () => new ShopUseCaseImpl(new ShopManager()),
  },
  {
    provide: REST_USE_CASE,
    useFactory: () => new RestUseCaseImpl(),
  },
  {
    provide: COLLECT_REWARD_USE_CASE,
    useFactory: () => new CollectRewardUseCaseImpl(),
  },
  {
    provide: SAVE_GAME_USE_CASE,
    deps: [GAME_REPOSITORY],
    useFactory: (repo: GameRepository) => new SaveGameUseCaseImpl(repo),
  },
  {
    provide: LOAD_GAME_USE_CASE,
    deps: [GAME_REPOSITORY],
    useFactory: (repo: GameRepository) => new LoadGameUseCaseImpl(repo),
  },
  {
    provide: RESOLVE_EVENT_USE_CASE,
    deps: [GAME_REPOSITORY],
    useFactory: (repo: GameRepository) => new ResolveEventUseCaseImpl(repo),
  },
];
