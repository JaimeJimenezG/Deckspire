/**
 * Funciones puras de dibujo para entidades del combate.
 * Cada función recibe un contexto 2D y parámetros de posición/estado;
 * no tienen efecto secundario fuera del canvas.
 */
import type { IntentDisplay, IntentDisplayType } from '../../domain/models/enemy.model';
import type { StatusEffect } from '../../domain/models/status-effect.model';

// ---------------------------------------------------------------------------
// Constantes de paleta (dungeon theme)
// ---------------------------------------------------------------------------

const PALETTE = {
  bg: '#0a0a1a',
  hpHigh: '#2ecc71',
  hpMid: '#f39c12',
  hpLow: '#e74c3c',
  hpBg: '#1a1a2e',
  hpBorder: '#444',
  block: '#5dade2',
  blockBorder: '#2e86c1',
  text: '#ffffff',
  textDim: 'rgba(255,255,255,0.6)',
  intentAttack: '#e74c3c',
  intentDefend: '#3498db',
  intentBuff: '#f39c12',
  intentDebuff: '#9b59b6',
  intentAttackDebuff: '#e67e22',
  intentUnknown: '#7f8c8d',
  statusDebuff: '#8e44ad',
  statusBuff: '#d35400',
  statusNeutral: '#555',
  energyFilled: '#f39c12',
  energyEmpty: '#2c3e50',
  energyBorder: '#d68910',
} as const;

// ---------------------------------------------------------------------------
// HP Bar
// ---------------------------------------------------------------------------

/**
 * Dibuja una barra de HP con fondo, relleno degradado por porcentaje y borde.
 */
