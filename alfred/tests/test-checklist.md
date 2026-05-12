# Test checklist — Phase 1

> Tests manuels (pas de framework). À cocher avant de passer à Phase 2.
>
> **Avant de commencer** : assure-toi d'avoir lancé Alfred en suivant les 3 étapes du [README](../README.md#-démarrer-alfred-en-3-étapes-zéro-connaissance-technique). Si tu vois "Your app will live here" → tu es sur la preview Lovable, pas sur Alfred. Relis le README.

## Pré-requis (à valider en premier)

- [ ] J'ai ouvert un terminal **dans le dossier `alfred/`** (pas à la racine)
- [ ] La commande `python3 -m http.server 8080` (ou équivalent) tourne, terminal ouvert
- [ ] J'accède à `http://localhost:8080` dans le navigateur (PAS la preview Lovable)
- [ ] La page n'est pas blanche : je vois la barre **ALFRED** en haut et un panneau "Système initialisé"

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

---

# Test checklist — Phase 2

## Chat de base

- [ ] Saisir un message + Entrée → message user affiché, réponse Alfred streamée token par token
- [ ] Maj+Entrée insère un saut de ligne sans envoyer
- [ ] Compteur "N car · ~M tok" se met à jour en tapant
- [ ] Sélecteur de modèle change `chat.model` (persisté après refresh)
- [ ] Sans clé API → toast d'erreur, pas d'envoi

## Streaming & contrôle

- [ ] Bouton "■ Stop" apparaît pendant la génération, disparaît à la fin
- [ ] Stop interrompt et conserve le contenu partiel marqué `[interrompu]`
- [ ] Erreur 401 → toast "Clé API invalide…"
- [ ] Erreur réseau → toast lisible

## Rendu markdown

- [ ] Bloc ```js …``` rendu avec fond, mono, bouton "copy" fonctionnel
- [ ] **gras**, *italique*, `code inline`, listes, blockquotes, headings rendus
- [ ] XSS test : envoyer `<img src=x onerror=alert(1)>` → texte affiché tel quel, pas d'alerte

## Persistance

- [ ] Refresh → conversation restaurée (messages + ratings)
- [ ] DevTools IndexedDB `AlfredDB.chats` contient les messages

## Actions message

- [ ] Hover message → barre d'actions visible
- [ ] Copier → toast "Copié."
- [ ] Note ★ persistée (re-cliquer même note = retire)
- [ ] Éditer un message user → tronque la suite et relance Alfred
- [ ] Regénérer un message Alfred → supprime et relance
- [ ] Supprimer un message → confirmation + retiré

## Export / Reset

- [ ] Export .md télécharge un fichier lisible avec horodatages
- [ ] Export .txt fonctionne
- [ ] "⟲ Nouveau" → confirmation + chat vidé
