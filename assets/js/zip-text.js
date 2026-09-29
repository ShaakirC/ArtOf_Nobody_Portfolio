// Zipper reveal for blocks of text: every letter sits in its own clipping box, one line tall,
// so it can slide in from below its line or out above it. Each letter gets --zip, its place
// in reading order across all the elements passed in (0 for the first letter, 1 for the
// last), which the stylesheet turns into a stagger. The animations themselves live in
// styles.css (.zip-glyph); this only builds the markup.
//
// Screen readers get the original text from a visually hidden copy, and the letters are
// hidden from them, since some would spell out text split into single letters.

export function zipText(elements){
  var glyphs = [];

  Array.prototype.forEach.call(elements, function(element){
    var text = element.textContent;
    var readable = document.createElement('span');
    readable.className = 'sr-only';
    readable.textContent = text;
    var visual = document.createElement('span');
    visual.className = 'zip-text';
    visual.setAttribute('aria-hidden', 'true');

    text.split(/(\s+)/).forEach(function(token){
      if (!token) return;
      if (/^\s+$/.test(token)){
        // Plain spaces between words, so lines still wrap where they did.
        visual.appendChild(document.createTextNode(token));
        return;
      }
      var word = document.createElement('span');
      word.className = 'zip-word';
      Array.from(token).forEach(function(character){
        var letter = document.createElement('span');
        letter.className = 'zip-letter';
        var glyph = document.createElement('span');
        glyph.className = 'zip-glyph';
        glyph.textContent = character;
        letter.appendChild(glyph);
        word.appendChild(letter);
        glyphs.push(glyph);
      });
      visual.appendChild(word);
    });

    element.replaceChildren(readable, visual);
  });

  var last = Math.max(1, glyphs.length - 1);
  glyphs.forEach(function(glyph, index){
    glyph.style.setProperty('--zip', (index / last).toFixed(4));
  });
}
