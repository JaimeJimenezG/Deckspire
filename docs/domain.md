# Capa de Dominio

Todo el código en `domain/` es **TypeScript puro** — sin decoradores Angular, sin imports de framework, sin `Math.random()`. Los servicios reciben estado y retornan nuevo estado sin mutaciones.

## Modelos (`domain/models/`)

Los modelos son exclusivamente interfaces y types con propiedades `readonly`.

### GameState

Estado completo de una run activa. Se serializa para persistencia.

```typescript
interface GameState {
  phase: GamePhase;       // 'main-menu' | 'map' | 'combat' | 'shop' | 'rest' | 'reward' | 'event' | 'game-over'
  gameOutcome: GameOutcome; // 'victory' | 'defeat' | null
  player: Player;
  combat: CombatState | null;
  map: GameMap | null;
  deck: Card[];           // Mazo maestro (fuera de combate)
  gold: number;
  floor: number;          // Nodo actual dentro del acto
  act: number;            // 1, 2 o 3
  seed: number;           // Seed para reproducibilidad
  relics: string[];       // IDs de reliquias equipadas
  shop: ShopState | null;
  reward: RewardState | null;
  event: EventState | null;
  pendingBossRelics: number;
}
```

### Player

```typescript
interface Player {
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  maxEnergy: number;
  gold: number;
  deck: Card[];             // Draw pile (durante combate)
  hand: Card[];
  piles: PlayerPiles;       // { discard, exhaust }
  statusEffects: StatusEffect[];
}
```

### Card

```typescript
type CardType = 'attack' | 'skill' | 'power';
type CardRarity = 'basic' | 'common' | 'uncommon' | 'rare';

interface Card {
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  cost: number;
  description: string;
  upgraded: boolean;
  effects: CardEffect[];    // Discriminated union de efectos
}
```

**Tipos de efecto de carta:**

| Tipo | Campos | Descripción |
|---|---|---|
| `damage` | `value`, `times?`, `target?` | Inflige daño |
| `block` | `value` | Gana bloqueo |
| `apply-status` | `target`, `status`, `stacks` | Aplica efecto de estado |
| `draw` | `value` | Roba cartas |
| `gain-energy` | `value` | Gana energía |
| `lose-hp` | `value` | Pierde HP (ignora bloqueo) |
| `exhaust-self` | — | La carta se exhausta al jugarse |

### CombatState

```typescript
interface CombatState {
  player: Player;
  enemies: EnemyInstance[];
  turn: number;             // 1-based
  phase: TurnPhase;         // 'player-turn' | 'enemy-turn' | 'combat-end-victory' | 'combat-end-defeat'
  cardsPlayedThisTurn: Card[];
  damageDealt: number;      // Daño del último efecto (para animaciones)
}
```

### EnemyInstance y EnemyDefinition

La **definición estática** (`EnemyDefinition`) describe el enemigo como dato (HP, patrón de comportamiento, efecto de muerte). La **instancia** (`EnemyInstance`) es el estado vivo durante un combate.

```typescript
interface EnemyDefinition {
  id: string;
  name: string;
  tier: EnemyTier;          // 'normal' | 'elite' | 'boss'
  baseHp: HpRange;         // { min, max } — se randomiza al instanciar
  pattern: EnemyPattern;
  onDeath?: DeathEffect;
}

interface EnemyInstance {
  definitionId: string;
  hp: number;
  maxHp: number;
  block: number;
  statusEffects: StatusEffect[];
  currentIntent: Intent | null;
  aiState: EnemyAiState;    // { turnCount, sequenceIndex, lastMoves, currentPhase }
}
```

### Patrones de comportamiento enemigo (`EnemyPattern`)

Los enemigos usan uno de cuatro patrones de IA:

| Patrón | Descripción |
|---|---|
| `CyclicPattern` | Rotación fija de intents que se repite en bucle |
| `WeightedRandomPattern` | Selección aleatoria con pesos y restricción de repetición máxima |
| `ConditionalPattern` | Árbol de decisiones basado en condiciones del combate |
| `PhasedPattern` | Envuelve otros patrones con transiciones entre fases según condiciones |

### StatusEffect

```typescript
type StatusCategory = 'buff' | 'debuff' | 'neutral';

interface StatusEffect {
  type: StatusType;
  stacks: number;
  pendingStacks?: number;
}
```

Hay ~30 tipos de estado agrupados en debuffs (vulnerable, weak, frail, poison, burn...), buffs ofensivos (strength, thorns, enrage, ritual...), buffs defensivos (dexterity, metallicize, barricade...) y buffs especiales (intangible, artifact, corruption...).

### GameMap y MapNode

```typescript
interface GameMap {
  nodes: ReadonlyMap<string, MapNode>;
  currentNodeId: string | null;
  act: number;
  bossId: string;
}

interface MapNode {
  id: string;               // formato "row-col"
  row: number;
  col: number;
  type: NodeType;           // 'combat' | 'elite' | 'rest' | 'shop' | 'treasure' | 'event' | 'boss'
  connections: string[];
  visited: boolean;
}
```

