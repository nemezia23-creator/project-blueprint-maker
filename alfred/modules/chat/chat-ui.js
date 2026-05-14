// Chat UI — assembles input bar, message list, toolbar.
// Vanilla DOM, no framework. Mounted by app.js after boot.

import {
  loadChat, listMessages, addMessage, updateMessage, deleteMessage,
  truncateAfter, resetChat, buildContext, approxTokens,
} from './chat-manager.js';
import { streamMistral, ChatStreamError } from './chat-stream.js';
import { renderMarkdown, bindCodeCopy } from './chat-renderer.js';
import { copyText, exportChat } from './chat-actions.js';
import { escapeHtml } from '../ui/sanitize.js';
import { toast } from '../ui/toast.js';
import { getSetting, setSetting } from '../core/settings.js';
import { hasApiKey } from '../core/api-bridge.js';
import { bus, EVT } from '../core/event-bus.js';
import { createLogger } from '../core/logger.js';
import { getActiveId, maybeAutoTitle, touchActive } from '../tabs/tab-engine.js';
import { getTab, setTabAgent } from '../tabs/tab-engine.js';
import { getAgent, listAgents, noteAgentUsed } from '../agents/agent-manager.js';
import { buildSystemPrompt } from '../agents/agent-prompt-builder.js';
import { fillAgentSelect, attachMentionDropdown, openAgentManager } from '../agents/agent-ui.js';

const log = createLogger('chat-ui');

const MODELS = [
  'mistral-large-latest',
  'mistral-medium-latest',
  'mistral-small-latest',
];

let root, listEl, inputEl, sendBtn, stopBtn, modelSel, tokenInfo;
let abortCtrl = null;
let streamingMsgId = null;

export async function mountChat(container) {
  root = container;
  root.innerHTML = `
    <div class="chat-toolbar">
      <select class="chat-model" aria-label="Modèle"></select>
      <select class="chat-agent-select" aria-label="Agent"></select>
      <button class="chat-btn" data-action="manage-agents" type="button" title="Gérer les agents">◈ Agents</button>
      <span class="chat-spacer"></span>
      <button class="chat-btn" data-action="export-md" type="button" title="Export markdown">⤓ .md</button>
      <button class="chat-btn" data-action="export-txt" type="button" title="Export texte">⤓ .txt</button>
      <button class="chat-btn chat-btn--danger" data-action="reset" type="button" title="Nouveau chat">⟲ Nouveau</button>
    </div>
    <div class="chat-list" role="log" aria-live="polite" aria-label="Conversation"></div>
    <div class="chat-input-bar">
      <textarea class="chat-input" rows="1" placeholder="Écrivez à Alfred…  (Entrée pour envoyer · Maj+Entrée pour saut de ligne)" aria-label="Message"></textarea>
      <div class="chat-input-actions">
        <span class="chat-token-info">0 car · ~0 tok</span>
        <button class="chat-btn chat-btn--stop" data-action="stop" type="button" hidden>■ Stop</button>
        <button class="chat-btn chat-btn--send" data-action="send" type="button">Envoyer ▸</button>
      </div>
    </div>
  `;

  listEl = root.querySelector('.chat-list');
  inputEl = root.querySelector('.chat-input');
  sendBtn = root.querySelector('[data-action="send"]');
  stopBtn = root.querySelector('[data-action="stop"]');
  modelSel = root.querySelector('.chat-model');
  tokenInfo = root.querySelector('.chat-token-info');
  const agentSel = root.querySelector('.chat-agent-select');

  // Model selector
  for (const m of MODELS) {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m;
    modelSel.appendChild(opt);
  }
  modelSel.value = getSetting('chat.model') || MODELS[0];
  modelSel.addEventListener('change', () => setSetting('chat.model', modelSel.value));

  // Agent selector (per-tab)
  function refreshAgentSel() {
    const tab = getTab(getActiveId());
    fillAgentSelect(agentSel, tab?.agentId || '');
  }
  refreshAgentSel();
  agentSel.addEventListener('change', async () => {
    await setTabAgent(getActiveId(), agentSel.value || null);
  });
  bus.on('agents:changed', refreshAgentSel);
  bus.on(EVT.TAB_SWITCHED, refreshAgentSel);
  bus.on(EVT.TAB_UPDATED, refreshAgentSel);

  root.querySelector('[data-action="manage-agents"]').addEventListener('click', () => openAgentManager());

  // Toolbar actions
  root.querySelector('[data-action="export-md"]').addEventListener('click', () => exportChat('md'));
  root.querySelector('[data-action="export-txt"]').addEventListener('click', () => exportChat('txt'));
  root.querySelector('[data-action="reset"]').addEventListener('click', async () => {
    if (!confirm('Effacer toute la conversation ?')) return;
    await resetChat();
    rerender();
  });

  // Input
  inputEl.addEventListener('input', () => {
    autoResize();
    const len = inputEl.value.length;
    tokenInfo.textContent = `${len} car · ~${approxTokens(inputEl.value)} tok`;
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  sendBtn.addEventListener('click', send);
  stopBtn.addEventListener('click', () => abortCtrl?.abort());

  // @ mention dropdown
  attachMentionDropdown(inputEl, async (agent) => {
    await setTabAgent(getActiveId(), agent.id);
    refreshAgentSel();
  });

  // Delegated message actions
  listEl.addEventListener('click', onListClick);

  await loadChat(getActiveId());
  rerender();
  inputEl.focus();

  // React to tab switching / closing → reload current chat
  bus.on(EVT.TAB_SWITCHED, async () => {
    if (abortCtrl) abortCtrl.abort();
    await loadChat(getActiveId());
    rerender();
  });
  bus.on(EVT.TAB_CLOSED, async () => {
    await loadChat(getActiveId());
    rerender();
  });
}

function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 240) + 'px';
}

