// The rules for assets/data/projects.json, shared by the site's loader (projects.js) and the
// spreadsheet import script (tools/csv-to-projects.mjs), so both check exactly the same things.
// No DOM or browser APIs here: Node imports this file too.

export var DISPLAY_MODES = ['name', 'anonymised', 'hidden'];
export var DETAIL_MODES = ['page', 'lightbox', 'none'];
export var FEATURED_LAYOUTS = ['wide', 'standard', 'tall'];

// Returns a list of human-readable problems; an empty list means the data is fine. Problems
// are warnings, not errors: the site still renders what it can. Drafts are only checked for
// things that would break the page (ids and categories), since they're unfinished by design.
export function validateProjects(data){
  var problems = [];
  if (!data || !Array.isArray(data.projects)){
    problems.push('projects.json has no "projects" list.');
    return problems;
  }
  var categoryIds = (data.categories || []).map(function(category){ return category.id; });
  var seen = {};

  data.projects.forEach(function(project, index){
    var name = project.id ? '"' + project.id + '"' : 'Project #' + (index + 1);
    if (!project.id) problems.push(name + ': missing id.');
    else if (seen[project.id]) problems.push(name + ': duplicate id.');
    seen[project.id] = true;

    var categories = project.categories || [];
    if (!categories.length) problems.push(name + ': no categories.');
    categories.forEach(function(id){
      if (categoryIds.indexOf(id) === -1) problems.push(name + ': unknown category "' + id + '".');
    });

    var client = project.client || {};
    var display = client.display || 'name';
    if (DISPLAY_MODES.indexOf(display) === -1) problems.push(name + ': unknown client.display "' + display + '".');
    if (display !== 'name' && (client.name || client.via)){
      // The JSON is public; confidential names must never be in it.
      problems.push(name + ': client.display is "' + display + '" but client.name or client.via is set. Remove them from the data.');
    }
    if (display === 'anonymised' && !client.anonymisedLabel) problems.push(name + ': anonymised without client.anonymisedLabel.');

    if (project.detail && DETAIL_MODES.indexOf(project.detail) === -1) problems.push(name + ': unknown detail "' + project.detail + '".');
    if (project.featured){
      if (!(project.media && project.media.thumb)) problems.push(name + ': featured without media.thumb.');
      if (FEATURED_LAYOUTS.indexOf(project.featured.layout) === -1) problems.push(name + ': unknown featured.layout "' + project.featured.layout + '".');
    }

    if (project.draft) return;
    if (!project.title) problems.push(name + ': missing title.');
    if (typeof project.year !== 'number') problems.push(name + ': missing year.');
    if (display === 'name' && !client.name) problems.push(name + ': missing client.');
  });
  return problems;
}

// True when an anonymised or hidden project still carries a client name: the one problem
// that must stop the import script, because it would publish a confidential name.
export function leaksClientName(project){
  var client = project.client || {};
  return (client.display === 'anonymised' || client.display === 'hidden') && !!(client.name || client.via);
}
