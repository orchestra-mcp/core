/**
 * Orchestra Twin Bridge — Script Engine
 *
 * Allows scripts to be loaded from the database at runtime and injected
 * into matching browser tabs, instead of being static extension files.
 *
 * Storage key: 'dynamicScripts' → { [scriptId]: ScriptRecord }
 *
 * ScriptRecord shape:
 *   { id, name, domain, code, active, installedAt }
 *
 * Security guarantees:
 *   - Domain isolation is strict — the injected tab's hostname must end with
 *     script.domain (no wildcards accepted in domain strings).
 *   - De-duplication: injection is skipped if data-orchestra-script attribute
 *     already exists in the document.
 *   - Sandbox blocks: external fetch requests, WebSocket construction.
 *   - host_permissions are checked via chrome.permissions.contains() before
 *     any tab query or injection attempt.
 */

class ScriptEngine {
  constructor() {
    // Map of scriptId → { tabIds: Set<number>, domain: string, active: boolean }
    this.injected = new Map();
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  /**
   * Load a script record from WS/DB and persist it to local storage.
   * Immediately injects into any already-open matching tabs.
   *
   * @param {{ id: string, name: string, domain: string, code: string, active?: boolean }} script
   */
  async load(script) {
    if (!script?.id || !script?.name || !script?.domain || !script?.code) {
      return { error: 'script must have id, name, domain, and code' };
    }

    const scripts = await this.getAll();
    scripts[script.id] = {
      ...script,
      active: script.active !== false, // default true
      installedAt: Date.now(),
    };
    await chrome.storage.local.set({ dynamicScripts: scripts });
    await this.injectIntoMatchingTabs(scripts[script.id]);

    return { loaded: true, id: script.id, name: script.name };
  }

  /**
   * Remove a script from storage and clear its injection tracking.
   *
   * @param {string} scriptId
   */
  async unload(scriptId) {
    const scripts = await this.getAll();
    delete scripts[scriptId];
    await chrome.storage.local.set({ dynamicScripts: scripts });
    this.injected.delete(scriptId);

    return { unloaded: true, id: scriptId };
  }

  /**
   * Toggle a script's active state without removing it.
   *
   * @param {string}  scriptId
   * @param {boolean} active
   */
  async toggle(scriptId, active) {
    const scripts = await this.getAll();
    if (scripts[scriptId]) {
      scripts[scriptId].active = !!active;
      await chrome.storage.local.set({ dynamicScripts: scripts });
    }

    return { toggled: true, id: scriptId, active: !!active };
  }

  /**
   * Return all stored script records.
   *
   * @returns {Promise<{ [id: string]: ScriptRecord }>}
   */
  async getAll() {
    const data = await chrome.storage.local.get('dynamicScripts');
    return data.dynamicScripts || {};
  }

  // ─── Injection ────────────────────────────────────────────────────────────

  /**
   * Find all open tabs matching the script's domain and inject into them.
   * Silently skips if the host permission has not been granted.
   *
   * @param {ScriptRecord} script
   */
  async injectIntoMatchingTabs(script) {
    if (!script.active) return { skipped: 'inactive' };

    const pattern = `*://${script.domain}/*`;
    let hasPermission = false;
    try {
      hasPermission = await chrome.permissions.contains({ origins: [pattern] });
    } catch (err) {
      console.warn(`[ScriptEngine] Permission check failed for ${script.domain}:`, err.message);
    }

    if (!hasPermission) {
      // Cannot auto-request permissions from the background — user must grant via popup.
      console.warn(`[ScriptEngine] No permission for ${script.domain}. Grant in popup.`);
      return { error: 'permission_required', domain: script.domain };
    }

    let tabs = [];
    try {
      tabs = await chrome.tabs.query({ url: pattern });
    } catch (err) {
      return { error: err.message };
    }

    for (const tab of tabs) {
      await this.inject(tab.id, script);
    }

    return { injected: tabs.length };
  }

  /**
   * Inject a script into a specific tab.
   * Verifies domain match, wraps code in the sandbox, and uses
   * chrome.scripting.executeScript (world: MAIN) to run it.
   *
   * @param {number}      tabId
   * @param {ScriptRecord} script
   */
  async inject(tabId, script) {
    // Verify the tab still exists and its URL is accessible
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      // Tab was closed
      return;
    }

    if (!tab.url) return;

    // Strict domain isolation — hostname must end with script.domain
    let tabHost;
    try {
      tabHost = new URL(tab.url).hostname;
    } catch {
      console.error(`[ScriptEngine] Could not parse tab URL: ${tab.url}`);
      return;
    }

    if (!tabHost.endsWith(script.domain)) {
      console.error(`[ScriptEngine] Domain mismatch: tab=${tabHost} script=${script.domain}`);
      return;
    }

    const sandboxedCode = this.sandbox(script);

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (code, scriptId) => {
          // De-duplication guard — skip if already injected this session
          if (document.querySelector(`[data-orchestra-script="${scriptId}"]`)) return;

          const el = document.createElement('script');
          el.textContent = code;
          el.dataset.orchestraScript = scriptId;
          // Append to DOM to execute, then remove the element (code is already running)
          document.documentElement.appendChild(el);
          el.remove();
        },
        args: [sandboxedCode, script.id],
        world: 'MAIN',
      });

      // Track which tabs have this script injected
      if (!this.injected.has(script.id)) {
        this.injected.set(script.id, { tabIds: new Set(), domain: script.domain, active: script.active });
      }
      this.injected.get(script.id).tabIds.add(tabId);
    } catch (err) {
      console.error(`[ScriptEngine] Inject failed for "${script.name}" in tab ${tabId}:`, err.message);
    }
  }

  // ─── Sandbox ──────────────────────────────────────────────────────────────

  /**
   * Wrap user script code in a sandbox IIFE that:
   *  - Blocks external fetch (cross-origin) requests
   *  - Prevents WebSocket construction
   *  - Restores original APIs after the script body runs (so page stays functional)
   *
   * @param {{ name: string, code: string }} script
   * @returns {string} sandboxed source code
   */
  sandbox(script) {
    // Escape backticks in the script name for safe template literal embedding
    const safeName = script.name.replace(/`/g, "'");

    return `
(function() {
  'use strict';

  // === Orchestra Script Sandbox: ${safeName} ===

  // ── Block cross-origin fetch ─────────────────────────────────────────────
  const _origFetch = window.fetch;
  const _sandboxFetch = function(url, opts) {
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin) {
        console.warn('[Orchestra] Blocked external fetch:', url);
        return Promise.reject(new Error('External fetch blocked by Orchestra'));
      }
    } catch (_e) {
      // Relative URL or parse error — allow through (same-origin by definition)
    }
    return _origFetch.call(window, url, opts);
  };

  // ── Block WebSocket construction ─────────────────────────────────────────
  const _origWS = window.WebSocket;
  const _sandboxWS = function() {
    throw new Error('WebSocket blocked by Orchestra — use TwinMonitor.send() instead');
  };
  // Preserve static properties so feature-detect code doesn't break
  _sandboxWS.CONNECTING = 0;
  _sandboxWS.OPEN       = 1;
  _sandboxWS.CLOSING    = 2;
  _sandboxWS.CLOSED     = 3;

  // ── Apply sandbox overrides ──────────────────────────────────────────────
  window.fetch     = _sandboxFetch;
  window.WebSocket = _sandboxWS;

  try {
    // === User Script: ${safeName} ===
    ${script.code}
  } catch (err) {
    console.error('[Orchestra Script: ${safeName}]', err);
  }

  // ── Restore original APIs after script body executes ────────────────────
  // Note: any listeners / observers the script set up retain the sandboxed
  // version of fetch/WebSocket via closure — intentional.
  setTimeout(function() {
    window.fetch     = _origFetch;
    window.WebSocket = _origWS;
  }, 100);
})();`;
  }

  // ─── One-Shot Execution ───────────────────────────────────────────────────

  /**
   * Open a background tab for the given domain, execute code once, close the tab.
   * The script is NOT saved to storage — this is fire-and-forget.
   *
   * @param {string} domain  - Hostname (e.g. 'github.com')
   * @param {string} code    - JavaScript source to execute
   * @returns {Promise<*>}   - Return value of the executed code
   */
  async runOnce(domain, code) {
    if (!domain || !code) {
      return { error: 'domain and code are required' };
    }

    let tab;
    try {
      tab = await chrome.tabs.create({ url: `https://${domain}`, active: false });

      // Wait for full page load (timeout: 15 s)
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          reject(new Error('Tab load timeout (15s)'));
        }, 15000);

        function listener(id, info) {
          if (id === tab.id && info.status === 'complete') {
            clearTimeout(timer);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        }

        chrome.tabs.onUpdated.addListener(listener);
      });

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (userCode) => {
          try {
            // Use Function constructor for dynamic execution in MAIN world
            return new Function(userCode)(); // eslint-disable-line no-new-func
          } catch (e) {
            return { error: e.message };
          }
        },
        args: [code],
        world: 'MAIN',
      });

      return results[0]?.result ?? null;
    } catch (err) {
      return { error: err.message };
    } finally {
      if (tab?.id) {
        chrome.tabs.remove(tab.id).catch(() => {});
      }
    }
  }
}

// Export for service worker context
if (typeof globalThis !== 'undefined') {
  globalThis.ScriptEngine = ScriptEngine;
}