function rerender() {
  const msgs = listMessages();
  if (msgs.length === 0) {
    listEl.innerHTML = `<div class="chat-empty">Conversation vide. Posez une question pour commencer.</div>`;
    return;
  }
  listEl.innerHTML = msgs.map(renderMsg).join('');
  listEl.querySelectorAll('.chat-msg-body').forEach((el) => bindCodeCopy(el));
  scrollToBottom();
}

function renderMsg(m) {
  const role = m.role;
  const label = role === 'user' ? 'Vous' : role === 'assistant' ? 'Alfred' : role;
  const stars = renderStars(m.rating || 0, m.id);
  const body = role === 'assistant' ? renderMarkdown(m.content) : `<p class="md-p">${escapeHtml(m.content).replace(/\\n/g, '<br>')}</p>`;
  const editable = role === 'user';
  return `
    <article class="chat-msg chat-msg--${role}" data-id="${m.id}">
      <header class="chat-msg-head">
        <span class="chat-msg-role">${label}</span>
        <span class="chat-msg-meta">${new Date(m.ts).toLocaleTimeString()}${m.model ? ' · ' + escapeHtml(m.model) : ''}</span>
      </header>
      <div class="chat-msg-body">${body}</div>
      <footer class="chat-msg-actions">
        <button class="chat-msg-btn" data-msg-action="copy" title="Copier">⧉</button>
        ${editable ? '<button class="chat-msg-btn" data-msg-action="edit" title="Éditer">✎</button>' : ''}
        ${role === 'assistant' ? '<button class="chat-msg-btn" data-msg-action="regen" title="Regénérer">↻</button>' : ''}
        <button class="chat-msg-btn" data-msg-action="del" title="Supprimer">✕</button>
        <span class="chat-msg-stars">${stars}</span>
      </footer>
    </article>
  `;
}

