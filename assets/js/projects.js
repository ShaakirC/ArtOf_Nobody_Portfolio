// Every project, shared by the services reels and the portfolio page.
//
// SERVICES are the three kinds of work, in the order of the service panels in index.html
// (joined by .panel[data-service]). label names it in the portfolio filters and the reel's
// hover text. reel is the looping 16:9 video beside its text on the home page, linking to
// that service's view of the portfolio. A service with no reel yet shows its placeholder
// ({ title, note }) in the same frame instead, or an empty frame if it has none. empty is
// what its portfolio filter says when none of its projects are visible yet.
//
// PROJECTS: list order is display order. categories holds one or more SERVICES ids. image is
// a path under assets/images/content/ (any file name), or null for an empty placeholder tile;
// tiles are square and crop to fill, so wide images lose their sides. concept: true labels
// self-initiated work with a "Concept" badge (it must always be labelled). draft: true keeps
// a project off the site entirely until it's ready. summary is a line about the project, for
// the project view once there is one; nothing shows it yet.
// The titles of the first twelve are placeholders and their images are stand-ins.

export var SERVICES = [
  { id: 'film', label: 'Film & Motion', reel: 'assets/reels-draft/REEL_VFX.webm' },
  { id: 'viz', label: 'Visualisation', reel: 'assets/reels-draft/REEL_CGI.webm' },
  { id: 'web', label: 'Interactive 3D', reel: null,
    placeholder: { title: "You're looking at it.", note: 'Client and concept builds coming soon.' },
    empty: 'New work in progress. In the meantime, this site is the first example.' }
];

export var PROJECTS = [
  { slug: 'vfx-01', title: 'VFX project 01', categories: ['film'], image: 'assets/images/content/VFX_Comp_1.webp' },
  { slug: 'vfx-02', title: 'VFX project 02', categories: ['film'], image: 'assets/images/content/VFX_Comp_2.webp' },
  { slug: 'vfx-03', title: 'VFX project 03', categories: ['film'], image: 'assets/images/content/VFX_Comp_3.webp' },
  { slug: 'vfx-04', title: 'VFX project 04', categories: ['film'], image: 'assets/images/content/VFX_Comp_4.webp' },
  { slug: 'cgi-01', title: 'CGI project 01', categories: ['viz'], image: 'assets/images/content/3D_CGI_1.webp' },
  { slug: 'cgi-02', title: 'CGI project 02', categories: ['viz'], image: 'assets/images/content/3D_CGI_2.webp' },
  { slug: 'cgi-03', title: 'CGI project 03', categories: ['viz'], image: 'assets/images/content/3D_CGI_3.webp' },
  { slug: 'cgi-04', title: 'CGI project 04', categories: ['viz'], image: 'assets/images/content/3D_CGI_4.webp' },
  { slug: 'mograph-01', title: 'Motion project 01', categories: ['film'], image: 'assets/images/content/MoGraph_1.webp' },
  { slug: 'mograph-02', title: 'Motion project 02', categories: ['film'], image: 'assets/images/content/MoGraph_2.webp' },
  { slug: 'mograph-03', title: 'Motion project 03', categories: ['film'], image: 'assets/images/content/MoGraph_3.webp' },
  { slug: 'mograph-04', title: 'Motion project 04', categories: ['film'], image: 'assets/images/content/MoGraph_4.webp' },
  // TODO(Shaakir): add media and set draft to false when each is ready.
  { slug: 'residential-site-model', title: 'Residential complex site model', categories: ['viz', 'web'],
    image: null, concept: true, draft: true,
    summary: 'Interactive 3D model of a 32-unit sectional title complex for planning parking, bins and future development.' },
  { slug: 'craft-gin-hero', title: 'Craft gin hero page', categories: ['web', 'viz'],
    image: null, concept: true, draft: true,
    summary: '3D bottle hero section concept for a craft distillery.' },
  { slug: 'wood-table-configurator', title: 'Solid wood table configurator', categories: ['web', 'viz'],
    image: null, concept: true, draft: true,
    summary: 'Geometry Nodes–driven configurator for size and timber choice.' }
];

export function findService(id){
  return SERVICES.find(function(service){ return service.id === id; }) || null;
}

// Every project that's on the site (drafts left out), in display order.
export function visibleProjects(){
  return PROJECTS.filter(function(project){ return !project.draft; });
}

export function projectsFor(serviceId){
  return visibleProjects().filter(function(project){
    return project.categories.indexOf(serviceId) !== -1;
  });
}

// Where a project lives on the portfolio page.
export function projectUrl(slug){
  return 'portfolio.html#' + encodeURIComponent(slug);
}

// The portfolio page filtered to one service.
export function serviceUrl(serviceId){
  return 'portfolio.html#' + encodeURIComponent(serviceId);
}
