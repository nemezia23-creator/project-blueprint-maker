# Plan — Phase 2 : Chat mono-onglet

Objectif : rendre Alfred utilisable en conversation simple avec Mistral (parité V1) + une poignée de bonus UX qui ne préjugent pas du multi-onglets (Phase 3).

## Livrables fonctionnels

1. **Saisie & envoi**
   - Textarea auto-resize, `Enter` = envoyer, `Shift+Enter` = nouvelle ligne
   - Compteur de caractères + estimation tokens (approx. `chars/4`)
   - Bouton Envoyer + bouton **Stop** pendant le streaming
   - Sélecteur de modèle (mistral-large-latest, mistral-small-latest, etc.)

2. **Streaming Mistral**
   - `chat-stream.js` : appel `POST /v1/chat/completions` avec `stream:true`, parsing SSE ligne par ligne, gestion `[DONE]`
   - `AbortController` pour stop propre
   - Backoff + message d'erreur lisible (401 clé invalide, 429 rate limit, réseau)

3. **Rendu**
   - `chat-renderer.js` : markdown-lite maison (headings, bold/italic, listes, liens, blockquotes, code inline, blocs ```lang)
   - Sanitization stricte (pas d'innerHTML brut sur contenu utilisateur/IA — escape puis injection contrôlée)
   - Copie code par bloc (bouton dans le coin)
   - Auto-scroll intelligent : suit le bas tant que l'utilisateur n'a pas remonté

4. **Historique & persistance**
   - 1 chat unique stocké dans `chats` (IndexedDB), id fixe `default`
   - Restauration au boot, fenêtre de contexte (N derniers messages, configurable, défaut 20)
   - Titre auto-généré (premiers mots du 1er message utilisateur)

5. **Actions par message**
   - Copier (markdown brut)
   - Rating ★ (0–5, persisté)
   - Supprimer
   - **Regénérer** (bonus) : relance le dernier tour assistant
   - **Éditer** (bonus) : éditer un message user et tronquer la suite

6. **Export / Reset**
   - Export `.md` et `.txt` du chat courant
   - Bouton "Nouveau chat" (vide l'historique après confirmation)

7. **Bonus UX retenus**
   - Indicateur tokens (in/out approximatif)
   - Stop streaming
   - Regenerate / Edit
   - Toast d'erreur réseau/API (composant `ui/toast.js` minimal créé ici, réutilisé en Phase 3+)

## Structure de fichiers ajoutés

```
alfred/modules/chat/
  chat-manager.js      # état conversation, persistance, fenêtre contexte
  chat-stream.js       # SSE Mistral + AbortController
  chat-renderer.js     # markdown-lite + sanitization + code blocks
  chat-actions.js      # copy/export/rating/regenerate/edit/delete
  chat-ui.js           # composition DOM (input bar, message list, toolbar)
alfred/modules/ui/
  toast.js             # notifications légères (ARIA live)
  sanitize.js          # helpers escape HTML
```

`index.html` : ajout du conteneur chat (`#alfred-chat`) ; `app.js` monte `chat-ui` après boot.

## Détails techniques

- **API Mistral** : endpoint `https://api.mistral.ai/v1/chat/completions`, header `Authorization: Bearer <key>` lu via `api-bridge.getApiKey('mistral')`. Body : `{ model, messages, stream:true, temperature, max_tokens }` (temp/max_tokens dans settings, valeurs par défaut V1).
- **Parsing SSE** : lecture du `ReadableStream` du `fetch`, split sur `\n\n`, lignes `data: {json}`, accumulation du `delta.content`. Émet `EVT.CHAT_STREAMING` à chaque chunk, `EVT.CHAT_MESSAGE` à la fin.
- **Schéma message** :
  ```js
  { id, chatId:'default', role:'user'|'assistant'|'system', content, ts, tokens?:{in,out}, rating?:0..5, model? }
  ```
- **Markdown-lite** : regex contrôlées + escape préalable. Pas de dépendance externe (cohérent avec stack zero-build).
- **Sanitization** : tout texte passe par `escapeHtml()` avant transformation markdown ; les `<a>` n'autorisent que `http(s):` et `mailto:`.
- **Settings ajoutés** : `chat.model`, `chat.temperature`, `chat.max_tokens`, `chat.context_window`, `chat.system_prompt` (vide par défaut).
- **EventBus** : utilise `EVT.CHAT_MESSAGE`, `CHAT_STREAMING`, `CHAT_ERROR` déjà déclarés Phase 1.
- **Compat V1** : la clé API en cookie reste source de vérité (déjà géré par `api-bridge`).

## Critères d'acceptation

- [ ] Saisir un message → réponse streamée token par token
- [ ] Bouton Stop interrompt proprement le stream
- [ ] Refresh → conversation restaurée
- [ ] Export `.md` produit un fichier lisible avec roles
- [ ] Erreur 401 affiche un toast clair invitant à reconfigurer la clé
- [ ] Regenerate / Edit fonctionnent et tronquent l'historique correctement
- [ ] Aucun XSS possible via markdown ou contenu IA (test : `<img src=x onerror=...>` reste texte)
- [ ] Checklist mise à jour dans `tests/test-checklist.md`

## Hors scope (reporté)

- Multi-onglets → Phase 3
- @mention agents → Phase 4
- Injection mémoire `[⬡ MEM×N]` → Phase 5
- Fichiers joints au chat → Phase 6

Une fois validé, j'implémente, je mets à jour `CHANGELOG.md` et la checklist.