function renderStars(rating, id) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<button class="chat-star ${i <= rating ? 'on' : ''}" data-msg-action="rate" data-rate="${i}" aria-label="Note ${i}">★</button>`;
  }
  return html;
}

function scrollToBottom() {
  const nearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 120;
  if (nearBottom) listEl.scrollTop = listEl.scrollHeight;
}

async function onListClick(e) {
  const btn = e.target.closest('[data-msg-action]');
  if (!btn) return;
  const article = btn.closest('.chat-msg');
  const id = article?.dataset.id;
  if (!id) return;
  const action = btn.dataset.msgAction;
  const msg = listMessages().find((m) => m.id === id);
  if (!msg) return;

  switch (action) {
    case 'copy':
      if (await copyText(msg.content)) toast('Copié.', { type: 'success', duration: 1500 });
      break;
    case 'del':
      if (confirm('Supprimer ce message ?')) { await deleteMessage(id); rerender(); }
      break;
    case 'rate': {
      const r = Number(btn.dataset.rate) || 0;
      await updateMessage(id, { rating: msg.rating === r ? 0 : r });
      rerender();
      break;
    }
    case 'edit': {
      const next = prompt('Éditer le message (la suite de la conversation sera supprimée) :', msg.content);
      if (next === null || next.trim() === '' || next === msg.content) return;
      await updateMessage(id, { content: next });
      await truncateAfter(id);
      rerender();
      await runAssistant();
      break;
    }
    case 'regen': {
      // Find the user message just before this assistant message
      const msgs = listMessages();
      const idx = msgs.findIndex((m) => m.id === id);
      if (idx <= 0) return;
      // Truncate from this assistant message onwards
      await deleteMessage(id);
      // delete subsequent
      for (const m of msgs.slice(idx + 1)) await deleteMessage(m.id);
      rerender();
      await runAssistant();
      break;
    }
  }
}

async function send() {
  const text = inputEl.value.trim();
  if (!text || abortCtrl) return;
  if (!hasApiKey('mistral')) {
    toast('Configurez votre clé Mistral via ⚙ Réglages.', { type: 'error' });
    return;
  }
  const activeId = getActiveId();
  const isFirst = listMessages().filter((m) => m.role === 'user').length === 0;
  await addMessage({ role: 'user', content: text });
  if (isFirst) await maybeAutoTitle(activeId, text);
  await touchActive();
  inputEl.value = '';
  autoResize();
  tokenInfo.textContent = '0 car · ~0 tok';
  rerender();
  await runAssistant();
}

async function runAssistant() {
  abortCtrl = new AbortController();
  setStreaming(true);

  const tab = getTab(getActiveId());
  const agent = tab?.agentId ? getAgent(tab.agentId) : null;
  const sysExtra = (getSetting('chat.system_prompt') || '').trim();
  const sysPrompt = buildSystemPrompt(agent, { extraSystem: sysExtra });
  const model = (agent?.modelPref) || modelSel.value;
  const temperature = agent ? Number(agent.temperature) : (Number(getSetting('chat.temperature')) || 0.7);
  const maxTokens = agent ? Number(agent.maxTokens) : undefined;

  // Insert placeholder assistant message
  const placeholder = await addMessage({ role: 'assistant', content: '', model, agentId: agent?.id || null });
  streamingMsgId = placeholder.id;
  rerender();

  try {
    const baseMsgs = buildContext().filter((m) => m.content !== '' || m.role === 'system');
    // Replace any leading system from buildContext with agent-built system
    const withoutSys = baseMsgs.filter((m) => m.role !== 'system');
    const finalMsgs = sysPrompt ? [{ role: 'system', content: sysPrompt }, ...withoutSys] : withoutSys;

    const result = await streamMistral({
      model,
      messages: finalMsgs,
      temperature,
      maxTokens,
      signal: abortCtrl.signal,
      onDelta: (_chunk, full) => {
        // Live-update placeholder DOM without full rerender
        const article = listEl.querySelector(`[data-id="${streamingMsgId}"] .chat-msg-body`);
        if (article) {
          article.innerHTML = renderMarkdown(full);
          bindCodeCopy(article);
          scrollToBottom();
        }
        bus.emit(EVT.CHAT_STREAMING, { id: streamingMsgId, full });
      },
    });
    await updateMessage(streamingMsgId, {
      content: result.content,
      tokens: result.usage ? { in: result.usage.prompt_tokens, out: result.usage.completion_tokens } : undefined,
    });
    if (agent) await noteAgentUsed(agent.id);
  } catch (err) {
    if (err.name === 'AbortError') {
      toast('Génération interrompue.', { type: 'info', duration: 2000 });
      // keep partial content already saved via onDelta — persist what we have in DOM
      const article = listEl.querySelector(`[data-id="${streamingMsgId}"] .chat-msg-body`);
      const partial = article?.innerText || '';
      await updateMessage(streamingMsgId, { content: partial + '\n\n_[interrompu]_' });
    } else {
      const msg = err instanceof ChatStreamError ? err.message : `Erreur: ${err.message}`;
      toast(msg, { type: 'error', duration: 6000 });
      await updateMessage(streamingMsgId, { content: `⚠ ${msg}` });
      bus.emit(EVT.CHAT_ERROR, err);
      log.error('stream failed', err);
    }
  } finally {
    abortCtrl = null;
    streamingMsgId = null;
    setStreaming(false);
    rerender();
  }
}

function setStreaming(on) {
  sendBtn.disabled = on;
  stopBtn.hidden = !on;
  inputEl.disabled = on;
}
