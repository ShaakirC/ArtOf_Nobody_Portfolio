// Entry point. Behaviors are imported first so they are registered before any model loads.
import './behaviors/index.js';
import { initSite } from './site.js';
import { initGrid } from './grid.js';
import { initSplitText } from './split-text.js';
import { initHero } from './hero.js';
import { initServices } from './services.js';

// Each feature starts independently so one failure doesn't take down the rest.
function start(init, options){
  try {
    return init(options);
  } catch (error) {
    console.error('Failed to start ' + init.name + ':', error);
  }
}

start(initSite);
start(initGrid);
start(initSplitText);
var heroReady = start(initHero);
// The service models wait for the hero logo, so they don't compete with it for bandwidth.
start(initServices, { modelsAfter: heroReady });
