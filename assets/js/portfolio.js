// Portfolio page, built from assets/data/projects.json (through projects.js):
// - the intro's "Clients include..." line,
// - the featured grid (projects with `featured`, hover loops on fine pointers),
// - the index: one row per visible project, filtered by category and sorted by year or
//   client, with both kept in the URL (?category=film&sort=client) so views can be shared,
// - the detail view (portfolio-detail.js), opened from cards and rows and deep-linked as
//   #project-<id>.
import {
  loadProjects, visibleProjects, featuredProjects, indexProjects, highlightedClients,
  clientLabel, primaryCategory
} from './projects.js';
import { createDetail } from './portfolio-detail.js';

var ALL = 'all';
var DEFAULT_SORT = 'year-desc';
// The most client names the intro lists.
var MAX_CLIENTS = 6;
// The sort names used in the URL, where they differ from the internal ones.
var SORT_PARAMS = { 'client-asc': 'client' };
var HASH_PREFIX = '#project-';

export function initPortfolio(){
  var main = document.querySelector('main.portfolio');
  loadProjects().then(function(data){
    render(data);
  }, function(error){
    console.error('Unable to load the projects:', error);
    showLoadError(main);
  }).then(function(){
    // The index stays invisible until everything above it is in place (see .is-loading).
    main.classList.remove('is-loading');
  });
}

