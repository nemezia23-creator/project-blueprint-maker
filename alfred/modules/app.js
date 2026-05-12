// Alfred Agent OS — bootstrap
// Phase 1 : core init, migration, theme, status.

import { bus, EVT } from './core/event-bus.js';
import { createLogger, setLogLevel } from './core/logger.js';
import { openDB, dbStats } from './core/db.js';
import { runMigrationIfNeeded } from './core/db-migrate.js';
import { loadSettings, getSetting } from './core/settings.js';
import { hasApiKey, setApiKey, clearApiKey } from './core/api-bridge.js';
import { bootTheme, applyTheme, applyDensity } from './ui/theme-engine.js';
import { mountChat } from './chat/chat-ui.js';

const log = createLogger('app');

const $ = (sel) => document.querySelector(sel);

function logBoot(msg, status = 'ok') {
  const ul = $('#boot-log');
  if (!ul) return;
  const li = document.createElement('li');
  li.dataset.status = status;
  li.textContent = msg;
  ul.appendChild(li);
  bus.emit(EVT.BOOT_STEP, { msg, status });
}

async function boot() {
  try {
    logBoot('▸ chargement settings…');
    await openDB();
    await loadSettings();
    setLogLevel(getSetting('log_level') || 'info');
    logBoot('✓ DB ouverte (AlfredDB v4)');

    logBoot('▸ migration V1 → V2…');
    const migration = await runMigrationIfNeeded();
    logBoot(
      migration.migrated
        ? `✓ migration OK (chats:${migration.chats}, agents:${migration.agents}, settings:${migration.settings}, memories:${migration.memories})`
        : '✓ pas de données V1 à migrer'
    );

    logBoot('▸ application du thème…');
    await bootTheme();
    logBoot(`✓ thème ${getSetting('theme')} · densité ${getSetting('density')}`);

    // Wire UI controls
    const themeSel = $('#theme-select');
    const densitySel = $('#density-select');
    if (themeSel) {
      themeSel.value = getSetting('theme') || 'cyber';
      themeSel.addEventListener('change', (e) => applyTheme(e.target.value));
    }
    if (densitySel) {
      densitySel.value = getSetting('density') || 'normal';
      densitySel.addEventListener('change', (e) => applyDensity(e.target.value));
    }

    $('#open-settings')?.addEventListener('click', openApiKeyPrompt);

    // Footer status
    const stats = await dbStats();
    $('#footer-db').textContent =
      `DB · ${Object.entries(stats).map(([k, v]) => `${k}:${v}`).join(' · ')}`;
    $('#footer-api').textContent = hasApiKey('mistral') ? 'API · Mistral ✓' : 'API · Mistral ✗ (cliquer Réglages)';

    $('#boot-status').textContent = 'Système prêt — Phase 1 opérationnelle.';
    $('#boot-status').dataset.ready = 'true';
    bus.emit(EVT.BOOT_READY);
    log.info('boot complete');
  } catch (err) {
    log.error('boot failed', err);
    logBoot(`✗ erreur: ${err.message}`, 'error');
    $('#boot-status').textContent = 'Échec du démarrage — voir console.';
    $('#boot-status').dataset.ready = 'false';
    bus.emit(EVT.BOOT_ERROR, err);
  }
}

function openApiKeyPrompt() {
  const current = hasApiKey('mistral') ? '(clé déjà enregistrée)' : '(aucune clé)';
  const next = prompt(`Clé API Mistral ${current}\n\nLaisser vide pour effacer.`, '');
  if (next === null) return;
  if (next.trim() === '') {
    clearApiKey('mistral');
    $('#footer-api').textContent = 'API · Mistral ✗';
  } else {
    setApiKey('mistral', next.trim());
    $('#footer-api').textContent = 'API · Mistral ✓';
  }
}

// Expose for debugging only
window.Alfred = { bus, EVT };

boot();
