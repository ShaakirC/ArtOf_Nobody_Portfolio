// Square project tile, used by the portfolio grid.
// Clicks aren't wired yet: each tile carries its portfolio URL in data-href for when they are.
// The tile is a fixed frame; its image and caption sit in .project-tile-inner, which can
// slide within the frame while the frame stays put.
import { findService, projectUrl } from './projects.js';

// options.showService: false leaves out the small label naming the project's services.
export function createProjectTile(project, options){
  options = options || {};
  var tile = document.createElement('article');
  tile.className = 'project-tile';
  tile.dataset.project = project.slug;
  tile.dataset.categories = project.categories.join(' ');
  tile.dataset.href = projectUrl(project.slug);

  var inner = document.createElement('div');
  inner.className = 'project-tile-inner';

  var media = document.createElement('div');
  media.className = 'project-tile-media';
  if (project.image){
    var image = document.createElement('img');
    image.src = project.image;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    media.appendChild(image);
  } else {
    media.classList.add('is-placeholder');
  }
  inner.appendChild(media);

  // Self-initiated work is always labelled as such.
  if (project.concept){
    var badge = document.createElement('span');
    badge.className = 'concept-badge';
    badge.textContent = 'Concept';
    inner.appendChild(badge);
  }

  var caption = document.createElement('div');
  caption.className = 'project-tile-caption';
  var labels = project.categories.map(findService).filter(Boolean).map(function(service){
    return service.label;
  });
  if (labels.length && options.showService !== false){
    var tag = document.createElement('p');
    tag.className = 'project-tile-service';
    tag.textContent = labels.join(' · ');
    caption.appendChild(tag);
  }
  var title = document.createElement('h3');
  title.className = 'project-tile-title';
  title.textContent = project.title;
  caption.appendChild(title);
  inner.appendChild(caption);
  tile.appendChild(inner);

  return tile;
}