function render(data){
  var hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var detail = createDetail(document.getElementById('pfDetail'), data, {
    onClose: function(){ setHash(''); }
  });
  var byId = {};
  visibleProjects(data).forEach(function(project){ byId[project.id] = project; });

  renderClients(data);
  renderFeatured(data, detail, hoverQuery, reducedMotion);

  // ---------- index ----------
  var list = document.getElementById('pfIndex');
  var filterBar = document.getElementById('pfFilters');
  var count = document.getElementById('pfCount');
  var empty = document.getElementById('pfEmpty');
  var sortButtons = Array.prototype.slice.call(document.querySelectorAll('.pf-sort'));
  var params = new URLSearchParams(location.search);
  var state = {
    category: params.get('category') || ALL,
    sort: sortFromParam(params.get('sort'))
  };
  // Old links named the category in the hash (portfolio.html#film).
  var legacy = location.hash.slice(1);
  if (!params.get('category') && data.categories.some(function(c){ return c.id === legacy; })){
    state.category = legacy;
  }
  if (state.category !== ALL && !data.categories.some(function(c){ return c.id === state.category; })){
    state.category = ALL;
  }

  var filterButtons = [{ id: ALL, label: 'All' }].concat(data.categories).map(function(category){
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'pf-filter';
    button.dataset.filter = category.id;
    button.textContent = category.label;
    button.addEventListener('click', function(){
      state.category = category.id;
      update(true);
    });
    filterBar.appendChild(button);
    return button;
  });

  sortButtons.forEach(function(button){
    button.addEventListener('click', function(){
      var key = button.dataset.sort;
      var current = state.sort.split('-');
      // A second click on the same column flips it; a new column starts at its natural
      // direction (newest years first, clients A to Z).
      if (current[0] === key) state.sort = key + '-' + (current[1] === 'asc' ? 'desc' : 'asc');
      else state.sort = key === 'year' ? 'year-desc' : 'client-asc';
      update(true);
    });
  });

  function update(writeUrl){
    filterButtons.forEach(function(button){
      button.setAttribute('aria-pressed', String(button.dataset.filter === state.category));
    });
    sortButtons.forEach(function(button){
      var parts = state.sort.split('-');
      var active = parts[0] === button.dataset.sort;
      button.setAttribute('aria-pressed', String(active));
      if (active) button.dataset.dir = parts[1];
      else delete button.dataset.dir;
      var name = button.dataset.sort === 'year' ? 'year' : 'client';
      button.setAttribute('aria-label', 'Sort by ' + name + (active
        ? (name === 'year' ? (parts[1] === 'desc' ? ', newest first' : ', oldest first') : (parts[1] === 'asc' ? ', A to Z' : ', Z to A'))
        : ''));
    });
    var rows = indexProjects(data, { category: state.category, sort: state.sort });
    list.replaceChildren.apply(list, rows.map(function(project){ return createRow(data, project); }));
    count.textContent = rows.length + (rows.length === 1 ? ' project' : ' projects');
    empty.hidden = rows.length > 0;
    if (writeUrl) writeState();
  }

  function writeState(){
    var query = new URLSearchParams(location.search);
    if (state.category === ALL) query.delete('category');
    else query.set('category', state.category);
    if (state.sort === DEFAULT_SORT) query.delete('sort');
    else query.set('sort', SORT_PARAMS[state.sort] || state.sort);
    var search = query.toString();
    history.replaceState(history.state, '', location.pathname + (search ? '?' + search : '') + location.hash);
  }

  update(false);
  // Drop a legacy #<category> hash now that it's in the query.
  if (legacy && legacy === state.category){
    history.replaceState(history.state, '', location.pathname + location.search);
    writeState();
  }

  // ---------- opening projects ----------
  // Cards and rows are links to #project-<id>, so they work as links (new tab, copy link).
  // A plain click opens the detail view in place and swaps the hash without a history entry.
  document.addEventListener('click', function(event){
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest('a[data-project]');
    if (!link) return;
    var project = byId[link.dataset.project];
    if (!project) return;
    event.preventDefault();
    openProject(project, link);
  });

  function openProject(project, opener){
    setHash(HASH_PREFIX + project.id);
    detail.open(project, opener);
  }

  function openFromHash(){
    if (location.hash.indexOf(HASH_PREFIX) !== 0) return;
    var project = byId[decodeURIComponent(location.hash.slice(HASH_PREFIX.length))];
    if (project && project.detail && project.detail !== 'none'){
      var opener = document.querySelector('a[data-project="' + CSS.escape(project.id) + '"]');
      detail.open(project, opener);
    }
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
}

function sortFromParam(value){
  if (!value) return DEFAULT_SORT;
  for (var key in SORT_PARAMS){
    if (SORT_PARAMS[key] === value) return key;
  }
  return ['year-desc', 'year-asc', 'client-asc', 'client-desc'].indexOf(value) !== -1 ? value : DEFAULT_SORT;
}

function setHash(hash){
  history.replaceState(history.state, '', location.pathname + location.search + hash);
}

// "Clients include A, B, C and D."
function renderClients(data){
  var names = highlightedClients(data).slice(0, MAX_CLIENTS);
  var line = document.getElementById('pfClients');
  if (!names.length) return;
  var list = names.length === 1 ? names[0]
    : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  line.textContent = 'Clients include ' + list + '.';
  line.hidden = false;
}

// ---------- featured ----------
function renderFeatured(data, detail, hoverQuery, reducedMotion){
  var projects = featuredProjects(data);
  var section = document.getElementById('pfFeaturedSection');
  var grid = document.getElementById('pfFeatured');
  if (!projects.length) return;

  projects.forEach(function(project, index){
    var opens = project.detail && project.detail !== 'none';
    var card = document.createElement(opens ? 'a' : 'div');
    card.className = 'pf-card pf-card--' + project.featured.layout;
    if (opens){
      card.href = '#project-' + project.id;
      card.dataset.project = project.id;
    }

    var media = document.createElement('div');
    media.className = 'pf-card-media';
    var still = project.media.thumb || project.media.poster;
    if (still){
      var image = document.createElement('img');
      image.src = still;
      image.alt = project.media.thumbAlt || '';
      // The first card is usually in view on arrival; the rest can wait.
      image.loading = index === 0 ? 'eager' : 'lazy';
      image.decoding = 'async';
      media.appendChild(image);
    }
    card.appendChild(media);

    var caption = document.createElement('div');
    caption.className = 'pf-card-caption';
    var title = document.createElement('h3');
    title.className = 'pf-card-title';
    title.textContent = project.title;
    if (project.concept) title.appendChild(conceptTag());
    caption.appendChild(title);
    var meta = [clientLabel(project), (primaryCategory(data, project) || {}).label].filter(Boolean);
    if (meta.length){
      var line = document.createElement('p');
      line.className = 'pf-card-meta';
      line.textContent = meta.join(' · ');
      caption.appendChild(line);
    }
    card.appendChild(caption);

    if (project.media.hoverLoop) addHoverLoop(card, media, project.media.hoverLoop, hoverQuery, reducedMotion);
    grid.appendChild(card);
  });
  section.hidden = false;
}

// Plays the loop while a fine pointer is over the card. Nothing downloads until the first
// hover; touch screens and reduced motion keep the still.
function addHoverLoop(card, media, src, hoverQuery, reducedMotion){
  var video = null;
  card.addEventListener('pointerenter', function(){
    if (!hoverQuery.matches || reducedMotion.matches) return;
    if (!video){
      video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none';
      video.setAttribute('aria-hidden', 'true');
      video.addEventListener('playing', function(){ media.classList.add('is-playing'); });
      video.src = src;
      media.appendChild(video);
    }
    var started = video.play();
    if (started) started.catch(function(){});
  });
  card.addEventListener('pointerleave', function(){
    if (!video) return;
    media.classList.remove('is-playing');
    video.pause();
    video.currentTime = 0;
  });
}

// ---------- index rows ----------
var ICONS = {
  page: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  view: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'
};

function createRow(data, project){
  var item = document.createElement('li');
  item.className = 'pf-row';
  var opens = project.detail && project.detail !== 'none';
  var row = document.createElement(opens ? 'a' : 'div');
  row.className = 'pf-row-inner';
  if (opens){
    row.href = '#project-' + project.id;
    row.dataset.project = project.id;
  } else {
    item.classList.add('is-static');
  }

  row.appendChild(cell('year', typeof project.year === 'number' ? String(project.year) : ''));
  row.appendChild(cell('client', clientLabel(project)));
  var title = cell('title', project.title || '');
  if (project.concept) title.appendChild(conceptTag());
  row.appendChild(title);
  row.appendChild(cell('role', (project.role || []).join(' · ')));
  row.appendChild(cell('pillar', (primaryCategory(data, project) || {}).label || ''));

  var action = document.createElement('span');
  action.className = 'pf-col-action';
  action.setAttribute('aria-hidden', 'true');
  if (opens){
    var kind = project.detail === 'page' ? 'page' : (project.media.video ? 'play' : 'view');
    action.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">' + ICONS[kind] + '</svg>';
  }
  row.appendChild(action);
  item.appendChild(row);
  return item;
}

function cell(name, text){
  var span = document.createElement('span');
  span.className = 'pf-col-' + name;
  span.textContent = text;
  return span;
}

function conceptTag(){
  var tag = document.createElement('span');
  tag.className = 'pf-tag';
  tag.textContent = 'Concept';
  return tag;
}

function showLoadError(main){
  var message = document.createElement('div');
  message.className = 'pf-error';
  message.setAttribute('role', 'alert');
  message.innerHTML = '<p>The projects couldn\'t be loaded just now. Please try again in a moment.</p>' +
    '<a href="index.html#contact">Or get in touch</a>';
  Array.prototype.forEach.call(main.querySelectorAll('.pf-featured, .pf-index'), function(section){
    section.hidden = true;
  });
  main.appendChild(message);
}
