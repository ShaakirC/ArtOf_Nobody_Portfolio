// Portfolio page: one section per service, in SERVICES order, each with its projects as tiles.
// This is scaffolding until the page is built out. Sections are anchored by service id
// (#<id>, see serviceUrl in projects.js), which is where the home page reels link to, and
// tiles by slug (#<slug>, see projectUrl).
import { SERVICES, projectsFor } from './projects.js';
import { createProjectTile } from './project-tiles.js';

export function initPortfolio(){
  var container = document.getElementById('portfolioSections');

  SERVICES.forEach(function(service){
    var section = document.createElement('section');
    section.className = 'portfolio-section';
    section.id = service.id;
    var heading = document.createElement('h2');
    heading.className = 'portfolio-section-title';
    heading.id = service.id + '-title';
    heading.textContent = service.label;
    section.setAttribute('aria-labelledby', heading.id);
    section.appendChild(heading);

    var grid = document.createElement('div');
    grid.className = 'portfolio-grid';
    projectsFor(service.id).forEach(function(project){
      // The section heading already names the service.
      var tile = createProjectTile(project, { showService: false });
      // The anchor a project link lands on.
      tile.id = project.slug;
      grid.appendChild(tile);
    });
    section.appendChild(grid);
    container.appendChild(section);
  });

  // The sections are built after load, so the browser's own jump to the hash has already
  // missed them. A service lands at the top of the screen, a project in the middle.
  if (location.hash){
    var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target){
      var isSection = target.classList.contains('portfolio-section');
      target.scrollIntoView({ block: isSection ? 'start' : 'center' });
    }
  }
}
