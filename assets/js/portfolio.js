// Portfolio page: one grid of every visible project, filtered by service. The filters are
// All plus one per SERVICES entry. #<service id> opens on that filter (see serviceUrl in
// projects.js; the home page reels link there), and #<slug> centres that project's tile
// (see projectUrl). Picking a filter updates the hash, so a filtered view can be shared.
import { SERVICES, findService, visibleProjects } from './projects.js';
import { createProjectTile } from './project-tiles.js';

var ALL = 'all';

export function initPortfolio(){
  var filterBar = document.getElementById('portfolioFilters');
  var grid = document.getElementById('portfolioGrid');
  var empty = document.getElementById('portfolioEmpty');
  var emptyText = document.getElementById('portfolioEmptyText');
  var defaultEmptyText = emptyText.textContent;
  var buttons = [];
  var tiles = [];

  [{ id: ALL, label: 'All' }].concat(SERVICES).forEach(function(service){
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'portfolio-filter';
    button.dataset.filter = service.id;
    button.textContent = service.label;
    button.addEventListener('click', function(){
      setFilter(service.id);
      // Shareable, without adding a history entry per click.
      history.replaceState(null, '', service.id === ALL ? location.pathname + location.search : '#' + service.id);
    });
    filterBar.appendChild(button);
    buttons.push(button);
  });

  visibleProjects().forEach(function(project){
    var tile = createProjectTile(project);
    // The anchor a project link lands on.
    tile.id = project.slug;
    grid.appendChild(tile);
    tiles.push({ element: tile, project: project });
  });

  function setFilter(id){
    var shown = 0;
    buttons.forEach(function(button){
      button.setAttribute('aria-pressed', String(button.dataset.filter === id));
    });
    tiles.forEach(function(tile){
      var match = id === ALL || tile.project.categories.indexOf(id) !== -1;
      tile.element.hidden = !match;
      if (match) shown++;
    });
    var service = findService(id);
    emptyText.textContent = (service && service.empty) || defaultEmptyText;
    empty.hidden = shown > 0;
  }

  // The grid is built after load, so the browser's own jump to the hash has already missed
  // it. A service hash picks its filter; a project hash shows everything and centres it.
  var hash = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
  if (findService(hash)){
    setFilter(hash);
  } else {
    setFilter(ALL);
    var target = hash && document.getElementById(hash);
    if (target && target.classList.contains('project-tile')) target.scrollIntoView({ block: 'center' });
  }
}
