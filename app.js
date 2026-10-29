'use strict';

const TAB_LABELS = { fb: 'Facebook', ig: 'Instagram', x: 'X' };
const PLATFORM_KEYS = { facebook: 'fb', instagram: 'ig', x: 'x' };

let current = 'fb';
const state = {};
let PLATFORMS = null;
const renderers = {};

function deriveGroups(entries) {
  const groups = [];
  for (const entry of entries) {
    if (!groups.includes(entry.group)) {
      groups.push(entry.group);
    }
  }
  return groups;
}

function loadVisited(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function saveVisited(key, visited) {
  try {
    localStorage.setItem(key, JSON.stringify([...visited]));
  } catch {
    // Ignore storage errors.
  }
}

function buildPlatforms(pages) {
  const platforms = {};
  for (const [jsonKey, platformKey] of Object.entries(PLATFORM_KEYS)) {
    const entries = pages[jsonKey] || [];
    platforms[platformKey] = {
      entries: entries,
      groups: deriveGroups(entries),
      key: platformKey + '-page-list-visited-v1',
      container: 'groups-' + platformKey,
      label: TAB_LABELS[platformKey]
    };
    state[platformKey] = {
      visited: loadVisited(platforms[platformKey].key),
      onlyPending: false
    };
  }
  return platforms;
}

function makeRenderer(platformKey) {
  const platform = PLATFORMS[platformKey];
  const entries = platform.entries;
  const groups = platform.groups;
  const container = document.getElementById(platform.container);
  const platformState = state[platformKey];

  return function render() {
    if (platformKey !== current) return;

    container.replaceChildren();
    let shown = 0;

    for (const group of groups) {
      const groupEntries = entries.filter((entry) => entry.group === group);
      const visibleEntries = platformState.onlyPending
        ? groupEntries.filter((entry) => !platformState.visited.has(entry.url))
        : groupEntries;

      if (!visibleEntries.length) continue;

      const section = document.createElement('section');
      const heading = document.createElement('h2');

      const indicator = document.createElement('span');
      indicator.textContent = '\u25BE';

      const title = document.createElement('span');
      title.textContent = `${group} (${groupEntries.length})`;

      heading.append(indicator, title);
      section.appendChild(heading);

      const list = document.createElement('ol');

      for (const entry of groupEntries) {
        const done = platformState.visited.has(entry.url);
        if (platformState.onlyPending && done) continue;

        shown += 1;

        const item = document.createElement('li');
        if (done) item.classList.add('visited');

        const link = document.createElement('a');
        link.href = entry.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = entry.name;
        link.title = entry.url;

        const url = document.createElement('span');
        url.className = 'url';
        url.textContent = entry.url;

        const marker = document.createElement('span');
        marker.className = 'mark ' + (done ? 'done' : 'pending');
        marker.textContent = done ? '\u2713' : '\u25CB';
        marker.title = done ? 'Visitée' : 'Pas encore visitée';
        marker.setAttribute('aria-label', marker.title);

        marker.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (platformState.visited.has(entry.url)) {
            platformState.visited.delete(entry.url);
          } else {
            platformState.visited.add(entry.url);
          }

          saveVisited(platform.key, platformState.visited);

          const nowVisited = platformState.visited.has(entry.url);
          item.classList.toggle('visited', nowVisited);
          marker.className = 'mark ' + (nowVisited ? 'done' : 'pending');
          marker.textContent = nowVisited ? '\u2713' : '\u25CB';
          marker.title = nowVisited ? 'Visitée' : 'Pas encore visitée';
          marker.setAttribute('aria-label', marker.title);

          updateCount(platformKey, shown);
        });

        link.addEventListener('click', () => {
          platformState.visited.add(entry.url);
          saveVisited(platform.key, platformState.visited);

          item.classList.add('visited');
          marker.className = 'mark done';
          marker.textContent = '\u2713';
          marker.title = 'Visitée';
          marker.setAttribute('aria-label', 'Visitée');

          updateCount(platformKey, shown);
        });

        item.append(link, url, marker);
        list.appendChild(item);
      }

      let collapsed = false;
      heading.addEventListener('click', () => {
        collapsed = !collapsed;
        list.style.display = collapsed ? 'none' : '';
        indicator.textContent = collapsed ? '\u25B8' : '\u25BE';
      });

      section.appendChild(list);
      container.appendChild(section);
    }

    updateCount(platformKey, shown);
  };
}

function updateCount(platformKey, shown) {
  if (platformKey !== current) return;

  const platform = PLATFORMS[platformKey];
  const platformState = state[platformKey];
  const visitedCount = platform.entries.filter((entry) =>
    platformState.visited.has(entry.url)
  ).length;

  document.getElementById('count').textContent =
    `${visitedCount} / ${platform.entries.length} visitées` +
    (platformState.onlyPending ? ` \u2014 ${shown} non visitées affichées` : '');
}

async function init() {
  try {
    const response = await fetch('pages.json');
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const pages = await response.json();
    PLATFORMS = buildPlatforms(pages);

    const tabsElement = document.getElementById('tabs');
    const panelsElement = document.getElementById('panels');

    for (const platformKey in PLATFORMS) {
      const platform = PLATFORMS[platformKey];

      const tabButton = document.createElement('button');
      tabButton.className = 'tab' + (platformKey === current ? ' active' : '');
      tabButton.dataset.tab = platformKey;
      tabButton.textContent = platform.label;
      tabsElement.appendChild(tabButton);

      const panel = document.createElement('div');
      panel.id = 'panel-' + platformKey;
      panel.className = 'panel' + (platformKey === current ? ' active' : '');

      const container = document.createElement('div');
      container.id = platform.container;
      panel.appendChild(container);

      panelsElement.appendChild(panel);
    }

    for (const platformKey in PLATFORMS) {
      renderers[platformKey] = makeRenderer(platformKey);
    }

    document.querySelectorAll('.tab').forEach((tabButton) => {
      tabButton.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((button) => button.classList.remove('active'));
        tabButton.classList.add('active');

        current = tabButton.dataset.tab;

        document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
        document.getElementById('panel-' + current).classList.add('active');

        renderCurrent();
      });
    });

    document.getElementById('all').addEventListener('click', () => {
      state[current].onlyPending = false;
      renderCurrent();
    });

    document.getElementById('pending').addEventListener('click', () => {
      state[current].onlyPending = true;
      renderCurrent();
    });

    document.getElementById('reset').addEventListener('click', () => {
      if (!confirm('Effacer tous les marqueurs enregistrés pour cet onglet ?')) return;
      state[current].visited.clear();
      saveVisited(PLATFORMS[current].key, state[current].visited);
      renderCurrent();
    });

    renderCurrent();
  } catch (error) {
    document.getElementById('panels').innerHTML =
      '<p class="error">Impossible de charger pages.json : ' + error.message +
      '. Lancez un serveur local (ex. python -m http.server) ou vérifiez le fichier.</p>';
  }
}

function renderCurrent() {
  for (const key in PLATFORMS) {
    if (key !== current) {
      document.getElementById(PLATFORMS[key].container).replaceChildren();
    }
  }
  renderers[current]();
}

init();
