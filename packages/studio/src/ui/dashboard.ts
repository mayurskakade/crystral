/**
 * Returns the complete HTML string for the embedded Studio dashboard.
 * Single-file HTML/CSS/JS — no frontend build step required.
 */
export function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crystral Studio</title>
  <style>
    :root {
      --bg: #0f1117;
      --bg-surface: #1a1d27;
      --bg-surface-hover: #222636;
      --border: #2a2e3d;
      --text: #e4e4e7;
      --text-muted: #8b8d98;
      --accent: #6366f1;
      --accent-hover: #818cf8;
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
      --radius: 8px;
      --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }

    /* Layout */
    .app { display: flex; min-height: 100vh; }

    .sidebar {
      width: 220px;
      background: var(--bg-surface);
      border-right: 1px solid var(--border);
      padding: 20px 0;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
    }

    .sidebar-logo {
      padding: 0 20px 20px;
      font-size: 18px;
      font-weight: 700;
      color: var(--accent);
      letter-spacing: -0.5px;
    }

    .sidebar-logo span { color: var(--text-muted); font-weight: 400; font-size: 12px; margin-left: 4px; }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 20px;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s;
      font-size: 14px;
      border-left: 3px solid transparent;
    }

    .nav-item:hover { background: var(--bg-surface-hover); color: var(--text); }
    .nav-item.active { color: var(--accent); border-left-color: var(--accent); background: var(--bg-surface-hover); }

    .main { flex: 1; overflow-y: auto; }

    .page { padding: 32px; max-width: 1200px; }
    .page-title { font-size: 24px; font-weight: 700; margin-bottom: 24px; }

    /* Cards */
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }

    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      transition: border-color 0.15s;
    }

    .card:hover { border-color: var(--accent); }
    .card-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    .card-meta { font-size: 13px; color: var(--text-muted); margin-bottom: 4px; }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      background: var(--bg-surface-hover);
      color: var(--text-muted);
    }

    .badge-accent { background: rgba(99,102,241,0.15); color: var(--accent); }
    .badge-success { background: rgba(34,197,94,0.15); color: var(--success); }
    .badge-warning { background: rgba(245,158,11,0.15); color: var(--warning); }

    /* Stats row */
    .stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 28px; }

    .stat-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
    }

    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }

    /* Chat */
    .chat-container { display: flex; flex-direction: column; height: calc(100vh - 140px); }

    .chat-header {
      padding: 16px 0;
      border-bottom: 1px solid var(--border);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding-bottom: 16px;
    }

    .message {
      margin-bottom: 16px;
      max-width: 85%;
    }

    .message-user { margin-left: auto; }

    .message-bubble {
      padding: 12px 16px;
      border-radius: var(--radius);
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .message-user .message-bubble {
      background: var(--accent);
      color: white;
      border-bottom-right-radius: 2px;
    }

    .message-assistant .message-bubble {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-bottom-left-radius: 2px;
    }

    .message-tool .message-bubble {
      background: rgba(99,102,241,0.08);
      border: 1px solid var(--border);
      font-family: var(--font-mono);
      font-size: 12px;
    }

    .message-label {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .chat-input-row {
      display: flex;
      gap: 8px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }

    .chat-input {
      flex: 1;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px 16px;
      color: var(--text);
      font-size: 14px;
      outline: none;
      resize: none;
      font-family: inherit;
    }

    .chat-input:focus { border-color: var(--accent); }

    /* Buttons */
    .btn {
      padding: 10px 20px;
      border-radius: var(--radius);
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-primary { background: var(--accent); color: white; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-sm { padding: 6px 14px; font-size: 13px; }
    .btn-ghost { background: var(--bg-surface-hover); color: var(--text); }
    .btn-ghost:hover { background: var(--border); }
    .btn-danger { background: var(--error); color: white; }
    .btn-danger:hover { background: #dc2626; }

    /* Forms */
    .form-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .form-panel {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 28px;
      width: 520px;
      max-height: 85vh;
      overflow-y: auto;
    }

    .form-title { font-size: 18px; font-weight: 700; margin-bottom: 20px; }

    .form-group { margin-bottom: 16px; }
    .form-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text-muted); }
    .form-input {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 12px;
      color: var(--text);
      font-size: 14px;
      outline: none;
      font-family: inherit;
    }
    .form-input:focus { border-color: var(--accent); }
    textarea.form-input { resize: vertical; min-height: 80px; }
    .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
    .form-error { color: var(--error); font-size: 13px; margin-top: 8px; }

    /* Select */
    .select {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px 12px;
      color: var(--text);
      font-size: 14px;
      outline: none;
    }

    .select:focus { border-color: var(--accent); }

    /* Table */
    .table-wrap { overflow-x: auto; }

    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 14px; color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--border); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 10px 14px; border-bottom: 1px solid var(--border); }
    tr:hover td { background: var(--bg-surface-hover); }

    /* Empty state */
    .empty { text-align: center; padding: 60px 20px; color: var(--text-muted); }
    .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
    .empty-text { font-size: 15px; }

    /* Loading */
    .loading { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 14px; padding: 20px 0; }
    .spinner { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Streaming indicator */
    .streaming-dot { display: inline-block; width: 8px; height: 8px; background: var(--accent); border-radius: 50%; animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

    .badge-error { background: rgba(239,68,68,0.15); color: var(--error); }

    /* Toggle switch */
    .toggle { position: relative; display: inline-block; width: 40px; height: 22px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; cursor: pointer; inset: 0; background: var(--border); border-radius: 22px; transition: 0.2s; }
    .toggle-slider:before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: var(--text); border-radius: 50%; transition: 0.2s; }
    .toggle input:checked + .toggle-slider { background: var(--accent); }
    .toggle input:checked + .toggle-slider:before { transform: translateX(18px); }

    /* Collapsible section */
    .collapsible-header { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 0; color: var(--text-muted); font-size: 13px; font-weight: 600; }
    .collapsible-header:hover { color: var(--text); }
    .collapsible-content { padding-left: 12px; }

    /* Modal (for validate results) */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 200; }
    .modal-panel { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; width: 640px; max-height: 80vh; overflow-y: auto; }
    .modal-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; }

    /* Key-value editor */
    .kv-row { display: flex; gap: 8px; margin-bottom: 6px; align-items: center; }
    .kv-row input { flex: 1; }
  </style>
