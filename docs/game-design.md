# Diseño de Juego

Deckspire es un roguelike de construcción de mazos por turnos. Cada partida (run) es un intento único de ascender a través de 3 actos, derrotando al boss de cada uno.

## Estructura de una run

```
Menú principal
  │
  ▼
Acto 1 (mapa de 15 filas)
  ├── Nodo 0: Evento especial (Pacto de Origen)
  ├── Nodos 1-7: combates, eventos, tiendas, tesoros
  ├── Nodo 8: descanso obligatorio
  ├── Nodos 9-13: combates, elites, eventos
  └── Nodo 14: Boss
        │
        ▼
Acto 2 (mismo formato)
        │
        ▼
Acto 3 (mismo formato)
        │
        ▼
Victoria (o derrota en cualquier momento)
```

## El mapa

Mapa procedural tipo Slay the Spire generado por `MapGenerator`:

- **15 filas** × **7 columnas** máximo.
- **6 caminos** trazados desde el centro de la fila 0 con drift aleatorio.
- Los caminos convergen gradualmente en las últimas 4 filas antes del boss.
- Restricción de no-cruce para legibilidad visual.
- Nodos compartidos donde varios caminos coinciden.

### Tipos de nodo

| Tipo | Icono | Frecuencia | Descripción |
|---|---|---|---|
| `combat` | Espada | ~45% | Combate contra enemigos normales |
| `event` | ? | ~22% | Evento narrativo con decisiones |
| `elite` | Calavera | ~8% | Combate contra enemigo elite (más difícil, mejor recompensa) |
| `rest` | Hoguera | ~12% | Hoguera: descansar (+30% HP) o mejorar una carta |
| `shop` | Moneda | ~5% | Tienda: comprar cartas/reliquias, purgar cartas |
| `treasure` | Cofre | ~8% | Recompensa directa |
| `boss` | Corona | 1 por acto | Boss del acto (fila 14) |

### Restricciones de generación

- Fila 0 siempre es `event` (Pacto de Origen).
- Fila 8 siempre es `rest`.
- Fila 14 siempre es `boss`.
- No hay `elite` en filas 0-4 ni en fila 13.
- No hay dos `elite` ni dos `rest` consecutivos en un mismo camino.
- Se garantiza al menos un `elite` en el mapa.

---

## Sistema de combate

### Turno del jugador

1. Al inicio: restaurar energía, resetear bloqueo (salvo Barricade), tick de status de inicio de turno, robar 5 cartas.
2. El jugador puede jugar cartas gastando energía.
3. Al pulsar "Fin de turno": descartar la mano, tick de status de fin de turno.

### Turno enemigo

1. Cada enemigo ejecuta su intent visible (daño, bloqueo, buff, debuff, curación, invocación o split).
2. Se calcula el próximo intent de cada enemigo (visible para el jugador).
3. Se procesan efectos de muerte (split → instanciar nuevos enemigos).

### Cálculo de daño

```
daño_base + strength_atacante
  × 0.75 si weak (atacante)
  × 1.50 si vulnerable (objetivo)
  → min(1) si intangible (objetivo)
  → max(0)
  → absorbe bloqueo del objetivo
  → resta HP restante
```

### Cálculo de bloqueo

```
bloqueo_base + dexterity
  × 0.75 si frail
  → max(0)
```

### Pilas de cartas

| Pila | Descripción |
|---|---|
| **Draw pile** | Cartas por robar (se baraja al inicio del combate) |
| **Hand** | Cartas en la mano del jugador (máx. al robar) |
| **Discard** | Cartas usadas (se reshufflean en draw pile cuando este se vacía) |
| **Exhaust** | Cartas eliminadas del combate (no vuelven) |

### Condiciones de victoria/derrota

- **Victoria**: todos los enemigos tienen HP ≤ 0.
- **Derrota**: el jugador tiene HP ≤ 0 (se evalúa primero si hay empate).

---

## Cartas

### Tipos

| Tipo | Color | Descripción |
|---|---|---|
| **Attack** | Rojo | Infligen daño. Pueden tener efectos secundarios |
| **Skill** | Azul | Generan bloqueo, roban cartas, aplican estados |
| **Power** | Naranja | Aplican buffs permanentes (no se descartan, se exhausan) |

### Rarezas

| Rareza | Probabilidad (Acto 1) | Probabilidad (Acto 3) | Precio tienda |
|---|---|---|---|
| Basic | Solo en mazo inicial | — | — |
| Common | 60% | 30% | 45-55 g |
| Uncommon | 37% | 52% | 68-82 g |
| Rare | 3% | 18% | 135-165 g |

