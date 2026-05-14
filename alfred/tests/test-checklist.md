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

---

# Test checklist — Phase 3 (Multi-onglets)

## Création / fermeture

- [ ] Au premier boot, un onglet "Conversation 1" existe par défaut
- [ ] Bouton `+` → crée un nouvel onglet, switch automatique dessus
- [ ] `Ctrl/Cmd + N` → idem (peut être intercepté par le navigateur)
- [ ] `Alt + N` → idem (toujours fonctionnel)
- [ ] Bouton `×` sur un onglet → confirmation puis fermeture
- [ ] Middle-click sur un onglet → confirmation puis fermeture
- [ ] `Alt + W` → ferme l'onglet actif
- [ ] Fermer le dernier onglet → un nouvel onglet vide est recréé
- [ ] Au-delà de `max_tabs` (default 20), le plus ancien non-épinglé est archivé

## Switch / cycle

- [ ] Click sur un onglet → switch, le chat affiche les messages de ce tab
- [ ] `Alt + →` cycle vers l'onglet suivant
- [ ] `Alt + ←` cycle vers l'onglet précédent
- [ ] `Ctrl/Cmd + Tab` cycle (si non intercepté par le navigateur)
- [ ] Streaming en cours → switch d'onglet : la génération est interrompue proprement

## Rename / pin / reorder

- [ ] Double-click sur un titre → prompt de renommage → persiste après refresh
- [ ] Right-click → menu (1=pin, 2=rename, 3=close)
- [ ] Onglet épinglé : pas de bouton ×, refus de fermeture
- [ ] Drag-and-drop entre onglets → l'ordre est persisté après refresh

## Auto-titre

- [ ] Sur un onglet "Conversation N", le premier message user (>0 char) renomme
      l'onglet (≤30 chars)
- [ ] Si l'onglet a déjà été renommé manuellement, l'auto-titre n'écrase rien

## Isolation

- [ ] Les messages d'un onglet n'apparaissent pas dans un autre
- [ ] DevTools → Database → `chats` : chaque message a `chatId === tab.id`
- [ ] DevTools → Database → `tabs` : la liste reflète l'UI

## Persistance / restauration

- [ ] Refresh → tous les onglets reviennent dans le même ordre
- [ ] L'onglet actif au moment du refresh est restauré
- [ ] `settings.tabs.activeId` = id de l'onglet actif (vérifiable DevTools)

## Anti-nouvelle-fenêtre

- [ ] Dans la console : `window.open('https://example.com')` → toast info
      "Alfred fonctionne en onglets…", retourne `null`, n'ouvre rien

## EventBus

- [ ] `Alfred.bus.on('tab:switched', console.log)` puis click sur un onglet → log
- [ ] `tab:created`, `tab:closed`, `tab:updated` émis aux bons moments

---

# Phase 4 — Système d'agents

## Boot & seed

- [ ] Premier boot d'une DB vierge → 4 agents créés automatiquement
      (Généraliste, CodeForge, WriterPro, ResearchBot), `settings.agents_seeded = true`
- [ ] Reboot → pas de re-seed (idempotence)
- [ ] DevTools → Database → `agents` contient bien les 4 lignes avec `version: 2`

## Ouverture du gestionnaire

- [ ] Bouton header `◈ Agents` ouvre la modal
- [ ] La liste de gauche affiche les 4 agents, leur couleur en bord gauche
- [ ] Click sur un agent affiche le formulaire d'édition à droite
- [ ] `Escape` ferme la modal ; click hors de la carte ferme aussi

## CRUD

- [ ] Bouton `+ Nouveau` ouvre un formulaire vide
- [ ] Soumettre sans nom → erreur visible (toast rouge)
- [ ] Créer un agent valide → apparaît dans la liste, toast succès
- [ ] Éditer un agent existant → enregistre, le toast s'affiche, la modale reste
- [ ] Dupliquer → crée une copie suffixée `(copie)` en `draft`
- [ ] Archiver → l'agent passe en `archived`, il disparaît du sélecteur de la
      toolbar mais reste visible (grisé) dans la modal
- [ ] Désarchiver → repasse en `active`
- [ ] Supprimer → confirmation puis disparition de la liste et de la DB

## Import / export

- [ ] Export JSON → télécharge un `.agent.json` valide
- [ ] Import du même fichier → crée un nouvel agent (nouvel id), nom suffixé
      manuellement si conflit (sinon erreur affichée)

## Sélecteur dans le chat

- [ ] La toolbar du chat affiche un select avec « — sans agent — » + les agents
      actifs
- [ ] Sélectionner un agent persiste sur l'onglet (refresh → toujours actif)
- [ ] Switch d'onglet → le sélecteur reflète l'agent du nouvel onglet

## System prompt effectif

- [ ] Avec un agent sélectionné, envoyer un message →
      DevTools → onglet EventBus / Logs → l'API reçoit un `system` construit à
      partir du `name`, `role`, `instructions`, `style`, `forbidden`, `tags`
- [ ] Sans agent, le system prompt est celui de `chat.system_prompt` (settings)
      ou aucun si vide
- [ ] La température et `max_tokens` envoyés correspondent à ceux de l'agent
- [ ] Si `modelPref` est défini sur l'agent, c'est ce modèle qui est utilisé
      (et non celui du select de la toolbar)

## @ Mention dropdown

- [ ] Taper `@` dans le textarea ouvre le dropdown
- [ ] Taper `@cod` filtre sur "CodeForge"
- [ ] `↑/↓` navigue, `Entrée` insère `@CodeForge ` et lie l'onglet à cet agent
- [ ] `Échap` ferme le dropdown sans rien insérer
- [ ] Click souris sur un item équivaut à Entrée

## Compatibilité

- [ ] Anciens agents V1 sans `version` → migrés silencieusement au prochain boot
- [ ] Aucun agent supprimé par la migration

## EventBus

- [ ] `Alfred.bus.on('agent:created', console.log)` puis création → log
- [ ] `agent:updated` / `agent:deleted` émis aux bons moments
