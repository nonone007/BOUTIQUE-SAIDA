/**
 * Build script: minifies HTML and obfuscates JS for production deploy (e.g. Firebase).
 * Output goes to dist/ — deploy that folder so your code is harder to read.
 * Run: npm run build   then deploy dist/ (e.g. firebase deploy).
 */

const fs = require('fs');
const path = require('path');
const { minify: minifyHtml } = require('html-minifier-terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC = __dirname;
const DIST = path.join(__dirname, 'dist');

// Names that must NOT be renamed (used from HTML onclick / window.*)
const RESERVED_NAMES = [
  'createQuickActionsMenu', 'deleteItemDirect', 'selectItemColor',
  'hideItemDirect', 'unhideItemDirect', 'hideAllArticles', 'hideDiscountArticles', 'unhideAllArticles',
  'escapeAttr', 'getImageSrc', 'moveItemToTop', 'moveItemUp', 'moveItemDown',
  'createQuickProductForm', 'createQuickVideoForm', 'openQuickSettingsPanel', 'deleteVideoDirect',
  'hideVideoDirect', 'unhideVideoDirect', 'hideAllVideos', 'unhideAllVideos',
  'moveVideoToTop', 'moveVideoUp', 'moveVideoDown',
  'moveVideoToTopById', 'moveVideoUpById', 'moveVideoDownById',
  'openOrderModal', 'openQuickVideoPanel', 'clearIframe', 'createProductEditor',
  'CATALOG', 'VIDEOS', 'READ_ONLY_MODE', '__APP_WIRED__', 'saveCatalog', 'saveVideos',
  'showToast', 'render', 'loadCatalog', 'loadVideos'
];

const HTML_OPTIONS = {
  collapseBooleanAttributes: true,
  collapseWhitespace: true,
  conservativeCollapse: true,
  minifyCSS: true,
  minifyJS: false,
  removeComments: true,
  removeOptionalTags: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function minifyFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  return minifyHtml(html, HTML_OPTIONS);
}

async function obfuscateJs(code) {
  return JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: false,
    renameGlobals: false,
    reservedNames: RESERVED_NAMES,
    reservedStrings: [],
    selfDefending: false,
    simplify: true,
    splitStrings: false,
    stringArray: true,
    stringArrayEncoding: ['none'],
    stringArrayThreshold: 0.75,
    target: 'browser',
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
  }).getObfuscatedCode();
}

async function build() {
  ensureDir(DIST);

  console.log('Minifying HTML...');
  const indexHtml = await minifyFile(path.join(SRC, 'index.html'));
  fs.writeFileSync(path.join(DIST, 'index.html'), indexHtml, 'utf8');

  const dynamicHtml = await minifyFile(path.join(SRC, 'exemple_dynamic.html'));
  fs.writeFileSync(path.join(DIST, 'exemple_dynamic.html'), dynamicHtml, 'utf8');

  const page404 = await minifyFile(path.join(SRC, '404.html'));
  fs.writeFileSync(path.join(DIST, '404.html'), page404, 'utf8');

  console.log('Obfuscating app.js...');
  const appJs = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
  const obfuscated = await obfuscateJs(appJs);
  fs.writeFileSync(path.join(DIST, 'app.js'), obfuscated, 'utf8');

  console.log('Copying static assets...');
  const toCopy = ['catalog.json', 'phraseGen.json'];
  for (const name of toCopy) {
    const srcPath = path.join(SRC, name);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(DIST, name));
    }
  }

  const imagesDir = path.join(SRC, 'images');
  if (fs.existsSync(imagesDir)) {
    const destImages = path.join(DIST, 'images');
    ensureDir(destImages);
    copyDir(imagesDir, destImages);
  }

  console.log('Done. Output in dist/ — deploy with: firebase deploy');
}

function copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      ensureDir(d);
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
