#!/usr/bin/env node
// Converts the master project spreadsheet (exported as CSV) into assets/data/projects.json.
// No dependencies; needs Node 22 or later.
//
//   node tools/csv-to-projects.mjs <input.csv> [output.json]
//
// The output defaults to assets/data/projects.json. Its "categories" list is kept from the
// existing file (it isn't in the spreadsheet), or the three defaults when there's no file yet.
//
// The repository is public, so confidential client names must never reach the JSON: rows whose
// client_display is "anonymised" or "hidden" have client_name and client_via removed, and any
// column named private_* (private_notes, ...) is never written. Keep the spreadsheet itself
// outside the repo, or name it *.private.csv or put it in tools/data/ (both git-ignored).
//
// The same checks as the site's loader run on the result (assets/js/project-rules.js) and are
// printed as warnings. A confidential name left in the output is an error, and nothing is
// written.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProjects, leaksClientName } from '../assets/js/project-rules.js';

var ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
var DEFAULT_OUTPUT = resolve(ROOT, 'assets/data/projects.json');
var DEFAULT_CATEGORIES = [
  { id: 'film', label: 'Film & Motion' },
  { id: 'viz', label: 'Visualisation' },
  { id: 'web', label: 'Interactive 3D' }
];
var COLUMNS = ['id', 'title', 'year', 'client_name', 'client_via', 'client_display',
  'client_anonymised_label', 'client_highlight', 'role', 'categories', 'summary', 'tools',
  'featured_order', 'featured_layout', 'detail', 'thumb', 'thumb_alt', 'poster', 'hover_loop',
  'video', 'breakdown', 'service_reel', 'concept', 'draft'];

var args = process.argv.slice(2);
if (!args.length || args[0] === '--help' || args[0] === '-h'){
  console.log('Usage: node tools/csv-to-projects.mjs <input.csv> [output.json]');
  process.exit(args.length ? 0 : 1);
}
var inputPath = resolve(args[0]);
var outputPath = args[1] ? resolve(args[1]) : DEFAULT_OUTPUT;

var rows = parseCsv(readFileSync(inputPath, 'utf8'));
var header = (rows.shift() || []).map(function(name){ return name.trim(); });
var missing = COLUMNS.filter(function(name){ return header.indexOf(name) === -1; });
if (missing.length) fail('The CSV is missing these columns: ' + missing.join(', '));
var unknown = header.filter(function(name){
  return name && COLUMNS.indexOf(name) === -1 && name.indexOf('private_') !== 0;
});
if (unknown.length) console.warn('Ignoring unknown columns: ' + unknown.join(', '));

var stripped = 0;
var projects = rows
  .filter(function(row){ return row.some(function(value){ return value.trim() !== ''; }); })
  .map(function(row, index){
    var cell = {};
    // Line breaks inside quoted cells are stored as plain \n, whatever the export used.
    header.forEach(function(name, i){ cell[name] = (row[i] || '').replace(/\r\n?/g, '\n').trim(); });
    return toProject(cell, index + 2);
  });

var categories = DEFAULT_CATEGORIES;
if (existsSync(outputPath)){
  try {
    var existing = JSON.parse(readFileSync(outputPath, 'utf8'));
    if (Array.isArray(existing.categories) && existing.categories.length) categories = existing.categories;
  } catch (error) {
    console.warn('Could not read the categories from ' + outputPath + '; using the defaults.');
  }
}
var data = { version: 1, categories: categories, projects: projects };

var leaks = projects.filter(leaksClientName);
if (leaks.length) fail('Confidential client names would be published for: ' + leaks.map(function(p){ return p.id; }).join(', '));

var problems = validateProjects(data);
problems.forEach(function(problem){ console.warn('warning: ' + problem); });
writeFileSync(outputPath, JSON.stringify(data, null, 2) + '\n');
console.log('Wrote ' + projects.length + ' project(s) to ' + outputPath + '.');
console.log('Removed client names from ' + stripped + ' anonymised or hidden row(s).');
if (problems.length) console.log(problems.length + ' warning(s) above.');

function toProject(cell, line){
  var display = (cell.client_display || 'name').toLowerCase();
  var confidential = display === 'anonymised' || display === 'hidden';
  if (confidential && (cell.client_name || cell.client_via)) stripped++;
  var year = cell.year === '' ? null : Number(cell.year);
  if (year !== null && !Number.isInteger(year)){
    console.warn('warning: row ' + line + ': year "' + cell.year + '" is not a number.');
    year = null;
  }
  var order = cell.featured_order === '' ? null : Number(cell.featured_order);
  return {
    id: cell.id,
    title: cell.title,
    year: year,
    client: {
      name: confidential ? null : (cell.client_name || null),
      via: confidential ? null : (cell.client_via || null),
      display: display,
      anonymisedLabel: cell.client_anonymised_label || null,
      highlight: bool(cell.client_highlight, line, 'client_highlight')
    },
    role: list(cell.role),
    categories: list(cell.categories),
    summary: cell.summary || null,
    tools: list(cell.tools),
    featured: order === null || Number.isNaN(order) ? null : { order: order, layout: cell.featured_layout || 'standard' },
    detail: cell.detail || 'none',
    media: {
      thumb: cell.thumb || null,
      thumbAlt: cell.thumb_alt || null,
      poster: cell.poster || null,
      hoverLoop: cell.hover_loop || null,
      video: cell.video || null,
      breakdown: list(cell.breakdown)
    },
    serviceReel: bool(cell.service_reel, line, 'service_reel'),
    concept: bool(cell.concept, line, 'concept'),
    draft: bool(cell.draft, line, 'draft')
  };
}

// Multi-value cells are separated by |.
function list(value){
  return value ? value.split('|').map(function(part){ return part.trim(); }).filter(Boolean) : [];
}

function bool(value, line, column){
  var text = value.toLowerCase();
  if (text === '' || text === 'false' || text === 'no' || text === '0') return false;
  if (text === 'true' || text === 'yes' || text === '1') return true;
  console.warn('warning: row ' + line + ': ' + column + ' "' + value + '" is not TRUE/FALSE, yes/no or 1/0; using FALSE.');
  return false;
}

// RFC 4180 CSV: quoted cells may contain commas, line breaks and doubled quotes. Handles a
// byte-order mark and CRLF line endings, as spreadsheet exports produce.
function parseCsv(text){
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  var rows = [];
  var row = [];
  var value = '';
  var quoted = false;
  for (var i = 0; i < text.length; i++){
    var char = text[i];
    if (quoted){
      if (char === '"'){
        if (text[i + 1] === '"'){ value += '"'; i++; }
        else quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"'){
      quoted = true;
    } else if (char === ','){
      row.push(value);
      value = '';
    } else if (char === '\n' || char === '\r'){
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (value !== '' || row.length){
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function fail(message){
  console.error('error: ' + message);
  process.exit(1);
}
