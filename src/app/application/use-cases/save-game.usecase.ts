import type { GameState } from '../../domain/models/game-state.model';
import type { SaveGameUseCase } from '../../domain/ports/inbound/save-game.usecase';
import type { GameRepository } from '../../domain/ports/outbound/game-repository.port';

/**
 * Delega la persistencia del estado completo de la run al puerto GameRepository.
 * No realiza ninguna transformación: el estado se almacena tal cual.
 */
export class SaveGameUseCaseImpl implements SaveGameUseCase {
  constructor(private readonly repository: GameRepository) {}

  async execute(state: GameState): Promise<void> {
    await this.repository.save(state);
  }
}
