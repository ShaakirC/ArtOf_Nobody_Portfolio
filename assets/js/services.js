import * as ModelStage from './model-stage.js';

// options.modelsAfter: a promise to wait for before loading the service models (the hero
// logo), so they don't compete for bandwidth. The first service shows as soon as the page
// scrolls, so scrolling loads them straight away.
export function initServices(options){
  options = options || {};
  // ---------- services scroll ----------
  // Each .panel is one service step. Its model comes from data-model, and
  // data-model-behavior optionally names a ModelStage behavior.
  // Fraction of each model's animation that overlaps the next service's model.
  var MODEL_OVERLAP = 0.25;

  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
  var progressBar = document.getElementById('servicesProgress');
  var progressStepsContainer = document.getElementById('servicesProgressSteps');
  var modelCanvas = document.getElementById('serviceModels');
  var wrap = document.querySelector('.services-wrap');
  var serviceSections = Math.max(1, panels.length);
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

  function sizeServices(){
    var segmentHeight = window.innerWidth <= 860 ? 121.3333 : 134.6667;
    wrap.style.height = (2 + serviceSections * segmentHeight) + 'vh';
  }
  sizeServices();

  function syncModels(){
    var timelineLength = 1 + (serviceSections - 1) * (1 - MODEL_OVERLAP);
    var timelinePosition = currentProgress * timelineLength;
    var anyVisible = false;
    modelEntries.forEach(function(entry, index){
      if (!entry) return;
      var entryProgress = timelinePosition - index * (1 - MODEL_OVERLAP);
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

    var activeIndex = idx + (localT >= 0.85 ? 1 : 0);
    if (activeIndex >= segments) activeIndex = segments - 1;
    progressSteps.forEach(function(step, index){
      step.classList.toggle('active', index === activeIndex);
    });

    var textTransitionT = localT < 0.75 ? 0 : (localT - 0.75) / 0.25;
    panels.forEach(function(panel, i){
      var opacity = idx === segments - 1
        ? (i === idx ? 1 : 0)
        : (i === idx ? 1 - textTransitionT : (i === idx + 1 ? textTransitionT : 0));
      panel.style.opacity = opacity;
      panel.style.pointerEvents = opacity > 0.6 ? 'auto' : 'none';
      panel.setAttribute('aria-hidden', opacity < 0.4 ? 'true' : 'false');
    });
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
