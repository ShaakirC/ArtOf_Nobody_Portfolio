// Entry point. Behaviors are imported first so they are registered before any model loads.
import './behaviors/index.js';
import { initSite } from './site.js';
import { initGrid } from './grid.js';
import { initSplitText } from './split-text.js';
import { initServices } from './services.js';

// Each feature starts independently so one failure doesn't take down the rest.
[initSite, initGrid, initSplitText, initServices].forEach(function(init){
  try {
    init();
  } catch (error) {
    console.error('Failed to start ' + init.name + ':', error);
  }
});
