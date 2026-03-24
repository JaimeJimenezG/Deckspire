import type { GameState } from '../../domain/models/game-state.model';
import type { LoadGameUseCase } from '../../domain/ports/inbound/load-game.usecase';
import type { GameRepository } from '../../domain/ports/outbound/game-repository.port';

/**
 * Recupera el estado completo de la run persistida a través del puerto GameRepository.
 * Retorna null si no existe ninguna partida guardada.
 */
export class LoadGameUseCaseImpl implements LoadGameUseCase {
  constructor(private readonly repository: GameRepository) {}

  async execute(): Promise<GameState | null> {
    return this.repository.load();
  }
}
