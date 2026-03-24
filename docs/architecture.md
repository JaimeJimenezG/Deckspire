# Arquitectura

Deckspire sigue una **arquitectura hexagonal** (ports & adapters). La regla de dependencia es estricta: las capas internas nunca conocen a las externas.

## Capas

```
┌──────────────────────────────────────────────────────────────┐
│  UI (adaptadores driving)                                    │
│  Componentes Angular · GameStateStore · DI                   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Application (casos de uso)                            │  │
│  │  Orquestan servicios de dominio y puertos de salida    │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  Domain (núcleo)                                 │  │  │
│  │  │  Modelos · Servicios · Puertos · Datos estáticos │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Infrastructure (adaptadores driven)                         │
│  IndexedDB · Canvas 2D                                       │
└──────────────────────────────────────────────────────────────┘
```

## Regla de dependencia

```
ui/             → application/ → domain/
infrastructure/ → domain/       (implementa puertos outbound)
```

| Capa | Puede importar de | NO puede importar de |
|---|---|---|
| `domain/` | Nada externo (TypeScript puro) | `application/`, `infrastructure/`, `ui/`, `@angular/*` |
| `application/` | `domain/` | `infrastructure/`, `ui/` |
| `infrastructure/` | `domain/models/`, `domain/ports/outbound/` | `application/`, `ui/`, `domain/services/` |
| `ui/` | `application/` (vía tokens DI), `domain/models/`, `domain/data/` | `infrastructure/` directamente |

## Flujo de una acción

Ejemplo: el jugador juega una carta.

```
HandComponent                           (UI — adaptador driving)
  │
  ▼
GameStateStore.playCard(card, targetIdx) (UI — fachada reactiva)
  │
  ▼
PlayCardUseCaseImpl.execute(...)         (Application — caso de uso)
  │
  ├── CombatEngine.resolveCardEffects() (Domain — servicio puro)
  ├── DeckManager.discardCard()         (Domain — servicio puro)
  │
  ├── CombatRendererPort.animateDamage()(Domain — puerto outbound)
  │       │
  │       ▼
  │   CanvasCombatRenderer              (Infrastructure — adaptador driven)
  │
  ▼
GameStateStore._state.set(newState)     (UI — actualiza signal)
  │
  ▼
Componentes se re-renderizan (OnPush + computed signals)
```

## Puertos

### Puertos inbound (contratos de casos de uso)

Definidos en `domain/ports/inbound/`. Cada interfaz describe una operación que la UI puede invocar.

| Puerto | Método | Descripción |
|---|---|---|
| `NewGameUseCase` | `execute(seed?)` | Inicia una nueva run |
| `StartCombatUseCase` | `execute(state)` | Prepara un combate |
| `PlayCardUseCase` | `execute(card, targetIdx, state, options?)` | Juega una carta |
| `EndTurnUseCase` | `execute(state)` | Finaliza turno del jugador |
| `NavigateMapUseCase` | `execute(nodeId, state)` | Navega a un nodo del mapa |
| `ShopUseCase` | `buyCard / purgeCard / buyRelic` | Interacciones de tienda |
| `RestUseCase` | `rest / smith` | Descansar o mejorar carta |
| `CollectRewardUseCase` | `pickCard / skip` | Recoger recompensa de combate |
| `SaveGameUseCase` | `execute(state)` | Persistir partida |
| `LoadGameUseCase` | `execute()` | Cargar partida guardada |
| `ResolveEventUseCase` | `execute(choiceId, state)` | Resolver evento narrativo |

### Puertos outbound (contratos para infraestructura)

Definidos en `domain/ports/outbound/`.

| Puerto | Implementación | Descripción |
|---|---|---|
| `GameRepository` | `IndexedDbGameRepository` | Persistencia del estado (save/load/delete/stats) |
| `CombatRendererPort` | `CanvasCombatRenderer` | Renderizado visual del combate (escena, animaciones) |

## Inyección de dependencias

La conexión entre puertos e implementaciones se configura en `ui/di/providers.ts` usando `InjectionToken` de Angular. Los tokens se inyectan en `GameStateStore` con `inject()`.

```
Token                    → Implementación concreta
─────────────────────────  ──────────────────────────
GAME_REPOSITORY          → IndexedDbGameRepository
COMBAT_RENDERER          → CanvasCombatRenderer
NEW_GAME_USE_CASE        → NewGameUseCaseImpl
START_COMBAT_USE_CASE    → StartCombatUseCaseImpl
PLAY_CARD_USE_CASE       → PlayCardUseCaseImpl
END_TURN_USE_CASE        → EndTurnUseCaseImpl
NAVIGATE_MAP_USE_CASE    → NavigateMapUseCaseImpl
SHOP_USE_CASE            → ShopUseCaseImpl
REST_USE_CASE            → RestUseCaseImpl
COLLECT_REWARD_USE_CASE  → CollectRewardUseCaseImpl
SAVE_GAME_USE_CASE       → SaveGameUseCaseImpl
LOAD_GAME_USE_CASE       → LoadGameUseCaseImpl
RESOLVE_EVENT_USE_CASE   → ResolveEventUseCaseImpl
```
