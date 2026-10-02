import * as ModelStage from './model-stage.js';
import { loadProjects, findCategory, reelProjects, isLocalVideo, serviceUrl } from './projects.js';
import { zipText } from './zip-text.js';

// options.modelsAfter: a promise to wait for before loading the service models (the hero
// logo), so they don't compete for bandwidth. The first service shows as soon as the page
// scrolls, so scrolling loads them straight away.
export function initServices(options){
  options = options || {};
  // ---------- services scroll ----------
  // Each .panel is one service step. Its model comes from data-model, and
  // data-model-behavior optionally names a ModelStage behavior. data-service names the
  // category in assets/data/projects.json whose reel it shows.
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
  var reels = [];
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
  // heading's transition. Left as plain text when the visitor prefers reduced motion, and on
  // small screens, where the services swap instantly (hundreds of letter boxes made phone
  // scrolling stutter). Matches the breakpoint of the instant-swap rules in styles.css.
  var MOBILE_QUERY = '(max-width: 860px)';
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      !window.matchMedia(MOBILE_QUERY).matches){
    panels.forEach(function(panel){
      zipText(panel.querySelectorAll(':scope > p, li'));
    });
  }

  // ---------- reels ----------
  // One looping 16:9 reel per service, all in one frame. Each is a link to the portfolio
  // filtered to that service, labelled on hover. The frames are built straight away (so the
  // step transitions have them from the start) and filled in once the project data arrives
  // (fillReels, below): the loop of the project flagged serviceReel for that category, or the
  // category's reelPlaceholder text when it has none.
  var reelFrame = document.getElementById('serviceReels');
  panels.forEach(function(panel){
    var serviceId = panel.dataset.service;
    var reel = document.createElement('a');
    reel.className = 'reel';
    reel.href = serviceUrl(serviceId);
    reel.tabIndex = -1;
    reel.serviceId = serviceId;
    var inner = document.createElement('div');
    inner.className = 'reel-inner is-placeholder';
    var label = document.createElement('span');
    label.className = 'reel-label';
    label.textContent = 'View projects';
    inner.appendChild(label);
    reel.appendChild(inner);
    reel.inner = inner;
    reel.label = label;
    reelFrame.appendChild(reel);
    reels.push(reel);

    // The reels are hidden on small screens, so each service links to its portfolio section
    // there.
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

  // Moves one step element (a text panel or a reel) into its state for this switch.
  function setStepState(element, active, leaving){
    clearTimeout(element.stepTimer);
    if (element.classList.contains('is-entering')){
      element.classList.remove('is-entering');
      // Restart the animation if the same service comes straight back.
      void element.offsetWidth;
    }
    element.classList.remove('is-leaving');
    if (active){
      element.classList.add('is-entering');
      element.stepTimer = setTimeout(function(){ element.classList.remove('is-entering'); }, ENTER_TIME);
    } else if (leaving){
      element.classList.add('is-leaving');
      element.stepTimer = setTimeout(function(){ element.classList.remove('is-leaving'); }, LEAVE_TIME);
    }
    element.classList.toggle('is-active', active);
    element.setAttribute('aria-hidden', String(!active));
  }

  // index -1 shows no service (the hero still covers the headings).
  function showService(index){
    var previous = shownIndex;
    shownIndex = index;
    // The reel carousel pushes left to right going down the page, right to left going up.
    reelFrame.style.setProperty('--slide-dir', index > previous ? '1' : '-1');
    panels.forEach(function(panel, i){
      setStepState(panel, i === index, i === previous);
      if (reels[i]){
        setStepState(reels[i], i === index, i === previous);
        reels[i].tabIndex = i === index ? 0 : -1;
      }
    });
    // An incoming reel starts from the top, unless it's still playing on its way out.
    var incoming = reels[index] && reels[index].video;
    if (incoming && reelsLoaded && incoming.paused) incoming.currentTime = 0;
    syncReels();
    // The outgoing reel keeps playing while it slides out.
    clearTimeout(reelPauseTimer);
    reelPauseTimer = setTimeout(syncReels, LEAVE_TIME);
  }

  // ---------- reel playback ----------
  // The videos are heavy, so none is fetched until the visitor starts scrolling, and on small
  // screens (where the reels are hidden) not at all. Only the reel on screen plays; the
  // others pause, as does everything once the section has scrolled away.
  var smallScreen = window.matchMedia(MOBILE_QUERY);
  var reelsLoaded = false;
  var reelsOnScreen = true;
  var reelPauseTimer = 0;

  function loadReels(){
    if (reelsLoaded || smallScreen.matches || window.scrollY <= 0) return;
    reelsLoaded = true;
    window.removeEventListener('scroll', loadReels);
    reels.forEach(function(reel){
      if (!reel.video) return;
      // Just enough to show the first frame; a reel buffers in full once it plays.
      reel.video.preload = 'metadata';
      reel.video.src = reel.video.dataset.src;
    });
    syncReels();
  }

  function syncReels(){
    if (!reelsLoaded) return;
    reels.forEach(function(reel, i){
      var video = reel.video;
      if (!video) return;
      var play = reelsOnScreen && !smallScreen.matches &&
        (i === shownIndex || reel.classList.contains('is-leaving'));
      if (play && video.paused){
        video.preload = 'auto';
        var started = video.play();
        // Autoplay can be refused (e.g. data saver); the reel then rests on its first frame.
        if (started) started.catch(function(){});
      } else if (!play && !video.paused){
        video.pause();
      }
    });
  }

  function fillReels(data){
    reels.forEach(function(reel){
      var category = findCategory(data, reel.serviceId);
      var project = reelProjects(data, reel.serviceId)[0];
      var inner = reel.inner;
      if (category) reel.label.textContent = 'View ' + category.label + ' projects';
      if (project){
        var video = document.createElement('video');
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'none';
        video.setAttribute('aria-hidden', 'true');
        video.dataset.src = project.media.hoverLoop || project.media.video;
        inner.classList.remove('is-placeholder');
        inner.insertBefore(video, reel.label);
        reel.video = video;
        // The page may already have started loading the reels.
        if (reelsLoaded){
          video.preload = 'metadata';
          video.src = video.dataset.src;
        }
      } else if (category && category.reelPlaceholder){
        // No reel yet: a line of text in the frame instead.
        inner.classList.add('has-text');
        var title = document.createElement('span');
        title.className = 'reel-placeholder-title';
        title.textContent = category.reelPlaceholder.title;
        var note = document.createElement('span');
        note.className = 'reel-placeholder-note';
        note.textContent = category.reelPlaceholder.note;
        inner.insertBefore(title, reel.label);
        inner.insertBefore(note, reel.label);
      }
    });
    syncReels();
  }

  window.addEventListener('scroll', loadReels, { passive: true });
  loadReels();
  // Without the data the frames stay empty, linking to the portfolio as before.
  loadProjects().then(fillReels, function(error){
    console.error('Unable to load the service reels:', error);
  });
  smallScreen.addEventListener('change', function(){
    loadReels();
    syncReels();
  });
  if ('IntersectionObserver' in window){
    new IntersectionObserver(function(entries){
      reelsOnScreen = entries[entries.length - 1].isIntersecting;
      syncReels();
    }).observe(reelFrame);
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
