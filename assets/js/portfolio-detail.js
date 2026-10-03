// The project detail view: one native <dialog> (#pfDetail), rebuilt for each project.
// detail "page" shows the full write-up (credits, link, summary, video, breakdown images);
// "lightbox" just the video, or the poster/thumb when there's no video. A video can be a file
// on the site or a YouTube/Vimeo URL (embedded, privacy-enhanced), so full-length films don't
// have to live in the repository.
//
// Escape, the close button and a click on the backdrop all close it. Closing empties it (which
// stops any video or embed), unlocks the page scroll and returns focus to whatever opened it.
import { clientLabel, findCategory, isLocalVideo } from './projects.js';

export function createDetail(dialog, data, options){
  options = options || {};
  var opener = null;

  // A click on the backdrop lands on the dialog itself; its content fills it edge to edge.
  dialog.addEventListener('click', function(event){
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', function(){
    // The close event arrives asynchronously; if another project opened meanwhile, it's
    // already showing and this close is stale.
    if (dialog.open) return;
    Array.prototype.forEach.call(dialog.querySelectorAll('video'), function(video){ video.pause(); });
    dialog.replaceChildren();
    unlockScroll();
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    opener = null;
    if (options.onClose) options.onClose();
  });

  function open(project, from){
    // Already open (e.g. the hash changed by hand): swap the content in place. Closing first
    // would empty it again, because the close event arrives asynchronously.
    if (from || !dialog.open) opener = from || null;
    Array.prototype.forEach.call(dialog.querySelectorAll('video'), function(video){ video.pause(); });
    var lightbox = project.detail !== 'page';
    dialog.className = 'pf-detail' + (lightbox ? ' is-lightbox' : '');
    dialog.replaceChildren(lightbox ? buildLightbox(project) : buildPage(data, project));
    if (!dialog.open){
      lockScroll();
      dialog.showModal();
    }
    // Start at the top, with focus on the close button rather than the first video control.
    dialog.querySelector('.pf-detail-close').focus();
  }

  return { open: open, close: function(){ if (dialog.open) dialog.close(); } };
}

function buildPage(data, project){
  var body = shell(project);
  var meta = [clientLabel(project), typeof project.year === 'number' ? String(project.year) : ''].filter(Boolean);
  if (meta.length) body.header.appendChild(element('p', 'pf-detail-meta', meta.join(' · ')));

  var tags = element('div', 'pf-detail-tags');
  project.categories.forEach(function(id){
    var category = findCategory(data, id);
    if (category) tags.appendChild(element('span', 'pf-tag pf-tag--quiet', category.label));
  });
  if (project.concept) tags.appendChild(element('span', 'pf-tag', 'Concept'));
  if (tags.childNodes.length) body.header.appendChild(tags);

  if (project.summary) body.content.appendChild(element('p', 'pf-detail-summary', project.summary));
  var credits = element('dl', 'pf-detail-credits');
  [['Role', project.role], ['Tools', project.tools]].forEach(function(pair){
    if (!pair[1] || !pair[1].length) return;
    credits.appendChild(element('dt', '', pair[0]));
    credits.appendChild(element('dd', '', pair[1].join(' · ')));
  });
  var link = buildLink(project.link);
  if (link){
    credits.appendChild(element('dt', '', 'Link'));
    var cell = element('dd', '');
    cell.appendChild(link);
    credits.appendChild(cell);
  }
  if (credits.childNodes.length) body.content.appendChild(credits);

  var media = project.media || {};
  var player = buildVideo(media, project.title);
  if (player) body.content.appendChild(player);
  (media.breakdown || []).forEach(function(src){
    var image = document.createElement('img');
    image.className = 'pf-detail-image';
    image.src = src;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    body.content.appendChild(image);
  });
  return body.root;
}

function buildLightbox(project){
  var body = shell(project);
  var media = project.media || {};
  var player = buildVideo(media, project.title);
  if (!player){
    var still = media.poster || media.thumb;
    if (still){
      player = document.createElement('img');
      player.className = 'pf-detail-image';
      player.src = still;
      player.alt = media.thumbAlt || project.title || '';
    }
  }
  if (player) body.content.appendChild(player);
  return body.root;
}

// Title, close button and an empty content area.
function shell(project){
  var root = element('div', 'pf-detail-body');
  var header = element('header', 'pf-detail-header');
  var title = element('h2', 'pf-detail-title', project.title || '');
  title.id = 'pfDetailTitle';
  header.appendChild(title);
  var close = element('button', 'pf-detail-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  // The dialog lives outside any form, so close it directly.
  close.addEventListener('click', function(){ close.closest('dialog').close(); });
  root.appendChild(close);
  root.appendChild(header);
  var content = element('div', 'pf-detail-content');
  root.appendChild(content);
  return { root: root, header: header, content: content };
}

function buildVideo(media, title){
  if (!media.video) return null;
  if (isLocalVideo(media.video)){
    var video = document.createElement('video');
    video.className = 'pf-detail-video';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    if (media.poster || media.thumb) video.poster = media.poster || media.thumb;
    video.src = media.video;
    return video;
  }
  var embed = embedUrl(media.video);
  if (!embed) return null;
  var frame = element('div', 'pf-detail-embed');
  var iframe = document.createElement('iframe');
  iframe.src = embed;
  iframe.title = title ? title + ' (video)' : 'Video';
  iframe.loading = 'lazy';
  iframe.allow = 'fullscreen; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.appendChild(iframe);
  return frame;
}

// An external link (live site, case study, ...) labelled by its host and path, opening in a
// new tab. Anything that isn't http(s) is left out, so a bad cell can't become a script URL.
function buildLink(href){
  var url;
  try { url = new URL(href); } catch (error) { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  var anchor = element('a', 'pf-detail-link', url.hostname.replace(/^www\./, '') + url.pathname.replace(/\/$/, ''));
  anchor.href = url.href;
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  return anchor;
}

// The embeddable player for a YouTube or Vimeo page URL, or null if it's neither.
// YouTube goes through youtube-nocookie.com, Vimeo with do-not-track.
export function embedUrl(url){
  var match;
  try { url = new URL(url); } catch (error) { return null; }
  var host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be'){
    match = url.pathname.slice(1);
  } else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)){
    match = url.searchParams.get('v') || (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/) || [])[1];
  }
  if (match) return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(match);
  if (/(^|\.)vimeo\.com$/.test(host)){
    match = (url.pathname.match(/(\d+)(?:\/([0-9a-f]+))?\/?$/) || []);
    if (match[1]) return 'https://player.vimeo.com/video/' + match[1] + '?dnt=1' + (match[2] ? '&h=' + match[2] : '');
  }
  return null;
}

// Stops the page scrolling behind the dialog. Hiding the scrollbar would widen the page, so
// the fixed and centred parts are held where they were by its width (--scrollbar-comp).
function lockScroll(){
  var root = document.documentElement;
  root.style.setProperty('--scrollbar-comp', (window.innerWidth - root.clientWidth) + 'px');
  root.classList.add('is-scroll-locked');
}

function unlockScroll(){
  var root = document.documentElement;
  root.classList.remove('is-scroll-locked');
  root.style.removeProperty('--scrollbar-comp');
}

function element(tag, className, text){
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
