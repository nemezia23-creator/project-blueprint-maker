# Test checklist — Phase 1

> Tests manuels (pas de framework). À cocher avant de passer à Phase 2.

## Boot

- [ ] `python3 -m http.server 8080` dans `alfred/`, ouvrir `http://localhost:8080`
- [ ] La page se charge sans erreur dans la console
- [ ] Boot log affiche : settings → DB → migration → thème → prêt
- [ ] `#footer-db` montre les compteurs des 8 stores
- [ ] `#footer-api` indique l'état de la clé Mistral

## Thèmes

- [ ] Switcher entre cyber / midnight / light met à jour la page sans reload
- [ ] Le choix persiste après un refresh (lu depuis `settings`)
- [ ] Switcher de densité change `--msg-padding` (vérifiable au DevTools)

## Settings + DB

- [ ] DevTools → Application → IndexedDB → `AlfredDB` v4 contient les 8 stores
- [ ] `settings` contient au moins `theme`, `density`, `migrated_v2`
- [ ] Refresh : tout est rechargé

## Migration V1

Cas A — pas de `VOANH_AI_DB` :
- [ ] Boot log : `pas de données V1 à migrer`
- [ ] `migrated_v2 = true` posé

Cas B — avec `VOANH_AI_DB` v3 préexistante :
- [ ] Boot log : `migration OK (chats:N, agents:N, ...)`
- [ ] `AlfredDB.chats/agents/memories/settings` contiennent les données
- [ ] `VOANH_AI_DB` non supprimée (toujours visible en DevTools)
- [ ] Refresh : pas de re-migration (idempotence)

## API key

- [ ] Click sur "⚙ Réglages" → prompt
- [ ] Saisir une clé bidon → footer passe à `Mistral ✓`
- [ ] Refresh → clé toujours présente (cookie)
- [ ] Effacer DevTools cookies → clé absente
- [ ] Vérifier qu'aucun log console ne contient la clé en clair

## EventBus

Dans la console :
```js
Alfred.bus.on('boot:ready', () => console.log('READY'));
```
- [ ] Recharger → "READY" affiché
