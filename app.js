'use strict';

const TAB_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  youtube: 'YouTube',
  telegram: 'Telegram',
  websites: 'Sites web',
  _to_verify: '\u00c0 v\u00e9rifier',
  personnalites_extreme_droite_monde: 'Personnalit\u00e9s extr\u00eame droite (monde)',
  personnalites_droite_france: 'Personnalit\u00e9s droite (France)'
};

let current = null;
const state = {};
let drawn = null;
let drawRandom = null;
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

function normalizeEntry(entry) {
  if (typeof entry === 'string') {
    return { url: entry, name: entry, group: '\u00c0 v\u00e9rifier' };
  }
  return {
    url: entry.url,
    name: entry.name || entry.url,
    group: entry.group || 'Divers'
  };
}

function buildPlatforms(pages) {
  const platforms = {};
  const keys = Object.keys(pages || {}).filter((key) => Array.isArray(pages[key]));

  for (const key of keys) {
    const entries = (pages[key] || []).map(normalizeEntry);
    platforms[key] = {
      entries: entries,
      groups: deriveGroups(entries),
      key: key + '-page-list-visited-v1',
      container: 'groups-' + key,
      label: TAB_LABELS[key] || (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '))
    };
    state[key] = {
      visited: loadVisited(platforms[key].key),
      onlyPending: false
    };
  }

  if (current === null && keys.length) {
    current = keys[0];
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
      const groupIsPending = platformState.onlyPending;
      const visibleEntries = groupIsPending
        ? groupEntries.filter((entry) => !platformState.visited.has(entry.url))
        : groupEntries;

      if (!visibleEntries.length) continue;

      const section = document.createElement('section');
      const heading = document.createElement('h2');

      const indicator = document.createElement('span');
      indicator.textContent = '\u25BE';

      const title = document.createElement('span');
      const visitedInGroup = groupEntries.filter((entry) => platformState.visited.has(entry.url)).length;
      title.textContent = `${group}: ${visitedInGroup}/${groupEntries.length}`;

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

        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'mark ' + (done ? 'done' : 'pending');
        marker.textContent = done ? '\u2713' : '\u25CB';
        marker.title = done ? 'Visitée' : 'Pas encore visitée';
        marker.setAttribute('aria-label', marker.title);

        marker.tabIndex = 0;
        marker.setAttribute('role', 'button');

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

          const visitedNow = groupEntries.filter((entry) => platformState.visited.has(entry.url)).length;
          title.textContent = `${group}: ${visitedNow}/${groupEntries.length}`;

          updateCount(platformKey, shown);
        });

        link.addEventListener('click', () => {
          platformState.visited.add(entry.url);
          saveVisited(platform.key, platformState.visited);

          item.classList.add('visited');
          marker.className = 'mark done';
          marker.textContent = '\u2713';
          marker.title = 'Visit\u00e9e';
          marker.setAttribute('aria-label', 'Visit\u00e9e');

          const visitedAfter = groupEntries.filter((e) => platformState.visited.has(e.url)).length;
          title.textContent = `${group}: ${visitedAfter}/${groupEntries.length}`;

          updateCount(platformKey, shown);
        });

        item.append(link, url, marker);
        list.appendChild(item);
      }

      heading.tabIndex = 0;
      heading.setAttribute('role', 'button');

      let collapsed = false;
      heading.addEventListener('click', () => {
        collapsed = !collapsed;
        list.style.display = collapsed ? 'none' : '';
        indicator.textContent = collapsed ? '\u25B8' : '\u25BE';
      });

      heading.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        heading.click();
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


function allUnvisitedEntries() {
  const result = [];
  for (const platformKey in PLATFORMS) {
    const platform = PLATFORMS[platformKey];
    const platformState = state[platformKey];
    for (const entry of platform.entries) {
      if (!platformState.visited.has(entry.url)) {
        result.push({ platformKey: platformKey, entry: entry });
      }
    }
  }
  return result;
}

function setupDraw() {
  const card = document.getElementById('draw-card');
  const nameElement = document.getElementById('draw-name');
  const platformElement = document.getElementById('draw-platform');
  const groupElement = document.getElementById('draw-group');
  const emptyElement = document.getElementById('draw-empty');
  const visitButton = document.getElementById('draw-visit');

  if (!card) return;

  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  drawRandom = () => {
    const candidates = allUnvisitedEntries();
    if (!candidates.length) {
      card.hidden = true;
      emptyElement.hidden = false;
      drawn = null;
      return;
    }
    emptyElement.hidden = true;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    drawn = {
      platformKey: pick.platformKey,
      entry: pick.entry,
      markVisited: () => {
        const platform = PLATFORMS[pick.platformKey];
        const platformState = state[pick.platformKey];
        platformState.visited.add(pick.entry.url);
        saveVisited(platform.key, platformState.visited);
        if (pick.platformKey === current) {
          renderCurrent();
        }
      }
    };
    nameElement.textContent = pick.entry.name;
    platformElement.textContent = TAB_LABELS[pick.platformKey] || pick.platformKey;
    groupElement.textContent = pick.entry.group;
    card.hidden = false;
  };

  card.addEventListener('click', () => {
    if (!drawn) return;
    drawn.markVisited();
    window.open(drawn.entry.url, '_blank', 'noopener');
  });

  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    card.click();
  });

  if (visitButton) {
    visitButton.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!drawn) return;
      drawn.markVisited();
      window.open(drawn.entry.url, '_blank', 'noopener');
    });
  }

  drawRandom();
}

async function init() {
  try {
    const response = await fetch('pages.json');
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const pages = await response.json();

    const platformData = {};
    const socialPlatforms = ['facebook', 'instagram', 'x', 'youtube', 'telegram'];

    for (const key of Object.keys(pages || {})) {
      if (key === 'updated') continue;
      const value = pages[key];
      if (!Array.isArray(value)) continue;

      const isPersonalityList = value.length && value.every((item) => item && typeof item === 'object' && !Array.isArray(item) && !item.url);

      if (isPersonalityList) {
        for (const person of value) {
          for (const platform of socialPlatforms) {
            const url = person[platform];
            if (!url) continue;
            platformData[platform] = platformData[platform] || [];
            platformData[platform].push({
              url: url,
              name: person.name + (person.pays ? ' (' + person.pays + ')' : ''),
              group: person.pays || key
            });
          }
        }
      } else {
        platformData[key] = value;
      }
    }

    PLATFORMS = buildPlatforms(platformData);
    const updatedElement = document.getElementById('updated');
    if (updatedElement && pages.updated) {
      const date = new Date(pages.updated);
      const label = isNaN(date.getTime()) ? pages.updated : date.toLocaleString('fr-BE');
      updatedElement.textContent = 'Liste mise \u00e0 jour le : ' + label;
    }

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

    setupDraw();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && drawRandom) {
        drawRandom();
      }
    });
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