### Otros modelos

- **RewardState**: `{ cardOptions: Card[], gold: number }` — Recompensa tras combate.
- **ShopState**: `{ items: ShopItem[], purgePrice: number, purgeCount: number }` — Estado de la tienda.
- **EventState**: `{ event: GameEvent, chosenId: string | null }` — Evento narrativo activo.
- **GameStats**: Estadísticas persistentes entre runs (partidas, victorias, piso máximo, etc.).

---

## Servicios de dominio (`domain/services/`)

Clases TypeScript puro, sin estado interno mutable. Reciben estado y retornan nuevo estado.

### CombatEngine

Motor central de combate. Métodos principales:

| Método | Descripción |
|---|---|
| `initCombat(player, enemies, rng)` | Construye el CombatState inicial (baraja, roba 5 cartas) |
| `resolveCardEffects(card, targetIdx, combat, rng)` | Aplica todos los efectos de una carta |
| `calculateDamage(base, attackerEffects, targetEffects)` | Calcula daño con strength, weak, vulnerable, intangible |
| `calculateBlock(base, playerEffects)` | Calcula bloqueo con dexterity y frail |
| `tickStatusEffects(combat, target, phase)` | Procesa efectos de turno (poison, burn, regen, etc.) |
| `processPlayerTurn(combat, rng)` | Inicio de turno: reset block, restore energy, draw |
| `processEnemyTurn(combat)` | Inicio de turno enemigo: descarta mano, tick status |
| `checkWinLoseConditions(combat)` | Evalúa victoria/derrota |

### DeckManager

Gestiona las cuatro pilas de cartas: draw pile, hand, discard, exhaust.

| Método | Descripción |
|---|---|
| `shuffle(cards, rng)` | Fisher-Yates con SeededRandom |
| `drawCards(state, count, rng)` | Roba N cartas (reshufflea discard si draw pile se vacía) |
| `discardCard(state, card)` | Mueve carta de hand a discard |
| `exhaustCard(state, card)` | Mueve carta de hand a exhaust |
| `addCard / removeCard / upgradeCard` | Operaciones sobre el mazo maestro (fuera de combate) |

### EnemyAI

Resuelve el comportamiento de los enemigos.

| Método | Descripción |
|---|---|
| `getNextIntent(enemy, pattern, context)` | Elige el próximo intent según la estrategia y avanza el aiState |
| `resolveIntent(enemy, intent, player)` | Aplica las acciones del intent (daño, bloqueo, buffs, debuffs, heal, split) |

### MapGenerator

Genera mapas procedurales tipo Slay the Spire con 15 filas y 7 columnas.

| Método | Descripción |
|---|---|
| `generateMap(act, rng, bossId)` | Genera un mapa completo (4 fases: paths → no-cross → merge → assign types) |
| `getReachableNodes(map)` | Nodos accesibles desde la posición actual |
| `moveToNode(map, nodeId)` | Mueve al jugador (marca visitado, actualiza currentNodeId) |

### RewardGenerator

Genera recompensas post-combate (cartas y oro).

| Método | Descripción |
|---|---|
| `generateCardRewards(tier, act, rng)` | Selecciona 3-4 cartas con pesos de rareza por acto |
| `calculateGoldReward(tier, act, rng)` | Oro aleatorio escalado por tier y acto |

### ShopManager

Gestiona la tienda: ofertas, compras y purga de cartas.

| Método | Descripción |
|---|---|
| `generateOfferings(cardPool, relicPool, ownedRelics, rng)` | Genera 3 cartas + 2 reliquias con precios |
| `purchaseCard(itemId, shop, player)` | Compra una carta (descuenta oro, marca vendida) |
| `removeCardFromDeck(cardIdx, player, shop)` | Purga una carta del mazo (coste incremental) |

### SeededRandom

PRNG determinista basado en el algoritmo mulberry32.

| Método | Descripción |
|---|---|
| `next()` | Float en [0, 1) |
| `nextInt(min, max)` | Entero en [min, max] inclusive |
| `nextFloat(min, max)` | Float en [min, max) |
| `weightedChoice(items)` | Selección ponderada |

---

## Datos estáticos (`domain/data/`)

| Archivo | Contenido |
|---|---|
| `cards.data.ts` | Catálogo de ~33 cartas (13 ataques, 12 habilidades, 8 poderes) + mazo inicial (5× Strike + 4× Defend) |
| `enemies.data.ts` | ~12 definiciones de enemigos con patrones de IA completos |
| `encounters.data.ts` | Pools de encuentros por acto (1-3) y tipo (combat, elite, boss) con pesos |
| `events.data.ts` | 6 eventos narrativos + evento especial de primer nodo ("Pacto de Origen") con 3 categorías de elección |
| `relics.data.ts` | Pool de ~29 IDs de reliquias |
