import { openDB, type IDBPDatabase } from 'idb';
import type { GameRepository } from '../../domain/ports/outbound/game-repository.port';
import type { GameState, GameStats } from '../../domain/models/game-state.model';

// ---------------------------------------------------------------------------
// Constantes del esquema
// ---------------------------------------------------------------------------

const DB_NAME = 'scrape-roguelike';
const DB_VERSION = 1;

/** Clave fija bajo la que se almacena la partida activa. */
const SAVE_KEY = 'active-save';

/** Clave fija bajo la que se almacenan las estadísticas acumuladas. */
const STATS_KEY = 'stats';

const STORE_SAVES = 'saves';
const STORE_STATS = 'stats';

const DEFAULT_STATS: GameStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  highestFloorReached: 0,
  totalGoldEarned: 0,
  totalDamageDealt: 0,
};

// ---------------------------------------------------------------------------
// Tipo del esquema de la base de datos (tipado fuerte con idb)
// ---------------------------------------------------------------------------

interface RoguelikeDB {
  /** Store de la partida activa. Clave string, valor GameState serializado. */
  [STORE_SAVES]: {
    key: string;
    value: GameState;
  };
  /** Store de estadísticas globales. Clave string, valor GameStats serializado. */
  [STORE_STATS]: {
    key: string;
    value: GameStats;
  };
}

// ---------------------------------------------------------------------------
// Adaptador
// ---------------------------------------------------------------------------

/**
 * Adaptador driven que implementa GameRepository usando IndexedDB a través
 * de la librería `idb`. Toda la lógica de apertura/migración se encapsula
 * aquí; el dominio y la capa de aplicación permanecen ajenos a IndexedDB.
 *
 * Stores:
 *   - `saves`  → GameState de la partida activa (una sola entrada, clave fija).
 *   - `stats`  → GameStats acumuladas entre runs (una sola entrada, clave fija).
 */
export class IndexedDbGameRepository implements GameRepository {
  private dbPromise: Promise<IDBPDatabase<RoguelikeDB>> | null = null;

  // ── API pública (GameRepository port) ─────────────────────────────────────

  async save(state: GameState): Promise<void> {
    const db = await this.getDb();
    await db.put(STORE_SAVES, state, SAVE_KEY);
  }

  async load(): Promise<GameState | null> {
    const db = await this.getDb();
    return (await db.get(STORE_SAVES, SAVE_KEY)) ?? null;
  }

  async deleteSave(): Promise<void> {
    const db = await this.getDb();
    await db.delete(STORE_SAVES, SAVE_KEY);
  }

  async getStats(): Promise<GameStats> {
    const db = await this.getDb();
    return (await db.get(STORE_STATS, STATS_KEY)) ?? { ...DEFAULT_STATS };
  }

  async updateStats(partial: Partial<GameStats>): Promise<void> {
    const current = await this.getStats();
    const updated: GameStats = { ...current, ...partial };
    const db = await this.getDb();
    await db.put(STORE_STATS, updated, STATS_KEY);
  }

  // ── Inicialización lazy de la DB ──────────────────────────────────────────

  /**
   * Abre (o reutiliza) la conexión a la base de datos.
   * La apertura es lazy y singleton: solo se llama a `openDB` la primera vez.
   */
  private getDb(): Promise<IDBPDatabase<RoguelikeDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<RoguelikeDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_SAVES)) {
            db.createObjectStore(STORE_SAVES);
          }
          if (!db.objectStoreNames.contains(STORE_STATS)) {
            db.createObjectStore(STORE_STATS);
          }
        },
      });
    }
    return this.dbPromise;
  }
}
