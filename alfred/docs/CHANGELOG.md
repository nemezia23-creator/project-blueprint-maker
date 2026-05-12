# Changelog

Toutes les versions notables du projet sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Phase 2 (à venir) — Chat mono-onglet
- `chat/chat-manager.js`, `chat-stream.js`, `chat-renderer.js`, `chat-actions.js`
- Streaming SSE Mistral
- Markdown-lite + code blocks
- Export `.md` / `.txt`, rating

### Phase 3 — Multi-onglets
### Phase 4 — Système d'agents
### Phase 5 — Mémoire documentaire
### Phase 6 — Pipeline fichiers
### Phase 7 — Orchestrateur + Tasks
### Phase 8 — Command Palette + 8 agents de supervision pré-installés

---

## [0.1.0] — Phase 1 — Fondations

### Ajouté
- `index.html` minimal avec importmap (`@alfred/` → `./modules/`)
- `modules/app.js` — bootstrap orchestré avec boot log visible
- **Core**
  - `event-bus.js` — pub/sub typed avec enum `EVT`
  - `logger.js` — logger structuré avec niveaux et namespaces
  - `db.js` — wrapper IndexedDB pour `AlfredDB` v4 (8 stores)
  - `db-migrate.js` — migration auto V1 (`VOANH_AI_DB`) → V2, non destructive
  - `settings.js` — settings persistés avec defaults
  - `api-bridge.js` — abstraction multi-provider (Mistral seul pour l'instant)
- **UI**
  - `ui/theme-engine.js` — switcher thème + densité, persistés
- **Thèmes**
  - `themes/_base.css` — tokens de spacing/typo/motion + reset
  - `themes/cyber.css` — héritage VOANH (cyan + scanlines)
  - `themes/midnight.css` — bleus profonds + indigo
  - `themes/light.css` — light mode soigné
- **Docs**
  - `README.md` (lancement local + déploiement VPS)
  - `docs/SPECIFICATION.md` (spec source)
  - `docs/SUPERVISION.md` (8 agents de supervision)
  - `docs/ARCHITECTURE.md` (décisions d'implémentation)
  - `docs/CHANGELOG.md` (ce fichier)

### Compatibilité V1
- Cookie `mistral_api_key` préservé (fallback localStorage)
- IndexedDB V1 lue mais jamais supprimée
- Flag `settings.migrated_v2` ⇒ migration idempotente

## Phase 2 — Chat mono-onglet

- Ajout module `chat/` : chat-manager, chat-stream (SSE Mistral), chat-renderer (markdown-lite + sanitization), chat-actions, chat-ui.
- Ajout `ui/sanitize.js` (escapeHtml, safeUrl) et `ui/toast.js` (notifications ARIA-live).
- Ajout `themes/chat.css` (styles toolbar, messages, markdown, input bar).
- Settings : `chat.model`, `chat.temperature`, `chat.context_window`, `chat.system_prompt`.
- Bonus UX : Stop streaming, Regenerate, Edit user message, Rating ★, Export .md/.txt, sélecteur de modèle, indicateur tokens approx.
- Sécurité : tout contenu IA passe par `escapeHtml` avant transformation markdown ; liens limités à http(s)/mailto.