### Catálogo de cartas

**Ataques (13 cartas)**

| Carta | Coste | Rareza | Efecto |
|---|---|---|---|
| Strike | 1 | Basic | 6 de daño |
| Bash | 2 | Common | 8 de daño + 2 Vulnerable |
| Cleave | 1 | Common | 8 de daño a TODOS |
| Clothesline | 2 | Common | 12 de daño + 2 Weak |
| Heavy Blow | 2 | Common | 14 de daño |
| Iron Wave | 1 | Common | 5 de daño + 5 de bloqueo |
| Pommel Strike | 1 | Common | 9 de daño + roba 1 |
| Twin Strike | 1 | Common | 5 de daño ×2 |
| Carnage | 2 | Uncommon | 20 de daño. Exhaust |
| Sword Boomerang | 1 | Uncommon | 3 de daño ×3 a enemigo aleatorio |
| Uppercut | 2 | Uncommon | 13 de daño + 1 Weak + 1 Vulnerable |
| Whirlwind | 1 | Uncommon | 5 de daño ×3 a TODOS |
| Fiend Fire | 2 | Rare | 7 de daño ×3. Exhaust |

**Habilidades (12 cartas)**

| Carta | Coste | Rareza | Efecto |
|---|---|---|---|
| Defend | 1 | Basic | 5 de bloqueo |
| Flex | 0 | Common | +2 Strength (temporal) |
| Shrug It Off | 1 | Common | 8 de bloqueo + roba 1 |
| War Cry | 0 | Common | Roba 2. Exhaust |
| Battle Trance | 0 | Uncommon | Roba 3. No más robo este turno |
| Bloodletting | 0 | Uncommon | −3 HP. +2 energía |
| Disarm | 1 | Uncommon | Enemigo pierde 2 Strength. Exhaust |
| Rage | 0 | Uncommon | +3 Juggernaut (bloqueo al atacar) |
| Seeing Red | 1 | Uncommon | +2 energía. Exhaust |
| True Grit | 1 | Uncommon | 7 de bloqueo. Exhaust |
| Entrench | 2 | Rare | Duplica bloqueo actual |
| Impervious | 2 | Rare | 30 de bloqueo. Exhaust |

**Poderes (8 cartas)**

| Carta | Coste | Rareza | Efecto |
|---|---|---|---|
| Inflame | 1 | Common | +2 Strength permanente |
| Brutality | 0 | Uncommon | Inicio de turno: −1 HP, roba 1 |
| Combust | 1 | Uncommon | Fin de turno: −1 HP, 5 daño a todos |
| Feel No Pain | 1 | Uncommon | Al exhaust: +3 bloqueo |
| Metallicize | 1 | Uncommon | Fin de turno: +3 bloqueo |
| Barricade | 3 | Rare | El bloqueo no se resetea |
| Corruption | 3 | Rare | Skills cuestan 0 pero hacen exhaust |
| Demon Form | 3 | Rare | Inicio de turno: +2 Strength |

### Mazo inicial

5× Strike + 4× Defend (9 cartas).

---

## Efectos de estado

### Debuffs

| Estado | Efecto | Duración |
|---|---|---|
| Vulnerable | +50% de daño recibido | Decrece 1/turno |
| Weak | −25% de daño infligido | Decrece 1/turno |
| Frail | −25% de bloqueo ganado | Decrece 1/turno |
| Poison | −N HP al inicio del turno | Decrece 1/turno |
| Burn | −N HP al final del turno | Decrece 1/turno |
| Daze | +1 coste en ataques | Decrece 1/turno |
| Shackled | −N fuerza al inicio del turno | Permanente |
| Constricted | −N HP al final del turno | Permanente |
| No Draw | No roba cartas este turno | Instantáneo |

### Buffs

| Estado | Efecto | Duración |
|---|---|---|
| Strength | +N daño en ataques | Permanente |
| Dexterity | +N bloqueo en cartas de bloqueo | Permanente |
| Thorns | Devuelve N daño al atacante | Permanente |
| Metallicize | +N bloqueo al inicio de turno | Permanente |
| Ritual | +N fuerza al final de turno | Permanente |
| Regen | +N HP al final de turno | Decrece 1/turno |
| Barricade | Bloqueo no se resetea | Permanente |
| Intangible | Daño recibido = 1 | Decrece 1/turno |
| Artifact | Niega un debuff | Se consume |
| Feel No Pain | +N bloqueo al exhaust | Permanente |
| Flame Barrier | Daño al atacante | Desaparece inicio de turno |
| Juggernaut | Daño a enemigo al ganar bloqueo | Permanente |
| Corruption | Skills cuestan 0, hacen exhaust | Permanente |
| Brutality | +1 energía, −1 HP inicio turno | Permanente |
| Combust | −1 HP, N daño a todos fin turno | Permanente |

