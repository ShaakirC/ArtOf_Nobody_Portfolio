// The one way into the project data. Every page imports this module; nothing else fetches
// assets/data/projects.json (see assets/data/README.md for the fields and crediting rules).
// loadProjects() fetches and checks the file once; the helpers take the data it resolves to.
import { validateProjects } from './project-rules.js';

// Relative to this module, so it works on the custom domain and on a github.io/<repo>/ URL.
var DATA_URL = new URL('../data/projects.json', import.meta.url);
var loading = null;

export function loadProjects(){
  if (!loading){
    loading = fetch(DATA_URL).then(function(response){
      if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + DATA_URL);
      return response.json();
    }).then(function(data){
      var problems = validateProjects(data);
      if (problems.length) console.warn('projects.json: ' + problems.length + ' problem(s)\n- ' + problems.join('\n- '));
      return data;
    });
  }
  return loading;
}

// On the site at all: drafts never are, and hidden-client projects stay out of the index and
// the clients line (they can still feed a home page reel; see reelProjects).
export function visibleProjects(data){
  return data.projects.filter(function(project){
    return !project.draft && clientDisplay(project) !== 'hidden';
  });
}

export function featuredProjects(data){
  return visibleProjects(data).filter(function(project){ return project.featured; })
    .sort(function(a, b){ return a.featured.order - b.featured.order; });
}

// The index rows. options.category filters by any of a project's categories ('all' or empty
// for everything). options.sort is 'year-desc' (default), 'year-asc', 'client-asc' or
// 'client-desc'; ties fall back to year (newest first), then title. Unknown years sort last.
export function indexProjects(data, options){
  options = options || {};
  var category = options.category && options.category !== 'all' ? options.category : null;
  var sort = options.sort || 'year-desc';
  var rows = visibleProjects(data).filter(function(project){
    return !category || project.categories.indexOf(category) !== -1;
  });
  function byYear(a, b, direction){
    var ay = typeof a.year === 'number', by = typeof b.year === 'number';
    if (ay !== by) return ay ? -1 : 1;
    return ay ? (a.year - b.year) * direction : 0;
  }
  function byTitle(a, b){ return (a.title || '').localeCompare(b.title || ''); }
  return rows.sort(function(a, b){
    var result = 0;
    if (sort === 'client-asc' || sort === 'client-desc'){
      var ac = clientLabel(a), bc = clientLabel(b);
      // Uncredited rows go last either way.
      if (!ac !== !bc) return ac ? -1 : 1;
      result = ac.localeCompare(bc) * (sort === 'client-desc' ? -1 : 1);
      if (!result) result = byYear(a, b, -1);
    } else {
      result = byYear(a, b, sort === 'year-asc' ? 1 : -1);
    }
    return result || byTitle(a, b);
  });
}

// Brand names for the intro's "Clients include..." line: named, flagged, not self-initiated,
// each once, in the order they first appear in the data.
export function highlightedClients(data){
  var names = [];
  visibleProjects(data).forEach(function(project){
    var client = project.client || {};
    if (client.highlight && clientDisplay(project) === 'name' && !project.concept &&
        client.name && names.indexOf(client.name) === -1) names.push(client.name);
  });
  return names;
}

// The projects whose loop plays in a category's reel on the home page (by primary category).
// Hidden-client projects count here; drafts don't.
export function reelProjects(data, category){
  return data.projects.filter(function(project){
    return !project.draft && project.serviceReel && project.categories[0] === category &&
      project.media && (project.media.hoverLoop || isLocalVideo(project.media.video));
  });
}

// How the client is credited everywhere: "Brand (via Agency)", the anonymised label for NDA
// work, or nothing.
export function clientLabel(project){
  var client = project.client || {};
  var display = clientDisplay(project);
  if (display === 'anonymised') return client.anonymisedLabel || '';
  if (display !== 'name' || !client.name) return '';
  return client.via ? client.name + ' (via ' + client.via + ')' : client.name;
}

export function findCategory(data, id){
  return data.categories.find(function(category){ return category.id === id; }) || null;
}

export function primaryCategory(data, project){
  return findCategory(data, project.categories[0]);
}

// A video path on this site, as opposed to a YouTube or Vimeo page.
export function isLocalVideo(src){
  return !!src && !/^https?:/i.test(src);
}

function clientDisplay(project){
  return (project.client && project.client.display) || 'name';
}

// Links, kept here so the URL scheme lives in one place. They need no data, so the home page
// can build them before the JSON arrives.
export function projectUrl(id){
  return 'portfolio.html#project-' + encodeURIComponent(id);
}

export function serviceUrl(categoryId){
  return 'portfolio.html?category=' + encodeURIComponent(categoryId);
}
