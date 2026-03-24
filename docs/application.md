# Capa de Aplicación

Los casos de uso orquestan servicios de dominio y puertos de salida. Cada uno implementa un puerto inbound definido en `domain/ports/inbound/`.

## Convenciones

- Reciben `GameState` y retornan `Promise<GameState>` con el nuevo estado.
- No mutan el estado recibido; siempre producen un nuevo snapshot.
- Instancian servicios de dominio en el constructor (inyección manual).
- Las dependencias de infraestructura se reciben como puertos outbound (interfaces).
- Se testean con Jasmine puro (spies para puertos outbound, instancias reales de servicios de dominio).

## Casos de uso

### NewGameUseCaseImpl

Crea una nueva run: genera seed, inicializa el jugador con 80 HP y 3 de energía, asigna el mazo inicial (5× Strike + 4× Defend), genera el mapa del acto 1 y posiciona la fase en `'map'`.

**Dependencias**: `MapGenerator`

### StartCombatUseCaseImpl

Prepara un combate a partir del nodo actual del mapa. Selecciona el encuentro del pool correspondiente (acto + tipo de nodo), instancia a los enemigos con HP aleatorio, calcula sus intents iniciales y delega la inicialización al `CombatEngine`.

**Dependencias**: `CombatEngine`, `EnemyAI`

### PlayCardUseCaseImpl

Juega una carta de la mano. Valida que el jugador tiene energía suficiente, delega la resolución de efectos a `CombatEngine`, anima el resultado vía `CombatRendererPort` y evalúa las condiciones de victoria/derrota.

El callback `onCombatCommitted` permite que la UI refleje el nuevo estado de la mano y la energía antes de que las animaciones terminen, evitando que las cartas "floten" en la mano mientras se reproduce la animación.

**Dependencias**: `CombatEngine`, `CombatRendererPort`

### EndTurnUseCaseImpl

Finaliza el turno del jugador y ejecuta el turno enemigo completo:

1. `CombatEngine.processEnemyTurn()` — descarte de mano, tick de status del jugador.
2. Para cada enemigo vivo: `EnemyAI.resolveIntent()` — aplica acciones del intent (daño, bloqueo, buffs).
3. Maneja efectos de muerte (`split` → instanciar nuevos enemigos, `summon`).
4. Anima los resultados vía `CombatRendererPort`.
5. `EnemyAI.getNextIntent()` — calcula el próximo intent visible.
6. `CombatEngine.processPlayerTurn()` — reset block, restore energy, draw.
7. Evalúa victoria/derrota.

**Dependencias**: `CombatEngine`, `EnemyAI`, `CombatRendererPort`

### NavigateMapUseCaseImpl

Mueve al jugador a un nodo accesible del mapa. Según el tipo de nodo:

- `combat` / `elite`: transiciona a fase `'combat'` (el combate se inicia por separado).
- `boss`: transiciona a fase `'combat'`.
- `shop`: genera las ofertas de tienda y transiciona a fase `'shop'`.
- `rest`: transiciona a fase `'rest'`.
- `event`: selecciona un evento aleatorio y transiciona a fase `'event'`.
- `treasure`: genera recompensa directa.

Persiste el estado tras la navegación.

**Dependencias**: `MapGenerator`, `GameRepository`

### ShopUseCaseImpl

Expone 3 métodos:

- `buyCard(itemId, state)` — Compra una carta de la tienda.
- `purgeCard(cardIdx, state)` — Elimina una carta del mazo (coste incremental: 75, 100, 125...).
- `buyRelic(itemId, state)` — Compra una reliquia.

**Dependencias**: `ShopManager`

### RestUseCaseImpl

Expone 2 métodos:

- `rest(state)` — Recupera el 30% del HP máximo.
- `smith(cardIdx, state)` — Mejora una carta del mazo.

### CollectRewardUseCaseImpl

Gestiona la pantalla de recompensa post-combate:

- `pickCard(card, state)` — Añade la carta al mazo y vuelve al mapa.
- `skip(state)` — Ignora las cartas y vuelve al mapa.

Ambos métodos suman el oro de la recompensa al jugador.

### SaveGameUseCaseImpl / LoadGameUseCaseImpl

Persistencia de la partida activa vía `GameRepository`.

- `SaveGameUseCaseImpl.execute(state)` — Serializa el estado completo a IndexedDB.
- `LoadGameUseCaseImpl.execute()` — Recupera el último estado guardado (o null).

**Dependencias**: `GameRepository`

### ResolveEventUseCaseImpl

Aplica los efectos de la elección del jugador en un evento narrativo (ganar/perder oro, HP, HP máximo, reliquias post-boss). Actualiza `EventState.chosenId` para que la UI muestre el resultado narrativo.

**Dependencias**: `GameRepository`
