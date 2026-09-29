// Portfolio page: every project in one grid, with tabs that narrow it to one service.
// The tab comes from ?service=<id> (see serviceUrl in projects.js), and a project from
// #<slug> (see projectUrl).
import { PROJECTS, SERVICES, findService } from './projects.js';
import { createProjectTile } from './project-tiles.js';

var ALL = 'all';

export function initPortfolio(){
  var tabList = document.getElementById('portfolioTabs');
  var grid = document.getElementById('portfolioGrid');
  var tabs = [];
  var tiles = [];

  [{ id: ALL, label: 'All' }].concat(SERVICES).forEach(function(service){
    var tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'portfolio-tab';
    tab.dataset.service = service.id;
    tab.textContent = service.label;
    tab.addEventListener('click', function(){ select(service.id, true); });
    tabList.appendChild(tab);
    tabs.push(tab);
  });

  PROJECTS.forEach(function(project){
    var tile = createProjectTile(project);
    // The anchor a project link lands on.
    tile.id = project.slug;
    grid.appendChild(tile);
    tiles.push(tile);
  });

  function select(serviceId, updateUrl){
    if (serviceId !== ALL && !findService(serviceId)) serviceId = ALL;
    tabs.forEach(function(tab){
      tab.setAttribute('aria-pressed', String(tab.dataset.service === serviceId));
    });
    tiles.forEach(function(tile){
      tile.hidden = serviceId !== ALL && tile.dataset.service !== serviceId;
    });
    if (updateUrl){
      var url = serviceId === ALL ? location.pathname : '?service=' + encodeURIComponent(serviceId);
      history.replaceState(null, '', url);
    }
  }

  select(new URLSearchParams(location.search).get('service') || ALL, false);

  // Tiles are built after load, so the browser's own jump to #slug has already missed them.
  if (location.hash){
    var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target && !target.hidden) target.scrollIntoView({ block: 'center' });
  }
}
