import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { GameStateStore } from '../../game-state.store';
import { STATUS_DEFINITIONS } from '../../../domain/models/status-effect.model';
import type { StatusEffect } from '../../../domain/models/status-effect.model';
import { RELIC_DEFINITIONS } from '../../../domain/data/relics.data';

/**
 * Barra de estado superior que muestra los recursos del jugador en todas las
 * fases de la run (excepto menú principal y game-over, controlado por el padre).
 *
 * Secciones:
 *  - Izquierda: HP (barra de progreso) + bloqueo activo
 *  - Centro: efectos de estado (buffs en verde, debuffs en rojo)
 *  - Derecha: energía (solo en combate), oro, planta/acto, reliquias
 */
@Component({
  selector: 'app-player-status-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './player-status-bar.component.html',
  styleUrl: './player-status-bar.component.scss',
})
export class PlayerStatusBarComponent {
  private readonly store = inject(GameStateStore);

  readonly gold   = this.store.gold;
  readonly floor  = this.store.floor;
  readonly act    = this.store.act;
  readonly relics = this.store.relics;
  readonly phase  = this.store.phase;

  /**
   * Durante el combate el estado del jugador (HP, energía, bloqueo) vive en
   * `combat.player` porque es ahí donde los use-cases aplican los cambios.
   * Fuera de combate se usa `state.player`.
   */
  readonly player = computed(() => this.store.combat()?.player ?? this.store.player());

  /** Porcentaje de HP para la barra de progreso (0–100). */
  readonly hpPercent = computed(() => {
    const p = this.player();
    return p.maxHp > 0 ? Math.round((p.hp / p.maxHp) * 100) : 0;
  });

  /** Clase de color para la barra de HP según nivel de vida. */
  readonly hpColorClass = computed<'hp-high' | 'hp-medium' | 'hp-low'>(() => {
    const pct = this.hpPercent();
    if (pct > 60) return 'hp-high';
    if (pct > 30) return 'hp-medium';
    return 'hp-low';
  });

  /**
   * Durante el combate el bloqueo siempre es visible (puede ser 0) para que
   * el jugador vea cuándo lo pierde al inicio del turno enemigo.
   * Fuera del combate solo se muestra si hay bloqueo activo.
   */
  readonly showBlock = computed(() =>
    this.phase() === 'combat' ? true : this.player().block > 0,
  );

  /** Mostrar energía solo durante el turno de combate. */
  readonly showEnergy = computed(() => this.phase() === 'combat');

  /** Efectos de estado beneficiosos activos en el jugador. */
  readonly activeBuffs = computed(() =>
    this.player().statusEffects.filter(
      (e: StatusEffect) => STATUS_DEFINITIONS[e.type]?.category === 'buff',
    ),
  );

  /** Efectos de estado perjudiciales activos en el jugador. */
  readonly activeDebuffs = computed(() =>
    this.player().statusEffects.filter(
      (e: StatusEffect) => STATUS_DEFINITIONS[e.type]?.category === 'debuff',
    ),
  );

  /** Nombre visible abreviado de un tipo de efecto. */
  statusName(effect: StatusEffect): string {
    return STATUS_DEFINITIONS[effect.type]?.name ?? effect.type;
  }

  private formatRelicName(relicId: string): string {
    return relicId
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private hookLabel(
    hook:
      | 'combat-start'
      | 'player-turn-start'
      | 'player-turn-end'
      | 'combat-end-victory'
      | 'map-node-enter'
      | 'rest-site-enter',
  ): string {
    switch (hook) {
      case 'combat-start':
        return 'Inicio de combate';
      case 'player-turn-start':
        return 'Inicio de turno';
      case 'player-turn-end':
        return 'Fin de turno';
      case 'combat-end-victory':
        return 'Victoria';
      case 'map-node-enter':
        return 'Al entrar en un nodo';
      case 'rest-site-enter':
        return 'Al entrar al descanso';
    }
  }

  private effectToText(
    effect: (typeof RELIC_DEFINITIONS)[string]['passiveHooks'][number]['effect'],
  ): string {
    switch (effect.type) {
      case 'gain-energy':
        return `Gana ${effect.value} energía`;
      case 'gain-block':
        return `Gana ${effect.value} de bloque`;
      case 'draw-cards':
        return `Roba ${effect.value} cartas`;
      case 'heal':
        return `Cura ${effect.value} HP`;
      case 'apply-status':
        return `Aplica estado ${effect.status} (${effect.stacks} cargas) a ti`;
      case 'modify-relic-reward-count': {
        const sign = effect.value >= 0 ? '+' : '';
        return `Modifica recompensas (${effect.target}): ${sign}${effect.value}`;
      }
    }
  }

  private relicTooltip(relicId: string): string {
    const def = RELIC_DEFINITIONS[relicId];
    if (!def) return relicId;

    const passiveLines = def.passiveHooks.map(
      h => `${this.hookLabel(h.hook)}: ${this.effectToText(h.effect)}`,
    );

    const abilitiesPart = passiveLines.length
      ? `\n\nHabilidades:\n${passiveLines.join('\n')}`
      : '\n\nSin habilidades pasivas definidas.';

    return `${def.name}\n${def.description}${abilitiesPart}`;
  }

  readonly relicChips = computed<
    readonly { id: string; name: string; tooltip: string }[]
  >(() =>
    this.relics().map(id => ({
      id,
      name: RELIC_DEFINITIONS[id]?.name ?? this.formatRelicName(id),
      tooltip: this.relicTooltip(id),
    })),
  );
}
