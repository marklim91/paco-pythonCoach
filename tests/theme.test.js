const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const publicDir = path.join(__dirname, '..', 'public');
const source = name => fs.readFileSync(path.join(publicDir, name), 'utf8');

function loadTheme({ stored, systemDark = false } = {}) {
  const storage = new Map(stored ? [['pco-theme', stored]] : []);
  const attributes = {};
  const toggles = [];
  const listeners = {};
  const root = {
    style: {},
    getAttribute: name => attributes[name] ?? null,
    setAttribute: (name, value) => { attributes[name] = value; },
  };
  const window = {
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    matchMedia: () => ({ matches: systemDark, addEventListener() {} }),
    addEventListener() {},
  };
  const document = {
    documentElement: root,
    querySelectorAll: () => toggles,
    querySelector: () => null,
    addEventListener(type, listener) { listeners[type] = listener; },
  };
  window.document = document;
  vm.runInNewContext(source('theme.js'), { window, document });
  return { window, root, storage, toggles, listeners };
}

test('theme follows the system preference until the user chooses one', () => {
  assert.equal(loadTheme({ systemDark: true }).root.getAttribute('data-theme'), 'dark');
  assert.equal(loadTheme({ systemDark: false }).root.getAttribute('data-theme'), 'light');
  assert.equal(loadTheme({ stored: 'light', systemDark: true }).root.getAttribute('data-theme'), 'light');
  assert.equal(loadTheme({ stored: 'dark', systemDark: false }).root.getAttribute('data-theme'), 'dark');
  assert.equal(loadTheme({ stored: 'invalid', systemDark: false }).root.getAttribute('data-theme'), 'light');
});

test('toggle switches the theme, persists it and updates every switch', () => {
  const { window, root, storage, toggles } = loadTheme();
  const toggle = { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  toggles.push(toggle);

  window.PcoTheme.toggle();
  assert.equal(root.getAttribute('data-theme'), 'dark');
  assert.equal(root.style.colorScheme, 'dark');
  assert.equal(storage.get('pco-theme'), 'dark');
  assert.equal(toggle.attributes['aria-checked'], 'true');

  window.PcoTheme.toggle();
  assert.equal(root.getAttribute('data-theme'), 'light');
  assert.equal(storage.get('pco-theme'), 'light');
  assert.equal(toggle.attributes['aria-checked'], 'false');

  window.PcoTheme.set('sepia');
  assert.equal(root.getAttribute('data-theme'), 'light');
});

test('theme still applies when localStorage is unavailable', () => {
  const { window, root } = loadTheme({ systemDark: true });
  window.localStorage.getItem = window.localStorage.setItem = () => { throw new Error('blocked'); };
  window.PcoTheme.set('light');
  assert.equal(root.getAttribute('data-theme'), 'light');
});

test('every page loads the theme script and stylesheet with a skin', () => {
  const pages = {
    'index.html': ['./theme.js', './theme.css', 'sky'],
    'v3_4/roadmap.html': ['../theme.js', '../theme.css', 'sky'],
    'login.html': ['./theme.js', './theme.css', 'login'],
    'dashboard.html': ['./theme.js', './theme.css', 'board'],
    'my-learning.html': ['./theme.js', './theme.css', 'board'],
    'local-setup.html': ['./theme.js', './theme.css', 'board'],
    'new.html': ['./theme.js', './theme.css', 'studio'],
  };
  for (const [page, [script, style, skin]] of Object.entries(pages)) {
    const html = source(page);
    assert.ok(html.includes(`<script src="${script}"></script>`), `${page}: theme.js`);
    assert.ok(html.includes(`href="${style}"`), `${page}: theme.css`);
    assert.ok(html.includes(`data-pco-skin="${skin}"`), `${page}: skin`);
    if (html.includes('auth.js')) assert.ok(html.indexOf(script) < html.indexOf('auth.js'), `${page}: theme before auth`);
  }
});

test('service worker precaches the theme assets', () => {
  const sw = source('sw.js');
  assert.match(sw, /'\.\/theme\.js'/);
  assert.match(sw, /'\.\/theme\.css'/);
});
