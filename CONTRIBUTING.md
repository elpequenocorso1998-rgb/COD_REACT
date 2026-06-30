# Contributing to Modern Warfare React

Thanks for your interest in contributing! This project aims to be a browser-based FPS that captures the feel of Call of Duty.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/modern_warfare_react.git`
3. Install dependencies: `npm install` (or use Docker — see below)
4. Start dev server: `npm run dev` → http://localhost:9432

### Docker (recommended if you don't have Node 20)

```bash
docker run --rm -v "$PWD:/app" -w /app -p 9432:9432 node:20-alpine sh -c "npm install && npm run dev"
```

## Development Workflow

1. Create a branch: `git checkout -b feat/your-feature`
2. Make your changes following the conventions below
3. Verify: `npm run lint && npm test && npm run build`
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(scope): description` — new feature
   - `fix(scope): description` — bug fix
   - `docs: description` — documentation only
   - `refactor: description` — code change that neither fixes a bug nor adds a feature
5. Push and open a Pull Request
6. CI must pass (lint + test + build)

## Conventions

- **`config.js` is the single source of truth** for all balance values (damage, ammo, speed). Never hardcode these in other files.
- **Times in `WEAPON` are in seconds**; `store.js` converts to ms for `setTimeout`.
- **Every Three.js resource must have `dispose()`** (geometries, materials, textures, envMaps).
- **`createEngine().mount()` is idempotent** (StrictMode safe).
- **Lint with `--max-warnings 0`**: zero warnings allowed.
- **Tests in `tests/`** (vitest + jsdom). Mock procedural textures with `vi.mock`.
- **No comments** unless necessary for disambiguation.
- **`useShallow` in React Zustand selectors** to avoid unnecessary re-renders.
- **Game loop reads store with `getState()`** (no re-render); only `set()` when HUD must reflect the change.
- **Scratch vectors pre-allocated** in hot paths to avoid GC pressure.
- **Material cloning per instance** when independent emissive/opacity is needed.

## Commit Message Format

```
type(scope): subject

body (optional)
```

Examples:
- `feat(19.1): wire keybinds to input handlers`
- `fix(19.2): map loading rebuilds world on startGame`
- `docs: update README with correct test count`

## Testing

```bash
npm test                    # run all tests
npm run test:watch          # watch mode
```

- Unit tests for logic-only modules (store, config, loadout, navmesh, etc.)
- Mock Three.js textures in tests that touch `textures.js`
- Use fake timers for killstreaks, multikill windows, ragdoll cleanup
- Don't test rendering (Three.js WebGL) — only pure logic

## Code Style

- ESLint with `--max-warnings 0`
- 2-space indentation
- Single quotes for strings
- No semicolons (except where needed by ASI hazards)
- Semicolons at start of line if line begins with `[` or `(`
