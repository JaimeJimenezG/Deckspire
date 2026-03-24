# Deckspire

Deckspire es un roguelike de construcción de mazos inspirado en *Slay the Spire*, desarrollado como aplicación web con **Angular 19** y **TypeScript**. El jugador asciende a través de un mapa procedural de 3 actos, enfrentando combates por turnos con un sistema de cartas, tienda, eventos narrativos y sitios de descanso.

## Tabla de contenidos

| Documento | Descripción |
|---|---|
| [Arquitectura](./docs/architecture.md) | Arquitectura hexagonal, regla de dependencia y estructura de carpetas |
| [Dominio](./docs/domain.md) | Modelos, servicios de dominio y puertos (inbound/outbound) |
| [Aplicación](./docs/application.md) | Casos de uso y orquestación |
| [Infraestructura](./docs/infrastructure.md) | Adaptadores driven: IndexedDB y Canvas 2D |
| [UI](./docs/ui.md) | Componentes Angular, GameStateStore y DI |
| [Diseño de juego](./docs/game-design.md) | Mecánicas, cartas, enemigos, eventos y balanceo |

## Stack tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| Angular | 19.2 | Framework UI (standalone components, signals, OnPush) |
| TypeScript | 5.7 | Lenguaje principal |
| idb | 8.x | Acceso tipado a IndexedDB |
| Canvas 2D | Nativo | Renderizado de combate (sprites geométricos, partículas) |
| Jasmine + Karma | 5.6 / 6.4 | Tests unitarios |
| RxJS | 7.8 | Usado mínimamente; la reactividad se basa en Angular Signals |

## Requisitos previos

- Node.js >= 18
- npm >= 9

## Inicio rápido

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo (http://localhost:4200)
npm start

# Ejecutar tests unitarios
npm test

# Build de producción
npm run build
```

## Estructura del proyecto

```
src/app/
├── domain/                 # Capa interna — TypeScript puro
│   ├── models/             # Interfaces y tipos inmutables
│   ├── services/           # Lógica de negocio pura (sin framework)
│   ├── ports/
│   │   ├── inbound/        # Contratos de casos de uso
│   │   └── outbound/       # Contratos para adaptadores externos
│   └── data/               # Datos estáticos (cartas, enemigos, encuentros, eventos, reliquias)
├── application/
│   └── use-cases/          # Implementaciones de los puertos inbound
├── infrastructure/
│   ├── persistence/        # IndexedDB adapter (GameRepository)
│   └── canvas/             # Canvas 2D renderer (CombatRendererPort)
└── ui/
    ├── components/         # Componentes Angular standalone
    ├── di/providers.ts     # Configuración de inyección de dependencias
    └── game-state.store.ts # Fachada reactiva (signals) entre UI y use cases
```

## Principios de diseño

- **Inmutabilidad**: todo el estado se transforma con spread/map/filter; nunca se muta.
- **Reproducibilidad**: toda aleatoriedad usa `SeededRandom` (mulberry32) con seed persistida.
- **Separación estricta**: la capa de dominio es TypeScript puro, sin dependencias de Angular.
- **Testabilidad**: servicios y use cases se testean con Jasmine puro, sin `TestBed`.
