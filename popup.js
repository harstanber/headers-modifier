'use strict';

const HEADER_SUGGESTIONS = ['pfb', 'X-Forwarded-For'];

let state = null;
let saveTimer = null;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function makeTab(n) {
  return { id: uid(), name: `Tab ${n}`, headers: [] };
}

function activeTab() {
  return state.tabs.find(t => t.id === state.activeTabId) || state.tabs[0];
}

// ─── Persistence ───────────────────────────────────────────

async function load() {
  const result = await chrome.storage.local.get(['hmState']);
  if (result.hmState) {
    state = result.hmState;
    // Migrate old format (flat headers, no tabs)
    if (!state.tabs) {
      const tab = makeTab(1);
      tab.headers = state.headers || [];
      state.tabs = [tab];
      state.activeTabId = tab.id;
      delete state.headers;
    }
  } else {
    const tab = makeTab(1);
    state = { enabled: true, activeTabId: tab.id, tabs: [tab] };
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

async function saveNow() {
  clearTimeout(saveTimer);
  await chrome.storage.local.set({ hmState: state });
  await applyRules();
}

async function applyRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const toRemove = existing.map(r => r.id);
  const toAdd = buildRules();
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove, addRules: toAdd });
}

function buildRules() {
  if (!state.enabled) return [];

  const mods = activeTab().headers
    .filter(h => h.enabled && h.name.trim())
    .map(h => h.operation === 'remove'
      ? { header: h.name.trim(), operation: 'remove' }
      : { header: h.name.trim(), operation: h.operation, value: h.value });

  if (!mods.length) return [];

  return [{ id: 1, priority: 1, action: { type: 'modifyHeaders', requestHeaders: mods }, condition: {} }];
}

// ─── Render ────────────────────────────────────────────────

function render() {
  document.getElementById('masterToggle').checked = state.enabled;
  renderTabs();
  renderHeaders();
}

function renderTabs() {
  const bar = document.getElementById('tabBar');
  bar.innerHTML = '';

  state.tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === state.activeTabId ? ' active' : '');
    el.dataset.id = tab.id;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tab-name';
    nameSpan.textContent = tab.name;
    nameSpan.title = 'Double-click to rename';
    nameSpan.addEventListener('dblclick', () => startRename(tab, nameSpan));
    el.addEventListener('click', () => {
      if (tab.id === state.activeTabId) return;
      state.activeTabId = tab.id;
      renderTabs();
      renderHeaders();
      saveNow();
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.title = 'Delete tab';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (state.tabs.length === 1) return; // keep at least one
      const idx = state.tabs.findIndex(t => t.id === tab.id);
      state.tabs.splice(idx, 1);
      if (state.activeTabId === tab.id) {
        state.activeTabId = state.tabs[Math.max(0, idx - 1)].id;
      }
      renderTabs();
      renderHeaders();
      saveNow();
    });

    el.append(nameSpan, closeBtn);
    bar.appendChild(el);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'tab-add';
  addBtn.title = 'New tab';
  addBtn.textContent = '+';
  addBtn.addEventListener('click', () => {
    const tab = makeTab(state.tabs.length + 1);
    state.tabs.push(tab);
    state.activeTabId = tab.id;
    renderTabs();
    renderHeaders();
    saveNow();
  });
  bar.appendChild(addBtn);
}

function startRename(tab, nameSpan) {
  const inp = document.createElement('input');
  inp.className = 'tab-rename-input';
  inp.value = tab.name;
  nameSpan.replaceWith(inp);
  inp.focus();
  inp.select();

  const commit = () => {
    const val = inp.value.trim() || tab.name;
    tab.name = val;
    inp.replaceWith(nameSpan);
    nameSpan.textContent = val;
    saveNow();
  };
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') inp.blur();
    if (e.key === 'Escape') { inp.value = tab.name; inp.blur(); }
  });
}

function renderHeaders() {
  const list = document.getElementById('headersList');
  list.innerHTML = '';
  activeTab().headers.forEach(h => list.appendChild(makeRow(h)));
}

