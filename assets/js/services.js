import * as ModelStage from './model-stage.js';
import { PREVIEWS_PER_SERVICE, projectsFor, serviceUrl } from './projects.js';
import { createProjectTile } from './project-tiles.js';
import { zipText } from './zip-text.js';

// options.modelsAfter: a promise to wait for before loading the service models (the hero
// logo), so they don't compete for bandwidth. The first service shows as soon as the page
// scrolls, so scrolling loads them straight away.
export function initServices(options){
  options = options || {};
  // ---------- services scroll ----------
  // Each .panel is one service step. Its model comes from data-model, and
  // data-model-behavior optionally names a ModelStage behavior. data-service names the
  // service in js/projects.js whose projects it previews.
  // The scroll splits into one equal step per service; the progress fill, the step number and
  // the text all change at the same step boundaries. Each model plays across its own step, and
  // hands over to the next one in a window centered on the boundary, this share of a step wide.
  var MODEL_OVERLAP = 0.25;

  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
  var progressBar = document.getElementById('servicesProgress');
  var progressStepsContainer = document.getElementById('servicesProgressSteps');
  var modelCanvas = document.getElementById('serviceModels');
  var wrap = document.querySelector('.services-wrap');
  // The section starts behind the hero; the first service arrives once the hero has scrolled
  // clear of its heading.
  var hero = document.querySelector('.hero');
  var firstHeading = panels.length ? panels[0].querySelector('h2') : null;
  var serviceSections = Math.max(1, panels.length);
  var previewSets = [];
  var progressSteps = [];
  var progressSegments = [];
  var modelStage = null;
  var modelEntries = [];
  var currentProgress = 0;

  panels.forEach(function(panel, index){
    var item = document.createElement('div');
    item.className = 'services-progress-item';
    var step = document.createElement('span');
    step.className = 'services-progress-step' + (index === 0 ? ' active' : '');
    step.dataset.i = index;
    step.textContent = (index + 1 < 10 ? '0' : '') + (index + 1);
    item.appendChild(step);
    var segment = document.createElement('div');
    segment.className = 'services-progress-segment';
    var segmentFill = document.createElement('div');
    segmentFill.className = 'services-progress-segment-fill';
    segment.appendChild(segmentFill);
    item.appendChild(segment);
    progressStepsContainer.appendChild(item);
    progressSteps.push(step);
    progressSegments.push(segmentFill);
  });

  // ---------- zipper text ----------
  // Each panel's tag, paragraph and list items zip in and out letter by letter with the
  // heading's transition. Left as plain text when the visitor prefers reduced motion.
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    panels.forEach(function(panel){
      zipText(panel.querySelectorAll(':scope > p, li'));
    });
  }

  // ---------- project previews ----------
  var previewContainer = document.getElementById('servicePreviews');
  panels.forEach(function(panel){
    var serviceId = panel.dataset.service;
    var set = document.createElement('div');
    set.className = 'preview-set';
    projectsFor(serviceId).slice(0, PREVIEWS_PER_SERVICE).forEach(function(project){
      set.appendChild(createProjectTile(project));
    });
    previewContainer.appendChild(set);
    previewSets.push(set);

    // Previews are hidden on small screens, so each service links to its portfolio tab there.
    var link = document.createElement('a');
    link.className = 'panel-portfolio-link';
    link.href = serviceUrl(serviceId);
    link.textContent = 'View projects';
    panel.appendChild(link);
  });

  // ---------- service steps ----------
  // Each service holds still for its stretch of the scroll. Crossing into the next one plays
  // a short timed transition instead of scrubbing it: .is-entering and .is-leaving drive the
  // animations in the stylesheet, and are cleared once those have finished.
  var LEAVE_TIME = 800; // ms, the leave animation's duration in styles.css
  var ENTER_TIME = 1120; // ms, the enter animation's delay plus duration in styles.css
  var shownIndex = -1;
  var stepTimers = [];

  // index -1 shows no service (the hero still covers the headings).
  function showService(index){
    var previous = shownIndex;
    shownIndex = index;
    panels.forEach(function(panel, i){
      var active = i === index;
      clearTimeout(stepTimers[i]);
      if (panel.classList.contains('is-entering')){
        panel.classList.remove('is-entering');
        // Restart the animation if the same service comes straight back.
        void panel.offsetWidth;
      }
      panel.classList.remove('is-leaving');
      if (active){
        panel.classList.add('is-entering');
        stepTimers[i] = setTimeout(function(){ panel.classList.remove('is-entering'); }, ENTER_TIME);
      } else if (i === previous){
        panel.classList.add('is-leaving');
        stepTimers[i] = setTimeout(function(){ panel.classList.remove('is-leaving'); }, LEAVE_TIME);
      }
      panel.classList.toggle('is-active', active);
      panel.setAttribute('aria-hidden', String(!active));
      if (previewSets[i]){
        previewSets[i].classList.toggle('is-active', active);
        previewSets[i].setAttribute('aria-hidden', String(!active));
      }
    });
  }

  function sizeServices(){
    var segmentHeight = window.innerWidth <= 860 ? 121.3333 : 134.6667;
    wrap.style.height = (2 + serviceSections * segmentHeight) + 'vh';
  }
  sizeServices();

  // The stretch of overall progress over which model `index` plays, 0 to 1. The first starts
  // at the top of the section and the last ends at the bottom; the rest reach half the
  // overlap window past each of their step's boundaries.
  function modelSpan(index){
    var step = 1 / serviceSections;
    var reach = step * MODEL_OVERLAP / 2;
    return {
      start: index === 0 ? 0 : index * step - reach,
      end: index === serviceSections - 1 ? 1 : (index + 1) * step + reach
    };
  }

  function syncModels(){
    var anyVisible = false;
    modelEntries.forEach(function(entry, index){
      if (!entry) return;
      var span = modelSpan(index);
      var entryProgress = (currentProgress - span.start) / (span.end - span.start);
      var isActive = entryProgress >= 0 && entryProgress <= 1;
      modelStage.setEntryVisible(entry, isActive);
      modelStage.setEntryProgress(entry, entryProgress);
      if (isActive) anyVisible = true;
    });
    modelCanvas.style.visibility = anyVisible ? 'visible' : 'hidden';
  }

  var ticking = false;

  function update(){
    ticking = false;
    var rect = wrap.getBoundingClientRect();
    var vh = window.innerHeight;
    var total = rect.height - vh * 2;
    var scrolled = -rect.top - vh;
    var progress = total > 0 ? scrolled / total : 0;
    progress = Math.max(0, Math.min(1, progress));
    currentProgress = progress;
    progressBar.setAttribute('aria-valuenow', Math.round(progress * 100));

    var segments = serviceSections;
    var scaled = progress * segments;
    var idx = Math.floor(scaled);
    if (idx >= segments) idx = segments - 1;
    var localT = scaled - idx;
    if (progress >= 1) { idx = segments - 1; localT = 1; }
    if (progress <= 0) { idx = 0; localT = 0; }

    progressSegments.forEach(function(segmentFill, index){
      var segmentProgress = index < idx ? 1 : (index === idx ? localT : 0);
      segmentFill.style.height = (segmentProgress * 100) + '%';
    });

    syncModels();

    var activeIndex = idx;
    progressSteps.forEach(function(step, index){
      step.classList.toggle('active', index === activeIndex);
    });

    // The text switches with the progress number, not gradually with the scroll.
    var heroCleared = !hero || !firstHeading ||
      hero.getBoundingClientRect().bottom <= firstHeading.getBoundingClientRect().top;
    var shownTarget = heroCleared ? activeIndex : -1;
    if (shownTarget !== shownIndex) showService(shownTarget);
  }

  function onScroll(){
    if (!ticking){
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function(){
    sizeServices();
    onScroll();
  });
  update();

  // ---------- service models ----------
  modelStage = ModelStage.create(modelCanvas);
  modelStage.ready.catch(function(error){
    console.error('Unable to start the model stage:', error);
    modelCanvas.setAttribute('aria-label', 'Service icons unavailable');
  });

  var modelsRequested = false;
  function loadModels(){
    if (modelsRequested) return;
    modelsRequested = true;
    window.removeEventListener('scroll', onFirstScroll);
    panels.forEach(function(panel, index){
      var src = panel.dataset.model;
      if (!src) return;
      modelStage.load(src, { behavior: panel.dataset.modelBehavior }).then(function(entry){
        modelEntries[index] = entry;
        syncModels();
      }, function(error){
        console.error('Unable to load model ' + src + ':', error);
      });
    });
  }

  function onFirstScroll(){
    if (window.scrollY > 0) loadModels();
  }

  window.addEventListener('scroll', onFirstScroll, { passive: true });
  onFirstScroll();
  Promise.resolve(options.modelsAfter).then(loadModels);
}
