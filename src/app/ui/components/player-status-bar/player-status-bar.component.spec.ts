import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { PlayerStatusBarComponent } from './player-status-bar.component';
import { GameStateStore } from '../../game-state.store';
import type { Player } from '../../../domain/models/player.model';
import type { CombatState } from '../../../domain/models/combat.model';
import type { StatusEffect } from '../../../domain/models/status-effect.model';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    hp: 70,
    maxHp: 80,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 0,
    deck: [],
    hand: [],
    piles: { discard: [], exhaust: [] },
    statusEffects: [],
    ...overrides,
  };
}

function makeCombatState(player: Player): CombatState {
  return {
    player,
    enemies: [],
    turn: 1,
    phase: 'player-turn',
    cardsPlayedThisTurn: [],
    damageDealt: 0,
  };
}

// ---------------------------------------------------------------------------
// Mock del store
// ---------------------------------------------------------------------------

function buildMockStore(overrides: {
  player?: Player;
  combat?: CombatState | null;
  gold?: number;
  floor?: number;
  act?: number;
  relics?: string[];
  phase?: string;
} = {}) {
  const playerSig  = signal<Player>(overrides.player  ?? makePlayer());
  const combatSig  = signal<CombatState | null>(overrides.combat  ?? null);
  const goldSig    = signal<number>(overrides.gold    ?? 150);
  const floorSig   = signal<number>(overrides.floor   ?? 3);
  const actSig     = signal<number>(overrides.act     ?? 1);
  const relicsSig  = signal<string[]>(overrides.relics ?? []);
  const phaseSig   = signal<string>(overrides.phase   ?? 'map');

  const store = {
    player: playerSig,
    combat: combatSig,
    gold:   goldSig,
    floor:  floorSig,
    act:    actSig,
    relics: relicsSig,
    phase:  phaseSig,
  };

  return { store, playerSig, combatSig, goldSig, floorSig, actSig, relicsSig, phaseSig };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlayerStatusBarComponent', () => {
  let fixture: ComponentFixture<PlayerStatusBarComponent>;
  let component: PlayerStatusBarComponent;
  let playerSig: ReturnType<typeof signal<Player>>;
  let combatSig: ReturnType<typeof signal<CombatState | null>>;
  let phaseSig:  ReturnType<typeof signal<string>>;
  let relicsSig: ReturnType<typeof signal<string[]>>;

  beforeEach(async () => {
    const built = buildMockStore();
    playerSig = built.playerSig;
    combatSig = built.combatSig;
    phaseSig  = built.phaseSig;
    relicsSig = built.relicsSig;

    await TestBed.configureTestingModule({
      imports: [PlayerStatusBarComponent],
      providers: [{ provide: GameStateStore, useValue: built.store }],
    }).compileComponents();

    fixture   = TestBed.createComponent(PlayerStatusBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── hpPercent ─────────────────────────────────────────────────────────────

  it('hpPercent devuelve 100 cuando hp === maxHp', () => {
    playerSig.set(makePlayer({ hp: 80, maxHp: 80 }));
    expect(component.hpPercent()).toBe(100);
  });

  it('hpPercent devuelve 50 cuando hp es la mitad de maxHp', () => {
    playerSig.set(makePlayer({ hp: 40, maxHp: 80 }));
    expect(component.hpPercent()).toBe(50);
  });

  it('hpPercent devuelve 0 cuando maxHp es 0', () => {
    playerSig.set(makePlayer({ hp: 0, maxHp: 0 }));
    expect(component.hpPercent()).toBe(0);
  });

  // ── hpColorClass ──────────────────────────────────────────────────────────

  it('hpColorClass devuelve hp-high cuando HP > 60%', () => {
    playerSig.set(makePlayer({ hp: 65, maxHp: 80 }));
    expect(component.hpColorClass()).toBe('hp-high');
  });

  it('hpColorClass devuelve hp-medium cuando HP está entre 30% y 60%', () => {
    playerSig.set(makePlayer({ hp: 36, maxHp: 80 }));
    expect(component.hpColorClass()).toBe('hp-medium');
  });

  it('hpColorClass devuelve hp-low cuando HP <= 30%', () => {
    playerSig.set(makePlayer({ hp: 20, maxHp: 80 }));
    expect(component.hpColorClass()).toBe('hp-low');
  });

  // ── showBlock ─────────────────────────────────────────────────────────────

  it('showBlock es false fuera del combate cuando block === 0', () => {
    phaseSig.set('map');
    playerSig.set(makePlayer({ block: 0 }));
    expect(component.showBlock()).toBeFalse();
  });

  it('showBlock es true fuera del combate cuando block > 0', () => {
    phaseSig.set('map');
    playerSig.set(makePlayer({ block: 5 }));
    expect(component.showBlock()).toBeTrue();
  });

  it('showBlock es true durante el combate aunque block === 0', () => {
    phaseSig.set('combat');
    combatSig.set(makeCombatState(makePlayer({ block: 0 })));
    expect(component.showBlock()).toBeTrue();
  });

  it('showBlock es true durante el combate cuando block > 0', () => {
    phaseSig.set('combat');
    combatSig.set(makeCombatState(makePlayer({ block: 8 })));
    expect(component.showBlock()).toBeTrue();
  });

  // ── showEnergy ────────────────────────────────────────────────────────────

  it('showEnergy es false en la fase map', () => {
    phaseSig.set('map');
    expect(component.showEnergy()).toBeFalse();
  });

  it('showEnergy es true en la fase combat', () => {
    phaseSig.set('combat');
    expect(component.showEnergy()).toBeTrue();
  });

  it('showEnergy es false en la fase shop', () => {
    phaseSig.set('shop');
    expect(component.showEnergy()).toBeFalse();
  });

  // ── activeBuffs / activeDebuffs ───────────────────────────────────────────

  it('activeBuffs filtra solo los efectos con categoría buff', () => {
    const effects: StatusEffect[] = [
      { type: 'strength', stacks: 3 },
      { type: 'vulnerable', stacks: 2 },
    ];
    playerSig.set(makePlayer({ statusEffects: effects }));
    const buffs = component.activeBuffs();
    expect(buffs.length).toBe(1);
    expect(buffs[0].type).toBe('strength');
  });

  it('activeDebuffs filtra solo los efectos con categoría debuff', () => {
    const effects: StatusEffect[] = [
      { type: 'strength', stacks: 3 },
      { type: 'vulnerable', stacks: 2 },
      { type: 'weak', stacks: 1 },
    ];
    playerSig.set(makePlayer({ statusEffects: effects }));
    const debuffs = component.activeDebuffs();
    expect(debuffs.length).toBe(2);
    expect(debuffs.map(e => e.type)).toContain('vulnerable');
    expect(debuffs.map(e => e.type)).toContain('weak');
  });

  it('activeBuffs devuelve vacío si no hay efectos', () => {
    playerSig.set(makePlayer({ statusEffects: [] }));
    expect(component.activeBuffs().length).toBe(0);
  });

  // ── statusName ────────────────────────────────────────────────────────────

  it('statusName devuelve el nombre visible del efecto', () => {
    const effect: StatusEffect = { type: 'strength', stacks: 2 };
    expect(component.statusName(effect)).toBe('Fuerza');
  });

  it('statusName devuelve el type como fallback para efectos desconocidos', () => {
    const effect = { type: 'unknown-effect' as never, stacks: 1 };
    expect(component.statusName(effect)).toBe('unknown-effect');
  });

  // ── Template: bloque de HP siempre visible ────────────────────────────────

  it('debe renderizar el grupo de HP', () => {
    const hpGroup = fixture.debugElement.query(By.css('.hp-group'));
    expect(hpGroup).toBeTruthy();
  });

  it('la barra de HP refleja el porcentaje correcto como width%', () => {
    playerSig.set(makePlayer({ hp: 40, maxHp: 80 }));
    fixture.detectChanges();
    const fill = fixture.debugElement.query(By.css('.hp-bar__fill'));
    expect(fill.styles['width']).toBe('50%');
  });

  // ── Template: chip de bloqueo ─────────────────────────────────────────────

  it('no muestra el chip de bloqueo fuera del combate cuando block === 0', () => {
    phaseSig.set('map');
    playerSig.set(makePlayer({ block: 0 }));
    fixture.detectChanges();
    const blockChip = fixture.debugElement.query(By.css('.stat-chip--block'));
    expect(blockChip).toBeNull();
  });

  it('muestra el chip de bloqueo fuera del combate cuando block > 0', () => {
    phaseSig.set('map');
    playerSig.set(makePlayer({ block: 8 }));
    fixture.detectChanges();
    const blockChip = fixture.debugElement.query(By.css('.stat-chip--block'));
    expect(blockChip).toBeTruthy();
    expect(blockChip.nativeElement.textContent).toContain('8');
  });

  it('muestra el chip de bloqueo durante el combate aunque sea 0', () => {
    phaseSig.set('combat');
    combatSig.set(makeCombatState(makePlayer({ block: 0 })));
    fixture.detectChanges();
    const blockChip = fixture.debugElement.query(By.css('.stat-chip--block'));
    expect(blockChip).toBeTruthy();
    expect(blockChip.nativeElement.textContent).toContain('0');
  });

  // ── Template: chip de energía ─────────────────────────────────────────────

  it('no muestra el chip de energía fuera del combate', () => {
    phaseSig.set('map');
    fixture.detectChanges();
    const energyChip = fixture.debugElement.query(By.css('.stat-chip--energy'));
    expect(energyChip).toBeNull();
  });

  it('muestra el chip de energía durante el combate', () => {
    phaseSig.set('combat');
    fixture.detectChanges();
    const energyChip = fixture.debugElement.query(By.css('.stat-chip--energy'));
    expect(energyChip).toBeTruthy();
  });

  // ── Template: reliquias ────────────────────────────────────────────────────

  it('no muestra la lista de reliquias cuando está vacía', () => {
    relicsSig.set([]);
    fixture.detectChanges();
    const relicsList = fixture.debugElement.query(By.css('.relics-list'));
    expect(relicsList).toBeNull();
  });

  it('muestra una reliquias chip por cada reliquia equipada', () => {
    relicsSig.set(['burning-blood', 'ring-of-snake']);
    fixture.detectChanges();
    const chips = fixture.debugElement.queryAll(By.css('.relic-chip'));
    expect(chips.length).toBe(2);
  });

  // ── player: fuente durante combate ────────────────────────────────────────

  it('usa store.player cuando no hay combate activo', () => {
    playerSig.set(makePlayer({ hp: 55, maxHp: 80 }));
    combatSig.set(null);
    expect(component.player().hp).toBe(55);
  });

  it('usa combat.player cuando hay combate activo', () => {
    playerSig.set(makePlayer({ hp: 55, maxHp: 80 }));
    combatSig.set(makeCombatState(makePlayer({ hp: 20, maxHp: 80 })));
    expect(component.player().hp).toBe(20);
  });

  it('hpPercent refleja el HP de combat.player durante el combate', () => {
    combatSig.set(makeCombatState(makePlayer({ hp: 40, maxHp: 80 })));
    expect(component.hpPercent()).toBe(50);
  });

  it('la barra de HP se actualiza al cambiar combat.player.hp', () => {
    combatSig.set(makeCombatState(makePlayer({ hp: 40, maxHp: 80 })));
    fixture.detectChanges();
    const fill = fixture.debugElement.query(By.css('.hp-bar__fill'));
    expect(fill.styles['width']).toBe('50%');

    combatSig.set(makeCombatState(makePlayer({ hp: 20, maxHp: 80 })));
    fixture.detectChanges();
    expect(fill.styles['width']).toBe('25%');
  });

  // ── Menú rápido: opciones ────────────────────────────────────────────────

  it('muestra la opción "Opciones" habilitada en el menú rápido', () => {
    component.toggleMenu();
    fixture.detectChanges();
    const buttons = fixture.debugElement.queryAll(By.css('.status-menu__item'));
    const opcionesBtn = buttons.find(btn => btn.nativeElement.textContent.includes('Opciones'));
    expect(opcionesBtn).toBeTruthy();
    expect(opcionesBtn?.nativeElement.disabled).toBeFalse();
  });

  it('abre el modal de opciones desde el menú rápido', () => {
    component.toggleMenu();
    fixture.detectChanges();
    const buttons = fixture.debugElement.queryAll(By.css('.status-menu__item'));
    const opcionesBtn = buttons.find(btn => btn.nativeElement.textContent.includes('Opciones'));
    opcionesBtn?.nativeElement.click();
    fixture.detectChanges();

    const optionsModal = fixture.debugElement.query(By.css('.status-menu-options'));
    expect(optionsModal).toBeTruthy();
  });

  it('renderiza 3 sliders de audio en el modal de opciones', () => {
    component.openOptions();
    fixture.detectChanges();
    const audioSection = fixture.debugElement.query(By.css('.status-menu-options__section'));
    const sliders = audioSection.queryAll(By.css('input[type="range"]'));
    expect(sliders.length).toBe(3);
  });

  it('muestra accesibilidad desactivada en el modal de opciones', () => {
    component.openOptions();
    fixture.detectChanges();
    const disabledSection = fixture.debugElement.query(By.css('.status-menu-options__section--disabled'));
    expect(disabledSection).toBeTruthy();
    expect(disabledSection.nativeElement.hasAttribute('disabled')).toBeTrue();
  });
});