function makeRow(header) {
  const row = document.createElement('div');
  row.className = 'row' + (header.enabled ? '' : ' muted');

  // Enable toggle
  const label = document.createElement('label');
  label.className = 'toggle toggle-sm';
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = header.enabled;
  chk.addEventListener('change', e => {
    header.enabled = e.target.checked;
    row.classList.toggle('muted', !header.enabled);
    saveNow();
  });
  const thumb = document.createElement('span');
  thumb.className = 'thumb';
  label.append(chk, thumb);
  row.appendChild(label);

  // Operation select
  const op = document.createElement('select');
  op.className = 'op-select';
  op.innerHTML = '<option value="set">Set</option><option value="append">Append</option><option value="remove">Remove</option>';
  op.value = header.operation;
  op.addEventListener('change', e => {
    header.operation = e.target.value;
    valInput.classList.toggle('invisible', header.operation === 'remove');
    scheduleSave();
  });
  row.appendChild(op);

  // Header name with custom dropdown
  const nameWrap = document.createElement('div');
  nameWrap.className = 'name-wrap';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'inp inp-name';
  nameInput.placeholder = 'Header-Name';
  nameInput.value = header.name;
  nameInput.addEventListener('input', e => { header.name = e.target.value; scheduleSave(); });
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !e.shiftKey && header.operation !== 'remove') {
      e.preventDefault();
      valInput.focus();
    }
    if (e.key === 'Escape') dropList.classList.add('hidden');
  });

  const dropBtn = document.createElement('button');
  dropBtn.type = 'button';
  dropBtn.className = 'btn-dropdown';
  dropBtn.title = 'Select preset';
  dropBtn.textContent = '▾';
  dropBtn.addEventListener('click', () => {
    dropList.classList.toggle('hidden');
    if (!dropList.classList.contains('hidden')) nameInput.focus();
  });

  const dropList = document.createElement('div');
  dropList.className = 'drop-list hidden';
  HEADER_SUGGESTIONS.forEach(opt => {
    const item = document.createElement('div');
    item.className = 'drop-item';
    item.textContent = opt;
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      nameInput.value = opt;
      header.name = opt;
      scheduleSave();
      dropList.classList.add('hidden');
    });
    dropList.appendChild(item);
  });

  nameWrap.append(nameInput, dropBtn, dropList);
  row.appendChild(nameWrap);

  // Header value
  const valInput = document.createElement('input');
  valInput.type = 'text';
  valInput.className = 'inp inp-value' + (header.operation === 'remove' ? ' invisible' : '');
  valInput.placeholder = 'value';
  valInput.value = header.value;
  valInput.addEventListener('input', e => { header.value = e.target.value; scheduleSave(); });
  row.appendChild(valInput);

  // Comments
  const commentInput = document.createElement('input');
  commentInput.type = 'text';
  commentInput.className = 'inp inp-comment';
  commentInput.placeholder = '# note...';
  commentInput.value = header.comments || '';
  commentInput.addEventListener('input', e => { header.comments = e.target.value; scheduleSave(); });
  row.appendChild(commentInput);

  // Delete
  const del = document.createElement('button');
  del.className = 'btn-del';
  del.title = 'Delete';
  del.textContent = '×';
  del.addEventListener('click', () => {
    const headers = activeTab().headers;
    const i = headers.findIndex(x => x.id === header.id);
    if (i !== -1) headers.splice(i, 1);
    row.remove();
    saveNow();
  });
  row.appendChild(del);

  return row;
}

// ─── Events ────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('masterToggle').addEventListener('change', e => {
    state.enabled = e.target.checked;
    saveNow();
  });

  document.getElementById('addBtn').addEventListener('click', () => {
    const h = { id: uid(), enabled: true, name: '', value: '', operation: 'set', comments: '' };
    activeTab().headers.push(h);
    const row = makeRow(h);
    document.getElementById('headersList').appendChild(row);
    row.querySelector('.inp-name').focus();
    saveNow();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.name-wrap')) {
      document.querySelectorAll('.drop-list:not(.hidden)')
        .forEach(el => el.classList.add('hidden'));
    }
  });
}

// ─── Init ──────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await load();
  render();
  bindEvents();
});
