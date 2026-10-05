// Entry point for portfolio.html.
import { initSite } from './site.js';
import { initGrid } from './grid.js';
import { initSplitText } from './split-text.js';
import { initPortfolio } from './portfolio.js';

// Each feature starts independently so one failure doesn't take down the rest.
[initSite, initGrid, initSplitText, initPortfolio].forEach(function(init){
  try {
    init();
  } catch (error) {
    console.error('Failed to start ' + init.name + ':', error);
  }
});
