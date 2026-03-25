# Capa de Infraestructura

Los adaptadores driven implementan los puertos outbound definidos en `domain/ports/outbound/`. Pueden importar modelos y puertos del dominio, pero nunca de `application/` ni `ui/`.

## IndexedDbGameRepository

**Puerto**: `GameRepository`
**Ubicación**: `infrastructure/persistence/indexed-db-game-repository.ts`

Adaptador de persistencia que usa IndexedDB a través de la librería `idb` (acceso tipado).

### Esquema de la base de datos

| Store | Clave | Valor | Descripción |
|---|---|---|---|
| `saves` | `'active-save'` (fija) | `GameState` | Partida activa (una sola entrada) |
| `stats` | `'stats'` (fija) | `GameStats` | Estadísticas acumuladas entre runs |

### Métodos

| Método | Descripción |
|---|---|
| `save(state)` | Persiste el GameState completo |
| `load()` | Recupera el último guardado (null si no existe) |
| `deleteSave()` | Elimina el guardado activo (al morir o ganar) |
| `getStats()` | Recupera estadísticas globales (devuelve defaults si no existen) |
| `updateStats(partial)` | Merge parcial de estadísticas |

### Detalles de implementación

- **Lazy singleton**: la conexión a la DB se abre solo la primera vez que se necesita y se reutiliza.
- **Migración**: el callback `upgrade` crea los object stores si no existen (versión 1).
- **Nombre de la DB**: `scrape-roguelike`, versión `1`.

---

## CanvasCombatRenderer

**Puerto**: `CombatRendererPort`
**Ubicación**: `infrastructure/canvas/canvas-combat-renderer.ts`

Adaptador de renderizado que usa Canvas 2D para dibujar la escena de combate. El dibujo por defecto sigue siendo geométrico (`sprite-helpers.ts`); los **sprites en imagen** viven en `public/sprites/` (ver convención spritesheet + `.manifest.json` en la regla `infrastructure-adapters.mdc` y el modelo `SpriteAtlasManifest`).

### Ciclo de vida

1. Angular crea la instancia vía DI.
2. El componente `CombatViewComponent` llama a `attachCanvas(canvasEl)` en `ngAfterViewInit`.
3. El render loop arranca con `requestAnimationFrame` (~60 FPS).
4. El componente llama a `detachCanvas()` en `ngOnDestroy`.

### Métodos del puerto

| Método | Duración | Descripción |
|---|---|---|
| `renderScene(combat)` | Síncrono | Actualiza el estado de combate que se pinta en cada frame |
| `animateDamage(targetIdx, amount)` | ~320 ms | Flash blanco + chispas rojas + número flotante + screen shake |
| `animateBlock(targetIdx, amount)` | ~260 ms | Chispas azules + número flotante |
| `animateDeath(targetIdx)` | ~800 ms | Flash intenso + shockwave + explosión de partículas + desvanecimiento |
| `animateCardPlay(card)` | ~180 ms | Chispas coloreadas según tipo (rojo/azul/naranja) |

### Efectos visuales

- **ParticleSystem** (`particles.ts`): sistema de partículas para chispas, números flotantes, ondas de choque y explosiones de muerte.
- **Sprite helpers** (`sprite-helpers.ts`): funciones para dibujar cuerpos de jugador/enemigo, barras de HP, badges de bloqueo, orbes de energía, iconos de intent y efectos de estado.
- **Atlas de combate** (`sprite-atlas-paths.ts`): URLs bajo `/sprites/...`; manifiestos validables con `isSpriteAtlasManifest` en dominio.
- **Screen shake**: oscilación sinusoidal con decaimiento exponencial + ruido aleatorio.
- **Damage flash**: gradiente radial blanco con fade-out cuadrático.
- **Shockwave**: anillo expansivo con fade-out.

### Posicionamiento

- **Jugador**: 17% del ancho, 40% del alto.
- **Enemigos**: distribuidos entre 42%-90% del ancho en la mitad derecha de la escena.
- `targetIdx = 0` → jugador; `targetIdx >= 1` → enemigo (índice + 1).

### Escena

```
┌─────────────────────────────────────────────────┐
│  Fondo degradado oscuro (#06060f → #1a1a2e)     │
│                                                   │
│         [Intent icons]                            │
│                                                   │
│  [Jugador]        [Enemigo 1]  [Enemigo 2]  ...  │
│  (cuerpo)         (cuerpo)     (cuerpo)           │
│  [HP bar]         [HP bar]     [HP bar]           │
│  [Energy orbs]    [Status]     [Status]           │
│  [Status]                                         │
│                                                   │
│  ──── línea de suelo ────                         │
│  (gradiente tenue)                                │
│                                                   │
│            ┌──────────────┐                       │
│            │ Tu turno     │                       │
│            └──────────────┘                       │
└─────────────────────────────────────────────────┘
```
