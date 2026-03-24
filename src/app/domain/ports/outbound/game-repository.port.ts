import type { GameState, GameStats } from '../../models/game-state.model';

/**
 * Puerto de salida para la persistencia del estado del juego.
 * Implementado por IndexedDbGameRepository en la capa infrastructure.
 */
export interface GameRepository {
  /** Persiste el estado completo de la run activa. */
  save(state: GameState): Promise<void>;

  /** Carga el último estado guardado. Retorna null si no existe guardado. */
  load(): Promise<GameState | null>;

  /** Elimina el guardado activo (e.g. al morir o iniciar nueva run). */
  deleteSave(): Promise<void>;

  /** Recupera las estadísticas acumuladas entre runs. */
  getStats(): Promise<GameStats>;

  /** Actualiza parcialmente las estadísticas acumuladas entre runs. */
  updateStats(stats: Partial<GameStats>): Promise<void>;
}

export const GAME_REPOSITORY = Symbol('GameRepository');