export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  hp: number,
  maxHp: number,
  showNumbers = true,
): void {
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const barColor =
    ratio > 0.5 ? PALETTE.hpHigh : ratio > 0.25 ? PALETTE.hpMid : PALETTE.hpLow;

  ctx.save();

  // Fondo
  ctx.fillStyle = PALETTE.hpBg;
  fillRoundRect(ctx, x, y, width, height, 3);

  // Relleno
  if (ratio > 0) {
    ctx.fillStyle = barColor;
    ctx.shadowColor = barColor;
    ctx.shadowBlur = 4;
    fillRoundRect(ctx, x, y, width * ratio, height, 3);
    ctx.shadowBlur = 0;
  }

  // Borde
  ctx.strokeStyle = PALETTE.hpBorder;
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, x, y, width, height, 3);

  if (showNumbers) {
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold ${Math.max(9, height - 3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(`${hp}/${maxHp}`, x + width / 2, y + height / 2);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Block Badge
// ---------------------------------------------------------------------------

/**
 * Dibuja un escudo circular con el valor de bloqueo.
 */
export function drawBlockBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  block: number,
): void {
  if (block <= 0) return;

  ctx.save();

  ctx.fillStyle = PALETTE.block;
  ctx.strokeStyle = PALETTE.blockBorder;
  ctx.shadowColor = PALETTE.block;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2;

  // Escudo (hexágono pequeño inclinado simula escudo)
  ctx.beginPath();
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x + 10, y - 7);
  ctx.lineTo(x + 10, y + 5);
  ctx.lineTo(x, y + 12);
  ctx.lineTo(x - 10, y + 5);
  ctx.lineTo(x - 10, y - 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(block), x, y + 1);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Status Effects row
// ---------------------------------------------------------------------------

const STATUS_CATEGORY_COLORS: Record<string, string> = {
  buff: PALETTE.statusBuff,
  debuff: PALETTE.statusDebuff,
  neutral: PALETTE.statusNeutral,
};

/** Abreviaturas de 2 letras para status effects. */
const STATUS_ABBR: Partial<Record<string, string>> = {
  vulnerable: 'VU',
  weak: 'WK',
  frail: 'FR',
  poison: 'PS',
  burn: 'BN',
  daze: 'DZ',
  shackled: 'SK',
  constricted: 'CO',
  slowness: 'SL',
  strength: 'ST',
  dexterity: 'DX',
  thorns: 'TH',
  enrage: 'EN',
  ritual: 'RT',
  regen: 'RG',
  metallicize: 'MT',
  barricade: 'BA',
  intangible: 'IN',
  artifact: 'AR',
  corruption: 'CR',
  combust: 'CB',
  juggernaut: 'JG',
  'fire-breathing': 'FB',
  'flame-barrier': 'FL',
  brutality: 'BR',
  evolve: 'EV',
  'feel-no-pain': 'FN',
};

/**
 * Dibuja una fila de insignias de estado (hasta 6 visibles).
 */
export function drawStatusEffects(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  statusEffects: readonly StatusEffect[],
  maxVisible = 6,
): void {
  if (statusEffects.length === 0) return;

  const SIZE = 18;
  const GAP = 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  statusEffects.slice(0, maxVisible).forEach((se, i) => {
    const sx = x + i * (SIZE + GAP);
    const color = STATUS_CATEGORY_COLORS[getStatusCategory(se.type)] ?? PALETTE.statusNeutral;
    const abbr = STATUS_ABBR[se.type] ?? se.type.slice(0, 2).toUpperCase();

    ctx.fillStyle = color;
    fillRoundRect(ctx, sx, y, SIZE, SIZE, 3);

    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 7px sans-serif`;
    ctx.fillText(abbr, sx + SIZE / 2, y + SIZE / 2 - 3);

    ctx.font = `bold 7px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(String(se.stacks), sx + SIZE / 2, y + SIZE / 2 + 5);
  });

  ctx.restore();
}

function getStatusCategory(type: string): string {
  const DEBUFFS = new Set([
    'vulnerable', 'weak', 'frail', 'poison', 'burn', 'daze',
    'shackled', 'constricted', 'slowness', 'no-draw', 'no-draw-next-turn',
  ]);
  if (DEBUFFS.has(type)) return 'debuff';
  if (type === 'corruption-skill-exhaust') return 'neutral';
  return 'buff';
}

// ---------------------------------------------------------------------------
// Intent Icon
// ---------------------------------------------------------------------------

const INTENT_CONFIG: Record<IntentDisplayType, { color: string; label: string }> = {
  'attack':       { color: PALETTE.intentAttack,       label: '⚔' },
  'defend':       { color: PALETTE.intentDefend,       label: '⬡' },
  'buff':         { color: PALETTE.intentBuff,         label: '▲' },
  'debuff':       { color: PALETTE.intentDebuff,       label: '▼' },
  'attack-debuff':{ color: PALETTE.intentAttackDebuff, label: '⚔▼' },
  'unknown':      { color: PALETTE.intentUnknown,      label: '?' },
};

/**
 * Dibuja el icono de intent del enemigo con su valor de daño si es un ataque.
 * Se coloca centrado en (x, y).
 */
export function drawIntentIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  intent: IntentDisplay,
): void {
  const cfg = INTENT_CONFIG[intent.type] ?? INTENT_CONFIG['unknown'];

  ctx.save();

  // Halo de fondo
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = cfg.color;
  ctx.shadowColor = cfg.color;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Símbolo central
  ctx.fillStyle = cfg.color;
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cfg.label, x, y);

  // Valor de daño bajo el icono
  if ((intent.type === 'attack' || intent.type === 'attack-debuff') && intent.value !== undefined) {
    const dmgLabel = intent.times ? `${intent.value}×${intent.times}` : String(intent.value);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 12px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(dmgLabel, x, y + 30);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Enemy Body
// ---------------------------------------------------------------------------

/** Paleta de colores por ID de enemigo (fallback por tier). */
const ENEMY_COLORS: Readonly<Record<string, string>> = {
  'jaw-worm':     '#a93226',
  'cultist':      '#7d3c98',
  'red-louse':    '#cb4335',
  'acid-slime-m': '#1e8449',
  'fungi-beast':  '#b7950b',
  'gremlin-nob':  '#ca6f1e',
  'lagavulin':    '#2e4057',
  'sentry':       '#717d7e',
  'the-guardian': '#922b21',
  'hexaghost':    '#6c3483',
} as const;

export function getEnemyColor(definitionId: string, tier: string): string {
  if (ENEMY_COLORS[definitionId]) return ENEMY_COLORS[definitionId];
  if (tier === 'boss') return '#922b21';
  if (tier === 'elite') return '#ca6f1e';
  return '#717d7e';
}

/**
 * Dibuja la forma principal del enemigo.
 * - normal → círculo estilizado con brillo interior
 * - elite  → diamante
 * - boss   → hexágono
 */
export function drawEnemyBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tier: string,
  alpha: number,
  color: string,
): void {
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const size = tier === 'boss' ? 52 : tier === 'elite' ? 44 : 36;
  const borderColor = lightenColor(color, 50);

  ctx.fillStyle = color;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;

  if (tier === 'boss') {
    drawHexagon(ctx, x, y, size);
  } else if (tier === 'elite') {
    drawDiamond(ctx, x, y, size);
  } else {
    // Normal: círculo con detalle interno
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = lightenColor(color, 30);
    ctx.beginPath();
    ctx.arc(x - size * 0.25, y - size * 0.25, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.68, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.68, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Player Body
// ---------------------------------------------------------------------------

/**
 * Dibuja una silueta estilizada del héroe (guerrero con espada).
 */
export function drawPlayerBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  alpha: number,
): void {
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const bodyColor = '#2e86c1';
  const highlightColor = '#5dade2';
  const armorColor = '#1a5276';

  ctx.shadowColor = bodyColor;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = highlightColor;
  ctx.lineWidth = 3;

  // Torso (rectángulo con esquinas)
  ctx.fillStyle = bodyColor;
  fillRoundRect(ctx, x - 18, y - 24, 36, 38, 4);
  ctx.strokeStyle = highlightColor;
  strokeRoundRect(ctx, x - 18, y - 24, 36, 38, 4);

  // Cabeza
  ctx.fillStyle = armorColor;
  ctx.beginPath();
  ctx.arc(x, y - 38, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = highlightColor;
  ctx.stroke();

  // Visor del casco (ranura horizontal)
  ctx.strokeStyle = '#85c1e9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 38);
  ctx.lineTo(x + 7, y - 38);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Espada (a la derecha del cuerpo)
  ctx.strokeStyle = '#aed6f1';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 22, y - 42);
  ctx.lineTo(x + 22, y + 18);
  ctx.stroke();

  // Guarda de la espada
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 14, y - 14);
  ctx.lineTo(x + 30, y - 14);
  ctx.stroke();

  // Escudo (a la izquierda)
  ctx.fillStyle = armorColor;
  ctx.strokeStyle = highlightColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 28);
  ctx.lineTo(x - 34, y - 18);
  ctx.lineTo(x - 34, y + 8);
  ctx.lineTo(x - 22, y + 18);
  ctx.lineTo(x - 10, y + 8);
  ctx.lineTo(x - 10, y - 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Energy Orbs
// ---------------------------------------------------------------------------

/**
 * Dibuja los orbes de energía del jugador (llenos = dorados, vacíos = oscuros).
 */
export function drawEnergyOrbs(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  energy: number,
  maxEnergy: number,
): void {
  const ORB_R = 10;
  const GAP = 26;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 11px sans-serif';

  for (let i = 0; i < maxEnergy; i++) {
    const ox = x + i * GAP;
    const filled = i < energy;

    ctx.beginPath();
    ctx.arc(ox, y, ORB_R, 0, Math.PI * 2);
    ctx.fillStyle = filled ? PALETTE.energyFilled : PALETTE.energyEmpty;
    if (filled) {
      ctx.shadowColor = PALETTE.energyFilled;
      ctx.shadowBlur = 8;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = PALETTE.energyBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Shared geometric helpers (no circular dependency)
// ---------------------------------------------------------------------------

/** Rellena un rectángulo con esquinas redondeadas. Compatible con todos los navegadores. */
export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fill();
}

/** Traza el borde de un rectángulo con esquinas redondeadas. */
export function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.stroke();
}

/** Aclara un color hexadecimal sumando `amount` a cada canal RGB. */
export function lightenColor(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}
