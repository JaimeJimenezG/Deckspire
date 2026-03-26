# Dependencias en `third-party/`

Esta carpeta aloja **repositorios externos** que no forman parte del árbol de código de Deckspire (Angular), pero que el equipo usa para **arte LPC**, pruebas o tooling. No se instalan con `npm install` en la raíz del proyecto: cada subcarpeta es un **submódulo Git** con su propio `package.json`.

## Contenido actual

| Ruta | Descripción |
|------|-------------|
| `third-party/Universal-LPC-Spritesheet-Character-Generator` | Fork del [generador universal de spritesheets LPC](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator). Sirve componer personajes (cuerpo, cabeza, armas, animaciones) y exportar PNG + metadatos. |

**Repositorio remoto del submódulo:** `https://github.com/JaimeJimenezG/Universal-LPC-Spritesheet-Character-Generator.git`

## Clonar Deckspire con submódulos

Tras un clone normal, `third-party/` puede quedar vacío hasta inicializar submódulos.

```bash
# Opción A: clonar ya con submódulos
git clone --recurse-submodules https://github.com/JaimeJimenezG/Deckspire.git

# Opción B: si ya clonaste sin submódulos
cd Deckspire
git submodule update --init --recursive
```

Comprueba que exista la carpeta `third-party/Universal-LPC-Spritesheet-Character-Generator/` con archivos (por ejemplo `index.html`, `package.json`).

## Instalar dependencias del generador LPC

Las dependencias **no** están en `node_modules` de la raíz de Deckspire. Hay que instalarlas **dentro** del submódulo:

```bash
cd third-party/Universal-LPC-Spritesheet-Character-Generator
npm install
```

Eso instala las `devDependencies` del generador (p. ej. ESLint, Mocha, Testem, Mithril) para lint y tests del propio generador. `node_modules/` del submódulo está en el `.gitignore` de ese repo y **no se versiona** en Deckspire.

### Ejecutar el generador en local

Los navegadores suelen bloquear `file://` para este tipo de app. Sirve cualquier servidor estático desde la carpeta del generador, por ejemplo:

```bash
cd third-party/Universal-LPC-Spritesheet-Character-Generator
npx --yes serve .
# o: python -m http.server 8080
```

Abre la URL que indique el servidor (p. ej. `http://localhost:3000`) y usa la interfaz para componer y exportar el spritesheet.

## Integración con Deckspire (`public/sprites/`)

El juego carga **sprites raster** desde `public/sprites/`, con **paridad de nombres**:

- `<nombre>.png` (u otro formato acordado en el equipo)
- `<nombre>.manifest.json` compatible con `SpriteAtlasManifest` (`domain/models/sprite-atlas.model.ts`)

Convención y rutas: regla `.cursor/rules/infrastructure-adapters.mdc` y módulos `infrastructure/canvas/sprite-atlas-paths.ts`, `sprite-atlas-loader.ts`.

Tras exportar desde el generador LPC:

1. Copia el PNG (y cualquier JSON de exportación que puedas mapear al manifiesto del juego) a la categoría adecuada, p. ej. `public/sprites/combat/`.
2. Asegura un `.manifest.json` coherente con el esquema del dominio.
3. Configura `combatAtlasBasename` en definiciones de enemigos y `DEFAULT_PLAYER_COMBAT_ATLAS_BASENAME` donde corresponda.

Si en el futuro existe un script en la raíz (p. ej. `npm run build-lpc-sprites`) que automatice copia o generación del manifiesto, estará documentado en el `package.json` principal.

## Licencias y atribución (LPC)

El arte del generador está bajo varias licencias abiertas (CC0, CC-BY, CC-BY-SA, OGA-BY, GPL, etc.). **Es obligación del proyecto cumplir los términos** del material concreto que uses: créditos, distribución de derivados, etc.

- Lista detallada: `CREDITS.csv` dentro del submódulo del generador.
- Resumen en el README del propio generador (sección *Licensing and Attribution*).

Mantén visibles los créditos en el juego o enlaces razonables a la información de licencia, según lo que apliquéis legalmente al subset de assets usados.

## Resolución de problemas

| Síntoma | Acción |
|---------|--------|
| `third-party/...` vacío o sin archivos | `git submodule update --init --recursive` |
| Comandos como `npm test` o `npx eslint` fallan en el generador | `cd` al submódulo y `npm install` |
| Git marca el submódulo como “modified content” | Normal si hay cambios sin commitear **dentro** del submódulo; entra en esa carpeta, revisa `git status` y decide si commitear en el fork o descartar cambios |
