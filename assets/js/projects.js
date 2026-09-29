// Every project, shared by the services previews and the portfolio page.
// These are placeholders: replace them with real projects, and set image to a path
// (e.g. 'assets/images/projects/some-project.jpg') to show a preview instead of the tile.
// The services section previews the first PREVIEWS_PER_SERVICE projects of each service,
// in list order.

export var SERVICES = [
  { id: 'vfx', label: 'VFX & Compositing' },
  { id: 'cgi', label: 'CGI & 3D' },
  { id: 'mograph', label: 'Motion Graphics' }
];

export var PREVIEWS_PER_SERVICE = 4;

export var PROJECTS = [
  { slug: 'vfx-01', title: 'VFX project 01', service: 'vfx', image: null },
  { slug: 'vfx-02', title: 'VFX project 02', service: 'vfx', image: null },
  { slug: 'vfx-03', title: 'VFX project 03', service: 'vfx', image: null },
  { slug: 'vfx-04', title: 'VFX project 04', service: 'vfx', image: null },
  { slug: 'cgi-01', title: 'CGI project 01', service: 'cgi', image: null },
  { slug: 'cgi-02', title: 'CGI project 02', service: 'cgi', image: null },
  { slug: 'cgi-03', title: 'CGI project 03', service: 'cgi', image: null },
  { slug: 'cgi-04', title: 'CGI project 04', service: 'cgi', image: null },
  { slug: 'mograph-01', title: 'Motion project 01', service: 'mograph', image: null },
  { slug: 'mograph-02', title: 'Motion project 02', service: 'mograph', image: null },
  { slug: 'mograph-03', title: 'Motion project 03', service: 'mograph', image: null },
  { slug: 'mograph-04', title: 'Motion project 04', service: 'mograph', image: null }
];

export function findService(id){
  return SERVICES.find(function(service){ return service.id === id; }) || null;
}

export function projectsFor(serviceId){
  return PROJECTS.filter(function(project){ return project.service === serviceId; });
}

// Where a project lives on the portfolio page.
export function projectUrl(slug){
  return 'portfolio.html#' + encodeURIComponent(slug);
}

// The portfolio page opened on one service's tab.
export function serviceUrl(serviceId){
  return 'portfolio.html?service=' + encodeURIComponent(serviceId);
}