</head>
<body>
  <div class="app">
    <nav class="sidebar">
      <div class="sidebar-logo">Crystral <span>Studio</span></div>
      <div class="nav-item active" data-page="overview">Overview</div>
      <div class="nav-item" data-page="agents">Agents</div>
      <div class="nav-item" data-page="tools">Tools</div>
      <div class="nav-item" data-page="workflows">Workflows</div>
      <div class="nav-item" data-page="sessions">Sessions</div>
      <div class="nav-item" data-page="logs">Logs</div>
      <div class="nav-item" data-page="rag">RAG</div>
      <div class="nav-item" data-page="providers">Providers</div>
      <div class="nav-item" data-page="prompts">Prompts</div>
      <div class="nav-item" data-page="tests">Tests</div>
      <div class="nav-item" data-page="schedules">Schedules</div>
      <div style="margin-top:auto;padding:12px 20px;border-top:1px solid var(--border)">
        <button class="btn btn-ghost btn-sm" style="width:100%" onclick="validateProject()">Validate Project</button>
      </div>
    </nav>
    <main class="main" id="main"></main>
  </div>

  <script>
    // ========== State ==========
    const state = {
      agents: [],
      tools: [],
      workflows: [],
      sessions: [],
      logs: [],
      rag: [],
      providers: null,
      prompts: [],
      tests: [],
      schedules: [],
      chatAgent: null,
      chatSessionId: null,
      chatMessages: [],
      streaming: false,
    };

    // ========== API ==========
    async function api(path, opts) {
      try {
        const res = await fetch('/api' + path, opts);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || res.statusText);
        }
        return res.json();
      } catch (e) {
        console.error('API error:', e);
        throw e;
      }
    }

    // ========== Router ==========
    const pages = {};

    function navigate(page) {
      location.hash = page;
    }

    function handleRoute() {
      const page = location.hash.slice(1) || 'overview';
      document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
      });
      if (pages[page]) {
        pages[page]();
      }
    }

    window.addEventListener('hashchange', handleRoute);
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.page));
    });

    // ========== Pages ==========
    const $ = id => document.getElementById(id);
    const main = () => $('main');

    pages.overview = async () => {
      main().innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div> Loading...</div></div>';
      try {
        const [agents, tools, workflows, sessions, logs] = await Promise.all([
          api('/agents'),
          api('/tools'),
          api('/workflows'),
          api('/sessions?limit=5').catch(() => []),
          api('/logs?limit=10').catch(() => []),
        ]);
        state.agents = agents;
        state.tools = tools;
        state.workflows = workflows;

        main().innerHTML = \`
          <div class="page">
            <h1 class="page-title">Overview</h1>
            <div class="stats-row">
              <div class="stat-card">
                <div class="stat-value">\${agents.length}</div>
                <div class="stat-label">Agents</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">\${tools.length}</div>
                <div class="stat-label">Tools</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">\${workflows.length}</div>
                <div class="stat-label">Workflows</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">\${Array.isArray(sessions) ? sessions.length : 0}</div>
                <div class="stat-label">Sessions</div>
              </div>
            </div>
            <h2 style="font-size:16px;margin-bottom:12px;">Recent Agents</h2>
            <div class="card-grid" style="margin-bottom:28px;">
              \${agents.length === 0 ? '<div class="empty"><div class="empty-text">No agents found. Create agents/ YAML files to get started.</div></div>' :
                agents.map(a => \`
                  <div class="card" onclick="navigate('agents')" style="cursor:pointer">
                    <div class="card-title">\${esc(a.name)}</div>
                    <div class="card-meta">\${esc(a.provider || '')} / \${esc(a.model || '')}</div>
                    \${a.description ? \`<div class="card-meta" style="margin-top:8px">\${esc(a.description)}</div>\` : ''}
                    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                      \${(a.tools || []).length ? \`<span class="badge">\${a.tools.length} tools</span>\` : ''}
                      \${a.has_rag ? '<span class="badge badge-accent">RAG</span>' : ''}
                      \${a.mcp_servers ? \`<span class="badge badge-warning">\${a.mcp_servers} MCP</span>\` : ''}
                    </div>
                  </div>
                \`).join('')}
            </div>
            \${Array.isArray(logs) && logs.length > 0 ? \`
              <h2 style="font-size:16px;margin-bottom:12px;">Recent Logs</h2>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Agent</th><th>Provider</th><th>Model</th><th>Tokens</th><th>Latency</th><th>Time</th></tr></thead>
                  <tbody>
                    \${logs.slice(0, 10).map(l => \`
                      <tr>
                        <td>\${esc(l.agent_name)}</td>
                        <td>\${esc(l.provider)}</td>
                        <td>\${esc(l.model)}</td>
                        <td>\${l.input_tokens + l.output_tokens}</td>
                        <td>\${l.latency_ms}ms</td>
                        <td>\${timeAgo(l.created_at)}</td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              </div>
            \` : ''}
          </div>
        \`;
      } catch (e) {
        main().innerHTML = '<div class="page"><div class="empty"><div class="empty-text">Failed to load data: ' + esc(e.message) + '</div></div></div>';
      }
    };

    pages.agents = async () => {
      main().innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div> Loading agents...</div></div>';
      try {
        state.agents = await api('/agents');
        renderAgentsList();
      } catch (e) {
        main().innerHTML = '<div class="page"><div class="empty"><div class="empty-text">Failed to load agents: ' + esc(e.message) + '</div></div></div>';
      }
    };

    function renderAgentsList() {
      main().innerHTML = \`
        <div class="page">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
            <h1 class="page-title" style="margin-bottom:0">Agents</h1>
            <button class="btn btn-primary" onclick="showAgentForm()">New Agent</button>
          </div>
          \${state.agents.length === 0 ?
            '<div class="empty"><div class="empty-text">No agents configured. Click "New Agent" to create one.</div></div>' :
            \`<div class="card-grid">\${state.agents.map(a => \`
              <div class="card">
                <div class="card-title">\${esc(a.name)}</div>
                <div class="card-meta">\${esc(a.provider || '')} / \${esc(a.model || '')}</div>
                \${a.description ? \`<div class="card-meta" style="margin-top:8px">\${esc(a.description)}</div>\` : ''}
                <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
                  <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openChat('\${esc(a.name)}')">Chat</button>
                  <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showAgentForm('\${esc(a.name)}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteAgent('\${esc(a.name)}')">Delete</button>
                </div>
              </div>
            \`).join('')}</div>\`}
        </div>
      \`;
    }

    async function showAgentForm(editName) {
      let agentData = null;
      let availableTools = [];
      try { availableTools = await api('/agents/meta/tools'); } catch {}

      if (editName) {
        try { agentData = await api('/agents/' + encodeURIComponent(editName)); } catch {}
      }

      const isEdit = !!agentData;
      const providers = ['openai', 'anthropic', 'groq', 'google', 'together'];

      const overlay = document.createElement('div');
      overlay.className = 'form-overlay';
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
      overlay.innerHTML = \`
        <div class="form-panel">
          <div class="form-title">\${isEdit ? 'Edit Agent' : 'New Agent'}</div>
          <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" id="af-name" value="\${esc(agentData?.name || '')}" \${isEdit ? 'disabled style="opacity:0.6"' : ''} placeholder="my-agent">
          </div>
          <div class="form-group">
            <label class="form-label">Provider</label>
            <select class="form-input" id="af-provider">
              \${providers.map(p => \`<option value="\${p}" \${agentData?.provider === p ? 'selected' : ''}>\${p}</option>\`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Model</label>
            <input class="form-input" id="af-model" value="\${esc(agentData?.model || '')}" placeholder="gpt-4o">
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <input class="form-input" id="af-description" value="\${esc(agentData?.description || '')}" placeholder="Optional description">
          </div>
          <div class="form-group">
            <label class="form-label">System Prompt</label>
            <textarea class="form-input" id="af-system-prompt" placeholder="You are a helpful assistant...">\${esc(agentData?.system_prompt || '')}</textarea>
          </div>
          <div style="display:flex;gap:12px">
            <div class="form-group" style="flex:1">
              <label class="form-label">Temperature</label>
              <input class="form-input" id="af-temperature" type="number" min="0" max="2" step="0.1" value="\${agentData?.temperature ?? 1.0}">
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Max Tokens</label>
              <input class="form-input" id="af-max-tokens" type="number" min="1" max="1000000" value="\${agentData?.max_tokens ?? 4096}">
            </div>
          </div>
          \${availableTools.length > 0 ? \`
            <div class="form-group">
              <label class="form-label">Tools</label>
              <div style="display:flex;flex-wrap:wrap;gap:6px;max-height:120px;overflow-y:auto">
                \${availableTools.map(t => \`
                  <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
                    <input type="checkbox" class="af-tool" value="\${esc(t)}" \${(agentData?.tools || []).includes(t) ? 'checked' : ''}>
                    \${esc(t)}
                  </label>
                \`).join('')}
              </div>
            </div>
          \` : ''}

          <!-- Extends -->
          <div class="form-group">
            <label class="form-label">Extends (Base Agent Name)</label>
            <input class="form-input" id="af-extends" value="\${esc(agentData?.extends || '')}" placeholder="base-agent">
          </div>

          <!-- Output Schema -->
          <div class="collapsible-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
            &#9654; Output Schema
          </div>
          <div class="collapsible-content" style="display:none">
            <div class="form-group">
              <label class="form-label">Format</label>
              <select class="form-input" id="af-output-format">
                <option value="text" \${agentData?.output?.format === 'text' || !agentData?.output?.format ? 'selected' : ''}>text</option>
                <option value="json" \${agentData?.output?.format === 'json' ? 'selected' : ''}>json</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">JSON Schema (when format=json)</label>
              <textarea class="form-input" id="af-output-schema" placeholder='{"type":"object","properties":{}}'>\${agentData?.output?.schema ? JSON.stringify(agentData.output.schema, null, 2) : ''}</textarea>
            </div>
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                <input type="checkbox" id="af-output-strict" \${agentData?.output?.strict ? 'checked' : ''}> Strict mode
              </label>
            </div>
          </div>

          <!-- Retry -->
          <div class="collapsible-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
            &#9654; Retry
          </div>
          <div class="collapsible-content" style="display:none">
            <div style="display:flex;gap:12px">
              <div class="form-group" style="flex:1">
                <label class="form-label">Max Attempts</label>
                <input class="form-input" id="af-retry-max" type="number" min="1" max="10" value="\${agentData?.retry?.max_attempts ?? 3}">
              </div>
              <div class="form-group" style="flex:1">
                <label class="form-label">Backoff</label>
                <select class="form-input" id="af-retry-backoff">
                  <option value="none" \${agentData?.retry?.backoff === 'none' ? 'selected' : ''}>none</option>
                  <option value="linear" \${agentData?.retry?.backoff === 'linear' ? 'selected' : ''}>linear</option>
                  <option value="exponential" \${!agentData?.retry?.backoff || agentData?.retry?.backoff === 'exponential' ? 'selected' : ''}>exponential</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Fallback -->
          <div class="collapsible-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
            &#9654; Fallback Providers
          </div>
          <div class="collapsible-content" style="display:none">
            <div id="af-fallback-list">
              \${(agentData?.fallback || []).map((f, i) => \`
                <div class="kv-row">
                  <select class="form-input af-fb-provider" style="flex:1">
                    \${['openai','anthropic','groq','google','together'].map(p => \`<option value="\${p}" \${f.provider === p ? 'selected' : ''}>\${p}</option>\`).join('')}
                  </select>
                  <input class="form-input af-fb-model" style="flex:2" value="\${esc(f.model)}" placeholder="model">
                  <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">X</button>
                </div>
              \`).join('')}
            </div>
            <button class="btn btn-sm btn-ghost" onclick="addFallbackRow()">+ Add Fallback</button>
          </div>

          <!-- Guardrails -->
          <div class="collapsible-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
            &#9654; Guardrails
          </div>
          <div class="collapsible-content" style="display:none">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;font-weight:600">Input Guardrails</div>
            <div class="form-group">
              <label class="form-label">Max Input Length</label>
              <input class="form-input" id="af-guard-in-maxlen" type="number" min="1" value="\${agentData?.guardrails?.input?.max_length ?? ''}">
            </div>
            <div class="form-group">
              <label class="form-label">PII Action</label>
              <select class="form-input" id="af-guard-in-pii">
                <option value="none" \${!agentData?.guardrails?.input?.pii_action || agentData?.guardrails?.input?.pii_action === 'none' ? 'selected' : ''}>none</option>
                <option value="block" \${agentData?.guardrails?.input?.pii_action === 'block' ? 'selected' : ''}>block</option>
                <option value="redact" \${agentData?.guardrails?.input?.pii_action === 'redact' ? 'selected' : ''}>redact</option>
                <option value="warn" \${agentData?.guardrails?.input?.pii_action === 'warn' ? 'selected' : ''}>warn</option>
              </select>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;margin-top:12px;font-weight:600">Output Guardrails</div>
            <div class="form-group">
              <label class="form-label">Max Output Length</label>
              <input class="form-input" id="af-guard-out-maxlen" type="number" min="1" value="\${agentData?.guardrails?.output?.max_length ?? ''}">
            </div>
            <div class="form-group">
              <label class="form-label">PII Action</label>
              <select class="form-input" id="af-guard-out-pii">
                <option value="none" \${!agentData?.guardrails?.output?.pii_action || agentData?.guardrails?.output?.pii_action === 'none' ? 'selected' : ''}>none</option>
                <option value="block" \${agentData?.guardrails?.output?.pii_action === 'block' ? 'selected' : ''}>block</option>
                <option value="redact" \${agentData?.guardrails?.output?.pii_action === 'redact' ? 'selected' : ''}>redact</option>
                <option value="warn" \${agentData?.guardrails?.output?.pii_action === 'warn' ? 'selected' : ''}>warn</option>
              </select>
            </div>
          </div>

          <!-- Capabilities -->
          <div class="collapsible-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
            &#9654; Capabilities
          </div>
          <div class="collapsible-content" style="display:none">
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                <input type="checkbox" id="af-cap-vision" \${agentData?.capabilities?.vision ? 'checked' : ''}> Vision
              </label>
            </div>
          </div>

          <!-- Cache -->
          <div class="collapsible-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
            &#9654; Cache
          </div>
          <div class="collapsible-content" style="display:none">
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                <input type="checkbox" id="af-cache-enabled" \${agentData?.cache?.enabled ? 'checked' : ''}> Enabled
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">TTL (seconds)</label>
              <input class="form-input" id="af-cache-ttl" type="number" min="1" value="\${agentData?.cache?.ttl ?? 3600}">
            </div>
          </div>

          <!-- Logging -->
          <div class="collapsible-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
            &#9654; Logging
          </div>
          <div class="collapsible-content" style="display:none">
            <div class="form-group">
              <label class="form-label">Level</label>
              <select class="form-input" id="af-logging-level">
                <option value="debug" \${agentData?.logging?.level === 'debug' ? 'selected' : ''}>debug</option>
                <option value="info" \${!agentData?.logging?.level || agentData?.logging?.level === 'info' ? 'selected' : ''}>info</option>
                <option value="warn" \${agentData?.logging?.level === 'warn' ? 'selected' : ''}>warn</option>
                <option value="error" \${agentData?.logging?.level === 'error' ? 'selected' : ''}>error</option>
              </select>
            </div>
          </div>

          <div class="form-error" id="af-error"></div>
          <div class="form-actions">
            <button class="btn btn-ghost" onclick="this.closest('.form-overlay').remove()">Cancel</button>
            <button class="btn btn-primary" id="af-submit">\${isEdit ? 'Save Changes' : 'Create Agent'}</button>
          </div>
        </div>
      \`;

      document.body.appendChild(overlay);

      document.getElementById('af-submit').onclick = async () => {
        const errEl = document.getElementById('af-error');
        errEl.textContent = '';

        const name = document.getElementById('af-name').value.trim();
        const provider = document.getElementById('af-provider').value;
        const model = document.getElementById('af-model').value.trim();
        const description = document.getElementById('af-description').value.trim();
        const system_prompt = document.getElementById('af-system-prompt').value;
        const temperature = parseFloat(document.getElementById('af-temperature').value);
        const max_tokens = parseInt(document.getElementById('af-max-tokens').value, 10);
        const tools = Array.from(document.querySelectorAll('.af-tool:checked')).map(cb => cb.value);

        if (!name) { errEl.textContent = 'Name is required.'; return; }
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) { errEl.textContent = 'Name must be alphanumeric, hyphens, underscores.'; return; }
        if (!model) { errEl.textContent = 'Model is required.'; return; }

        // Collect new fields
        const extendsVal = document.getElementById('af-extends').value.trim();
        const outputFormat = document.getElementById('af-output-format').value;
        const outputSchemaStr = document.getElementById('af-output-schema').value.trim();
        const outputStrict = document.getElementById('af-output-strict').checked;
        const retryMax = parseInt(document.getElementById('af-retry-max').value, 10);
        const retryBackoff = document.getElementById('af-retry-backoff').value;
        const capVision = document.getElementById('af-cap-vision').checked;
        const cacheEnabled = document.getElementById('af-cache-enabled').checked;
        const cacheTtl = parseInt(document.getElementById('af-cache-ttl').value, 10);
        const loggingLevel = document.getElementById('af-logging-level').value;
        const guardInMaxLen = document.getElementById('af-guard-in-maxlen').value;
        const guardInPii = document.getElementById('af-guard-in-pii').value;
        const guardOutMaxLen = document.getElementById('af-guard-out-maxlen').value;
        const guardOutPii = document.getElementById('af-guard-out-pii').value;

        // Collect fallback rows
        const fbProviders = document.querySelectorAll('.af-fb-provider');
        const fbModels = document.querySelectorAll('.af-fb-model');
        const fallback = [];
        fbProviders.forEach((sel, i) => {
          const m = fbModels[i]?.value?.trim();
          if (m) fallback.push({ provider: sel.value, model: m });
        });

        const payload = { name, provider, model, temperature, max_tokens, tools };
        if (description) payload.description = description;
        if (system_prompt) payload.system_prompt = system_prompt;
        if (extendsVal) payload.extends = extendsVal;

        // Output
        if (outputFormat === 'json') {
          const outputObj = { format: 'json', strict: outputStrict };
          if (outputSchemaStr) {
            try { outputObj.schema = JSON.parse(outputSchemaStr); } catch { errEl.textContent = 'Invalid JSON in output schema.'; return; }
          }
          payload.output = outputObj;
        }

        // Retry
        if (retryMax && retryBackoff) {
          payload.retry = { max_attempts: retryMax, backoff: retryBackoff };
        }

        // Fallback
        if (fallback.length > 0) {
          payload.fallback = fallback;
        }

        // Guardrails
        const guardrails = {};
        const inputGuard = {};
        if (guardInMaxLen) inputGuard.max_length = parseInt(guardInMaxLen, 10);
        if (guardInPii !== 'none') inputGuard.pii_action = guardInPii;
        if (Object.keys(inputGuard).length > 0) guardrails.input = inputGuard;
        const outputGuard = {};
        if (guardOutMaxLen) outputGuard.max_length = parseInt(guardOutMaxLen, 10);
        if (guardOutPii !== 'none') outputGuard.pii_action = guardOutPii;
        if (Object.keys(outputGuard).length > 0) guardrails.output = outputGuard;
        if (Object.keys(guardrails).length > 0) payload.guardrails = guardrails;

        // Capabilities
        if (capVision) payload.capabilities = { vision: true };

        // Cache
        if (cacheEnabled) payload.cache = { enabled: true, ttl: cacheTtl || 3600 };

        // Logging
        if (loggingLevel !== 'info') payload.logging = { level: loggingLevel };

        try {
          if (isEdit) {
            await api('/agents/' + encodeURIComponent(editName), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          } else {
            await api('/agents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          }
          overlay.remove();
          pages.agents();
        } catch (e) {
          errEl.textContent = e.message;
        }
      };
    }

    async function deleteAgent(name) {
      if (!confirm('Delete agent "' + name + '"? This will remove its YAML file.')) return;
      try {
        await api('/agents/' + encodeURIComponent(name), { method: 'DELETE' });
        pages.agents();
      } catch (e) {
        alert('Failed to delete agent: ' + e.message);
      }
    }

    function addFallbackRow() {
      const list = document.getElementById('af-fallback-list');
      if (!list) return;
      const row = document.createElement('div');
      row.className = 'kv-row';
      row.innerHTML = \`
        <select class="form-input af-fb-provider" style="flex:1">
          <option value="openai">openai</option>
          <option value="anthropic">anthropic</option>
          <option value="groq">groq</option>
          <option value="google">google</option>
          <option value="together">together</option>
        </select>
        <input class="form-input af-fb-model" style="flex:2" placeholder="model">
        <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">X</button>
      \`;
      list.appendChild(row);
    }

    function openChat(agentName) {
      state.chatAgent = agentName;
      state.chatSessionId = null;
      state.chatMessages = [];
      renderChat();
    }

    function renderChat() {
      main().innerHTML = \`
        <div class="page">
          <div class="chat-container">
            <div class="chat-header">
              <button class="btn btn-sm" onclick="renderAgentsList()" style="background:var(--bg-surface-hover);color:var(--text)">Back</button>
              <div>
                <strong>\${esc(state.chatAgent)}</strong>
                \${state.chatSessionId ? \`<span style="color:var(--text-muted);font-size:12px;margin-left:8px">Session: \${state.chatSessionId.slice(0,8)}...</span>\` : ''}
              </div>
              <button class="btn btn-sm" onclick="openChat(state.chatAgent)" style="background:var(--bg-surface-hover);color:var(--text);margin-left:auto">New Chat</button>
            </div>
            <div class="chat-messages" id="chatMessages">
              \${state.chatMessages.length === 0 ?
                '<div class="empty"><div class="empty-text">Send a message to start chatting with this agent</div></div>' :
                state.chatMessages.map(renderMessage).join('')}
            </div>
            <div class="chat-input-row">
              <textarea class="chat-input" id="chatInput" placeholder="Type a message..." rows="1" onkeydown="handleChatKey(event)"></textarea>
              <button class="btn btn-primary" id="sendBtn" onclick="sendMessage()">Send</button>
            </div>
          </div>
        </div>
      \`;
      const el = $('chatMessages');
      if (el) el.scrollTop = el.scrollHeight;
      const input = $('chatInput');
      if (input) input.focus();
    }

    function renderMessage(msg) {
      const cls = msg.role === 'user' ? 'message-user' : msg.role === 'tool' ? 'message-tool' : 'message-assistant';
      return \`
        <div class="message \${cls}">
          <div class="message-label">\${msg.role}</div>
          <div class="message-bubble">\${esc(msg.content)}</div>
        </div>
      \`;
    }

    function handleChatKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    }

    async function sendMessage() {
      const input = $('chatInput');
      const text = input.value.trim();
      if (!text || state.streaming) return;

      state.chatMessages.push({ role: 'user', content: text });
      input.value = '';
      state.streaming = true;
      renderChat();

      // Add streaming placeholder
      const assistantMsg = { role: 'assistant', content: '' };
      state.chatMessages.push(assistantMsg);

      try {
        const body = { message: text };
        if (state.chatSessionId) body.sessionId = state.chatSessionId;

        const res = await fetch('/api/agents/' + encodeURIComponent(state.chatAgent) + '/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || res.statusText);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'chunk') {
                  assistantMsg.content += data.content;
                  updateLastMessage(assistantMsg.content);
                } else if (data.type === 'tool_call') {
                  state.chatMessages.push({ role: 'tool', content: 'Calling: ' + data.name + '(' + JSON.stringify(data.args) + ')' });
                  renderChat();
                  // Re-add assistant placeholder
                  state.chatMessages.push(assistantMsg);
                } else if (data.type === 'tool_result') {
                  const resultContent = typeof data.result === 'object' ? data.result.content : String(data.result);
                  state.chatMessages.splice(-1, 0, { role: 'tool', content: data.name + ' result: ' + resultContent });
                } else if (data.type === 'done') {
                  if (data.sessionId) state.chatSessionId = data.sessionId;
                  if (data.content && !assistantMsg.content) assistantMsg.content = data.content;
                }
              } catch {}
            }
          }
        }
      } catch (e) {
        assistantMsg.content = 'Error: ' + e.message;
      }

      state.streaming = false;
      renderChat();
    }

    function updateLastMessage(content) {
      const el = $('chatMessages');
      if (!el) return;
      const msgs = el.querySelectorAll('.message-assistant');
      const last = msgs[msgs.length - 1];
      if (last) {
        last.querySelector('.message-bubble').textContent = content;
        el.scrollTop = el.scrollHeight;
      }
    }

    pages.tools = async () => {
      main().innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div> Loading tools...</div></div>';
      try {
        state.tools = await api('/tools');
        main().innerHTML = \`
          <div class="page">
            <h1 class="page-title">Tools</h1>
            \${state.tools.length === 0 ?
              '<div class="empty"><div class="empty-text">No tools configured. Create YAML files in tools/ directory.</div></div>' :
              \`<div class="card-grid">\${state.tools.map(t => \`
                <div class="card">
                  <div class="card-title">\${esc(t.name)}</div>
                  <div style="margin-bottom:8px"><span class="badge badge-accent">\${esc(t.type)}</span></div>
                  <div class="card-meta">\${esc(t.description || '')}</div>
                  \${t.parameters && t.parameters.length ? \`<div class="card-meta" style="margin-top:8px">\${t.parameters.length} parameter(s)</div>\` : ''}
                </div>
              \`).join('')}</div>\`}
          </div>
        \`;
      } catch (e) {
        main().innerHTML = '<div class="page"><div class="empty"><div class="empty-text">Failed to load tools: ' + esc(e.message) + '</div></div></div>';
      }
    };

    pages.workflows = async () => {
      main().innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div> Loading workflows...</div></div>';
      try {
        state.workflows = await api('/workflows');
        main().innerHTML = \`
          <div class="page">
            <h1 class="page-title">Workflows</h1>
            \${state.workflows.length === 0 ?
              '<div class="empty"><div class="empty-text">No workflows configured. Create YAML files in workflows/ directory.</div></div>' :
              \`<div class="card-grid">\${state.workflows.map(w => \`
                <div class="card">
                  <div class="card-title">\${esc(w.name)}</div>
                  \${w.description ? \`<div class="card-meta">\${esc(w.description)}</div>\` : ''}
                  <div style="margin-top:8px">
                    <span class="badge">\${esc(w.strategy || 'auto')}</span>
                    <span class="badge" style="margin-left:4px">\${(w.agents || []).length} agents</span>
                  </div>
                  \${w.agents ? \`<div style="margin-top:10px;font-size:12px;color:var(--text-muted)">
                    \${w.agents.map(a => \`<div style="margin-bottom:4px">
                      \${esc(a.name)}
                      \${a.run_if ? \` <span class="badge badge-warning" style="font-size:10px">if: \${esc(a.run_if)}</span>\` : ''}
                      \${a.output_as ? \` <span class="badge badge-accent" style="font-size:10px">output: \${esc(a.output_as)}</span>\` : ''}
                    </div>\`).join('')}
                  </div>\` : ''}
                </div>
              \`).join('')}</div>\`}
          </div>
        \`;
      } catch (e) {
        main().innerHTML = '<div class="page"><div class="empty"><div class="empty-text">Failed to load workflows: ' + esc(e.message) + '</div></div></div>';
      }
    };

    pages.sessions = async () => {
      main().innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div> Loading sessions...</div></div>';
      try {
        state.sessions = await api('/sessions');
        renderSessions();
      } catch (e) {
        main().innerHTML = '<div class="page"><div class="empty"><div class="empty-text">Failed to load sessions: ' + esc(e.message) + '</div></div></div>';
      }
    };

    function renderSessions() {
      main().innerHTML = \`
        <div class="page">
          <h1 class="page-title">Sessions</h1>
          \${state.sessions.length === 0 ?
            '<div class="empty"><div class="empty-text">No sessions yet. Chat with an agent to create one.</div></div>' :
            \`<div class="table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Agent</th><th>Title</th><th>Messages</th><th>Created</th><th></th></tr></thead>
                <tbody>
                  \${state.sessions.map(s => \`
                    <tr>
                      <td style="font-family:var(--font-mono);font-size:12px">\${esc(s.id.slice(0, 8))}...</td>
                      <td><span class="badge badge-accent">\${esc(s.agent_name)}</span></td>
                      <td>\${esc(s.title || '-')}</td>
                      <td>\${s.message_count || 0}</td>
                      <td>\${timeAgo(s.created_at)}</td>
                      <td>
                        <button class="btn btn-sm" onclick="viewSession('\${esc(s.id)}')" style="background:var(--bg-surface-hover);color:var(--text)">View</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSession('\${esc(s.id)}')">Delete</button>
                      </td>
                    </tr>
                  \`).join('')}
                </tbody>
              </table>
            </div>\`}
        </div>
      \`;
    }

    async function viewSession(id) {
      try {
        const data = await api('/sessions/' + id + '/messages');
        main().innerHTML = \`
          <div class="page">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
              <button class="btn btn-sm" onclick="pages.sessions()" style="background:var(--bg-surface-hover);color:var(--text)">Back</button>
              <h1 class="page-title" style="margin-bottom:0">\${esc(data.session.agent_name)}</h1>
              <span style="color:var(--text-muted);font-size:12px">\${id.slice(0,8)}...</span>
            </div>
            <div>
              \${data.messages.map(m => \`
                <div class="message \${m.role === 'user' ? 'message-user' : m.role === 'tool' ? 'message-tool' : 'message-assistant'}">
                  <div class="message-label">\${m.role}</div>
                  <div class="message-bubble">\${esc(m.content)}</div>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      } catch (e) {
        alert('Failed to load session: ' + e.message);
      }
    }

    async function deleteSession(id) {
      if (!confirm('Delete this session?')) return;
      try {
        await api('/sessions/' + id, { method: 'DELETE' });
        state.sessions = state.sessions.filter(s => s.id !== id);
        renderSessions();
      } catch (e) {
        alert('Failed to delete: ' + e.message);
      }
    }

    pages.logs = async () => {
      main().innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div> Loading logs...</div></div>';
      try {
        state.logs = await api('/logs?limit=100');
        main().innerHTML = \`
          <div class="page">
            <h1 class="page-title">Inference Logs</h1>
            \${state.logs.length === 0 ?
              '<div class="empty"><div class="empty-text">No inference logs yet.</div></div>' :
              \`<div class="table-wrap">
                <table>
                  <thead><tr><th>Agent</th><th>Provider</th><th>Model</th><th>Input</th><th>Output</th><th>Cost</th><th>Latency</th><th>Time</th></tr></thead>
                  <tbody>
                    \${state.logs.map(l => \`
                      <tr>
                        <td><span class="badge badge-accent">\${esc(l.agent_name)}</span></td>
                        <td>\${esc(l.provider)}</td>
                        <td style="font-family:var(--font-mono);font-size:12px">\${esc(l.model)}</td>
                        <td>\${l.input_tokens}</td>
                        <td>\${l.output_tokens}</td>
                        <td>$\${(l.cost_usd || 0).toFixed(4)}</td>
                        <td>\${l.latency_ms}ms</td>
                        <td>\${timeAgo(l.created_at)}</td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              </div>\`}
          </div>
        \`;
      } catch (e) {
        main().innerHTML = '<div class="page"><div class="empty"><div class="empty-text">Failed to load logs: ' + esc(e.message) + '</div></div></div>';
      }
    };

    pages.rag = async () => {
      main().innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div> Loading RAG collections...</div></div>';
      try {
        state.rag = await api('/rag');
        main().innerHTML = \`
          <div class="page">
            <h1 class="page-title">RAG Collections</h1>
            \${state.rag.length === 0 ?
              '<div class="empty"><div class="empty-text">No RAG collections configured.</div></div>' :
              \`<div class="card-grid">\${state.rag.map(r => \`
                <div class="card">
                  <div class="card-title">\${esc(r.name)}</div>
                  <div class="card-meta">\${esc(r.embedding_provider || '')} / \${esc(r.embedding_model || '')}</div>
                  <div style="margin-top:8px;display:flex;gap:6px">
                    <span class="badge">\${r.chunks || 0} chunks</span>
                    <span class="badge">\${r.documents || 0} docs</span>
                  </div>
                  \${r.lastIndexed ? \`<div class="card-meta" style="margin-top:8px">Last indexed: \${timeAgo(r.lastIndexed)}</div>\` : ''}
                </div>
              \`).join('')}</div>\`}
          </div>
        \`;
      } catch (e) {
        main().innerHTML = '<div class="page"><div class="empty"><div class="empty-text">Failed to load RAG collections: ' + esc(e.message) + '</div></div></div>';
      }
    };

    pages.providers = async () => {
      main().innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div> Loading providers...</div></div>';
      try {
        state.providers = await api('/providers');
        main().innerHTML = \`
          <div class="page">
            <h1 class="page-title">Providers</h1>
            <div class="card-grid">
              \${state.providers.providers.map(p => \`
                <div class="card">
                  <div class="card-title" style="text-transform:capitalize">\${esc(p.name)}</div>
                  <div style="margin-top:8px">
                    \${p.configured ?
                      \`<span class="badge badge-success">Configured</span> <span class="badge" style="margin-left:4px">\${esc(p.source || '')}</span>\` :
                      '<span class="badge" style="background:rgba(239,68,68,0.15);color:var(--error)">Not configured</span>'}
                  </div>
                  \${state.providers.credentials[p.name] ? \`
                    <div class="card-meta" style="margin-top:8px;font-family:var(--font-mono);font-size:11px">\${esc(state.providers.credentials[p.name].maskedKey)}</div>
                  \` : ''}
                  <div style="margin-top:12px;display:flex;gap:6px">
                    <button class="btn btn-sm \${p.configured ? 'btn-ghost' : 'btn-primary'}" onclick="showProviderForm('\${esc(p.name)}')">\${p.configured ? 'Update Key' : 'Configure'}</button>
                    \${p.configured && p.source === 'credentials' ? \`<button class="btn btn-sm btn-danger" onclick="removeProviderKey('\${esc(p.name)}')">Remove</button>\` : ''}
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      } catch (e) {
        main().innerHTML = '<div class="page"><div class="empty"><div class="empty-text">Failed to load providers: ' + esc(e.message) + '</div></div></div>';
      }
    };

    function showProviderForm(providerName) {
      const overlay = document.createElement('div');
      overlay.className = 'form-overlay';
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
      overlay.innerHTML = \`
        <div class="form-panel" style="width:420px">
          <div class="form-title">Configure \${esc(providerName)}</div>
          <div class="form-group">
            <label class="form-label">API Key</label>
            <input class="form-input" id="pf-apikey" type="password" placeholder="sk-...">
          </div>
          <div class="form-error" id="pf-error"></div>
          <div class="form-actions">
            <button class="btn btn-ghost" onclick="this.closest('.form-overlay').remove()">Cancel</button>
            <button class="btn btn-primary" id="pf-submit">Save Key</button>
          </div>
        </div>
      \`;

      document.body.appendChild(overlay);
      document.getElementById('pf-apikey').focus();

      document.getElementById('pf-submit').onclick = async () => {
        const errEl = document.getElementById('pf-error');
        errEl.textContent = '';
        const apiKey = document.getElementById('pf-apikey').value.trim();
        if (!apiKey) { errEl.textContent = 'API key is required.'; return; }

        try {
          await api('/providers/' + encodeURIComponent(providerName), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey }),
          });
          overlay.remove();
          pages.providers();
        } catch (e) {
          errEl.textContent = e.message;
        }
      };
    }

    async function removeProviderKey(providerName) {
      if (!confirm('Remove API key for "' + providerName + '"?')) return;
      try {
        await api('/providers/' + encodeURIComponent(providerName), { method: 'DELETE' });
        pages.providers();
      } catch (e) {
        alert('Failed to remove key: ' + e.message);
      }
    }

    // ========== Prompts Page ==========
    pages.prompts = async () => {
      main().innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div> Loading prompts...</div></div>';
      try {
        state.prompts = await api('/prompts');
        renderPromptsList();
      } catch (e) {
        main().innerHTML = '<div class="page"><div class="empty"><div class="empty-text">Failed to load prompts: ' + esc(e.message) + '</div></div></div>';
      }
    };

    function renderPromptsList() {
      main().innerHTML = \`
        <div class="page">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
            <h1 class="page-title" style="margin-bottom:0">Prompt Templates</h1>
            <button class="btn btn-primary" onclick="showPromptForm()">New Template</button>
          </div>
          \${state.prompts.length === 0 ?
            '<div class="empty"><div class="empty-text">No prompt templates. Click "New Template" to create one.</div></div>' :
            \`<div class="card-grid">\${state.prompts.map(p => \`
              <div class="card">
                <div class="card-title">\${esc(p.name)}</div>
                \${p.description ? \`<div class="card-meta">\${esc(p.description)}</div>\` : ''}
                \${p.defaults ? \`<div style="margin-top:8px"><span class="badge">\${Object.keys(p.defaults).length} defaults</span></div>\` : ''}
                <div style="margin-top:12px;display:flex;gap:6px">
                  <button class="btn btn-ghost btn-sm" onclick="showPromptForm('\${esc(p.name)}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deletePrompt('\${esc(p.name)}')">Delete</button>
                </div>
              </div>
            \`).join('')}</div>\`}
        </div>
      \`;
    }

    async function showPromptForm(editName) {
      let promptData = null;
      if (editName) {
        try { promptData = await api('/prompts/' + encodeURIComponent(editName)); } catch {}
      }
      const isEdit = !!promptData;

      const overlay = document.createElement('div');
      overlay.className = 'form-overlay';
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
      overlay.innerHTML = \`
        <div class="form-panel">
          <div class="form-title">\${isEdit ? 'Edit Template' : 'New Template'}</div>
          <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" id="pf-name" value="\${esc(promptData?.name || '')}" \${isEdit ? 'disabled style="opacity:0.6"' : ''} placeholder="my-template">
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <input class="form-input" id="pf-description" value="\${esc(promptData?.description || '')}" placeholder="Optional description">
          </div>
          <div class="form-group">
            <label class="form-label">Template</label>
            <textarea class="form-input" id="pf-template" style="min-height:160px;font-family:var(--font-mono);font-size:13px" placeholder="You are a {role} that helps with {task}...">\${esc(promptData?.template || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Defaults (variable = value)</label>
            <div id="pf-defaults-list">
              \${promptData?.defaults ? Object.entries(promptData.defaults).map(([k,v]) => \`
                <div class="kv-row">
                  <input class="form-input pf-dk" value="\${esc(k)}" placeholder="key">
                  <input class="form-input pf-dv" value="\${esc(v)}" placeholder="value">
                  <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">X</button>
                </div>
              \`).join('') : ''}
            </div>
            <button class="btn btn-sm btn-ghost" onclick="addDefaultRow()">+ Add Default</button>
          </div>
          <div class="form-error" id="pf-error"></div>
          <div class="form-actions">
            <button class="btn btn-ghost" onclick="this.closest('.form-overlay').remove()">Cancel</button>
            <button class="btn btn-primary" id="pf-submit">\${isEdit ? 'Save Changes' : 'Create Template'}</button>
          </div>
        </div>
      \`;

      document.body.appendChild(overlay);

      document.getElementById('pf-submit').onclick = async () => {
        const errEl = document.getElementById('pf-error');
        errEl.textContent = '';
        const name = document.getElementById('pf-name').value.trim();
        const description = document.getElementById('pf-description').value.trim();
        const template = document.getElementById('pf-template').value;
        if (!name) { errEl.textContent = 'Name is required.'; return; }
        if (!template) { errEl.textContent = 'Template text is required.'; return; }

        const keys = document.querySelectorAll('.pf-dk');
        const vals = document.querySelectorAll('.pf-dv');
        const defaults = {};
        keys.forEach((k, i) => {
          const kv = k.value.trim();
          if (kv) defaults[kv] = vals[i]?.value || '';
        });

        const payload = { name, template };
        if (description) payload.description = description;
        if (Object.keys(defaults).length > 0) payload.defaults = defaults;

        try {
          if (isEdit) {
            await api('/prompts/' + encodeURIComponent(editName), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          } else {
            await api('/prompts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          }
          overlay.remove();
          pages.prompts();
        } catch (e) {
          errEl.textContent = e.message;
        }
      };
    }

    function addDefaultRow() {
      const list = document.getElementById('pf-defaults-list');
      if (!list) return;
      const row = document.createElement('div');
      row.className = 'kv-row';
      row.innerHTML = \`
        <input class="form-input pf-dk" placeholder="key">
        <input class="form-input pf-dv" placeholder="value">
        <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">X</button>
      \`;
      list.appendChild(row);
    }

    async function deletePrompt(name) {
      if (!confirm('Delete prompt template "' + name + '"?')) return;
      try {
        await api('/prompts/' + encodeURIComponent(name), { method: 'DELETE' });
        pages.prompts();
      } catch (e) {
        alert('Failed to delete prompt: ' + e.message);
      }
    }

    // ========== Tests Page ==========
    pages.tests = async () => {
      main().innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div> Loading tests...</div></div>';
      try {
        state.tests = await api('/tests');
        renderTestsList();
      } catch (e) {
        main().innerHTML = '<div class="page"><div class="empty"><div class="empty-text">Failed to load tests: ' + esc(e.message) + '</div></div></div>';
      }
    };

    function renderTestsList() {
      main().innerHTML = \`
        <div class="page">
          <h1 class="page-title">Test Suites</h1>
          \${state.tests.length === 0 ?
            '<div class="empty"><div class="empty-text">No test suites found. Create YAML files in tests/ directory.</div></div>' :
            \`<div class="card-grid">\${state.tests.map(t => \`
              <div class="card">
                <div class="card-title">\${esc(t.name)}</div>
                <div class="card-meta">Agent: \${esc(t.agent || '')}</div>
                <div style="margin-top:8px;display:flex;gap:6px">
                  <span class="badge">\${t.testCount || 0} tests</span>
                  \${t.mock ? '<span class="badge badge-warning">mock</span>' : ''}
                </div>
                <div style="margin-top:12px">
                  <button class="btn btn-primary btn-sm" onclick="runTestSuite('\${esc(t.name)}')">Run Tests</button>
                </div>
                <div id="test-result-\${esc(t.name)}" style="margin-top:12px"></div>
              </div>
            \`).join('')}</div>\`}
        </div>
      \`;
    }

    async function runTestSuite(name) {
      const resultEl = document.getElementById('test-result-' + name);
      if (resultEl) resultEl.innerHTML = '<div class="loading"><div class="spinner"></div> Running...</div>';
      try {
        const result = await api('/tests/' + encodeURIComponent(name) + '/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (resultEl) {
          resultEl.innerHTML = \`
            <div style="font-size:13px;margin-bottom:8px">
              <span class="badge badge-success">\${result.passed} passed</span>
              <span class="badge badge-error" style="margin-left:4px">\${result.failed} failed</span>
              <span style="color:var(--text-muted);margin-left:8px">\${result.duration}ms</span>
            </div>
            \${result.results.map(r => \`
              <div style="font-size:12px;padding:4px 0;display:flex;align-items:center;gap:6px">
                <span style="color:\${r.passed ? 'var(--success)' : 'var(--error)'}">\${r.passed ? 'PASS' : 'FAIL'}</span>
                <span>\${esc(r.name)}</span>
                \${r.error ? \`<span style="color:var(--error);font-size:11px">\${esc(r.error)}</span>\` : ''}
              </div>
            \`).join('')}
          \`;
        }
      } catch (e) {
        if (resultEl) resultEl.innerHTML = '<div style="color:var(--error);font-size:13px">Error: ' + esc(e.message) + '</div>';
      }
    }

    // ========== Schedules Page ==========
    pages.schedules = async () => {
      main().innerHTML = '<div class="page"><div class="loading"><div class="spinner"></div> Loading schedules...</div></div>';
      try {
        state.schedules = await api('/schedules');
        renderSchedulesList();
      } catch (e) {
        main().innerHTML = '<div class="page"><div class="empty"><div class="empty-text">Failed to load schedules: ' + esc(e.message) + '</div></div></div>';
      }
    };

    function renderSchedulesList() {
      main().innerHTML = \`
        <div class="page">
          <h1 class="page-title">Schedules</h1>
          \${state.schedules.length === 0 ?
            '<div class="empty"><div class="empty-text">No schedules configured. Create YAML files in schedules/ directory.</div></div>' :
            \`<div class="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Agent</th><th>Schedule</th><th>Input</th><th>Enabled</th><th></th></tr></thead>
                <tbody>
                  \${state.schedules.map(s => \`
                    <tr>
                      <td><strong>\${esc(s.name)}</strong></td>
                      <td><span class="badge badge-accent">\${esc(s.agent)}</span></td>
                      <td style="font-family:var(--font-mono);font-size:12px">\${esc(s.schedule)}</td>
                      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${esc(s.input)}</td>
                      <td>
                        <label class="toggle">
                          <input type="checkbox" \${s.enabled !== false ? 'checked' : ''} onchange="toggleSchedule('\${esc(s.name)}')">
                          <span class="toggle-slider"></span>
                        </label>
                      </td>
                      <td>
                        <span class="badge \${s.enabled !== false ? 'badge-success' : ''}" id="sched-status-\${esc(s.name)}">\${s.enabled !== false ? 'Active' : 'Disabled'}</span>
                      </td>
                    </tr>
                  \`).join('')}
                </tbody>
              </table>
            </div>\`}
        </div>
      \`;
    }

    async function toggleSchedule(name) {
      try {
        await api('/schedules/' + encodeURIComponent(name) + '/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        // Refresh the list
        pages.schedules();
      } catch (e) {
        alert('Failed to toggle schedule: ' + e.message);
      }
    }

    // ========== Validate ==========
    async function validateProject() {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
      overlay.innerHTML = \`
        <div class="modal-panel">
          <div class="modal-title">Validate Project</div>
          <div id="validate-content"><div class="loading"><div class="spinner"></div> Validating...</div></div>
          <div class="form-actions" style="margin-top:16px">
            <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Close</button>
          </div>
        </div>
      \`;
      document.body.appendChild(overlay);

      try {
        const result = await api('/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const contentEl = document.getElementById('validate-content');
        if (contentEl) {
          contentEl.innerHTML = \`
            <div style="display:flex;gap:12px;margin-bottom:16px">
              <span class="badge badge-success" style="font-size:13px;padding:4px 12px">\${result.valid} valid</span>
              <span class="badge badge-error" style="font-size:13px;padding:4px 12px">\${result.errors} errors</span>
              <span class="badge badge-warning" style="font-size:13px;padding:4px 12px">\${result.warnings} warnings</span>
            </div>
            \${result.files.map(f => \`
              <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="color:\${f.valid ? 'var(--success)' : 'var(--error)'};font-weight:600">\${f.valid ? 'PASS' : 'FAIL'}</span>
                  <span class="badge">\${esc(f.type)}</span>
                  <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">\${esc(f.file.split('/').pop())}</span>
                </div>
                \${f.errors.length > 0 ? \`<div style="margin-top:4px;padding-left:16px">\${f.errors.map(e => \`<div style="color:var(--error);font-size:12px">\${esc(e)}</div>\`).join('')}</div>\` : ''}
                \${f.warnings.length > 0 ? \`<div style="margin-top:4px;padding-left:16px">\${f.warnings.map(w => \`<div style="color:var(--warning);font-size:12px">\${esc(w)}</div>\`).join('')}</div>\` : ''}
              </div>
            \`).join('')}
          \`;
        }
      } catch (e) {
        const contentEl = document.getElementById('validate-content');
        if (contentEl) contentEl.innerHTML = '<div style="color:var(--error)">Error: ' + esc(e.message) + '</div>';
      }
    }

    // ========== Helpers ==========
    function esc(str) {
      if (str == null) return '';
      const d = document.createElement('div');
      d.textContent = String(str);
      return d.innerHTML;
    }

    function timeAgo(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      const now = Date.now();
      const diff = now - d.getTime();
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return Math.floor(diff / 86400000) + 'd ago';
    }

    // ========== Init ==========
    handleRoute();
  </script>
</body>
</html>`;
}
