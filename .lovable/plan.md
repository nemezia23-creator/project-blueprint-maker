
# Plan — Alfred Agent OS v2

## Contexte & décisions cadre

- **Stack** : SPA **vanilla JS + ES Modules natifs**, zero build, zero npm. Déployable par simple copie de dossier (local via `python -m http.server` ou `file://`, puis VPS via Nginx/Caddy). Le squelette React/TanStack actuel sera **mis de côté** (l'app Alfred vivra dans un dossier autonome `alfred/` à la racine, servable indépendamment).
- **Persistance** : IndexedDB (`AlfredDB` v4) + migration auto depuis `VOANH_AI_DB` v3. Aucun backend.
- **LLM** : appel direct API Mistral côté client, clé stockée en cookie/localStorage (logique V1 préservée). `APIBridge` prévu pour brancher d'autres providers plus tard.
- **Agents de supervision** : intégrés comme **agents IA réels in-app** (8 personas système avec prompts dédiés) ET documentés dans `docs/SUPERVISION.md`.
- **Livraison** : par phases incrémentales, chacune testable et fonctionnelle de bout en bout.

---

## Arborescence cible

```
alfred/
├── index.html                    # Entrée minimale + importmap
├── modules/
│   ├── app.js                    # Bootstrap
│   ├── core/                     # event-bus, logger, db, db-migrate, settings, api-bridge
│   ├── agents/                   # agent-manager, schema, runner, orchestrator, prompt-builder
│   ├── chat/                     # chat-manager, stream, renderer, actions
│   ├── tabs/                     # tab-engine, renderer, keybindings
│   ├── memory/                   # manager, index (FTS maison), filters
│   ├── files/                    # upload, parser, segmenter, summarizer
│   ├── tasks/                    # engine, kanban, graph, sync
│   ├── commands/                 # palette, registry, builtins
│   └── ui/                       # modal, toast, dropdown, progress, keyboard, theme-engine
├── themes/                       # cyber.css, midnight.css, light.css
├── assets/                       # fonts, icons
├── docs/                         # SPECIFICATION.md, ARCHITECTURE.md, SUPERVISION.md, CHANGELOG.md
└── tests/test-checklist.md
```

---

## Phases de livraison

### Phase 1 — Fondations (Core + Shell)
- `index.html` minimal + importmap
- `core/event-bus.js`, `logger.js`, `settings.js`
- `core/db.js` (wrapper IndexedDB) + `db-migrate.js` (V1→V2, stores préservés)
- `core/api-bridge.js` (Mistral d'abord, interface extensible)
- Theme engine + portage des 3 thèmes V1 (cyber/midnight/light) en CSS séparés avec tokens (`--surface-0..5`, accents, density)
- **Critère** : page se charge, DB initialisée, settings persistés, thème commutable.

### Phase 2 — Chat mono-onglet (parité V1 minimale)
- `chat/chat-manager.js` : historique, fenêtre de contexte
- `chat/chat-stream.js` : SSE Mistral
- `chat/chat-renderer.js` : markdown-lite, code blocks, pliage messages
- `chat/chat-actions.js` : copier, export `.md`/`.txt`, rating ★
- Saisie clé API (cookie compat V1)
- **Critère** : conversation fonctionnelle équivalente V1.

### Phase 3 — Multi-onglets
- `tabs/tab-engine.js` : CRUD onglet, isolation d'état, restauration session
- `tabs/tab-renderer.js` : barre d'onglets (drag-reorder, ellipsis, close hover)
- `tabs/tab-keybindings.js` : Ctrl+N/W/Tab, middle-click close
- Cap 50 onglets, défaut 20
- **Critère** : N conversations parallèles persistées.

### Phase 4 — Système d'agents
- `agents/agent-schema.js` : validation JSON
- `agents/agent-manager.js` : CRUD, isolation
- `agents/agent-prompt-builder.js` : composition system prompt
- `agents/agent-runner.js` : contexte d'exécution
- UI gestion agents (modal CRUD) + dropdown `@mention` (`ui/dropdown.js`)
- **Critère** : créer agent, l'invoquer via `@nom` dans le chat.

### Phase 5 — Mémoire documentaire
- `memory/memory-manager.js` : CRUD + versioning léger
- `memory/memory-index.js` : full-text search maison (tokenisation + tf-idf simple)
- `memory/memory-filters.js` : tag/type/date/owner/confidence
- Injection `[⬡ MEM×N]` dans messages (badge + drawer détail)
- UI panneau mémoire
- **Critère** : ajouter mémoire, retrouver via recherche, contexte injecté dans prompts.

### Phase 6 — Pipeline fichiers
- `files/file-upload.js` : drag-drop + validation
- `files/file-parser.js` : TXT, JSON, CSV nativement ; PDF/DOCX via libs CDN (pdfjs, mammoth — chargées dynamiquement)
- `files/file-segmenter.js` : chunking token-aware
- `files/file-summarizer.js` : résumé IA → injection mémoire
- **Critère** : upload PDF → parsé → résumé → mémoire interrogeable.

### Phase 7 — Orchestrateur + Tasks
- `agents/orchestrator.js` : plan → execute (parsing JSON sécurisé)
- `tasks/task-engine.js` : lifecycle (pending/running/done/failed)
- `tasks/task-kanban.js` + `task-graph.js` (DAG) + `task-sync.js`
- **Critère** : prompt complexe → orchestrateur découpe → tasks visibles dans kanban → agents exécutent.

### Phase 8 — Command Palette + Agents de supervision + Polish
- `commands/command-palette.js` (Ctrl+K), registry, builtins
- **8 agents de supervision** seedés au premier lancement : `alfred-architect`, `alfred-reviewer`, `alfred-qa`, `alfred-pm`, `alfred-ux`, `alfred-security`, `alfred-perf`, `alfred-docs` — chacun avec system prompt dédié dérivé de `supervision_agent.md`, invocables via `@`
- `docs/SUPERVISION.md` complet
- Polish : a11y (ARIA, navigation clavier), perf (virtual scrolling chat long), responsive
- **Critère** : Ctrl+K fonctionnel, 8 agents pré-installés opérationnels, checklist QA passée.

---

## Détails techniques transverses

- **EventBus typed** : enum `EVT.*` partagé, pub/sub intra-fenêtre.
- **Sécurité** : sanitization HTML systématique (pas d'`innerHTML` brut sur contenu dynamique), JSON.parse de l'orchestrateur en try-catch + schema validation, clé API jamais loggée.
- **Compat V1** : migration auto, ancienne DB non supprimée, flag `settings.migrated_v2`.
- **Déploiement local** : `cd alfred && python3 -m http.server 8080`. **VPS** : `rsync alfred/ user@vps:/var/www/alfred/` + bloc Nginx statique (fourni en doc Phase 1).
- **Pas de framework** : aucune dépendance npm. Libs externes (pdfjs, mammoth) chargées via CDN à la demande dans Phase 6.

---

## Hors scope explicite

- Pas de React/TanStack/Vite pour Alfred (le shell Lovable existant est conservé inerte mais ne sera pas étendu).
- Pas d'auth multi-utilisateur, pas de backend, pas de sync cloud (V1 → V2 reste 100 % client).
- PWA / offline manifest : reportés post-Phase 8.

---

## Démarrage proposé

Commencer par **Phase 1** (fondations + thèmes + DB + migration). Une fois validée et testée localement, enchaîner Phase 2. Chaque phase = un commit propre, testable isolément.
