# ALFRED — Agent OS

> Refactor modulaire de **VOANH AI v1** (single-file HTML) en SPA vanilla JS sans build.
> Voir [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md) pour la spec complète.

## Stack

- **Vanilla JS + ES Modules natifs** (importmap, `<script type="module">`)
- **Zero build, zero npm** — déployable par simple copie
- **IndexedDB** (`AlfredDB` v4) pour la persistance, migration auto depuis `VOANH_AI_DB` v3
- **API LLM** : Mistral en direct (clé en cookie/localStorage, jamais en DB)

## Lancement local

```bash
cd alfred
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

> ⚠ Les ES modules + `importmap` ne fonctionnent pas en `file://` sur tous les navigateurs.
> Utilise toujours un serveur HTTP local.

Alternatives :
```bash
npx --yes serve alfred -p 8080
# ou
busybox httpd -f -p 8080 -h alfred
```

## Déploiement VPS (Nginx)

```bash
rsync -av alfred/ user@vps:/var/www/alfred/
```

Bloc Nginx :
```nginx
server {
  listen 80;
  server_name alfred.example.com;
  root /var/www/alfred;
  index index.html;

  # ES modules : MIME type strict requis
  types { application/javascript js mjs; }

  location / {
    try_files $uri $uri/ =404;
  }

  # Cache long sur modules versionnés (à activer après stabilisation)
  # location ~* \.(js|css)$ { expires 1h; }
}
```

Avec Caddy :
```caddyfile
alfred.example.com {
  root * /var/www/alfred
  file_server
  encode gzip
}
```

## État actuel — Phase 1

✓ Shell HTML + importmap
✓ EventBus typed (pub/sub)
✓ Logger structuré (debug/info/warn/error)
✓ AlfredDB v4 (8 stores)
✓ Migration auto V1 → V2
✓ Settings persistés
✓ APIBridge (Mistral, clé via cookie/localStorage)
✓ Theme engine + 3 thèmes (cyber, midnight, light)
✓ Densités (compact / normal / spacious)

Phases suivantes : voir [`docs/CHANGELOG.md`](docs/CHANGELOG.md).

## Arborescence

```
alfred/
├── index.html
├── modules/
│   ├── app.js
│   ├── core/         # event-bus, logger, db, db-migrate, settings, api-bridge
│   └── ui/           # theme-engine
├── themes/           # _base.css, cyber.css, midnight.css, light.css
└── docs/             # SPECIFICATION, SUPERVISION, ARCHITECTURE, CHANGELOG
```

## Compatibilité V1

- Cookie `mistral_api_key` lu en priorité (fallback `localStorage`)
- IndexedDB `VOANH_AI_DB` lue puis copiée vers `AlfredDB` (jamais supprimée)
- Flag `settings.migrated_v2 = true` après migration réussie