---

## Enemigos

### Tiers

| Tier | HP | Recompensa oro | Descripción |
|---|---|---|---|
| Normal | Bajo-medio | 10-20 g (+2/acto) | Encuentros rutinarios |
| Elite | Medio-alto | 25-35 g (+5/acto) | Más difíciles, mejor recompensa |
| Boss | Alto | 95-105 g (+15/acto) | Final de acto |

### Encuentros por acto

**Acto 1 — Normal**: Jaw Worm, Cultist, 2× Red Louse, Acid Slime M, Fungi Beast, combinaciones.

**Acto 1 — Elite**: Gremlin Nob, Lagavulin, 3× Sentry.

**Acto 1 — Boss**: The Guardian, Hexaghost.

Los actos 2 y 3 escalan la dificultad con más enemigos por encuentro y combinaciones más agresivas, usando el mismo pool de enemigos con pesos ajustados.

### Patrones de IA

Los enemigos no actúan al azar puro. Cada uno tiene un patrón definido:

- **Cultist**: patrón cíclico — buff inicial, luego ataca en bucle.
- **Jaw Worm**: aleatorio ponderado con restricción de no repetir ≥3 veces.
- **Red Louse**: condicional según HP y cartas jugadas por el jugador.
- **Gremlin Nob**: condicional — se enfurece cuando el jugador juega Skills.
- **Lagavulin**: por fases — dormido las primeras rondas, despierta al recibir daño.
- **The Guardian**: por fases — alterna entre modo ofensivo y defensivo según HP.

---

## Eventos

### Pacto de Origen (primer nodo)

Evento especial que siempre aparece en el primer nodo. Ofrece 3 elecciones (una de cada categoría):

| Categoría | Ejemplos |
|---|---|
| **Buena ahora** | +100 oro, +35 HP |
| **Buena a la larga** | +2 reliquias al derrotar boss, +15 HP máximo |
| **Incierta** | Resultado aleatorio positivo o negativo (ej: +12 HP max o −25 HP) |

### Eventos generales

6 eventos narrativos con elecciones de riesgo/recompensa:

| Evento | Opciones |
|---|---|
| El Viajero Herido | Ayudar (−20 g, +3 HP max) / Ignorar |
| El Altar Sangriento | Sacrificar (−20 HP, +250 g) / Rodear |
| El Cofre Trampa | Abrir (−10 HP, +75 g) / Dejar |
| El Pozo Maldito | Beber (−8 HP, +5 HP max) / No tocar |
| El Cadáver del Explorador | Registrar (+100 g) / Dejar en paz |
| Las Inscripciones Antiguas | Tocar (−15 HP, +175 g, +4 HP max) / Estudiar (+5 HP) |

---

## Tienda

Cada visita a la tienda genera:

- **3 cartas** seleccionadas por rareza ponderada (50% common, 35% uncommon, 15% rare).
- **2 reliquias** aleatorias (excluyendo las ya obtenidas).
- **Purga de carta**: eliminar una carta del mazo por 75 g (incrementa 25 g por uso).

### Precios base

| Ítem | Precio | Variación |
|---|---|---|
| Carta common | 50 g | ±5 g |
| Carta uncommon | 75 g | ±7 g |
| Carta rare | 150 g | ±15 g |
| Reliquia | 143 g | ±15 g |

---

## Reliquias

Pool de 29 reliquias con IDs en kebab-case. Las reliquias se obtienen en tiendas, como recompensa de eventos especiales, o al derrotar bosses. Cada reliquia tiene un efecto pasivo único.

---

## Reproducibilidad

Toda aleatoriedad en el juego usa `SeededRandom` (mulberry32) con la seed de la run. Esto significa que dada la misma seed y las mismas decisiones del jugador, la run produce exactamente los mismos resultados: mismo mapa, mismos encuentros, mismas cartas de recompensa, mismos intents enemigos.

La seed se genera al crear una nueva partida y se persiste en `GameState.seed`.
