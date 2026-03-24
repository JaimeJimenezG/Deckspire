# Capa UI

La capa UI contiene los adaptadores driving: componentes Angular, el store reactivo y la configuración de inyección de dependencias.

## Convenciones de componentes

- **Standalone**: todos usan `standalone: true`. No hay NgModules.
- **OnPush**: siempre `changeDetection: ChangeDetectionStrategy.OnPush`.
- **`inject()`**: función `inject()` en vez de constructor injection.
- **Signals**: `signal()`, `computed()` y `effect()` para estado reactivo.
- **Control flow**: `@if`, `@for`, `@switch` en templates (no directivas estructurales legacy).
- **Sin lógica de negocio**: toda lógica vive en `domain/services/`. Los componentes solo presentan datos y delegan acciones al `GameStateStore`.

## GameStateStore

**Ubicación**: `ui/game-state.store.ts`

Servicio Angular `@Injectable({ providedIn: 'root' })` que actúa como fachada reactiva entre la UI y los casos de uso.

### Responsabilidades

1. Mantiene el estado global en un signal central (`_state: Signal<GameState>`).
2. Expone signals derivados (`computed()`) para que los componentes lean solo la porción que necesitan.
3. Delega toda la lógica a los use cases inyectados.
4. Cada acción pública actualiza `_state` con el nuevo estado devuelto por el use case.

### Signals expuestos

| Signal | Tipo | Descripción |
|---|---|---|
| `phase` | `GamePhase` | Fase actual del juego |
| `player` | `Player` | Estado del jugador |
| `combat` | `CombatState \| null` | Combate activo |
| `map` | `GameMap \| null` | Mapa del acto actual |
| `deck` | `Card[]` | Mazo maestro |
| `gold` | `number` | Oro acumulado |
| `floor` | `number` | Piso actual |
| `act` | `number` | Acto actual (1-3) |
| `relics` | `string[]` | IDs de reliquias |
| `shop` | `ShopState \| null` | Tienda activa |
| `reward` | `RewardState \| null` | Recompensa activa |
| `event` | `EventState \| null` | Evento activo |
| `gameOutcome` | `GameOutcome` | Resultado de la run |
| `deckViewerOpen` | `boolean` | Visibilidad del visor de mazo |

### Acciones públicas

| Método | Descripción |
|---|---|
| `newGame(seed?)` | Inicia nueva run |
| `startCombat()` | Inicia combate del nodo actual |
| `playCard(card, targetIdx)` | Juega una carta |
| `endTurn()` | Finaliza turno del jugador |
| `navigateToNode(nodeId)` | Navega a un nodo del mapa |
| `buyCard(itemId)` | Compra carta en tienda |
| `purgeCard(cardIdx)` | Purga carta del mazo |
| `buyRelic(itemId)` | Compra reliquia |
| `rest()` | Descansar en hoguera |
| `smith(cardIdx)` | Mejorar carta en hoguera |
| `leaveRestSite()` | Abandonar hoguera |
| `resolveEvent(choiceId)` | Elegir opción de evento |
| `leaveEvent()` | Abandonar evento |
| `leaveShop()` | Abandonar tienda |
| `pickRewardCard(card)` | Elegir carta de recompensa |
| `skipReward()` | Omitir recompensa |
| `collectCombatReward()` | Generar recompensa de combate |
| `declareGameOver(outcome)` | Registrar fin de run (victoria/derrota) |
| `returnToMenu()` | Volver al menú principal |
| `saveGame()` | Guardar partida |
| `loadGame()` | Cargar partida guardada |
| `checkSavedGame()` | Comprobar si existe guardado |
| `getStats()` | Obtener estadísticas acumuladas |

---

## Componentes

### GameContainerComponent

Componente raíz del juego. Usa `@switch` sobre `store.phase()` para mostrar el componente correspondiente a la fase actual.

### MainMenuComponent

Pantalla de inicio con opciones:
- **Nueva partida**: llama a `store.newGame()`.
- **Continuar**: visible solo si existe guardado; llama a `store.loadGame()`.
- Muestra estadísticas acumuladas (partidas, victorias, piso máximo).

### MapViewComponent

Visualización del mapa procedural. Renderiza nodos como círculos conectados por líneas, coloreados según su tipo. Los nodos accesibles son clickeables y llaman a `store.navigateToNode(nodeId)`.

### CombatViewComponent

Vista de combate con:
- **Canvas** para el renderer (`CanvasCombatRenderer`).
- **Barra de estado del jugador** (`PlayerStatusBarComponent`).
- **Mano de cartas** (`HandComponent`).
- Botón **Fin de turno**.
- Detección de victoria/derrota para transicionar a recompensa o game over.

### HandComponent

Renderiza la mano del jugador como abanico de cartas con animaciones CSS:
- Hover: la carta se eleva y escala.
- Selección: la carta se destaca y los enemigos se vuelven clickeables.
- Drag & play: animación de salida al jugar una carta.

### CardComponent

Carta individual con diseño visual que muestra nombre, coste, descripción, tipo (ataque/habilidad/poder) y rareza con colores diferenciados.

### PlayerStatusBarComponent

Barra superior que muestra HP, bloqueo, energía, oro, reliquias y un botón para abrir el visor de mazo.

### DeckViewerComponent

Overlay modal que muestra todas las cartas del mazo maestro del jugador, categorizado por tipo.

### ShopComponent

Interfaz de tienda con:
- Cartas en venta (3 slots).
- Reliquias en venta (2 slots).
- Opción de purga de carta del mazo.
- Botón para abandonar la tienda.

### RestSiteComponent

Hoguera con dos opciones:
- **Descansar**: recuperar 30% del HP máximo.
- **Mejorar**: seleccionar una carta del mazo para mejorarla.

### RewardComponent

Pantalla de recompensa post-combate que ofrece 3-4 opciones de carta (según tier) y muestra el oro ganado.

### EventViewComponent

Pantalla de evento narrativo con título, descripción, icono y botones de elección. Tras elegir, muestra el texto de resultado.

### GameOverComponent

Pantalla de fin de run que muestra el resultado (victoria/derrota), estadísticas de la run y botón para volver al menú.

---

## Inyección de dependencias

**Ubicación**: `ui/di/providers.ts`

Define `InjectionToken` para cada puerto y configura `GAME_PROVIDERS` con las implementaciones concretas usando `useFactory`. Este array se incluye en `appConfig.providers`.

Los servicios de dominio (`CombatEngine`, `DeckManager`, `EnemyAI`, etc.) se instancian dentro de los factories — no tienen tokens propios porque no son servicios Angular.
