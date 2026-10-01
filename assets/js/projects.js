// Every project, shared by the services previews and the portfolio page.
// The titles are placeholders and the images are stand-ins. Set image to a path under
// assets/images/content/ (any file name), or null for an empty placeholder tile. Tiles are
// square and crop to fill, so wide images lose their sides.
// Each service's reel is the looping 16:9 video beside its text on the home page; it links to
// that service's section of the portfolio page.

export var SERVICES = [
  { id: 'vfx', label: 'VFX & Compositing', reel: 'assets/reels-draft/REEL_VFX.webm' },
  { id: 'cgi', label: 'CGI & 3D', reel: 'assets/reels-draft/REEL_CGI.webm' },
  { id: 'mograph', label: 'Motion Graphics', reel: 'assets/reels-draft/REEL_MOGRAPH.webm' }
];

export var PROJECTS = [
  { slug: 'vfx-01', title: 'VFX project 01', service: 'vfx', image: 'assets/images/content/VFX_Comp_1.webp' },
  { slug: 'vfx-02', title: 'VFX project 02', service: 'vfx', image: 'assets/images/content/VFX_Comp_2.webp' },
  { slug: 'vfx-03', title: 'VFX project 03', service: 'vfx', image: 'assets/images/content/VFX_Comp_3.webp' },
  { slug: 'vfx-04', title: 'VFX project 04', service: 'vfx', image: 'assets/images/content/VFX_Comp_4.webp' },
  { slug: 'cgi-01', title: 'CGI project 01', service: 'cgi', image: 'assets/images/content/3D_CGI_1.webp' },
  { slug: 'cgi-02', title: 'CGI project 02', service: 'cgi', image: 'assets/images/content/3D_CGI_2.webp' },
  { slug: 'cgi-03', title: 'CGI project 03', service: 'cgi', image: 'assets/images/content/3D_CGI_3.webp' },
  { slug: 'cgi-04', title: 'CGI project 04', service: 'cgi', image: 'assets/images/content/3D_CGI_4.webp' },
  { slug: 'mograph-01', title: 'Motion project 01', service: 'mograph', image: 'assets/images/content/MoGraph_1.webp' },
  { slug: 'mograph-02', title: 'Motion project 02', service: 'mograph', image: 'assets/images/content/MoGraph_2.webp' },
  { slug: 'mograph-03', title: 'Motion project 03', service: 'mograph', image: 'assets/images/content/MoGraph_3.webp' },
  { slug: 'mograph-04', title: 'Motion project 04', service: 'mograph', image: 'assets/images/content/MoGraph_4.webp' }
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

// One service's section of the portfolio page.
export function serviceUrl(serviceId){
  return 'portfolio.html#' + encodeURIComponent(serviceId);
}
