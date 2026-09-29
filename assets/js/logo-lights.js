// The logo's lighting rig, shared by every stage that shows the logo (the hero and the about
// section), so both are lit the same way in both themes.
//
//   var lights = createLogoLights();
//   var stage = ModelStage.create(canvas, { lights: lights.addTo });
//   lights.watchTheme(stage);             // re-light and redraw when the theme changes
//   var rig = lights.attach(logoEntry.root); // once the logo has loaded: the lights turn with it
//
// attach returns the group holding the lights (pivoting on the logo's), so the lights can
// be turned further relative to the logo, e.g. by the 'sway' behavior's follower option.

// Lights copied from the Blender sun lamps, in the logo's coordinates: the camera looks
// down from +Y, so -Y is behind the logo, -Z is its top and +Z its bottom. Each light aims
// at the logo's pivot and is attached to the logo, so it turns with it, both into its
// resting pose and as it tilts. Strength is Blender's sun strength: 1 lights a white
// surface to full white.
var LIGHTS = [
  { name: 'Front', position: [0, 2.991, 0], strength: 0.5 },
  { name: 'Rim_Top', position: [1.103, -0.844, -1.904], strength: 1 },
  { name: 'Rim_Bot', position: [-1.806, -1.049, 1.092], strength: 1 }
];
// three.js needs an intensity of PI to light a white surface to full white.
var STRENGTH_TO_INTENSITY = Math.PI;

// Lighting, per theme: the ambient intensity, plus a multiplier on each light's strength,
// by name. The rim comes from how the side walls are lit compared with the front face:
//   dark:  the rim lights make the walls brighter than the front (a light rim).
//   light: the rims are off and a low ambient leaves the walls in shadow, while the front
//          light lifts only the front face back up, so the walls read darker (a dark rim).
var LIGHTING = {
  dark: { ambient: 0.5, lights: { Front: .2, Rim_Top: 3, Rim_Bot: .5 } },
  light: { ambient: 0.4, lights: { Front: 1, Rim_Top: 0, Rim_Bot: 0 } }
};

export function createLogoLights(){
  var ambient = null;
  var logoLights = [];
  var THREE = null;

  function applyTheme(){
    if (!ambient) return;
    var settings = LIGHTING[document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'];
    ambient.intensity = settings.ambient;
    logoLights.forEach(function(light, index){
      var multiplier = settings.lights[LIGHTS[index].name];
      light.intensity = LIGHTS[index].strength * STRENGTH_TO_INTENSITY * (multiplier === undefined ? 1 : multiplier);
    });
  }

  return {
    // ModelStage's lights option: adds the ambient light now; the logo lights wait for attach.
    addTo: function(scene, three){
      THREE = three;
      ambient = new THREE.AmbientLight(0xffffff, 0);
      logoLights = LIGHTS.map(function(settings){
        var light = new THREE.DirectionalLight(0xffffff, 0);
        light.position.fromArray(settings.position);
        return light;
      });
      scene.add(ambient);
      applyTheme();
    },

    // Parents the logo lights and their targets to the logo, in a group that pivots on the
    // logo's pivot (where the targets sit). Returns the group.
    attach: function(root){
      var rig = new THREE.Group();
      logoLights.forEach(function(light){ rig.add(light, light.target); });
      root.add(rig);
      return rig;
    },

    watchTheme: function(stage){
      new MutationObserver(function(){
        applyTheme();
        stage.requestRender();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
  };
}
