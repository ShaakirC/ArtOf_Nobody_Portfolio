// Square project tile, used by the services previews and the portfolio grid.
// Clicks aren't wired yet: each tile carries its portfolio URL in data-href for when they are.
// The tile is a fixed frame; its image and caption sit in .project-tile-inner, which can
// slide within the frame (the services preview transition) while the frame stays put.
import { findService, projectUrl } from './projects.js';

export function createProjectTile(project){
  var tile = document.createElement('article');
  tile.className = 'project-tile';
  tile.dataset.project = project.slug;
  tile.dataset.service = project.service;
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

  var caption = document.createElement('div');
  caption.className = 'project-tile-caption';
  var service = findService(project.service);
  if (service){
    var tag = document.createElement('p');
    tag.className = 'project-tile-service';
    tag.textContent = service.label;
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
