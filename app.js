// ============================================================================
// FIREBASE INTEGRATION - SETUP INSTRUCTIONS
// ============================================================================
// 
// STEP 1: Create Firebase Project
//   1. Go to https://console.firebase.google.com and create a free account
//   2. Create a new project
//   3. Wait for the project to be ready
//
// STEP 2: Enable Firestore Database
//   1. Go to Firestore Database in your Firebase console
//   2. Click "Create database"
//   3. Start in "test mode" (for development) or set up security rules
//   4. Choose a location for your database
//
// STEP 3: Enable Firebase Storage
//   1. Go to Storage in your Firebase console
//   2. Click "Get started"
//   3. Start in "test mode" (for development) or set up security rules
//   4. Choose a location for your storage
//
// STEP 4: Configure This File
//   1. Go to Project Settings (gear icon) → General tab
//   2. Scroll down to "Your apps" section
//   3. Click the web icon (</>) to add a web app
//   4. Copy the firebaseConfig object → paste below
//
// ============================================================================

// Firebase imports (modular SDK v9+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  snapshotEqual,
  increment
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// ⚠️ TODO: Replace these with your actual Firebase project credentials
// Paste your Firebase config here from the Firebase console
// If you haven't set up Firebase yet, leave these as placeholder values to use fallback mode
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  appId: "YOUR_APP_ID",
};

// Check if Firebase is configured
const FIREBASE_ENABLED = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID";

// Initialize Firebase (only if configured)
let app = null;
let db = null;
let storage = null;

if (FIREBASE_ENABLED) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log('✅ Firebase initialized (Firestore + Storage)');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    console.warn('⚠️ Falling back to localStorage mode');
  }
} else {
  console.warn('⚠️ Firebase not configured - using localStorage fallback mode');
  console.warn('ℹ️ To enable Firebase, update firebaseConfig in the code');
}

// ============================================================================
// END FIREBASE INITIALIZATION
// ============================================================================

// Real visitor count (no fake number): one count per device per day, stored in Firestore
const VISITOR_STATS_DOC = 'stats';
const VISITOR_FIELD = 'total';
const VISITOR_STORAGE_KEY = 'visitorCounted';

async function initVisitorCounter() {
  if (!FIREBASE_ENABLED || !db) return;
  const isReadOnly = document.body?.dataset?.readOnly === 'true';
  if (!isReadOnly) return;
  const badge = document.getElementById('visitorCountBadge');
  if (!badge) return;

  const today = new Date().toISOString().slice(0, 10);
  const storageKey = `${VISITOR_STORAGE_KEY}_${today}`;
  const ref = doc(db, VISITOR_STATS_DOC, 'visitorCount');

  try {
    const alreadyCounted = localStorage.getItem(storageKey) === '1';
    if (!alreadyCounted) {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { [VISITOR_FIELD]: 1 });
      } else {
        await updateDoc(ref, { [VISITOR_FIELD]: increment(1) });
      }
      localStorage.setItem(storageKey, '1');
    }
    const snap = await getDoc(ref);
    const total = snap.exists() ? (snap.data()[VISITOR_FIELD] || 0) : 0;
    badge.textContent = total > 0 ? `👁 ${total} زيارات` : '';
    badge.removeAttribute('aria-hidden');
  } catch (e) {
    console.warn('Visitor counter:', e);
    badge.textContent = '';
  }
}


const CONFIG = {
  BRAND: "Boutique Saïda",
  HEADER_TAGLINE: "تجميعة أنيقة لأحدث المنتجات المختارة بعناية.",
  FOLLOW_MAIN: "https://instagram.com/yourshop/channel",
  IG: "https://instagram.com/yourshop",
  TT: "https://tiktok.com/@yourshop",
  VIDEOS_TITLE: "🎥 ستوري اليوم",
  VIDEOS_EMPTY_MESSAGE: "لا توجد فيديوهات اليوم — ترقب التحديث القادم 🎥",
  VIDEOS: [
    {
      title: "كواليس تجهيز الطلبات",
      video: ""
    },
    {
      title: "أبرز الستايلات المختارة",
      video: ""
    },
    {
      title: "نصائح تنسيق سريعة",
      video: ""
    }
  ],
  // Cloudinary Configuration (OPTIONAL - Professional upgrade)
  // Works immediately with localStorage, but you can add Cloudinary for professional hosting
  // Get free account at: https://cloudinary.com/users/register/free
  CLOUDINARY: {
    cloudName: '', // Your Cloudinary cloud name (e.g., 'mycloud')
    uploadPreset: '', // Your upload preset name (e.g., 'my_preset')
    enabled: false, // Set to true when you add credentials above
    folders: {
      today: 'products/today',      // Better folder organization
      discount: 'products/discount',
      stories: 'content/stories'
    }
  }
};
const DELETE_CONFIRM_MESSAGE = 'هل تريد فعلاً حذف هذا المنتج؟ لن تتمكن من التراجع.';

let CATALOG = [];
let VIDEOS = [];
let NOTIFICATIONS = [];
let LAST_CATALOG_HASH = '';
const headerDateFormatter = new Intl.DateTimeFormat('ar-TN', { weekday: 'long', day: 'numeric', month: 'long' });
let TICKER_PHRASES = null; // Will be loaded from phraseGen.json or localStorage
let TICKER_RELOAD_TIMER = null;
const ENABLE_TICKER_AUTO_RELOAD = false; // Disable to avoid periodic ticker refreshes
const ENABLE_PERIODIC_RENDER = false;    // Disable to avoid background UI rerenders
const SORT_STORAGE_KEY = 'sort_pref_v1';
const SORT_DEFAULT_STATE = { today: 'manual', discount: 'ends-soon' };
const PERSIST_SORT_PREF = false; // Do not keep user sort choice after refresh
let SORT_STATE = loadSortState();
const SORT_UI = {};
const SEARCH_STATE = { query: '' };
const AUTO_MOVE_TICKER_SILENCE_MS = 24 * 60 * 60 * 1000; // 24h silence for auto-moved items
const SEARCH_DEBOUNCE_MS = 120;

// Check for read-only mode (set by index.html)
const READ_ONLY_MODE = window.READ_ONLY_MODE === true ||
  (document.documentElement?.dataset?.readOnly === 'true') ||
  (document.body?.dataset?.readOnly === 'true') ||
  (document.querySelector('meta[name="read-only"]')?.content === 'true');
if (READ_ONLY_MODE) {
  console.log('📖 Read-only mode enabled - editing disabled, real-time updates enabled');
}

/** Generate a unique ID for an article (products and stories). Used to avoid bugs when two items have the same name. */
function generateArticleId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'P' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return 'P' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

/** Ensure every catalog item has a unique id; assign one if missing. Returns true if any was added (caller may saveCatalog). */
function ensureCatalogIds() {
  if (!Array.isArray(CATALOG)) return false;
  let changed = false;
  const used = new Set();
  CATALOG.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (!item.id || typeof item.id !== 'string' || item.id.trim() === '') {
      do {
        item.id = generateArticleId();
      } while (used.has(item.id));
      used.add(item.id);
      changed = true;
    } else {
      used.add(item.id);
    }
  });
  return changed;
}

/** Ensure every video has a unique id; assign one if missing. Returns true if any was added. */
function ensureVideoIds() {
  if (!Array.isArray(VIDEOS)) return false;
  let changed = false;
  const used = new Set();
  VIDEOS.forEach((v) => {
    if (!v || typeof v !== 'object') return;
    if (!v.id || typeof v.id !== 'string' || v.id.trim() === '') {
      do {
        v.id = 'video_' + generateArticleId().slice(1);
      } while (used.has(v.id));
      used.add(v.id);
      changed = true;
    } else {
      used.add(v.id);
    }
  });
  return changed;
}

function ensurePositions(list) {
  if (!Array.isArray(list)) return list;
  let changed = false;
  list.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    if (typeof item.position !== 'number') {
      item.position = idx + 1;
      changed = true;
    }
  });
  return changed;
}

function sortByPosition(list = []) {
  return [...list].sort((a, b) => {
    const ap = typeof a.position === 'number' ? a.position : 0;
    const bp = typeof b.position === 'number' ? b.position : 0;
    return ap - bp;
  });
}

function assignSequentialPositions(list = []) {
  list.forEach((item, idx) => {
    if (item && typeof item === 'object') item.position = idx + 1;
  });
  return list;
}

async function persistPositionsToFirestore(list = []) {
  if (!db) return;
  try {
    await Promise.allSettled(list.map((item) => {
      if (!item || !item.id || item.id.startsWith('P')) return Promise.resolve();
      return updateDoc(doc(db, "articles", item.id), { position: item.position || 0 });
    }));
  } catch (e) {
    console.warn('[positions] Failed to persist positions to Firestore', e);
  }
}

// Deep-merge helper to ensure shape and safe defaults
// Global error handlers to make debugging easier
// ERROR CODE: GLOBAL-ERR-001
window.addEventListener('error', (e) => {
  const ERROR_CODE = 'GLOBAL-ERR-001';
  console.error(`[${ERROR_CODE}] Global error:`, e.message || e);
  try { showToast(`[${ERROR_CODE}] خطأ: ${e.message || e}`); } catch (err) {
    console.error(`[GLOBAL-ERR-002] Failed to show toast:`, err);
  }
});
// ERROR CODE: GLOBAL-ERR-003
window.addEventListener('unhandledrejection', (e) => {
  const ERROR_CODE = 'GLOBAL-ERR-003';
  console.error(`[${ERROR_CODE}] Unhandled rejection:`, e && e.reason ? e.reason : e);
  try { showToast(`[${ERROR_CODE}] خطأ غير متوقع: ${e && e.reason ? e.reason : e}`); } catch (err) {
    console.error(`[GLOBAL-ERR-004] Failed to show toast:`, err);
  }
});
function normalizeTickerPhrases(obj) {
  const defaults = {
    todayPhrases: [
      'سلعة مطلوبة برشا: «{title}» رجعت!',
      'اليوم: «{title}» هبط جديد!',
      'جديد الأسبوع: «{title}».',
      'عينك على الجديد؟ «{title}» يستنّاك.'
    ],
    discountPhrases: [
      'استغل الفرصة: «{title}» أرخص بـ{percent}٪.',
      'فرصة ما تتفوتش: {percent}٪ على «{title}» لمدّة محدودة.',
      'صولد صافي: «{title}» ناقص {percent}٪'
    ],
    emptyMessage: 'مرحباً بكم في متجرنا',
    statusEmojis: { today: '🆕', discount: '🔥' }
  };
  const safe = typeof obj === 'object' && obj ? obj : {};
  const today = Array.isArray(safe.todayPhrases) && safe.todayPhrases.length ? safe.todayPhrases : defaults.todayPhrases;
  const disc = Array.isArray(safe.discountPhrases) && safe.discountPhrases.length ? safe.discountPhrases : defaults.discountPhrases;
  const empty = typeof safe.emptyMessage === 'string' && safe.emptyMessage.trim() ? safe.emptyMessage : defaults.emptyMessage;
  const emojis = typeof safe.statusEmojis === 'object' && safe.statusEmojis ? { ...defaults.statusEmojis, ...safe.statusEmojis } : defaults.statusEmojis;
  return { todayPhrases: today, discountPhrases: disc, emptyMessage: empty, statusEmojis: emojis };
}

// Sort sizes from largest to smallest (numeric then common text + kids/baby sizes)
function sortSizesForDisplay(sizes = []) {
  const canonicalDesc = [
    '5xl', '4xl', '3xl', '2xl', 'xxl', 'xl', 'l', 'm', 's', 'xs', 'xxs',
    '16', '14', '12', '10', '8', '6', '4', '2',
    '24m', '18-24m', '12-18m', '9-12m', '6-9m', '3-6m', '0-3m'
  ];
  const alias = {
    xxs: 'xxs', xs: 'xs', sm: 's', small: 's',
    md: 'm', med: 'm', medium: 'm', ml: 'm',
    lg: 'l', large: 'l', xlg: 'l',
    xxl: 'xxl', '2xl': '2xl', xxxl: '3xl', '3xl': '3xl', xxxxl: '4xl', '4xl': '4xl', '5xl': '5xl'
  };
  const normalize = s => String(s || '').trim();
  const lower = s => s.toLowerCase();
  const toNum = s => {
    // Only treat as numeric if the whole string is a number (avoid "5XL" being parsed as 5)
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };
  const rank = s => {
    const mapped = alias[s] || s;
    return canonicalDesc.indexOf(mapped);
  };
  return [...sizes].sort((a, b) => {
    const na = normalize(a); const nb = normalize(b);
    const naNum = toNum(na); const nbNum = toNum(nb);
    if (naNum !== null && nbNum !== null) return nbNum - naNum; // bigger numbers first
    if (naNum !== null) return -1; // numeric before text
    if (nbNum !== null) return 1;
    const ra = rank(lower(na)); const rb = rank(lower(nb));
    if (ra !== -1 && rb !== -1) return ra - rb; // canonicalDesc order already descending
    if (ra !== -1) return -1;
    if (rb !== -1) return 1;
    return lower(nb).localeCompare(lower(na), 'en', { numeric: true }); // fallback descending alpha
  });
}

function phrasesEqual(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

function loadTickerPhrasesFromLocalStorage() {
  try {
    const raw = localStorage.getItem('ticker_phrases');
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return normalizeTickerPhrases(obj);
  } catch { return null; }
}

function saveTickerPhrasesToLocalStorage(phrases) {
  try { localStorage.setItem('ticker_phrases', JSON.stringify(phrases)); } catch { }
}

// Load ticker phrases with robust fallbacks
async function loadTickerPhrases() {
  // 1) Try localStorage first (instant, and survives file:// limitations)
  const cached = loadTickerPhrasesFromLocalStorage();
  if (cached) {
    TICKER_PHRASES = cached;
    console.log('✅ Ticker phrases loaded from localStorage');
  }

  // 2) Try fetching phraseGen.json (only reliable under http/https)
  const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
  if (isHttp) {
    try {
      const url = `phraseGen.json?ts=${Date.now()}`; // cache-bust
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        const json = await response.json();
        const normalized = normalizeTickerPhrases(json);
        if (!TICKER_PHRASES || !phrasesEqual(TICKER_PHRASES, normalized)) {
          TICKER_PHRASES = normalized;
          saveTickerPhrasesToLocalStorage(TICKER_PHRASES);
          console.log('✅ Ticker phrases loaded from phraseGen.json');
        }
      } else {
        if (!TICKER_PHRASES) TICKER_PHRASES = normalizeTickerPhrases(null);
        console.warn('⚠️ Could not load phraseGen.json (HTTP error), using cached/defaults');
      }
    } catch (error) {
      if (!TICKER_PHRASES) TICKER_PHRASES = normalizeTickerPhrases(null);
      console.warn('⚠️ Error loading phraseGen.json:', error?.message);
    }
  } else {
    // file:// mode — rely on localStorage or defaults
    if (!TICKER_PHRASES) {
      TICKER_PHRASES = normalizeTickerPhrases(null);
      console.log('💾 Using default ticker phrases (file mode)');
    }
  }
}

// Lightweight title normalizer to group A/أ/إ/آ together and strip accents
function normalizeTitleForSort(title = '') {
  try {
    let t = (title || '').toString().trim().toLowerCase();

    // Remove all accents and diacritics (works for French, Spanish, etc.)
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // French-specific normalizations
    t = t.replace(/[àáâãäå]/g, 'a');
    t = t.replace(/[èéêë]/g, 'e');
    t = t.replace(/[ìíîï]/g, 'i');
    t = t.replace(/[òóôõö]/g, 'o');
    t = t.replace(/[ùúûü]/g, 'u');
    t = t.replace(/[ýÿ]/g, 'y');
    t = t.replace(/ç/g, 'c');
    t = t.replace(/ñ/g, 'n');

    // Arabic-specific normalizations
    t = t.replace(/[آأإ]/g, 'ا'); // unify Alif forms
    t = t.replace(/[\u064B-\u065F]/g, ''); // remove arabic diacritics
    t = t.replace(/^ال/, ''); // drop Arabic definite article for sorting

    // Keep letters, numbers, spaces (both Latin and Arabic)
    t = t.replace(/[^a-z\u0600-\u06FF0-9\s]/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();

    return t || title;
  } catch {
    return title || '';
  }
}

function compareTitles(aTitle, bTitle) {
  const a = normalizeTitleForSort(aTitle);
  const b = normalizeTitleForSort(bTitle);
  return a.localeCompare(b, 'ar', { sensitivity: 'base', ignorePunctuation: true });
}

function getRemainingMs(item) {
  if (!item || !item.ends) return Number.POSITIVE_INFINITY;
  const t = new Date(item.ends).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return t - Date.now();
}

function sortItemsByMode(items, mode = 'manual') {
  const arr = [...items];
  switch (mode) {
    case 'alpha':
      return arr.sort((a, b) => compareTitles(a.title || '', b.title || ''));
    case 'ends-soon':
      return arr.sort((a, b) => {
        const da = getRemainingMs(a);
        const db = getRemainingMs(b);
        if (da !== db) return da - db;
        return compareTitles(a.title || '', b.title || '');
      });
    case 'price-desc':
      return arr.sort((a, b) => {
        const diff = (Number(b.price) || 0) - (Number(a.price) || 0);
        return diff !== 0 ? diff : compareTitles(a.title || '', b.title || '');
      });
    case 'price-asc':
      return arr.sort((a, b) => {
        const diff = (Number(a.price) || 0) - (Number(b.price) || 0);
        return diff !== 0 ? diff : compareTitles(a.title || '', b.title || '');
      });
    case 'manual':
    default:
      return arr; // keep existing order
  }
}

function getSortedItems(items, sectionKey) {
  const mode = SORT_STATE[sectionKey] || 'manual';
  return sortItemsByMode(items, mode);
}

function normalizeCatalogPricing() {
  CATALOG.forEach(item => {
    if (!item) return;
    if (item.status !== 'discount') {
      if (isFinite(item.was) && item.was > 0) {
        if (!isFinite(item.price) || item.price < item.was) {
          item.price = round2(item.was);
        }
      }
      item.was = 0;
      item.ends = null;
    }
  });
}

// Summarize sizes into compact ranges for display (e.g., S -> XXL, 3XL - 5XL)
function summarizeSizesForDisplay(sizes = []) {
  // Descending order (largest to smallest)
  const sizeOrder = [
    '5XL', '4XL', '3XL', '2XL', 'XXL', 'XL', 'L', 'M', 'S', 'XS', 'XXS',
    '16', '14', '12', '10', '8', '6', '4', '2',
    '24M', '18-24M', '12-18M', '9-12M', '6-9M', '3-6M', '0-3M'
  ];
  const alias = {
    xxs: 'XXS', xs: 'XS', s: 'S', sm: 'S', small: 'S',
    m: 'M', md: 'M', med: 'M', medium: 'M',
    l: 'L', lg: 'L', large: 'L', xlg: 'L',
    xl: 'XL', xxl: 'XXL', '2xl': '2XL', xxxl: '3XL', '3xl': '3XL', xxxxl: '4XL', '4xl': '4XL', '5xl': '5XL'
  };
  const normalize = s => {
    const clean = String(s || '').trim();
    const key = clean.toLowerCase();
    return alias[key] || clean;
  };
  const orderIndex = val => {
    const idx = sizeOrder.indexOf(val);
    return idx === -1 ? null : idx;
  };
  // Deduplicate while preserving intent
  const unique = [];
  sizes.forEach(s => {
    const n = normalize(s);
    if (!unique.includes(n)) unique.push(n);
  });
  // Split known/unknown
  const known = [];
  const unknown = [];
  unique.forEach(s => {
    const idx = orderIndex(s);
    if (idx === null) unknown.push(s);
    else known.push({ v: s, i: idx });
  });
  known.sort((a, b) => a.i - b.i);
  const parts = [];
  // Build ranges for known sizes with modern arrows
  for (let i = 0; i < known.length;) {
    let j = i;
    while (j + 1 < known.length && known[j + 1].i === known[j].i + 1) {
      j++;
    }
    const len = j - i + 1;
    if (len >= 3) {
      parts.push(`${known[i].v} ⇠ ${known[j].v}`);
    } else if (len === 2) {
      parts.push(`${known[i].v} ← ${known[j].v}`);
    } else {
      parts.push(known[i].v);
    }
    i = j + 1;
  }
  // Add unknowns at the end, alphabetically
  if (unknown.length) {
    parts.push(...unknown.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));
  }
  return parts.join(' / ');
}

// Character similarity map for French and common typos
const SIMILAR_CHARS = {
  'a': ['à', 'á', 'â', 'ä'],
  'e': ['è', 'é', 'ê', 'ë'],
  'i': ['ì', 'í', 'î', 'ï'],
  'o': ['ò', 'ó', 'ô', 'ö'],
  'u': ['ù', 'ú', 'û', 'ü'],
  'c': ['ç'],
  'n': ['ñ'],
  's': ['ß'],
  'y': ['ý', 'ÿ']
};

// Check if two characters are similar (handles accents, common typos)
// STRICT: Only allows accents and very close keyboard typos
function areSimilarChars(char1, char2, requireExactMatches = false) {
  if (char1 === char2) return true;

  // Check if they're in the same similarity group (accents only)
  for (const base in SIMILAR_CHARS) {
    const group = [base, ...SIMILAR_CHARS[base]];
    if (group.includes(char1) && group.includes(char2)) {
      return true;
    }
  }

  // Only use keyboard typos if we're not in strict mode
  // AND only for very close keys (not distant ones)
  if (!requireExactMatches) {
    // Very limited keyboard typos - only immediate neighbors
    const closeKeyboardTypos = {
      'e': ['r', 'w', 'd'], 'r': ['e', 't', 'f'], 't': ['r', 'y', 'g'],
      'y': ['t', 'u', 'h'], 'u': ['y', 'i', 'j'], 'i': ['u', 'o', 'k'],
      'o': ['i', 'p'], 'p': ['o'],
      'a': ['s', 'q'], 's': ['a', 'd'], 'd': ['s', 'f', 'e'],
      'f': ['d', 'g'], 'g': ['f', 'h'], 'h': ['g', 'j'],
      'j': ['h', 'k'], 'k': ['j', 'l'], 'l': ['k'],
      'z': ['x'], 'x': ['z', 'c'], 'c': ['x', 'v'],
      'v': ['c', 'b'], 'b': ['v', 'n'], 'n': ['b', 'm'], 'm': ['n']
    };

    const typos1 = closeKeyboardTypos[char1] || [];
    if (typos1.includes(char2)) {
      return true;
    }
  }

  return false;
}

// Check if two words share enough common characters to be considered similar
// This prevents "kool" from matching "pull" (completely different words)
function shareCommonCharacters(str1, str2, minRatio = 0.5) {
  if (!str1 || !str2) return false;

  const chars1 = new Set(str1.split(''));
  const chars2 = new Set(str2.split(''));

  // Count exact character matches (not keyboard typos)
  let exactMatches = 0;
  for (const char of chars1) {
    if (chars2.has(char)) {
      exactMatches++;
    }
  }

  // Require at least minRatio of unique characters to match exactly
  const uniqueChars1 = chars1.size;
  const uniqueChars2 = chars2.size;
  const minUnique = Math.min(uniqueChars1, uniqueChars2);

  if (minUnique === 0) return false;

  return (exactMatches / minUnique) >= minRatio;
}

// Advanced fuzzy matching with high tolerance for typos (works for French and Arabic)
function fuzzyMatch(query, text) {
  if (!query || !text) return false;

  // Normalize both (removes accents, handles Arabic)
  query = normalizeTitleForSort(query);
  text = normalizeTitleForSort(text);

  query = query.toLowerCase().trim();
  text = text.toLowerCase().trim();

  // Exact match (case-insensitive) - highest priority
  if (text.includes(query)) return true;

  // If query is very short (1-2 chars), use exact match only
  if (query.length <= 2) {
    return text.includes(query);
  }

  // CRITICAL: Check if words share enough common characters
  // This prevents "kool" from matching "pull" (completely different words)
  // Require at least 40% of unique characters to match exactly
  if (!shareCommonCharacters(query, text, 0.4)) {
    return false; // Words are too different, don't match
  }

  // Calculate similarity score using Levenshtein-like algorithm
  // This allows for character swaps, insertions, deletions
  const similarity = calculateFuzzySimilarity(query, text);

  // Stricter threshold: require higher similarity for shorter words
  // For "gmail" (5 chars), threshold is 0.75 (75% similarity required)
  // For longer words, threshold decreases slightly
  const threshold = query.length <= 5
    ? 0.75  // Short words need 75% similarity
    : Math.max(0.65, 1 - (query.length * 0.1)); // Longer words: 65-70%

  if (similarity >= threshold) return true;

  // Also check if query letters appear in order (with moderate tolerance)
  let queryIndex = 0;
  let textIndex = 0;
  let totalSkips = 0;
  let consecutiveSkips = 0;
  let exactMatches = 0; // Count exact character matches (not keyboard typos)
  // Stricter: allow skipping up to 30% of characters (was 50%)
  const maxTotalSkip = Math.floor(query.length * 0.3);
  // Stricter: allow skipping up to 40% consecutively (was 60%)
  const maxConsecutiveSkip = Math.max(2, Math.floor(query.length * 0.4));

  while (queryIndex < query.length && textIndex < text.length) {
    const qChar = query[queryIndex];
    const tChar = text[textIndex];

    // Exact match (preferred)
    if (qChar === tChar) {
      queryIndex++;
      textIndex++;
      consecutiveSkips = 0;
      exactMatches++;
    }
    // Similar character (accents only, or very close keyboard typos)
    else if (areSimilarChars(qChar, tChar, false)) {
      queryIndex++;
      textIndex++;
      consecutiveSkips = 0;
      // Don't count keyboard typos as exact matches
    }
    else {
      textIndex++;
      totalSkips++;
      consecutiveSkips++;

      // If we skip too many characters total, it's not a good match
      if (totalSkips > maxTotalSkip) {
        return false;
      }

      // If we skip too many consecutive characters, it's not a good match
      if (consecutiveSkips > maxConsecutiveSkip) {
        return false;
      }
    }
  }

  // Check if we matched at least 85% of query characters
  const matchRatio = queryIndex / query.length;
  if (matchRatio < 0.85) {
    return false;
  }

  // CRITICAL: Require at least 50% of matches to be EXACT (not keyboard typos)
  // This prevents "kool" from matching "pull" through keyboard typos
  const exactMatchRatio = exactMatches / query.length;
  return exactMatchRatio >= 0.5; // At least 50% must be exact matches
}

// Calculate fuzzy similarity score (0-1, higher is better)
// Uses a simplified Levenshtein distance approach with better swap detection
function calculateFuzzySimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1.0;
  if (str2.includes(str1)) return 0.95;
  if (str1.includes(str2)) return 0.9;

  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);
  const minLen = Math.min(len1, len2);

  if (maxLen === 0) return 1.0;

  // If lengths are very different, similarity is low
  if (Math.abs(len1 - len2) > Math.max(2, maxLen * 0.3)) {
    return 0;
  }

  // Count matching characters with position awareness
  let matches = 0;
  let exactMatches = 0; // Count exact matches separately
  let positionScore = 0; // Bonus for characters in correct positions
  const used2 = new Array(len2).fill(false);

  for (let i = 0; i < len1; i++) {
    const char1 = str1[i];
    let bestMatch = -1;
    let bestDistance = Infinity;
    let isExact = false;

    // Find closest matching character in str2 (preferring nearby positions)
    for (let j = 0; j < len2; j++) {
      if (used2[j]) continue;

      const char2 = str2[j];
      const distance = Math.abs(i - j);

      // Prefer exact matches over similar characters
      if (char1 === char2) {
        if (distance < bestDistance) {
          bestMatch = j;
          bestDistance = distance;
          isExact = true;
        }
      } else if (areSimilarChars(char1, char2, false)) {
        // Only use similar chars if we haven't found an exact match nearby
        if (bestMatch === -1 || bestDistance > 2) {
          if (distance < bestDistance) {
            bestMatch = j;
            bestDistance = distance;
            isExact = false;
          }
        }
      }
    }

    // Only count if character is found and position is reasonably close
    const maxAllowedDistance = Math.max(2, Math.min(len1, len2) * 0.4);
    if (bestMatch !== -1 && bestDistance <= maxAllowedDistance) {
      matches++;
      if (isExact) {
        exactMatches++;
      }
      // Give bonus for exact position match, penalty for distance
      if (bestDistance === 0) {
        positionScore += 1.0;
      } else if (bestDistance === 1) {
        positionScore += 0.5; // Adjacent position (character swap)
      } else {
        positionScore += Math.max(0, 0.3 - (bestDistance * 0.1));
      }
      used2[bestMatch] = true;
    }
  }

  // Require at least 50% of matches to be exact (not keyboard typos)
  if (matches > 0 && exactMatches / matches < 0.5) {
    return 0; // Too many keyboard typos, not a real match
  }

  // Calculate base similarity
  const baseSimilarity = matches / maxLen;

  // Adjust based on position accuracy (characters in correct positions = better match)
  const positionBonus = (positionScore / len1) * 0.2; // Up to 20% bonus

  // Final similarity: base + position bonus, capped at 1.0
  return Math.min(1.0, baseSimilarity + positionBonus);
}

// Check if multiple words/parts all match (for multi-word searches)
// Works for both French and Arabic
function matchesMultipleParts(query, text) {
  if (!query || !text) return false;

  // Normalize both query and text
  query = normalizeTitleForSort(query);
  text = normalizeTitleForSort(text);

  // Split query into words/parts (by spaces)
  const parts = query.split(/\s+/).filter(p => p.length > 0);

  if (parts.length === 0) return false;
  if (parts.length === 1) {
    // Single word - use enhanced fuzzy match
    return fuzzyMatch(parts[0], text);
  }

  // Multiple words: check if ALL parts match (with strong fuzzy matching)
  // This means if user types "chemise bleue" or "قميص أزرق", 
  // find articles with both words (even with typos)
  let allPartsMatch = true;
  let atLeastOneExact = false;

  for (const part of parts) {
    if (part.length <= 2) {
      // Very short parts: use exact match
      if (text.includes(part)) {
        atLeastOneExact = true;
      } else {
        allPartsMatch = false;
        break;
      }
    } else {
      // Longer parts: use fuzzy match with high tolerance
      if (fuzzyMatch(part, text)) {
        // Check if it's an exact match
        if (text.includes(part)) {
          atLeastOneExact = true;
        }
      } else {
        allPartsMatch = false;
        break;
      }
    }
  }

  // If all parts match, return true
  // Also return true if most parts match (at least 70% of words)
  if (allPartsMatch) return true;

  // Partial match: if at least 70% of words match
  let matchedParts = 0;
  for (const part of parts) {
    if (part.length <= 2) {
      if (text.includes(part)) matchedParts++;
    } else {
      if (fuzzyMatch(part, text)) matchedParts++;
    }
  }

  const matchRatio = matchedParts / parts.length;
  return matchRatio >= 0.7; // At least 70% of words must match
}

function matchesSearch(item) {
  if (!SEARCH_STATE.query) return true;

  // Normalize both query and title (handles case-insensitive, Arabic & French normalization)
  const q = normalizeTitleForSort(SEARCH_STATE.query);
  if (!q) return true;

  const title = normalizeTitleForSort(item?.title || '');

  // 1. Exact match (case-insensitive) - highest priority
  if (title.includes(q)) return true;

  // 2. Check if query appears at the start of any word (for better matching)
  // Only if query is at least 3 characters to avoid too many false matches
  if (q.length >= 3) {
    const words = title.split(/\s+/);
    for (const word of words) {
      // Require at least 3 characters match for word start
      if (word.length >= 3 && (word.startsWith(q) || (q.length >= 3 && q.startsWith(word)))) {
        return true;
      }
    }
  }

  // 3. Check for multiple words/parts (works for "chemise bleue", "قميص أزرق", etc.)
  if (q.includes(' ') || q.length >= 3) {
    if (matchesMultipleParts(q, title)) return true;
  }

  // 4. Strong fuzzy match for typos (works for both French and Arabic)
  // Examples:
  // - "chemise" typed as "chemize" or "chemis" will find "chemise"
  // - "قميص" typed as "قميض" will find "قميص"
  // - "t-shirt" typed as "tshirt" or "t shirt" will find "t-shirt"
  if (q.length >= 3) {
    if (fuzzyMatch(q, title)) return true;
  }

  // 5. Check for character swaps/transpositions (e.g., "gmail" vs "gamil")
  // This is more strict - characters must be in similar positions
  if (q.length >= 4 && q.length <= 15) {
    // CRITICAL: First check if words share common characters
    // This prevents "kool" from matching "pull"
    if (!shareCommonCharacters(q, title, 0.4)) {
      return false; // Words are too different
    }

    const qChars = q.replace(/\s/g, '').split('');
    const titleChars = title.replace(/\s/g, '').split('');

    // Only check if lengths are similar (within 2 characters)
    if (Math.abs(qChars.length - titleChars.length) <= 2) {
      let foundChars = 0;
      let exactMatches = 0; // Count exact matches
      let positionDeviation = 0;
      const usedIndices = new Set();

      for (let i = 0; i < qChars.length; i++) {
        const qChar = qChars[i];
        let bestMatch = -1;
        let bestDistance = Infinity;
        let isExact = false;

        // Find matching character in title, preferring exact matches and nearby positions
        for (let j = 0; j < titleChars.length; j++) {
          if (usedIndices.has(j)) continue;

          const tChar = titleChars[j];
          const distance = Math.abs(i - j);

          // Prefer exact matches
          if (qChar === tChar) {
            if (distance < bestDistance) {
              bestMatch = j;
              bestDistance = distance;
              isExact = true;
            }
          } else if (areSimilarChars(qChar, tChar, false)) {
            // Only use similar chars if no exact match nearby
            if (bestMatch === -1 || bestDistance > 2) {
              if (distance < bestDistance) {
                bestMatch = j;
                bestDistance = distance;
                isExact = false;
              }
            }
          }
        }

        // Only count if character is found and position is reasonably close
        if (bestMatch !== -1 && bestDistance <= Math.max(2, qChars.length * 0.3)) {
          foundChars++;
          if (isExact) exactMatches++;
          positionDeviation += bestDistance;
          usedIndices.add(bestMatch);
        }
      }

      // Require at least 90% of characters match AND average position deviation is small
      const matchRatio = foundChars / qChars.length;
      const avgDeviation = foundChars > 0 ? positionDeviation / foundChars : Infinity;

      // Require at least 60% of matches to be exact (not keyboard typos)
      const exactRatio = foundChars > 0 ? exactMatches / foundChars : 0;

      // Only match if: high character match (90%+) AND characters are in similar positions AND enough exact matches
      if (matchRatio >= 0.9 && avgDeviation <= Math.max(1.5, qChars.length * 0.25) && exactRatio >= 0.6) {
        return true;
      }
    }
  }

  // 6. For very short queries (1-2 chars), use exact match only
  return title.includes(q);
}

function shouldShowInTicker(item) {
  if (!item) return true;
  if (item.tickerEnabled === false) return false;
  const expires = Number(item.tickerExpiresAt);
  if (Number.isFinite(expires) && expires <= Date.now()) return false;
  const until = Number(item.skipTickerUntil);
  if (Number.isFinite(until) && until > Date.now()) return false;
  return true;
}

function loadSortState() {
  if (!PERSIST_SORT_PREF) return { ...SORT_DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      return { ...SORT_DEFAULT_STATE, ...parsed };
    }
  } catch { }
  return { ...SORT_DEFAULT_STATE };
}

function saveSortState() {
  if (!PERSIST_SORT_PREF) {
    try { localStorage.removeItem(SORT_STORAGE_KEY); } catch { }
    return;
  }
  try { localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(SORT_STATE)); } catch { }
}

function getSortLabel(mode) {
  switch (mode) {
    case 'ends-soon': return 'ينتهي قريباً';
    case 'alpha': return 'أ / A';
    case 'price-desc': return 'السعر (مرتفع → منخفض)';
    case 'price-asc': return 'السعر (منخفض → مرتفع)';
    default: return 'Par Défaut';
  }
}

function ensureSortStyles() {
  if (document.getElementById('sort-bar-styles')) return;
  const style = document.createElement('style');
  style.id = 'sort-bar-styles';
  style.textContent = `
      .search-bar {
        margin: 14px 0 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .search-shell {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      .search-input-wrap {
        flex: 0 1 520px; /* ~4cm wider than previous max */
        min-width: 200px;
        max-width: 520px;
        display: grid;
        grid-template-columns: 38px 1fr 42px;
        align-items: center;
        border-radius: 14px;
        padding: 2px;
        background: linear-gradient(135deg, rgba(255,255,255,0.85), rgba(226,232,240,0.85));
        border: 1px solid rgba(148,163,184,0.35);
        box-shadow: 0 8px 30px -18px rgba(15,23,42,0.45);
      }
      [data-theme="dark"] .search-input-wrap {
        background: linear-gradient(135deg, rgba(30,41,59,0.7), rgba(15,23,42,0.85));
        border-color: rgba(148,163,184,0.35);
        box-shadow: 0 12px 34px -20px rgba(0,0,0,0.6);
      }
      .search-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: var(--muted, #64748b);
      }
      .search-input {
        width: 100%;
        height: 44px;
        border: none;
        outline: none;
        background: transparent;
        color: var(--text, #0f172a);
        font-weight: 800;
        font-size: 15px;
      }
      .search-input::placeholder { color: var(--muted, #94a3b8); font-weight: 600; }
      .search-clear-icon {
        border: none;
        background: transparent;
        color: var(--muted, #94a3b8);
        font-size: 16px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        transition: background 0.2s, color 0.2s;
      }
      .search-clear-icon:hover { background: rgba(148,163,184,0.12); color: var(--text, #0f172a); }
      [data-theme="dark"] .search-clear-icon:hover { background: rgba(148,163,184,0.18); }
      .search-meta {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
      @media (max-width: 640px) {
        .search-shell { flex-direction: column; align-items: stretch; }
        .search-input-wrap { 
          width: 100%; 
          max-width: 100%; 
          flex: 0 1 auto;
          min-width: auto;
        }
        .search-input {
          height: 38px;
          font-size: 14px;
        }
        .search-icon {
          font-size: 16px;
        }
        .search-clear-icon {
          font-size: 14px;
        }
        .search-bar {
          margin: 10px 0 8px;
        }
      }
      .sort-bar {
        margin: 0;
        display: inline-flex;
        align-items: center;
        gap: 0;
        background: transparent;
        border: none;
        padding: 0;
        border-radius: 0;
      }
      .sort-bar select {
        max-width: 140px;
        transition: background 0.2s ease;
        color: var(--text, #0f172a) !important;
        direction: ltr;
        font-weight: 600 !important;
        font-size: 13px !important;
      }
      [data-theme="dark"] .sort-bar select {
        color: var(--text, #f1f5f9) !important;
        background: rgba(30, 41, 59, 0.8) !important;
        border: 1px solid rgba(148, 163, 184, 0.3) !important;
        font-weight: 600 !important;
        font-size: 13px !important;
      }
      .sort-bar select option {
        background: var(--card, #ffffff) !important;
        color: var(--text, #0f172a) !important;
        padding: 8px 10px;
        font-weight: 600;
        font-size: 13px;
        direction: ltr;
      }
      .sort-bar select option[value="manual"] {
        text-align: left !important;
      }
      .sort-bar select option:not([value="manual"]) {
        text-align: center !important;
      }
      [data-theme="dark"] .sort-bar select option {
        background: rgba(30, 41, 59, 0.95) !important;
        color: #f1f5f9 !important;
        border: 1px solid rgba(148, 163, 184, 0.2);
        font-weight: 600;
        font-size: 13px;
        direction: ltr;
      }
      [data-theme="dark"] .sort-bar select option[value="manual"] {
        text-align: left !important;
      }
      [data-theme="dark"] .sort-bar select option:not([value="manual"]) {
        text-align: center !important;
      }
      [data-theme="dark"] .sort-bar select option:hover,
      [data-theme="dark"] .sort-bar select option:checked {
        background: rgba(56, 189, 248, 0.2) !important;
        color: #7dd3fc !important;
        font-weight: 600;
        font-size: 13px;
      }
      .sort-bar .label {
        font-weight: 700;
        color: var(--muted, #64748b);
        font-size: 14px;
      }
      .sort-chip { display:none; }
      @media (max-width: 767px) {
        .sort-bar {
          display: flex !important;
          flex-direction: row;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          width: auto;
          margin-right: auto;
          margin-left: 0;
        }
        .sort-bar > span {
          order: 1;
          margin-left: 0 !important;
          margin-right: 8px !important;
          white-space: nowrap;
          font-weight: bold;
          font-size: 16px;
          color: var(--text);
        }
        .sort-bar > select {
          order: 2;
          margin-left: 0;
          margin-right: 0;
        }
        /* Ensure the button container aligns sort bar to left in mobile */
        .section > div[style*="display:flex"] {
          justify-content: flex-start !important;
          align-items: center;
        }
      }
    `;
  document.head.appendChild(style);
}

function syncSortBars() {
  Object.entries(SORT_UI).forEach(([sectionKey, ctx]) => {
    const active = SORT_STATE[sectionKey] || 'manual';
    // Label removed - only dropdown shown
    ctx.chips?.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.sort === active);
    });
  });
}

function setSortMode(sectionKey, mode) {
  SORT_STATE = { ...SORT_STATE, [sectionKey]: mode };
  saveSortState();
  syncSortBars();
  render();
}

function createSortBar(sectionKey, hostSection, title = '') {
  if (!hostSection || hostSection.querySelector('.sort-bar')) return;
  ensureSortStyles();

  // Find the button container (div with flex display) inside the section
  const buttonContainer = hostSection.querySelector('div[style*="display:flex"]');
  if (!buttonContainer) {
    // Fallback: append to section if button container not found
    const bar = document.createElement('div');
    bar.className = 'sort-bar';
    const label = document.createElement('span');
    label.textContent = 'ترتيب:';
    label.style.cssText = `font-weight:bold;font-size:16px;color:var(--text);margin-left:8px;white-space:nowrap;background:transparent;border:none`;
    const isDiscount = sectionKey === 'discount';
    const options = isDiscount
      ? [
        { value: 'ends-soon', text: '⏱️ ينتهي قريباً' },
        { value: 'price-desc', text: 'السعر ↑' },
        { value: 'price-asc', text: 'السعر ↓' },
      ]
      : [
        { value: 'manual', text: 'Par Défaut' },
        { value: 'alpha', text: 'A • أ' },
        { value: 'price-desc', text: 'السعر ↑' },
        { value: 'price-asc', text: 'السعر ↓' },
      ];
    const select = document.createElement('select');
    const initialValue = SORT_STATE[sectionKey] || 'manual';
    const initialAlign = initialValue === 'manual' ? 'left' : 'center';
    select.style.cssText = `width:auto;max-width:140px;padding:8px 12px;border-radius:8px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-weight:600;font-size:13px;cursor:pointer;transition:all 0.2s ease;text-align:${initialAlign};direction:ltr`;
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.text;
      if (opt.value === 'manual') {
        o.style.cssText = `text-align:left;direction:ltr;font-weight:600;font-size:13px`;
      } else {
        o.style.cssText = `text-align:center;direction:ltr;font-weight:600;font-size:13px`;
      }
      select.appendChild(o);
    });
    select.value = SORT_STATE[sectionKey] || 'manual';

    // Function to update background and alignment based on value
    const updateSelectBackground = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      select.style.fontSize = '13px';
      select.style.fontWeight = '600';
      if (select.value === 'manual') {
        select.style.background = isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff';
        select.style.color = isDark ? '#f1f5f9' : '#0f172a';
        select.style.textAlign = 'left';
      } else {
        if (isDark) {
          select.style.background = 'rgba(30, 41, 59, 0.9)';
          select.style.color = '#f1f5f9';
        } else {
          select.style.background = 'var(--input-bg, rgba(2,6,23,0.06))';
          select.style.color = 'var(--text, #0f172a)';
        }
        select.style.textAlign = 'center';
      }
    };

    // Set initial background
    updateSelectBackground();

    select.addEventListener('change', () => {
      updateSelectBackground();
      setSortMode(sectionKey, select.value);
    });
    select.addEventListener('mouseenter', () => {
      select.style.transform = 'translateY(-2px)';
      select.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    });
    select.addEventListener('mouseleave', () => {
      select.style.transform = 'translateY(0)';
      select.style.boxShadow = 'none';
    });
    bar.appendChild(label);
    bar.appendChild(select);
    hostSection.appendChild(bar);
    SORT_UI[sectionKey] = { bar, chips: [], label, title };
    syncSortBars();
    return;
  }

  const bar = document.createElement('div');
  bar.className = 'sort-bar';
  const label = document.createElement('span');
  label.textContent = 'ترتيب:';
  label.style.cssText = `font-weight:bold;font-size:16px;color:var(--text);margin-left:8px;white-space:nowrap;background:transparent;border:none`;

  const isDiscount = sectionKey === 'discount';
  const options = isDiscount
    ? [
      { value: 'ends-soon', text: '⏱️ ينتهي قريباً' },
      { value: 'price-desc', text: 'السعر ↑' },
      { value: 'price-asc', text: 'السعر ↓' },
    ]
    : [
      { value: 'manual', text: 'Par Défaut' },
      { value: 'alpha', text: 'A • أ' },
      { value: 'price-desc', text: 'السعر ↑' },
      { value: 'price-asc', text: 'السعر ↓' },
    ];

  const select = document.createElement('select');
  const initialValue = SORT_STATE[sectionKey] || 'manual';
  const initialAlign = initialValue === 'manual' ? 'left' : 'center';
  select.style.cssText = `width:auto;max-width:140px;padding:8px 12px;border-radius:8px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-weight:800;font-size:15px;cursor:pointer;transition:all 0.2s ease;text-align:${initialAlign};direction:ltr`;
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.text;
    if (opt.value === 'manual') {
      o.style.cssText = `text-align:left;direction:ltr;font-weight:600;font-size:13px`;
    } else {
      o.style.cssText = `text-align:center;direction:ltr;font-weight:600;font-size:13px`;
    }
    select.appendChild(o);
  });
  select.value = SORT_STATE[sectionKey] || 'manual';

  // Function to update background and alignment based on value
  const updateSelectBackground = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    select.style.fontSize = '13px';
    select.style.fontWeight = '600';
    if (select.value === 'manual') {
      select.style.background = isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff';
      select.style.color = isDark ? '#f1f5f9' : '#0f172a';
      select.style.textAlign = 'left';
    } else {
      if (isDark) {
        select.style.background = 'rgba(30, 41, 59, 0.9)';
        select.style.color = '#f1f5f9';
      } else {
        select.style.background = 'var(--input-bg, rgba(2,6,23,0.06))';
        select.style.color = 'var(--text, #0f172a)';
      }
      select.style.textAlign = 'center';
    }
  };

  // Set initial background
  updateSelectBackground();

  select.addEventListener('change', () => {
    updateSelectBackground();
    setSortMode(sectionKey, select.value);
  });
  select.addEventListener('mouseenter', () => {
    select.style.transform = 'translateY(-2px)';
    select.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
  });
  select.addEventListener('mouseleave', () => {
    select.style.transform = 'translateY(0)';
    select.style.boxShadow = 'none';
  });
  bar.appendChild(label);
  bar.appendChild(select);
  const chips = []; // maintain structure

  // Append to button container so it's on the same line
  buttonContainer.appendChild(bar);
  SORT_UI[sectionKey] = { bar, chips, label, title };
  syncSortBars();
}

function setupSortControls() {
  // Today section sits right before #todayGrid
  const todaySection = document.querySelector('#todayGrid')?.previousElementSibling;
  if (todaySection) createSortBar('today', todaySection, 'جديد اليوم');

  // Discount section sits right before #saleGrid
  const saleSection = document.querySelector('#saleGrid')?.previousElementSibling;
  if (saleSection) createSortBar('discount', saleSection, 'التخفيضات');
}

function setupSearchControls() {
  ensureSortStyles();
  const main = document.querySelector('main.container');
  const todaySection = document.querySelector('#todayGrid')?.previousElementSibling;
  if (!main || !todaySection) return;
  if (document.querySelector('.search-bar')) return;
  const bar = document.createElement('div');
  bar.className = 'search-bar';
  bar.innerHTML = `
      <div class="search-shell">
        <div class="search-input-wrap">
          <span class="search-icon">🔍</span>
          <input type="search" class="search-input" id="searchProducts" placeholder="ابحث باسم المنتج..." aria-label="بحث عن منتج">
          <button type="button" class="search-clear-icon" id="searchClear" aria-label="مسح البحث">✕</button>
        </div>
      </div>
    `;
  todaySection.parentNode.insertBefore(bar, todaySection);
  const input = bar.querySelector('#searchProducts');
  const clearBtn = bar.querySelector('#searchClear');
  let searchTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      SEARCH_STATE.query = input.value || '';
      render();
    }, SEARCH_DEBOUNCE_MS);
  });
  clearBtn.addEventListener('click', () => {
    SEARCH_STATE.query = '';
    input.value = '';
    render();
  });
}

// Image resize and optimize function
function resizeImage(file, maxWidth, maxHeight, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Optional: Add background for transparent images
        ctx.fillStyle = '#0a162c';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(resizedFile);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, file.type, quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// IndexedDB helper functions for videos and images
const DB_NAME = 'MediaStorageDB';
const DB_VERSION = 1;
const VIDEO_STORE = 'videos';
const IMAGE_STORE = 'images';

// ERROR CODE: IDB-OPEN-002 (for videos and images)
async function openIndexedDBForVideos() {
  const ERROR_CODE = 'IDB-OPEN-001';
  const logPrefix = `[openIndexedDB:${ERROR_CODE}]`;
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        console.error(`${logPrefix} ❌ Failed to open IndexedDB:`, request.error);
        reject(new Error(`[${ERROR_CODE}] Failed to open IndexedDB: ${request.error?.message || 'Unknown error'}`));
      };
      request.onsuccess = () => {
        console.log(`${logPrefix} ✅ IndexedDB opened successfully`);
        resolve(request.result);
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(VIDEO_STORE)) {
          db.createObjectStore(VIDEO_STORE);
          console.log(`${logPrefix} ✅ Object store created: ${VIDEO_STORE}`);
        }
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          db.createObjectStore(IMAGE_STORE);
          console.log(`${logPrefix} ✅ Object store created: ${IMAGE_STORE}`);
        }
      };
    } catch (err) {
      console.error(`${logPrefix} ❌ Exception opening IndexedDB:`, err);
      reject(new Error(`[${ERROR_CODE}] Exception opening IndexedDB: ${err.message || 'Unknown error'}`));
    }
  });
}

// ERROR CODE: IDB-IMG-OPEN-001
async function openIndexedDBForImages() {
  const ERROR_CODE = 'IDB-IMG-OPEN-001';
  const logPrefix = `[openIndexedDBForImages:${ERROR_CODE}]`;
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        console.error(`${logPrefix} ❌ Failed to open IndexedDB:`, request.error);
        reject(new Error(`[${ERROR_CODE}] Failed to open IndexedDB: ${request.error?.message || 'Unknown error'}`));
      };
      request.onsuccess = () => {
        console.log(`${logPrefix} ✅ IndexedDB opened successfully`);
        resolve(request.result);
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(VIDEO_STORE)) {
          db.createObjectStore(VIDEO_STORE);
          console.log(`${logPrefix} ✅ Object store created: ${VIDEO_STORE}`);
        }
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          db.createObjectStore(IMAGE_STORE);
          console.log(`${logPrefix} ✅ Object store created: ${IMAGE_STORE}`);
        }
      };
    } catch (err) {
      console.error(`${logPrefix} ❌ Exception opening IndexedDB:`, err);
      reject(new Error(`[${ERROR_CODE}] Exception opening IndexedDB: ${err.message || 'Unknown error'}`));
    }
  });
}

// ERROR CODE: IDB-IMG-STORE-001
async function storeImageInIndexedDB(imageId, dataUrl) {
  const ERROR_CODE = 'IDB-IMG-STORE-001';
  const logPrefix = `[storeImageInIndexedDB:${ERROR_CODE}]`;
  try {
    console.log(`${logPrefix} 📤 START: Storing image ${imageId}`);
    const db = await openIndexedDBForImages();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IMAGE_STORE], 'readwrite');
      const store = transaction.objectStore(IMAGE_STORE);
      const request = store.put(dataUrl, imageId);
      request.onsuccess = () => {
        console.log(`${logPrefix} ✅ Image stored in IndexedDB: ${imageId}`);
        resolve(true);
      };
      request.onerror = () => {
        console.error(`${logPrefix} ❌ Failed to store image:`, request.error);
        reject(new Error(`[${ERROR_CODE}] Failed to store image in IndexedDB: ${request.error?.message || 'Unknown error'}`));
      };
    });
  } catch (err) {
    console.error(`${logPrefix} ❌ IndexedDB storage error:`, err);
    throw new Error(`[${ERROR_CODE}] IndexedDB storage failed: ${err.message || 'Unknown error'}`);
  }
}

// ERROR CODE: IDB-IMG-GET-001
async function getImageFromIndexedDB(imageId) {
  const ERROR_CODE = 'IDB-IMG-GET-001';
  const logPrefix = `[getImageFromIndexedDB:${ERROR_CODE}]`;
  try {
    console.log(`${logPrefix} 🔍 START: Retrieving image ${imageId}`);
    const db = await openIndexedDBForImages();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IMAGE_STORE], 'readonly');
      const store = transaction.objectStore(IMAGE_STORE);
      const request = store.get(imageId);
      request.onsuccess = () => {
        const dataUrl = request.result;
        if (dataUrl) {
          console.log(`${logPrefix} ✅ Image retrieved from IndexedDB: ${imageId}`);
          resolve(dataUrl);
        } else {
          console.warn(`${logPrefix} ⚠️ Image not found in IndexedDB: ${imageId}`);
          resolve(null);
        }
      };
      request.onerror = () => {
        console.error(`${logPrefix} ❌ Failed to retrieve image:`, request.error);
        reject(new Error(`[${ERROR_CODE}] Failed to retrieve image from IndexedDB: ${request.error?.message || 'Unknown error'}`));
      };
    });
  } catch (err) {
    console.error(`${logPrefix} ❌ IndexedDB retrieval error:`, err);
    return null;
  }
}

/**
 * Fallback uploader when Firebase Storage is not configured.
 * Stores the resized image in IndexedDB (and returns an idb:* URL).
 */
async function uploadImageToLocalStorage(file, status = 'today') {
  const ERROR_CODE = 'IMG-IDB-UPLOAD';
  const logPrefix = `[uploadImageToLocalStorage:${ERROR_CODE}]`;
  try {
    // Resize for consistent quality/size
    const resizedFile = await resizeImage(file, 1200, 1200, 0.85);

    // Convert to data URL
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(reader.error?.message || 'File read error'));
      reader.readAsDataURL(resizedFile);
    });

    // Save to IndexedDB
    const key = `img_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    await storeImageInIndexedDB(key, dataUrl);

    console.log(`${logPrefix} ✅ Stored image in IndexedDB: ${key}`);
    return {
      success: true,
      imageUrl: `idb:${key}`,
      metadata: {
        originalSize: file.size,
        compressedSize: resizedFile.size,
        status,
        storageType: 'indexedDB',
        path: key
      }
    };
  } catch (err) {
    console.error(`${logPrefix} ❌ Fallback upload failed:`, err);
    throw err;
  }
}

// ERROR CODE: IDB-VID-STORE-001
async function storeVideoInIndexedDB(videoId, dataUrl) {
  const ERROR_CODE = 'IDB-VID-STORE-001';
  const logPrefix = `[storeVideoInIndexedDB:${ERROR_CODE}]`;
  try {
    console.log(`${logPrefix} 📤 START: Storing video ${videoId}`);
    const db = await openIndexedDBForVideos();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([VIDEO_STORE], 'readwrite');
      const store = transaction.objectStore(VIDEO_STORE);
      const request = store.put(dataUrl, videoId);
      request.onsuccess = () => {
        console.log(`${logPrefix} ✅ Video stored in IndexedDB: ${videoId}`);
        resolve(true);
      };
      request.onerror = () => {
        console.error(`${logPrefix} ❌ Failed to store video:`, request.error);
        reject(new Error(`[${ERROR_CODE}] Failed to store video in IndexedDB: ${request.error?.message || 'Unknown error'}`));
      };
    });
  } catch (err) {
    console.error(`${logPrefix} ❌ IndexedDB storage error:`, err);
    throw new Error(`[${ERROR_CODE}] IndexedDB storage failed: ${err.message || 'Unknown error'}`);
  }
}

// ERROR CODE: IDB-VID-GET-001
async function getVideoFromIndexedDB(videoId) {
  const ERROR_CODE = 'IDB-VID-GET-001';
  const logPrefix = `[getVideoFromIndexedDB:${ERROR_CODE}]`;
  try {
    console.log(`${logPrefix} 🔍 START: Retrieving video ${videoId}`);
    const db = await openIndexedDBForVideos();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([VIDEO_STORE], 'readonly');
      const store = transaction.objectStore(VIDEO_STORE);
      const request = store.get(videoId);
      request.onsuccess = () => {
        const dataUrl = request.result;
        if (dataUrl) {
          console.log(`${logPrefix} ✅ Video retrieved from IndexedDB: ${videoId}`);
          resolve(dataUrl);
        } else {
          console.warn(`${logPrefix} ⚠️ Video not found in IndexedDB: ${videoId}`);
          resolve(null);
        }
      };
      request.onerror = () => {
        console.error(`${logPrefix} ❌ Failed to retrieve video:`, request.error);
        reject(new Error(`[${ERROR_CODE}] Failed to retrieve video from IndexedDB: ${request.error?.message || 'Unknown error'}`));
      };
    });
  } catch (err) {
    console.error(`${logPrefix} ❌ IndexedDB retrieval error:`, err);
    return null;
  }
}

// Unified video upload function
// ERROR CODE: VID-UPL-001
async function uploadVideoToServer(file, folder, originalFilename) {
  const ERROR_CODE = 'VID-UPL-001';
  const logPrefix = `[uploadVideoToServer:${ERROR_CODE}]`;
  console.log(`${logPrefix} 📤 START:`, { folder, originalFilename, fileSize: file.size, fileType: file.type });

  // Check file size before processing
  // For localStorage: 200MB limit (will attempt storage, browser may enforce quota)
  // For server: 200MB limit (supports iPhone high quality videos)
  const MAX_LOCALSTORAGE_SIZE = 200 * 1024 * 1024; // 200MB for localStorage
  const MAX_SERVER_SIZE = 200 * 1024 * 1024; // 200MB for server (iPhone videos)
  const isFileProtocol = window.location.protocol === 'file:';

  // Only check server limit, allow localStorage to attempt storage (browser will enforce quota)
  if (isFileProtocol && file.size > MAX_LOCALSTORAGE_SIZE) {
    const errorMsg = `[${ERROR_CODE}] Video file too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 200MB. Please compress the video.`;
    console.error(`${logPrefix} ❌ File too large:`, file.size);
    throw new Error(errorMsg);
  }

  // Warn if file is very large even for server
  if (!isFileProtocol && file.size > MAX_SERVER_SIZE) {
    const errorMsg = `[${ERROR_CODE}] Video file too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 200MB. Please compress the video.`;
    console.error(`${logPrefix} ❌ File too large for server:`, file.size);
    throw new Error(errorMsg);
  }

  try {
    // Step 1: Convert to data URL (no resizing for videos)
    console.log(`${logPrefix} 🔄 Step 1: Converting to data URL...`);
    let dataUrl;
    try {
      dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = (e) => reject(new Error(`[${ERROR_CODE}-STEP1] FileReader error: ${e.target?.error?.message || 'Unknown'}`));
        r.readAsDataURL(file);
      });
      console.log(`${logPrefix} ✅ Step 1 complete: Data URL length ${dataUrl.length} chars`);
    } catch (err) {
      console.error(`${logPrefix} ❌ Step 1 FAILED (dataURL):`, err);
      throw new Error(`[${ERROR_CODE}-STEP1] Data URL conversion failed: ${err.message}`);
    }

    // Step 2: Generate filename with folder organization
    const timestamp = Date.now();
    const ext = originalFilename.split('.').pop() || 'mp4';
    // Videos always go to 'stories' folder (or use provided folder if valid)
    const folderSafe = folder && ['today', 'discount', 'stories'].includes(String(folder)) ? String(folder) : 'stories';
    const filename = `${folderSafe}_video_${timestamp}.${ext}`;
    console.log(`${logPrefix} ✅ Step 2: Generated filename: ${filename} (folder: ${folderSafe})`);

    // Step 3: Always try server upload first (regardless of protocol)
    // Include folder in videoId for local storage organization (fallback only)
    const videoId = `${folderSafe}_video_${timestamp}_${Math.floor(Math.random() * 1e9)}`;
    console.log(`${logPrefix} ✅ Step 3: Generated videoId: ${videoId} (folder: ${folderSafe})`);

    // REMOVED: Server upload logic - now 100% client-side
    // Videos are stored in IndexedDB (client-side only)
    console.log(`${logPrefix} 💾 Storing video in IndexedDB (client-side storage)`);

    try {
      await storeVideoInIndexedDB(videoId, dataUrl);
      console.log(`${logPrefix} ✅ Video stored in IndexedDB`);
      console.warn(`${logPrefix} ⚠️ NOTE: Video is in browser storage, NOT in images/stories folder!`);
      console.warn(`${logPrefix} ⚠️ To save to folder, start server: node server.js`);
      return {
        ok: true,
        path: `idb:${videoId}`,
        dataUrl: dataUrl,
        filename,
        originalSize: file.size,
        mode: 'indexedDB',
        folder: folderSafe
      };
    } catch (idbErr) {
      // Last resort: try localStorage
      try {
        localStorage.setItem(videoId, dataUrl);
        console.log(`${logPrefix} ✅ Video stored in localStorage`);
        return {
          ok: true,
          path: videoId,
          dataUrl: dataUrl,
          filename,
          originalSize: file.size,
          mode: 'localStorage',
          folder: folderSafe
        };
      } catch (storageErr) {
        console.error(`${logPrefix} ❌ All storage methods failed`);
        throw new Error(`[VID-UPL-006] Storage failed: ${storageErr.message}`);
      }
    }
  } catch (err) {
    console.error(`${logPrefix} ❌ FAILED:`, err);
    throw err;
  }
}

// Centralized folder mapping function
// Maps product status to folder name for consistent organization
// ============================================================================
// BACKEND ADAPTER LAYER
// ============================================================================
// These two functions are the ONLY place where backend/platform-specific code should exist.
// To integrate with Firebase, Appwrite, PHP/XAMPP, etc., you only need to modify these two functions.
// The rest of the app will automatically work with any backend you choose.
// ============================================================================

/**
 * Cloudflare R2: Upload file using presigned URL
 * @param {File} file - The file to upload
 * @param {string} folder - Destination folder (today, discount, stories)
 * @returns {Promise<{success: boolean, publicUrl: string, key: string}>}
 */
async function uploadToR2(file, folder) {
  const logPrefix = '[uploadToR2]';
  try {
    console.log(`${logPrefix} 🔗 Demande d'URL présignée pour ${file.name} dans ${folder}`);
    const response = await fetch('/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        folder: folder
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Échec de la génération de l’URL présignée');
    }

    const { uploadUrl, key, publicUrl } = await response.json();

    console.log(`${logPrefix} 📤 Upload vers R2 : ${key}`);
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload échoué : ${uploadResponse.statusText}`);
    }

    console.log(`${logPrefix} ✅ Upload réussi : ${key}`);

    // Retourne l'URL publique si fournie, sinon la clé
    return {
      success: true,
      publicUrl: publicUrl || key,  // Utilise la clé comme fallback
      key: key
    };
  } catch (error) {
    console.error(`${logPrefix} ❌ Échec :`, error);
    throw error;
  }
}
/**
 * Firebase Storage: Upload Product Image
 * 
 * Uploads an image file to Firebase Storage in the appropriate folder based on product status.
 * 
 * @param {File} file - The image file to upload
 * @param {string} status - Product status ('today' or 'discount')
 * @returns {Promise<{success: boolean, imageUrl: string, metadata?: object}>}
 */
async function uploadProductImageToFirebase(file, status) {
  const logPrefix = '[uploadProductImageToFirebase]';

  // File size validation
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_IMAGE_SIZE) {
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    throw new Error(`File size too large: ${fileSizeMB}MB. Maximum size is 10MB for images.`);
  }

  try {
    // Step 1: Resize image for optimal storage
    const resizedFile = await resizeImage(file, 1200, 1200, 0.85);
    console.log(`${logPrefix} ✅ Image resized: ${resizedFile.size} bytes`);

    // Step 2: Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.floor(Math.random() * 1e9);
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${timestamp}_${randomId}.${ext}`;

    // Step 3: Determine folder path based on status
    const safeStatus = status || "other";
    const folderPath = `products/${safeStatus}`;
    const storagePath = `${folderPath}/${filename}`;

    // Step 4: TRY CLOUDFLARE R2 FIRST
    try {
      const r2Folder = ['today', 'discount'].includes(status) ? status : 'today';
      const r2Result = await uploadToR2(resizedFile, r2Folder);
      if (r2Result.success) {
        return {
          success: true,
          imageUrl: r2Result.publicUrl,
          metadata: {
            originalSize: file.size,
            compressedSize: resizedFile.size,
            status: status,
            storageType: 'r2',
            path: r2Result.key
          }
        };
      }
    } catch (r2Error) {
      console.warn(`${logPrefix} ⚠️ R2 upload failed, trying Firebase...`, r2Error);
    }

    // Step 5: Upload to Firebase Storage
    console.log(`${logPrefix} 📤 Uploading to Firebase Storage: ${storagePath}`);

    if (!storage) {
      console.warn(`${logPrefix} ⚠️ Firebase not configured, using localStorage fallback`);
      return await uploadImageToLocalStorage(file, status);
    }

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, resizedFile);

    // Step 5: Get public URL
    const publicUrl = await getDownloadURL(storageRef);
    console.log(`${logPrefix} ✅ Image uploaded successfully: ${publicUrl}`);

    return {
      success: true,
      imageUrl: publicUrl,
      metadata: {
        originalSize: file.size,
        compressedSize: resizedFile.size,
        status: status,
        storageType: 'firebase',
        path: storagePath
      }
    };
  } catch (error) {
    console.error(`${logPrefix} ❌ Upload failed:`, error);
    console.warn(`${logPrefix} ⚠️ Falling back to localStorage`);
    return await uploadImageToLocalStorage(file, status);
  }
}

/**
 * Firebase Storage: Upload Story Video
 * 
 * Uploads a video file to Firebase Storage in the stories folder.
 * Falls back to localStorage/IndexedDB if Firebase is not configured.
 * 
 * @param {File} file - The video file to upload
 * @returns {Promise<{success: boolean, videoUrl: string, metadata?: object}>}
 */
async function uploadStoryVideoToFirebase(file) {
  const logPrefix = '[uploadStoryVideoToFirebase]';

  // File size validation
  const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
  if (file.size > MAX_VIDEO_SIZE) {
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    throw new Error(`File size too large: ${fileSizeMB}MB. Maximum size is 100MB for videos.`);
  }

  // TRY CLOUDFLARE R2 FIRST
  try {
    const r2Result = await uploadToR2(file, 'stories');
    if (r2Result.success) {
      return {
        success: true,
        videoUrl: r2Result.publicUrl,
        metadata: {
          originalSize: file.size,
          storageType: 'r2',
          path: r2Result.key
        }
      };
    }
  } catch (r2Error) {
    console.warn(`${logPrefix} ⚠️ R2 upload failed, trying Firebase/IndexedDB...`, r2Error);
  }

  // If Firebase is not configured, fall back to IndexedDB
  if (!storage) {
    console.warn(`${logPrefix} ⚠️ Firebase not configured, using IndexedDB fallback`);
    return await uploadVideoToIndexedDB(file);
  }

  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.floor(Math.random() * 1e9);
    const ext = file.name.split('.').pop() || 'mp4';
    const filename = `${timestamp}_${randomId}.${ext}`;

    // Upload to stories folder
    const storagePath = `stories/${filename}`;

    console.log(`${logPrefix} 📤 Uploading video to Firebase Storage: ${storagePath}`);

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);

    // Get public URL
    const publicUrl = await getDownloadURL(storageRef);
    console.log(`${logPrefix} ✅ Video uploaded successfully: ${publicUrl}`);

    return {
      success: true,
      videoUrl: publicUrl,
      metadata: {
        originalSize: file.size,
        storageType: 'firebase',
        path: storagePath
      }
    };
  } catch (error) {
    console.error(`${logPrefix} ❌ Upload failed:`, error);
    console.warn(`${logPrefix} ⚠️ Falling back to IndexedDB`);
    return await uploadVideoToIndexedDB(file);
  }
}

/**
 * Fallback: Upload Video to IndexedDB
 * Used when Firebase is not configured or upload fails
 */
async function uploadVideoToIndexedDB(file) {
  const logPrefix = '[uploadVideoToIndexedDB]';

  try {
    // Convert to data URL
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(new Error(`FileReader error: ${e.target?.error?.message || 'Unknown'}`));
      reader.readAsDataURL(file);
    });

    // Generate unique storage key
    const timestamp = Date.now();
    const randomId = Math.floor(Math.random() * 1e9);
    const storageKey = `video_${timestamp}_${randomId}`;

    // Save to IndexedDB
    await storeVideoInIndexedDB(storageKey, dataUrl);
    console.log(`${logPrefix} ✅ Video saved to IndexedDB: ${storageKey}`);

    return {
      success: true,
      videoUrl: `idb:${storageKey}`,
      metadata: {
        originalSize: file.size,
        storageType: 'indexedDB'
      }
    };
  } catch (error) {
    console.error(`${logPrefix} ❌ Upload failed:`, error);
    throw error;
  }
}

/**
 * Firebase Storage: Upload Product Video
 * 
 * Allows attaching a video directly to a product (article).
 * Uses Firebase Storage when available and falls back to IndexedDB otherwise.
 * @param {File} file - The video file selected locally
 * @param {string} status - Product status (today/discount) used to organize folders
 */
async function uploadProductVideoToFirebase(file, status = 'today') {
  const logPrefix = '[uploadProductVideoToFirebase]';

  // Accept generous size for product demos (200MB max)
  const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
  if (file.size > MAX_VIDEO_SIZE) {
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    throw new Error(`File size too large: ${fileSizeMB}MB. Maximum size is 200MB for product videos.`);
  }

  // TRY CLOUDFLARE R2 FIRST
  try {
    const r2Folder = ['today', 'discount'].includes(status) ? status : 'today';
    const r2Result = await uploadToR2(file, r2Folder);
    if (r2Result.success) {
      return {
        success: true,
        videoUrl: r2Result.publicUrl,
        metadata: {
          originalSize: file.size,
          storageType: 'r2',
          path: r2Result.key
        }
      };
    }
  } catch (r2Error) {
    console.warn(`${logPrefix} ⚠️ R2 upload failed, trying Firebase/IndexedDB...`, r2Error);
  }

  // If Firebase is not configured, fall back to IndexedDB
  if (!storage) {
    console.warn(`${logPrefix} ⚠️ Firebase not configured, using IndexedDB fallback`);
    return await uploadVideoToIndexedDB(file);
  }

  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.floor(Math.random() * 1e9);
    const ext = file.name.split('.').pop() || 'mp4';
    const safeStatus = status || 'other';
    const filename = `${timestamp}_${randomId}.${ext}`;

    // Upload to products folder, grouped by status
    const storagePath = `products/${safeStatus}/videos/${filename}`;
    console.log(`${logPrefix} 📤 Uploading video to Firebase Storage: ${storagePath}`);

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);

    // Get public URL
    const publicUrl = await getDownloadURL(storageRef);
    console.log(`${logPrefix} ✅ Video uploaded successfully: ${publicUrl}`);

    return {
      success: true,
      videoUrl: publicUrl,
      metadata: {
        originalSize: file.size,
        storageType: 'firebase',
        path: storagePath
      }
    };
  } catch (error) {
    console.error(`${logPrefix} ❌ Upload failed:`, error);
    console.warn(`${logPrefix} ⚠️ Falling back to IndexedDB`);
    return await uploadVideoToIndexedDB(file);
  }
}

/**
 * Backend Adapter: Upload Image
 * 
 * Now uses Firebase Storage instead of localStorage/IndexedDB.
 * 
 * @param {File} file - The image file to upload
 * @param {string} status - Article status ('today', 'discount', 'stories')
 * @returns {Promise<{success: boolean, imageUrl: string, metadata?: object}>}
 */
async function backendUploadImage(file, status) {
  const logPrefix = '[backendUploadImage]';
  console.log(`${logPrefix} Début upload pour ${file.name}, status=${status}`);

  // 1. Essayer R2
  if (typeof uploadToR2 === 'function') {
    try {
      const result = await uploadToR2(file, status);
      if (result.success && result.publicUrl) {
        console.log(`${logPrefix} ✅ Upload réussi vers R2: ${result.publicUrl}`);
        return {
          success: true,
          imageUrl: result.publicUrl,
          metadata: {
            originalSize: file.size,
            status: status,
            storageType: 'r2',
            path: result.key
          }
        };
      }
    } catch (err) {
      console.warn(`${logPrefix} Échec R2, fallback Firebase`, err);
    }
  }

  // 2. Fallback Firebase
  try {
    const fbResult = await uploadProductImageToFirebase(file, status);
    return fbResult;
  } catch (fbErr) {
    console.warn(`${logPrefix} Échec Firebase, fallback localStorage`, fbErr);
  }

  // 3. Fallback localStorage/IndexedDB
  return await uploadImageToLocalStorage(file, status);
}

/**
 * Backend Adapter: Upload Product Video
 * Delegates to Firebase Storage with IndexedDB fallback.
 */
async function backendUploadProductVideo(file, status) {
  return await uploadProductVideoToFirebase(file, status);
}

/**
 * Backend Adapter: Save Article
 * 
 * Uses Firestore Database if configured, otherwise falls back to localStorage.
 * 
 * Firestore Collection: "articles"
 * Fields: title, price, was, status, imageUrl, sizes, colors, note, gender, cat, section, createdAt
 * 
 * @param {object} article - The article object to save (title, price, status, image_url, etc.)
 * @param {boolean} isNew - Whether this is a new article (true) or an update (false)
 * @returns {Promise<{success: boolean, article: object}>}
 */
async function backendSaveArticle(article, isNew) {
  const logPrefix = '[backendSaveArticle]';

  // If Firebase is not configured, use localStorage fallback
  if (!db) {
    console.warn(`${logPrefix} ⚠️ Firebase not configured, saving to localStorage`);
    return await saveArticleToLocalStorage(article, isNew);
  }

  try {
    // Prepare data for Firestore (map img to imageUrl, ensure proper types)
    const productData = {
      title: article.title || '',
      price: parseFloat(article.price) || 0,
      was: parseFloat(article.was) || 0,
      status: article.status || 'today',
      imageUrl: article.img || article.image_url || article.imageUrl || null,
      videoUrl: article.video || article.video_url || article.videoUrl || null,
      hidden: !!article.hidden,
      sizes: Array.isArray(article.sizes) ? article.sizes : [],
      colors: Array.isArray(article.colors) ? article.colors : [],
      note: article.note || null,
      gender: article.gender || 'f',
      cat: article.cat || 'clothes',
      ends: article.ends || null,
      section: 'article', // Distinguish from stories
      createdAt: serverTimestamp()
    };

    let docRef;
    let savedData;

    if (isNew) {
      // Insert new product to Firestore collection "articles"
      docRef = await addDoc(collection(db, "articles"), productData);
      savedData = { id: docRef.id, ...productData };
      console.log(`${logPrefix} ✅ Product inserted: ${docRef.id}`);
    } else {
      // Update existing product
      if (!article.id) {
        throw new Error('Cannot update product without id');
      }

      const docRef = doc(db, "articles", article.id);
      // Remove createdAt from update (only set on create)
      const updateData = { ...productData };
      delete updateData.createdAt;
      await updateDoc(docRef, updateData);

      // Use the update data as saved data (Firestore will merge)
      savedData = { id: article.id, ...updateData };

      console.log(`${logPrefix} ✅ Product updated: ${article.id}`);
    }

    // Map Firestore result back to article format (for compatibility)
    const savedArticle = {
      id: savedData.id,
      title: savedData.title,
      price: savedData.price,
      was: savedData.was || 0,
      status: savedData.status,
      img: savedData.imageUrl,
      image_url: savedData.imageUrl,
      imageUrl: savedData.imageUrl,
      video: savedData.videoUrl || savedData.video_url || null,
      video_url: savedData.videoUrl || savedData.video_url || null,
      videoUrl: savedData.videoUrl || savedData.video_url || null,
      hidden: !!savedData.hidden,
      sizes: savedData.sizes || [],
      colors: savedData.colors || [],
      note: savedData.note,
      gender: savedData.gender,
      cat: savedData.cat,
      ends: savedData.ends || null,
      date: savedData.createdAt && savedData.createdAt.toDate ? savedData.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    };

    // Update local CATALOG array for immediate UI update
    if (isNew) {
      CATALOG.unshift(savedArticle);
    } else {
      const index = CATALOG.findIndex(item => item.id === savedArticle.id);
      if (index !== -1) {
        CATALOG[index] = savedArticle;
      }
    }

    console.log(`${logPrefix} ✅ Article saved: ${savedArticle.title} (${isNew ? 'new' : 'updated'})`);

    return {
      success: true,
      article: savedArticle
    };
  } catch (error) {
    console.error(`${logPrefix} ❌ Save failed:`, error);
    console.warn(`${logPrefix} ⚠️ Falling back to localStorage`);
    return await saveArticleToLocalStorage(article, isNew);
  }
}

/**
 * Fallback: Save article to localStorage
 */
async function saveArticleToLocalStorage(article, isNew) {
  const logPrefix = '[saveArticleToLocalStorage]';

  try {
    // Generate unique ID if new (avoids bugs when two articles have same name)
    if (isNew && !article.id) {
      article.id = generateArticleId();
    }

    // If new article, add to catalog
    if (isNew) {
      CATALOG.unshift(article);
    } else {
      // Update existing article in catalog
      const index = CATALOG.findIndex(item => item.id === article.id);
      if (index !== -1) {
        CATALOG[index] = article;
      }
    }

    // Save to localStorage
    await saveCatalog();

    console.log(`${logPrefix} ✅ Article saved: ${article.title} (${isNew ? 'new' : 'updated'})`);

    return {
      success: true,
      article: article
    };
  } catch (error) {
    console.error(`${logPrefix} ❌ Save failed:`, error);
    throw error;
  }
}

// ============================================================================
// END BACKEND ADAPTER LAYER
// ============================================================================

// ============================================================================
// OLD SERVER/FOLDER LOGIC REMOVED
// ============================================================================
// The following functions have been removed/disabled:
// - checkServerAvailable() - No longer needed (100% client-side)
// - uploadImageToCloudinary() - Can be added to backendUploadImage() if needed
// - uploadImageToServer() - Replaced by backendUploadImage()
// - getFolderFromStatus() - No longer needed (status is passed directly)
//
// All image uploads now go through backendUploadImage()
// All article saves now go through backendSaveArticle()
// ============================================================================

// Legacy function kept for backward compatibility (now just returns status)
function getFolderFromStatus(status) {
  // This function is kept for any remaining references, but it's no longer used
  // for folder organization since we're 100% client-side
  return status;
}

// REMOVED: async function uploadImageToServer(file, folder, originalFilename) {
// REMOVED: Old uploadImageToServer function - replaced by backendUploadImage()    // Expose handlers used in inline onclick attributes
window.createQuickActionsMenu = createQuickActionsMenu;
window.deleteItemDirect = deleteItemDirect;
window.selectItemColor = selectItemColor;
window.hideItemDirect = hideItemDirect;
window.unhideItemDirect = unhideItemDirect;
window.hideAllArticles = hideAllArticles;
window.hideDiscountArticles = hideDiscountArticles;
window.unhideAllArticles = unhideAllArticles;
// Expose helpers used by inline handlers
window.escapeAttr = escapeAttr;
window.getImageSrc = getImageSrc;
window.moveItemToTop = moveItemToTop;
window.moveItemUp = moveItemUp;
window.moveItemDown = moveItemDown;

// Global helper for query selection
const $ = sel => document.querySelector(sel);
window.$ = $;


function fmtPrice(x) {
  return x && x > 0 ? `${x} د.ت` : "—";
}

// Modern countdown timer function - returns formatted time string
function countdown(to) {
  if (!to) return "";
  const end = new Date(to).getTime();
  const now = Date.now();
  if (isNaN(end) || end <= now) return "انتهى";

  const diff = end - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) {
    return `${days}يوم ${hours}س ${minutes}د`;
  } else if (hours > 0) {
    return `${hours}س ${minutes}د ${seconds}ث`;
  } else if (minutes > 0) {
    return `${minutes}د ${seconds}ث`;
  } else {
    return `${seconds}ث`;
  }
}

// Ultra-advanced countdown timer for discount items - premium design with animations
function getAdvancedCountdownTimer(endDate) {
  if (!endDate) return "";
  const end = new Date(endDate).getTime();
  const now = Date.now();
  if (isNaN(end) || end <= now) return '<div class="pro-timer-expired">انتهى العرض</div>';

  const diff = end - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  // Calculate urgency level for dynamic styling
  const totalHours = days * 24 + hours;
  const isUrgent = totalHours < 24;
  const isVeryUrgent = totalHours < 6;

  // Ultra-advanced compact timer - minimal but elegant
  return `
        <div class="ultra-timer-container ${isVeryUrgent ? 'urgent' : isUrgent ? 'warning' : ''}">
          <div class="ultra-timer-glow"></div>
          <div class="ultra-timer-grid">
            ${days > 0 ? `
              <div class="ultra-timer-item" data-unit="days">
                <div class="ultra-timer-value-wrapper">
                  <div class="ultra-timer-value">${String(days).padStart(2, '0')}</div>
                  <div class="ultra-timer-shine"></div>
                </div>
                <div class="ultra-timer-unit">يوم</div>
              </div>
            ` : ''}
            <div class="ultra-timer-item" data-unit="hours">
              <div class="ultra-timer-value-wrapper">
                <div class="ultra-timer-value">${String(hours).padStart(2, '0')}</div>
                <div class="ultra-timer-shine"></div>
              </div>
              <div class="ultra-timer-unit">س</div>
            </div>
            <div class="ultra-timer-separator">:</div>
            <div class="ultra-timer-item" data-unit="minutes">
              <div class="ultra-timer-value-wrapper">
                <div class="ultra-timer-value">${String(minutes).padStart(2, '0')}</div>
                <div class="ultra-timer-shine"></div>
              </div>
              <div class="ultra-timer-unit">د</div>
            </div>
            ${days === 0 ? `
              <div class="ultra-timer-separator">:</div>
              <div class="ultra-timer-item" data-unit="seconds">
                <div class="ultra-timer-value-wrapper">
                  <div class="ultra-timer-value">${String(seconds).padStart(2, '0')}</div>
                  <div class="ultra-timer-shine"></div>
                </div>
                <div class="ultra-timer-unit">ث</div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
}

// Modern countdown timer - returns HTML for beautiful display
function getCountdownTimer(endDate, compact = false) {
  if (!endDate) return "";
  const end = new Date(endDate).getTime();
  const now = Date.now();
  if (isNaN(end) || end <= now) return '<span class="timer-expired">انتهى</span>';

  const diff = end - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (compact) {
    // Compact version for cards
    if (days > 0) {
      return `<span class="countdown-timer compact"><span class="timer-value">${days}</span><span class="timer-label">يوم</span> <span class="timer-value">${hours}</span><span class="timer-label">س</span></span>`;
    } else if (hours > 0) {
      return `<span class="countdown-timer compact"><span class="timer-value">${hours}</span><span class="timer-label">س</span> <span class="timer-value">${minutes}</span><span class="timer-label">د</span></span>`;
    } else {
      return `<span class="countdown-timer compact"><span class="timer-value">${minutes}</span><span class="timer-label">د</span> <span class="timer-value">${seconds}</span><span class="timer-label">ث</span></span>`;
    }
  } else {
    // Full version for section header
    return `
          <div class="countdown-timer full">
            ${days > 0 ? `<div class="timer-unit"><span class="timer-value">${String(days).padStart(2, '0')}</span><span class="timer-label">يوم</span></div>` : ''}
            <div class="timer-unit"><span class="timer-value">${String(hours).padStart(2, '0')}</span><span class="timer-label">ساعة</span></div>
            <div class="timer-unit"><span class="timer-value">${String(minutes).padStart(2, '0')}</span><span class="timer-label">دقيقة</span></div>
            <div class="timer-unit"><span class="timer-value">${String(seconds).padStart(2, '0')}</span><span class="timer-label">ثانية</span></div>
          </div>
        `;
  }
}

// Update all countdown timers on the page
function updateCountdownTimers() {
  // Update ultra-advanced timers for discount items
  document.querySelectorAll('.ultra-countdown-timer[data-countdown-end]').forEach(element => {
    const endDate = element.getAttribute('data-countdown-end');
    if (endDate) {
      element.innerHTML = getAdvancedCountdownTimer(endDate);
    }
  });

  // Update legacy advanced timers (for backward compatibility)
  document.querySelectorAll('.advanced-countdown-timer[data-countdown-end]').forEach(element => {
    const endDate = element.getAttribute('data-countdown-end');
    if (endDate) {
      element.innerHTML = getAdvancedCountdownTimer(endDate);
    }
  });

  // Update regular card timers
  document.querySelectorAll('[data-countdown-end]').forEach(element => {
    // Skip advanced timers as they're already handled above
    if (element.classList.contains('advanced-countdown-timer') ||
      element.classList.contains('ultra-countdown-timer')) return;

    const endDate = element.getAttribute('data-countdown-end');
    if (endDate) {
      const timerHtml = getCountdownTimer(endDate, true);
      if (timerHtml) {
        element.innerHTML = timerHtml;
      } else {
        element.innerHTML = '<span class="timer-expired">انتهى</span>';
      }
    }
  });

  // Auto-move expired discount items back to "today" and silence ticker for a while
  let changed = false;
  const now = Date.now();
  CATALOG.forEach(item => {
    if (!item || item.status !== 'discount' || !item.ends) return;
    const t = new Date(item.ends).getTime();
    if (Number.isNaN(t)) return;
    if (t <= now) {
      item.status = 'today';
      resetDiscountPricing(item); // This already clears item.ends and item.was
      item.skipTickerUntil = Date.now() + AUTO_MOVE_TICKER_SILENCE_MS;
      changed = true;
    }
  });
  if (changed) {
    saveCatalog();
    render();
  }
}

function getStatusText(status, pct) {
  return {
    today: { ar: "جديد اليوم", en: "NEW", fr: "NOUVEAU" },
    discount: { ar: `خصم ${pct}%`, en: `-${pct}%`, fr: `-${pct}%` }
  }[status] || { ar: "منتج", en: "ITEM", fr: "ARTICLE" };
}

function label(status) {
  return {
    today: "جديد اليوم",
    discount: "عرض خاص"
  }[status] || "متاح";
}

// Map human-readable color names (AR/EN) to hex codes for swatches
function resolveColorCode(name) {
  const n = (name || '').toLowerCase().trim();
  const map = {
    'ابيض': '#e2e8f0', 'أبيض': '#e2e8f0', 'white': '#e2e8f0',
    'اسود': '#111827', 'أسود': '#111827', 'black': '#111827',
    'بيج': '#c8b58b', 'beige': '#c8b58b',
    'زيتي': '#3f6212', 'olive': '#3f6212',
    'أزرق': '#2563eb', 'ازرق': '#2563eb', 'blue': '#2563eb',
    'وردي': '#ec4899', 'pink': '#ec4899',
    'احمر': '#dc2626', 'أحمر': '#dc2626', 'red': '#dc2626',
    'اخضر': '#16a34a', 'أخضر': '#16a34a', 'green': '#16a34a',
    'بنفسجي': '#7c3aed', 'violet': '#7c3aed', 'purple': '#7c3aed',
    'اصفر': '#facc15', 'أصفر': '#facc15', 'yellow': '#facc15',
    'رمادي': '#6b7280', 'gris': '#6b7280', 'gray': '#6b7280',
    'برتقالي': '#f97316', 'orange': '#f97316',
    'بني': '#8b5a2b', 'marron': '#8b5a2b', 'brown': '#8b5a2b',
    'ذهبي': '#fbbf24', 'gold': '#fbbf24',
    'فضي': '#94a3b8', 'silver': '#94a3b8'
  };
  return map[n] || '#64748b';
}

// Remove color names from product titles to keep only the base name
function cleanTitle(title) {
  if (!title) return '';
  const tokens = [
    'ابيض', 'أبيض', 'ابيض', 'white', 'أسود', 'اسود', 'black', 'بيج', 'beige', 'زيتي', 'olive', 'أزرق', 'ازرق', 'blue', 'وردي', 'pink', 'أحمر', 'احمر', 'red', 'أخضر', 'اخضر', 'green', 'بنفسجي', 'violet', 'purple', 'اصفر', 'أصفر', 'yellow', 'رمادي', 'gris', 'gray', 'برتقالي', 'orange', 'بني', 'marron', 'brown', 'ذهبي', 'gold', 'فضي', 'silver'
  ];
  let result = ` ${title} `;
  for (const t of tokens) {
    const re = new RegExp(`\\s${t}\\s`, 'ig');
    result = result.replace(re, ' ');
  }
  result = result.replace(/\s{2,}/g, ' ').trim();
  result = result.replace(/[\-\/(),]+$/g, '').trim();
  return result;
}

// Escape text for safe inclusion in HTML attributes
function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function shortTitle(text = '', maxLength = 24) {
  const clean = String(text || '').trim();
  if (!clean) return 'بدون عنوان';
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

// Select a preferred color for an item for quick reference
function selectItemColor(evtOrId, maybeId, maybeColor) {
  let eventRef = null;
  let id;
  let color;
  if (evtOrId && typeof evtOrId === 'object' && typeof evtOrId.stopPropagation === 'function') {
    eventRef = evtOrId;
    id = maybeId;
    color = maybeColor;
  } else {
    id = evtOrId;
    color = maybeId;
  }
  if (!id || !color) return;
  eventRef?.preventDefault?.();
  eventRef?.stopPropagation?.();
  const item = CATALOG.find(p => p.id === id);
  if (!item) return;
  item.selectedColor = color;
  const clickedButton = event && event.currentTarget ? event.currentTarget : null;
  updateCardColorSelection(id, color, clickedButton);
  try {
    saveCatalog();
  } catch (e) {
    console.warn('selectItemColor failed:', e);
  }
}

function updateCardColorSelection(id, color, clickedButton) {
  const safeId = (typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
    ? CSS.escape(id)
    : String(id).replace(/"/g, '\\"');
  const card = document.querySelector(`article[data-id="${safeId}"]`);
  if (!card) {
    try {
      render();
    } catch (err) {
      console.warn('updateCardColorSelection re-render fallback failed:', err);
    }
    return;
  }
  const swatches = card.querySelectorAll('.color-swatch');
  swatches.forEach(btn => {
    const name = btn.getAttribute('data-color-name');
    const isSelected = name === color;
    btn.classList.toggle('selected', isSelected);
    btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });
  const msg = card.querySelector('.color-msg[data-color-msg]');
  if (msg) {
    if (color) {
      const localized = mapColorDisplay(color);
      msg.textContent = localized ? localized : color;
      const hex = resolveColorCode(color) || '#0f172a';
      const veryLight = isVeryLightColor(hex);
      msg.style.background = veryLight ? '#f8fafc' : hex;
      msg.style.borderColor = veryLight ? '#cbd5e1' : hex;
      msg.style.boxShadow = veryLight
        ? '0 0 0 1px rgba(0,0,0,0.08), 0 6px 16px rgba(15,23,42,0.12)'
        : '0 6px 14px rgba(0,0,0,0.12)';
      msg.style.color = getReadableTextColor(hex);
      msg.removeAttribute('hidden');
      if (clickedButton) {
        const variantLine = msg.closest('.variant-line');
        if (variantLine) {
          const btnRect = clickedButton.getBoundingClientRect();
          const lineRect = variantLine.getBoundingClientRect();
          msg.style.left = (btnRect.left - lineRect.left + btnRect.width / 2) + 'px';
          msg.style.top = (btnRect.bottom - lineRect.top + 6) + 'px';
        }
      }
      if (msg._hideTimer) {
        clearTimeout(msg._hideTimer);
      }
      msg._hideTimer = setTimeout(() => {
        msg.textContent = '';
        msg.setAttribute('hidden', '');
        msg.style.background = '';
        msg.style.borderColor = '';
        msg.style.boxShadow = '';
        msg.style.color = '';
        msg.style.left = '';
        msg.style.top = '';
        msg._hideTimer = null;
      }, 6000);
    } else {
      if (msg._hideTimer) {
        clearTimeout(msg._hideTimer);
        msg._hideTimer = null;
      }
      msg.textContent = '';
      msg.setAttribute('hidden', '');
      msg.style.background = '';
      msg.style.borderColor = '';
      msg.style.boxShadow = '';
      msg.style.color = '';
      msg.style.left = '';
      msg.style.top = '';
    }
  }
}

function mapColorDisplay(color) {
  const table = {
    'أبيض': 'أبيض / Blanc',
    'ابيض': 'أبيض / Blanc',
    'أحمر': 'أحمر / Rouge',
    'احمر': 'أحمر / Rouge',
    'أزرق': 'أزرق / Bleu',
    'ازرق': 'أزرق / Bleu',
    'أخضر': 'أخضر / Vert',
    'اخضر': 'أخضر / Vert',
    'وردي': 'وردي / Rose',
    'بنفسجي': 'بنفسجي / Violet',
    'بيج': 'بيج / Beige',
    'أسود': 'أسود / Noir',
    'اسود': 'أسود / Noir',
    'زيتي': 'زيتي / Olive',
    'أصفر': 'أصفر / Jaune',
    'اصفر': 'أصفر / Jaune',
    'رمادي': 'رمادي / Gris',
    'برتقالي': 'برتقالي / Orange',
    'بني': 'بني / Marron',
    'ذهبي': 'ذهبي / Or',
    'فضي': 'فضي / Argent'
  };
  return table[color] || null;
}

function hexToRgb(hex) {
  if (!hex) return null;
  const value = hex.replace('#', '');
  if (value.length !== 6) return null;
  const num = parseInt(value, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function getReadableTextColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#0f172a';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#f8fafc';
}

function isVeryLightColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
  return luminance > 230; // near-white
}

function closeQuickPanels() {
  const panels = document.querySelectorAll('.quick-panel, .quick-backdrop');
  if (!panels.length) return false;
  panels.forEach(el => el.remove());
  return true;
}

function closeActiveModalOverlay() {
  const overlays = document.querySelectorAll('.modal-overlay');
  if (!overlays.length) return false;
  const last = overlays[overlays.length - 1];
  last.remove();
  return true;
}

function closeContextMenus() {
  const menu = document.querySelector('.quick-menu');
  if (menu) {
    menu.remove();
    return true;
  }
  return false;
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (closeQuickPanels()) return;
  if (closeActiveModalOverlay()) return;
  closeContextMenus();
});

// User-friendly upload error handler (from solu.txt)
function showUploadError(error) {
  const errorMsg = error.message || 'Unknown error occurred';
  let userMessage = '';

  if (errorMsg.includes('Cloudinary') || errorMsg.includes('configuration')) {
    userMessage = `⚙️ Cloudinary غير مُكوّن
        
        لإصلاح هذا:
        1. افتح SETUP_GUIDE.html
        2. اتبع خطوات الإعداد
        3. حدّث بيانات Cloudinary
        
        هذا مطلوب لرفع الصور.`;
  } else if (errorMsg.includes('Internet') || errorMsg.includes('network') || errorMsg.includes('fetch')) {
    userMessage = '📡 يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.';
  } else if (errorMsg.includes('File size') || errorMsg.includes('too large') || errorMsg.includes('quota')) {
    userMessage = '📁 الملف كبير جداً. يرجى استخدام صور أقل من 10MB أو قم بتكوين Cloudinary للتخزين غير المحدود.';
  } else if (errorMsg.includes('Storage quota') || errorMsg.includes('exceeded')) {
    userMessage = '💾 تجاوزت حد التخزين. يرجى مسح بعض البيانات أو تكوين Cloudinary للتخزين غير المحدود.';
  } else {
    userMessage = `❌ خطأ: ${errorMsg}`;
  }

  // Show toast notification
  showToast(userMessage);

  // Also log to console for debugging
  console.error('📤 Upload Error:', error);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    document.body.removeChild(toast);
  }, 3000);
}

// Notification system for product updates
function generateCatalogHash() {
  return JSON.stringify(CATALOG.map(p => ({
    id: p.id,
    title: p.title,
    price: p.price,
    was: p.was,
    status: p.status,
    discount: p.was && p.price ? Math.round((1 - p.price / p.was) * 100) : 0
  })));
}

function detectProductChanges() {
  const currentHash = generateCatalogHash();

  if (LAST_CATALOG_HASH && currentHash !== LAST_CATALOG_HASH) {
    const previous = JSON.parse(LAST_CATALOG_HASH);
    const current = JSON.parse(currentHash);

    const prevMap = new Map(previous.map(p => [p.id, p]));
    const currMap = new Map(current.map(p => [p.id, p]));

    const newProducts = current.filter(p => !prevMap.has(p.id));
    const removedProducts = previous.filter(p => !currMap.has(p.id));
    const discountedProducts = current.filter(p => {
      const prev = prevMap.get(p.id);
      return prev && prev.price > p.price && p.status === 'discount';
    });

    newProducts.forEach(product => {
      NOTIFICATIONS.push({
        type: 'new',
        timestamp: Date.now(),
        message: `🆕 منتج جديد: ${product.title}`
      });
    });

    removedProducts.forEach(product => {
      NOTIFICATIONS.push({
        type: 'removed',
        timestamp: Date.now(),
        message: `🗑️ تمت إزالة المنتج: ${product.title}`
      });
    });

    discountedProducts.forEach(product => {
      NOTIFICATIONS.push({
        type: 'discount',
        timestamp: Date.now(),
        message: `💥 خصم على: ${product.title}`
      });
    });

    // Keep all notifications (no time-based filtering)
    // NOTIFICATIONS = NOTIFICATIONS.filter(n => 
    //   Date.now() - n.timestamp < 24 * 60 * 60 * 1000
    // );
  }

  LAST_CATALOG_HASH = currentHash;
}

function getNotificationMessages() {
  return NOTIFICATIONS.slice(-8).map(n => n.message);
}

// ERROR CODE: ITEM-DEL-001
async function deleteItemDirect(id) {
  const ERROR_CODE = 'ITEM-DEL-001';
  const logPrefix = `[deleteItemDirect:${ERROR_CODE}]`;
  try {
    if (confirm(DELETE_CONFIRM_MESSAGE)) {
      // Delete from Firestore if configured
      if (db && id && !id.startsWith('P')) {
        try {
          const docRef = doc(db, "articles", id);
          await deleteDoc(docRef);
          console.log(`${logPrefix} ✅ Item deleted from Firestore: ${id}`);
        } catch (firestoreError) {
          console.error(`${logPrefix} ⚠️ Failed to delete from Firestore:`, firestoreError);
          // Continue with local deletion even if Firestore delete fails
        }
      }

      // Remove from local catalog
      CATALOG = CATALOG.filter(p => p.id !== id);
      console.log(`${logPrefix} ✅ Item deleted: ${id}`);
      await saveCatalog();
      render();
    }
  } catch (err) {
    console.error(`${logPrefix} ❌ Error deleting item:`, err);
    showToast(`❌ [${ERROR_CODE}] خطأ في حذف المنتج: ${err.message || 'Unknown error'}`);
  }
}

// Hide/Unhide product
async function hideItemDirect(id) {
  const ERROR_CODE = 'ITEM-HIDE-001';
  try {
    const item = CATALOG.find(p => p.id === id);
    if (!item) return;
    item.hidden = true;
    if (db && id && !id.startsWith('P')) {
      try {
        await updateDoc(doc(db, "articles", id), { hidden: true });
      } catch (e) {
        console.warn(`[${ERROR_CODE}] Firestore hide failed:`, e);
      }
    }
    await saveCatalog();
    render();
    showToast('🙈 تم إخفاء المنتج');
  } catch (err) {
    console.error(`[${ERROR_CODE}]`, err);
    showToast(`❌ [${ERROR_CODE}] فشل إخفاء المنتج`);
  }
}

// Helper function to check if article timer is still active
function isArticleTimerActive(item) {
  if (!item || item.status !== 'today' && item.status !== 'discount') return false;
  if (!shouldShowInTicker(item)) return false;
  const days = Number(item.tickerDays) || 7;
  const startMs = item.tickerStart ? new Date(item.tickerStart).getTime() : (item.date ? new Date(item.date).getTime() : NaN);
  if (!Number.isFinite(startMs)) return false;
  const cutoff = Date.now() - (days * 86400000);
  return startMs >= cutoff;
}

async function unhideItemDirect(id) {
  const ERROR_CODE = 'ITEM-UNHIDE-001';
  try {
    const item = CATALOG.find(p => p.id === id);
    if (!item) return;
    item.hidden = false;
    if (db && id && !id.startsWith('P')) {
      try {
        await updateDoc(doc(db, "articles", id), { hidden: false });
      } catch (e) {
        console.warn(`[${ERROR_CODE}] Firestore unhide failed:`, e);
      }
    }
    await saveCatalog();
    render();
    // Check if timer is still active - if so, it will appear in ticker automatically
    if (isArticleTimerActive(item)) {
      showToast('👀 تم إظهار المنتج - سيظهر في الشريط');
    } else {
      showToast('👀 تم إظهار المنتج');
    }
  } catch (err) {
    console.error(`[${ERROR_CODE}]`, err);
    showToast(`❌ [${ERROR_CODE}] فشل إظهار المنتج`);
  }
}

function hideAllArticles() {
  CATALOG.forEach(p => { p.hidden = true; });
  saveCatalog().then(render);
  showToast('🙈 تم إخفاء كل المنتجات');
}

// Hide only discount products
function hideDiscountArticles() {
  CATALOG.forEach(p => { if (p.status === 'discount') p.hidden = true; });
  saveCatalog().then(render);
  showToast('🙈 تم إخفاء كل التخفيضات');
}

// Reorder helpers for articles
function moveItemToTop(id) {
  const idx = CATALOG.findIndex(p => p.id === id);
  if (idx === -1) return;
  const [item] = CATALOG.splice(idx, 1);
  CATALOG.unshift(item);
  saveCatalog().then(render);
}

function moveItemUp(id) {
  const idx = CATALOG.findIndex(p => p.id === id);
  if (idx <= 0) return;
  const tmp = CATALOG[idx - 1];
  CATALOG[idx - 1] = CATALOG[idx];
  CATALOG[idx] = tmp;
  saveCatalog().then(render);
}

function moveItemDown(id) {
  const idx = CATALOG.findIndex(p => p.id === id);
  if (idx === -1 || idx === CATALOG.length - 1) return;
  const tmp = CATALOG[idx + 1];
  CATALOG[idx + 1] = CATALOG[idx];
  CATALOG[idx] = tmp;
  saveCatalog().then(render);
}

function unhideAllArticles() {
  let restoredToTicker = 0;
  CATALOG.forEach(p => {
    const wasHidden = p.hidden;
    p.hidden = false;
    // Check if timer is still active - if so, it will appear in ticker
    if (wasHidden && isArticleTimerActive(p)) {
      restoredToTicker++;
    }
  });
  saveCatalog().then(render);
  if (restoredToTicker > 0) {
    showToast(`👀 تم إظهار كل المنتجات - ${restoredToTicker} منتج سيظهر في الشريط`);
  } else {
    showToast('👀 تم إظهار كل المنتجات');
  }
}

// ERROR CODE: FORM-PROD-001
function createQuickProductForm(item, isNewProduct = false) {
  const ERROR_CODE = 'FORM-PROD-001';
  const logPrefix = `[createQuickProductForm:${ERROR_CODE}]`;
  try {
    console.log(`${logPrefix} 🔄 START: Creating product form for ${isNewProduct ? 'new product' : item?.id || 'unknown'}`);
    item.hidden = !!item.hidden;
    const modal = document.createElement('div');
    modal.classList.add('modal-overlay', 'product-editor-modal');
    modal.dataset.modalType = 'product-editor';
    modal.classList.add('modal-overlay', 'video-form-modal');
    modal.dataset.modalType = 'video-form';
    modal.classList.add('modal-overlay', 'product-form-modal');
    modal.dataset.modalType = 'product-form';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        z-index: 200;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      `;

    const sizeGroups = [
      { label: 'الكبار', sizes: ["5XL", "4XL", "3XL", "2XL", "XXL", "XL", "L", "M", "S", "XS", "XXS"] },
      { label: 'الأطفال', sizes: ["16", "14", "12", "10", "8", "6", "4", "2"] },
      { label: 'البيبي', sizes: ["24M", "18-24M", "12-18M", "9-12M", "6-9M", "3-6M", "0-3M"] }
    ];
    const colors = ["أبيض", "أسود", "بيج", "زيتي", "أزرق", "وردي", "أحمر", "بنفسجي", "أخضر"];

    const form = document.createElement('form');
    form.style.cssText = `
        background: var(--card);
        padding: 24px;
        border-radius: 18px;
        width: 100%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        border: 1px solid #ffffff18;
      `;

    form.innerHTML = `
        <h2 style="margin:0 0 20px 0">أضف منتجًا جديدًا</h2>

        <div style="margin:12px 0">
          <label style="display:block;margin-bottom:6px;font-weight:600">الاسم</label>
          <input type="text" id="quick-title" placeholder="مثال: قميص أبيض" style="width:100%;padding:10px;border-radius:8px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--text);font-size:14px" required>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600">السعر (TND)</label>
            <input type="number" id="quick-price" placeholder="مثال: 45" min="0" step="any" style="width:100%;padding:10px;border-radius:8px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--text);font-size:14px" required>
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600">الحالة</label>
            <select id="quick-status" style="width:100%;padding:10px;border-radius:8px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--text);font-size:14px">
              <option value="today">جديد اليوم</option>
              <option value="discount">تخفيض</option>
            </select>
          </div>
        </div>

        <div id="gender-row" style="margin:14px 0">
          <label style="display:flex;align-items:center;gap:8px;font-weight:600">
            <input type="checkbox" id="use-gender" checked>
            الرمز (👨 / 👗)
          </label>
          <div id="gender-buttons" style="display:flex;gap:8px;margin-top:8px">
            <button type="button" class="btn" id="btn-g-m" style="padding:8px 12px;border-radius:6px;border:1px solid var(--chip-border);background:var(--chip-bg);color:var(--text)">👨</button>
            <button type="button" class="btn primary" id="btn-g-f" style="padding:8px 12px;border-radius:6px;border:1px solid var(--chip-border);background:var(--chip-bg);color:var(--text)">👗</button>
          </div>
        </div>

        <div id="image-upload-row" style="margin:14px 0">
          <label style="display:block;margin-bottom:8px;font-weight:600">الصورة (اختياري)</label>
          <input type="file" id="image-file-input" accept="image/*" style="display:none">
          <button type="button" id="choose-image-btn" style="width:100%;padding:10px;border-radius:8px;background:var(--chip-bg);border:1px solid var(--chip-border);color:var(--text);cursor:pointer;font-size:14px">
            اختر صورة من جهازك
          </button>
          <div id="image-preview-area" style="margin-top:10px;text-align:center"></div>
          <input type="text" id="image-url" placeholder="أو اكتب رابط الصورة" style="width:100%;padding:10px;border-radius:8px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--text);font-size:14px;margin-top:10px">
        </div>

  <div id="video-upload-row" style="margin:14px 0">
    <label style="display:block;margin-bottom:8px;font-weight:600">الفيديو (اختياري)</label>
    <input type="file" id="video-file-input" accept="video/*,video/quicktime,video/x-m4v,video/m4v,.mov,.m4v,.mp4,.webm,.ogg" style="display:none">
    <button type="button" id="choose-video-btn" style="width:100%;padding:10px;border-radius:8px;background:var(--chip-bg);border:1px solid var(--chip-border);color:var(--text);cursor:pointer;font-size:14px">
      اختر فيديو من جهازك
    </button>
    <div id="video-preview-area" style="margin-top:10px;text-align:center"></div>
    <input type="text" id="video-url" placeholder="أو اكتب رابط الفيديو" style="width:100%;padding:10px;border-radius:8px;background:var(--input-bg);border:1px solid var(--input-border);color:var(--text);font-size:14px;margin-top:10px">
  </div>

        <div style="margin:16px 0;display:flex;justify-content:center">
          <button type="button" id="quick-continue-details" class="btn" style="padding:10px 16px;border-radius:8px;background:var(--chip-bg);border:1px solid var(--chip-border);color:var(--text);font-size:14px">التفاصيل الإضافية</button>
        </div>

        <div id="discount-row" style="display:none"></div>
        <input type="number" id="disc-from" step="any" min="0" style="display:none">
        <input type="number" id="disc-new" step="any" min="0" style="display:none">
        <output id="disc-pct" style="display:none">-0%</output>

        <div id="quick-sizes-section" style="margin:15px 0;display:none">
          <label style="display:block;margin-bottom:8px;font-weight:600">المقاسات</label>
          ${sizeGroups.map(group => `
            <div style="margin-bottom:10px;border:1px solid var(--chip-border);border-radius:10px;padding:8px">
              <div style="font-weight:700;margin-bottom:6px;border-bottom:1px solid var(--chip-border);padding-bottom:4px">${group.label}</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px">
                ${group.sizes.map(s => `
                  <label style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--chip-bg);border:2px solid var(--chip-border);border-radius:999px;cursor:pointer">
                    <input type="checkbox" value="${s}" name="size" style="cursor:pointer">
                    <span>${s}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          `).join('')}
          
          <div style="margin-top:10px;border-top:1px solid var(--chip-border);padding-top:10px;border:1px solid var(--chip-border);border-radius:10px;padding:8px">
            <div style="font-weight:700;margin-bottom:6px;border-bottom:1px solid var(--chip-border);padding-bottom:4px">📐 الحجم</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${(() => {
        const sizes = [];
        for (let i = 28; i <= 56; i += 2) {
          sizes.push(String(i));
        }
        return sizes.map(s => `
                  <label style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--chip-bg);border:2px solid var(--chip-border);border-radius:999px;cursor:pointer">
                    <input type="checkbox" value="${s}" name="fontsize" ${item.fontSizes?.includes(s) ? 'checked' : ''} style="cursor:pointer">
                    <span>${s}</span>
                  </label>
                `).join('');
      })()}
            </div>
          </div>
        </div>

        <div id="quick-colors-section" style="margin:15px 0;display:none">
          <label style="display:block;margin-bottom:8px;font-weight:600">الألوان</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${colors.map(c => `
              <label style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--chip-bg);border:2px solid var(--chip-border);border-radius:999px;cursor:pointer">
                <input type="checkbox" value="${c}" name="color" style="cursor:pointer">
                <span>${c}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div id="quick-notes-section" style="margin:15px 0;display:none">
          <label style="display:block;margin-bottom:6px;font-weight:600">ملاحظات (اختياري)</label>
          <textarea id="quick-note" placeholder="مثال: قطن 100% • مخزون محدود" style="width:100%;padding:12px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text);font-size:14px;min-height:60px;resize:vertical"></textarea>
        </div>

        <div id="quick-ends-section" style="margin:15px 0;display:none">
          <label style="display:block;margin-bottom:6px;font-weight:600">تاريخ انتهاء العرض (اختياري)</label>
          <input type="datetime-local" id="quick-ends" style="width:100%;padding:12px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text);font-size:14px">
          <div class="optional-note" style="color:#888;font-size:12px;margin-top:4px">سيظهر عداد تنازلي تلقائياً عند تعيين تاريخ</div>
        </div>

        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
          <button type="submit" style="flex:1;min-width:140px;padding:10px;border-radius:8px;background:var(--ok);color:#052e17;border:none;font-weight:600;cursor:pointer;font-size:14px">حفظ</button>
          <button type="button" class="save-and-continue" style="flex:1;min-width:140px;padding:10px;border-radius:8px;background:var(--accent);color:#052e17;border:none;font-weight:600;cursor:pointer;font-size:14px">حفظ وإضافة آخر</button>
          <button type="button" class="cancel" style="flex:1;min-width:140px;padding:10px;border-radius:8px;background:var(--chip-bg);border:1px solid var(--chip-border);color:var(--text);cursor:pointer;font-weight:600;font-size:14px">إلغاء</button>
        </div>
      `;

    const statusSelect = form.querySelector('#quick-status');
    const discountRow = form.querySelector('#discount-row');
    const priceInput = form.querySelector('#quick-price');
    const discFrom = form.querySelector('#disc-from');
    const pctOut = form.querySelector('#disc-pct');
    const discNew = form.querySelector('#disc-new');
    const continueDetailsBtn = form.querySelector('#quick-continue-details');
    const sizesSection = form.querySelector('#quick-sizes-section');
    const colorsSection = form.querySelector('#quick-colors-section');
    const notesSection = form.querySelector('#quick-notes-section');
    const endsSection = form.querySelector('#quick-ends-section');
    const endsInput = form.querySelector('#quick-ends');

    const useGender = form.querySelector('#use-gender');
    const btnGM = form.querySelector('#btn-g-m');
    const btnGF = form.querySelector('#btn-g-f');
    const genderBtns = form.querySelector('#gender-buttons');

    function setGender(g) {
      item.gender = g; // 'm' ou 'f'
      btnGM?.classList.toggle('primary', g === 'm');
      btnGF?.classList.toggle('primary', g === 'f');
    }

    useGender?.addEventListener('change', () => {
      if (genderBtns) genderBtns.style.display = useGender.checked ? 'flex' : 'none';
      if (!useGender.checked) setGender('f'); // défaut 👗
    });

    btnGM?.addEventListener('click', () => setGender('m'));
    btnGF?.addEventListener('click', () => setGender('f'));

    // défaut: 👗
    setGender(item.gender || 'f');

    // Image upload handling
    const chooseImageBtn = form.querySelector('#choose-image-btn');
    const imageFileInput = form.querySelector('#image-file-input');
    const imagePreviewArea = form.querySelector('#image-preview-area');
    const imageUrlInput = form.querySelector('#image-url');
    let selectedImageFile = null;

    // Video upload handling
    const chooseVideoBtn = form.querySelector('#choose-video-btn');
    const videoFileInput = form.querySelector('#video-file-input');
    const videoPreviewArea = form.querySelector('#video-preview-area');
    const videoUrlInput = form.querySelector('#video-url');
    let selectedVideoFile = null;

    chooseImageBtn?.addEventListener('click', () => {
      imageFileInput?.click();
    });

    // Function to update preview message based on current status
    const updateImagePreviewMessage = () => {
      if (selectedImageFile) {
        const status = statusSelect.value;
        const folder = getFolderFromStatus(status);
        const fileSize = (selectedImageFile.size / 1024).toFixed(1);
        imagePreviewArea.innerHTML = `
            <img src="${URL.createObjectURL(selectedImageFile)}" style="max-width:150px;max-height:150px;border-radius:8px;border:2px solid var(--line);margin:8px 0;object-fit:contain;background:#0a162c" onerror="this.style.display='none'">
            <p style="color:var(--ok);font-size:13px;margin:4px 0">✅ ${selectedImageFile.name}</p>
            <p style="color:var(--muted);font-size:11px">الحجم: ${fileSize}KB</p>
            <p style="color:var(--muted);font-size:11px">📂 سيتم الرفع إلى Firebase Storage</p>
            <p style="color:var(--muted);font-size:10px">(سيتم الرفع عند حفظ المنتج)</p>
          `;
      }
    };

    imageFileInput?.addEventListener('change', async (e) => {
      const logPrefix = '[Add Product Image]';

      const file = e.target.files?.[0];
      if (!file) {
        selectedImageFile = null;
        imagePreviewArea.innerHTML = '';
        imageUrlInput.value = '';
        return;
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        console.error(`${logPrefix} Invalid file type:`, file.type);
        showToast('❌ نوع الملف غير مدعوم. استخدم: JPG, PNG, WEBP, GIF');
        selectedImageFile = null;
        imageFileInput.value = '';
        return;
      }

      // Store file for upload on form submission (ensures correct folder based on current status)
      selectedImageFile = file;
      imageUrlInput.value = ''; // Clear any existing URL

      // Show preview with current folder info
      updateImagePreviewMessage();

      showToast(`📷 تم اختيار الصورة - سيتم الرفع عند الحفظ`);
    });

    // Video upload handling (optional)
    const updateVideoPreviewMessage = (src, metaText = '') => {
      if (!videoPreviewArea) return;
      const isIndexedDB = src && src.startsWith('idb:');
      const safeSrc = src ? getImageSrc(src) : '';
      videoPreviewArea.innerHTML = src ? `
      <video ${isIndexedDB ? `data-video-path="${escapeAttr(src)}"` : `src="${escapeAttr(safeSrc)}"`} controls style="max-width:100%;max-height:220px;border-radius:8px;border:2px solid var(--line);margin:8px 0"></video>
      ${metaText ? `<p style="color:var(--muted);font-size:12px;margin:4px 0">${metaText}</p>` : ''}
    ` : '';
      if (isIndexedDB) {
        const videoEl = videoPreviewArea.querySelector('video');
        if (videoEl) loadIndexedDBVideo(videoEl, src);
      }
    };

    // Show existing video if present (useful when editing)
    if (item.video) {
      updateVideoPreviewMessage(item.video, 'الفيديو الحالي');
    }

    chooseVideoBtn?.addEventListener('click', () => {
      videoFileInput?.click();
    });

    videoFileInput?.addEventListener('change', async (e) => {
      const logPrefix = '[Add Product Video]';
      const file = e.target.files?.[0];
      if (!file) {
        selectedVideoFile = null;
        updateVideoPreviewMessage('');
        videoUrlInput.value = '';
        return;
      }

      const validTypes = [
        'video/mp4', 'video/webm', 'video/ogg',
        'video/quicktime', 'video/x-m4v', 'video/m4v', 'video/mov',
        'video/3gpp', 'video/x-msvideo'
      ];
      const validExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.3gp', '.avi'];
      const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      if (!validTypes.includes(file.type) && !hasValidExt) {
        console.error(`${logPrefix} Invalid file type:`, file.type);
        showToast('❌ نوع الفيديو غير مدعوم. استخدم MP4 / MOV / WEBM');
        videoFileInput.value = '';
        return;
      }

      const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
      if (file.size > MAX_VIDEO_SIZE) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        showToast(`❌ حجم الفيديو كبير (${fileSizeMB}MB). الحد الأقصى 200MB.`);
        videoFileInput.value = '';
        return;
      }

      selectedVideoFile = file;
      videoUrlInput.value = '';

      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      updateVideoPreviewMessage(URL.createObjectURL(file), `الحجم: ${fileSizeMB}MB • سيتم رفع الفيديو عند الحفظ`);
      showToast('🎥 تم اختيار الفيديو - سيتم الرفع عند الحفظ');
    });

    videoUrlInput?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (!val) {
        updateVideoPreviewMessage('');
        return;
      }
      updateVideoPreviewMessage(val, 'معاينة الرابط');
    });

    const updateEndsVisibility = () => {
      if (!endsSection) return;
      const isDiscount = statusSelect?.value === 'discount';
      endsSection.style.display = isDiscount ? 'block' : 'none';
    };

    updateEndsVisibility();

    continueDetailsBtn?.addEventListener('click', () => {
      if (sizesSection) sizesSection.style.display = 'block';
      if (colorsSection) colorsSection.style.display = 'block';
      if (notesSection) notesSection.style.display = 'block';
      updateEndsVisibility();
      showToast('ℹ️ Additional details enabled');
    });

    if (item.ends && endsInput) {
      const endsDate = new Date(item.ends);
      const localDateTime = new Date(endsDate.getTime() - endsDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      endsInput.value = localDateTime;
    } else if (item.status === 'discount' && endsInput) {
      const iso = ensureDiscountTimerValue(item);
      if (iso) {
        endsInput.value = isoToLocalInputValue(iso);
      }
    }

    statusSelect.addEventListener('change', () => {
      const isDiscount = statusSelect.value === 'discount';
      discountRow.style.display = isDiscount ? 'flex' : 'none';
      updateEndsVisibility();
      if (selectedImageFile) {
        updateImagePreviewMessage();
      }
      if (isDiscount) {
        if (endsInput && !endsInput.value) {
          const iso = ensureDiscountTimerValue(item);
          endsInput.value = isoToLocalInputValue(iso);
          if (typeof showToast === 'function') {
            showToast('⏱️ التخفيض يحتاج إلى مؤقت. تم ضبط 24 ساعة افتراضيًا، يمكنك تعديله');
          }
        }
      } else {
        resetDiscountPricing(item);
        if (endsInput) endsInput.value = '';
        if (isFinite(item.price) && priceInput) priceInput.value = item.price;
        discFrom.value = '';
        discNew.value = '';
        pctOut.textContent = '-0%';
      }
    });

    // Calcul automatique du pourcentage et MAJ du prix principal
    function updateDiscount() {
      const from = parseFloat(discFrom.value);
      const now = parseFloat(discNew.value);
      if (isFinite(from) && from > 0 && isFinite(now) && now >= 0) {
        const pct = Math.round((1 - now / from) * 100);
        if (pctOut) pctOut.textContent = `-${pct}%`;
        if (priceInput) priceInput.value = now;
      } else {
        if (pctOut) pctOut.textContent = '-0%';
      }
    }
    discFrom?.addEventListener('input', updateDiscount);
    discNew?.addEventListener('input', updateDiscount);

    // Calcul désormais géré par updateDiscount sur disc-from et disc-new

    form.addEventListener('submit', async e => {
      e.preventDefault();

      const title = form.querySelector('#quick-title').value.trim();
      const price = Number(form.querySelector('#quick-price').value);
      const status = form.querySelector('#quick-status').value;
      const sizes = [...form.querySelectorAll('input[name="size"]:checked')].map(cb => cb.value);
      const colors = [...form.querySelectorAll('input[name="color"]:checked')].map(cb => cb.value);
      const fontSizes = [...form.querySelectorAll('input[name="fontsize"]:checked')].map(cb => cb.value);
      const note = form.querySelector('#quick-note').value.trim();

      if (!title || isNaN(price) || price <= 0) {
        alert('Please fill in product name and a valid price');
        return;
      }

      if (status === 'discount' && (!endsInput || !endsInput.value)) {
        if (typeof showToast === 'function') {
          showToast('⚠️ يرجى ضبط مؤقت للتخفيض قبل الحفظ');
        } else {
          alert('يرجى ضبط مؤقت للتخفيض قبل الحفظ');
        }
        endsInput?.focus();
        return;
      }

      // Upload image if file was selected (using CURRENT status for correct folder)
      let imagePath = form.querySelector('#image-url')?.value.trim() || '';
      let videoPath = form.querySelector('#video-url')?.value.trim() || item.video || '';

      if (selectedImageFile) {
        const logPrefix = '[Form Submit Image Upload]';
        console.log(`${logPrefix} Uploading image with current status: ${status}`);

        try {
          console.log(`${logPrefix} 📂 Uploading image for status: ${status}`);

          // Show loading in preview area
          imagePreviewArea.innerHTML = `<p style="color:var(--muted)">⏳ جاري رفع الصورة...</p>`;

          // Use backend adapter for image upload
          const uploadResult = await backendUploadImage(selectedImageFile, status);

          if (uploadResult && uploadResult.success && uploadResult.imageUrl) {
            imagePath = uploadResult.imageUrl;
            imageUrlInput.value = imagePath;

            // Update preview
            const imgSrc = getImageSrc(imagePath);
            const metadata = uploadResult.metadata || {};
            const originalSize = metadata.originalSize ? (metadata.originalSize / 1024).toFixed(1) : 'N/A';
            const compressedSize = metadata.compressedSize ? (metadata.compressedSize / 1024).toFixed(1) : 'N/A';

            imagePreviewArea.innerHTML = `
                <img src="${imgSrc}" style="max-width:150px;max-height:150px;border-radius:8px;border:2px solid var(--line);margin:8px 0;object-fit:contain;background:#0a162c" onerror="this.style.display='none'">
                <p style="color:var(--ok);font-size:13px;margin:4px 0">✅ تم حفظ الصورة بنجاح</p>
                <p style="color:var(--muted);font-size:11px">الحجم: ${originalSize}KB → ${compressedSize}KB</p>
                <p style="color:var(--muted);font-size:10px">التخزين: ${metadata.storageType || 'localStorage'}</p>
              `;
          }
        } catch (err) {
          console.error(`${logPrefix} Upload FAILED:`, err);
          showUploadError(err); // Use user-friendly error handler
          // Continue with form submission even if image upload fails
        }
      }

      // Upload video if selected
      if (selectedVideoFile) {
        const logPrefix = '[Form Submit Video Upload]';
        const fileSizeMB = (selectedVideoFile.size / 1024 / 1024).toFixed(2);
        videoPreviewArea.innerHTML = `<p style="color:var(--muted)">⏳ جاري رفع الفيديو... (${fileSizeMB}MB)</p>`;
        try {
          const uploadResult = await backendUploadProductVideo(selectedVideoFile, status);
          if (uploadResult && uploadResult.success && uploadResult.videoUrl) {
            videoPath = uploadResult.videoUrl;
            videoUrlInput.value = videoPath;
            updateVideoPreviewMessage(videoPath, `✅ تم حفظ الفيديو • ${fileSizeMB}MB`);
          }
        } catch (err) {
          console.error(`${logPrefix} Upload FAILED:`, err);
          showUploadError(err);
        }
      } else if (videoPath) {
        // If user entered a link, show quick preview
        updateVideoPreviewMessage(videoPath, 'معاينة الرابط');
      }

      item.title = title;
      item.sizes = sizes;
      item.colors = colors;
      item.fontSizes = fontSizes;
      item.note = note;
      item.img = imagePath || item.img || '';
      item.video = videoPath || item.video || '';
      item.gender = item.gender || 'f';
      item.date = new Date().toISOString().split('T')[0];

      // Handle status change and pricing
      const previousStatus = item.status;
      item.status = status;

      if (status === 'discount') {
        // Setting up discount: save original price first if changing from non-discount
        if (previousStatus !== 'discount' && isFinite(item.price) && item.price > 0) {
          item.was = item.price; // Preserve current price as original
        }
        // Get discount values from form
        const from = parseFloat(form.querySelector('#disc-from').value);
        const nw = parseFloat(form.querySelector('#disc-new').value);
        if (isFinite(from) && from > 0) item.was = from;
        if (isFinite(nw) && nw >= 0) item.price = nw;
        // Set discount timer
        const endsValue = endsInput?.value;
        item.ends = endsValue ? new Date(endsValue).toISOString() : null;

        // Automatically activate ticker when moving from today to discount
        if (previousStatus === 'today') {
          const now = Date.now();
          item.tickerEnabled = true;
          // Set tickerStart to now if not already set
          if (!item.tickerStart) {
            item.tickerStart = now;
          }
          // Set tickerDays to 7 if not set
          if (!item.tickerDays || item.tickerDays === 0) {
            item.tickerDays = 7;
          }
          // Calculate tickerExpiresAt if not set or expired
          const startMs = item.tickerStart ? Number(item.tickerStart) : now;
          const days = item.tickerDays || 7;
          const expMs = Number(item.tickerExpiresAt);
          if (!item.tickerExpiresAt || !Number.isFinite(expMs) || expMs <= startMs) {
            item.tickerExpiresAt = startMs + (days * 86400000);
          }
          // Clear skipTickerUntil if set
          if (item.skipTickerUntil) {
            item.skipTickerUntil = null;
          }
        }
      } else {
        // Changing from discount to today: reset discount pricing
        resetDiscountPricing(item);
        // Use the price from form input (which should be the restored price)
        if (isFinite(price) && price > 0) item.price = price;
      }

      console.log('💾 Saving product:', item.title, 'Image:', item.img);

      // Only add to catalog if this is a new product
      // Use backend adapter to save article
      await backendSaveArticle(item, isNewProduct);
      render();
      document.body.removeChild(modal);
    });

    form.querySelector('.cancel').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    // Close modal when clicking outside (on the backdrop) - like pressing Escape
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    // Save and continue button
    form.querySelector('.save-and-continue')?.addEventListener('click', async () => {
      const title = form.querySelector('#quick-title').value.trim();
      const price = Number(form.querySelector('#quick-price').value);
      const status = form.querySelector('#quick-status').value;
      const sizes = [...form.querySelectorAll('input[name="size"]:checked')].map(cb => cb.value);
      const colors = [...form.querySelectorAll('input[name="color"]:checked')].map(cb => cb.value);
      const fontSizes = [...form.querySelectorAll('input[name="fontsize"]:checked')].map(cb => cb.value);
      const note = form.querySelector('#quick-note').value.trim();

      if (!title || isNaN(price) || price <= 0) {
        alert('Please fill in product name and a valid price');
        return;
      }

      // Upload image if file was selected (using CURRENT status for correct folder)
      let imagePath = form.querySelector('#image-url')?.value.trim() || '';
      let videoPath = form.querySelector('#video-url')?.value.trim() || item.video || '';

      if (selectedImageFile) {
        const logPrefix = '[Save and Continue Image Upload]';
        console.log(`${logPrefix} Uploading image with current status: ${status}`);

        try {
          const folder = getFolderFromStatus(status);
          console.log(`${logPrefix} 📂 Uploading to folder: images/${folder}`);

          // Show loading in preview area
          imagePreviewArea.innerHTML = `<p style="color:var(--muted)">⏳ جاري رفع الصورة...</p>`;

          // Use backend adapter for image upload
          const uploadResult = await backendUploadImage(selectedImageFile, status);

          if (uploadResult && uploadResult.success && uploadResult.imageUrl) {
            imagePath = uploadResult.imageUrl;
            imageUrlInput.value = imagePath;

            // Update preview
            const imgSrc = getImageSrc(imagePath);
            const metadata = uploadResult.metadata || {};
            const originalSize = metadata.originalSize ? (metadata.originalSize / 1024).toFixed(1) : 'N/A';
            const compressedSize = metadata.compressedSize ? (metadata.compressedSize / 1024).toFixed(1) : 'N/A';

            imagePreviewArea.innerHTML = `
                <img src="${imgSrc}" style="max-width:150px;max-height:150px;border-radius:8px;border:2px solid var(--line);margin:8px 0;object-fit:contain;background:#0a162c" onerror="this.style.display='none'">
                <p style="color:var(--ok);font-size:13px;margin:4px 0">✅ تم حفظ الصورة بنجاح</p>
                <p style="color:var(--muted);font-size:11px">الحجم: ${originalSize}KB → ${compressedSize}KB</p>
                <p style="color:var(--muted);font-size:10px">التخزين: ${metadata.storageType || 'localStorage'}</p>
              `;
          }
        } catch (err) {
          console.error(`${logPrefix} Upload FAILED:`, err);
          showUploadError(err); // Use user-friendly error handler
          // Continue with form submission even if image upload fails
        }
      }

      // Upload video if selected
      if (selectedVideoFile) {
        const logPrefix = '[Save and Continue Video Upload]';
        const fileSizeMB = (selectedVideoFile.size / 1024 / 1024).toFixed(2);
        videoPreviewArea.innerHTML = `<p style="color:var(--muted)">⏳ جاري رفع الفيديو... (${fileSizeMB}MB)</p>`;
        try {
          const uploadResult = await backendUploadProductVideo(selectedVideoFile, status);
          if (uploadResult && uploadResult.success && uploadResult.videoUrl) {
            videoPath = uploadResult.videoUrl;
            videoUrlInput.value = videoPath;
            updateVideoPreviewMessage(videoPath, `✅ تم حفظ الفيديو • ${fileSizeMB}MB`);
          }
        } catch (err) {
          console.error(`${logPrefix} Upload FAILED:`, err);
          showUploadError(err);
        }
      } else if (videoPath) {
        updateVideoPreviewMessage(videoPath, 'معاينة الرابط');
      }

      item.title = title;
      item.sizes = sizes;
      item.colors = colors;
      item.fontSizes = fontSizes;
      item.note = note;
      item.img = imagePath || item.img || '';
      item.video = videoPath || item.video || '';
      item.gender = item.gender || 'f';
      item.date = new Date().toISOString().split('T')[0];

      // Handle status change and pricing
      const previousStatus = item.status;
      item.status = status;

      if (status === 'discount') {
        // Setting up discount: save original price first if changing from non-discount
        if (previousStatus !== 'discount' && isFinite(item.price) && item.price > 0) {
          item.was = item.price; // Preserve current price as original
        }
        // Get discount values from form
        const from = parseFloat(form.querySelector('#disc-from').value);
        const nw = parseFloat(form.querySelector('#disc-new').value);
        if (isFinite(from) && from > 0) item.was = from;
        if (isFinite(nw) && nw >= 0) item.price = nw;
        // Set discount timer
        const endsValue = endsInput?.value;
        item.ends = endsValue ? new Date(endsValue).toISOString() : null;

        // Automatically activate ticker when moving from today to discount
        if (previousStatus === 'today') {
          const now = Date.now();
          item.tickerEnabled = true;
          // Set tickerStart to now if not already set
          if (!item.tickerStart) {
            item.tickerStart = now;
          }
          // Set tickerDays to 7 if not set
          if (!item.tickerDays || item.tickerDays === 0) {
            item.tickerDays = 7;
          }
          // Calculate tickerExpiresAt if not set or expired
          const startMs = item.tickerStart ? Number(item.tickerStart) : now;
          const days = item.tickerDays || 7;
          const expMs = Number(item.tickerExpiresAt);
          if (!item.tickerExpiresAt || !Number.isFinite(expMs) || expMs <= startMs) {
            item.tickerExpiresAt = startMs + (days * 86400000);
          }
          // Clear skipTickerUntil if set
          if (item.skipTickerUntil) {
            item.skipTickerUntil = null;
          }
        }
      } else {
        // Changing from discount to today: reset discount pricing
        resetDiscountPricing(item);
        // Use the price from form input (which should be the restored price)
        if (isFinite(price) && price > 0) item.price = price;
      }

      // Use backend adapter to save article
      await backendSaveArticle(item, isNewProduct);
      render();

      // Reset form for new entry
      form.querySelector('#quick-title').value = '';
      form.querySelector('#quick-price').value = '';
      form.querySelector('#quick-note').value = '';
      form.querySelector('#image-url').value = '';
      imagePreviewArea.innerHTML = '';
      imageFileInput.value = '';
      selectedImageFile = null;
      form.querySelector('#video-url').value = '';
      videoPreviewArea.innerHTML = '';
      videoFileInput.value = '';
      selectedVideoFile = null;
      form.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      form.querySelector('#quick-title').focus();

      showToast('✅ Saved! Add another product.');
    });

    modal.appendChild(form);
    document.body.appendChild(modal);

    form.querySelector('#quick-title').focus();
  } catch (err) {
    console.error(`${logPrefix} ❌ Error creating product form:`, err);
    showToast(`❌ [${ERROR_CODE}] خطأ في إنشاء نموذج المنتج: ${err.message || 'Unknown error'}`);
  }
}

window.createQuickProductForm = createQuickProductForm;

// ERROR CODE: FORM-VID-001
function createQuickVideoForm(video, isNew = false) {
  const ERROR_CODE = 'FORM-VID-001';
  const logPrefix = `[createQuickVideoForm:${ERROR_CODE}]`;
  try {
    console.log(`${logPrefix} 🔄 START: Creating video form for ${isNew ? 'new video' : video?.id || 'unknown'}`);
  } catch (err) {
    console.error(`${logPrefix} ❌ Failed early:`, err);
    showToast(`❌ [${ERROR_CODE}] خطأ في إنشاء نموذج الفيديو: ${err.message || 'Unknown error'}`);
    return;
  }
  const modal = document.createElement('div');
  modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      `;
  modal.innerHTML = `
        <div style="
          background: var(--card);
          padding: 20px;
          border-radius: 10px;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        ">
          <h3>${isNew ? 'أضف فيديو جديد' : 'تعديل الفيديو'}</h3>
          <form id="videoForm" style="
            display: flex;
            flex-direction: column;
            gap: 15px;
          ">
            <label for="videoTitle" style="
              font-weight: 600;
              color: var(--text);
            ">عنوان الفيديو:</label>
            <input type="text" id="videoTitle" value="${escapeAttr(video.title || '')}" required style="
              padding: 10px;
              border: 1px solid var(--input-border);
              border-radius: 5px;
              background: var(--input-bg);
              color: var(--text);
            ">
            <label for="videoFile" style="
              font-weight: 600;
              color: var(--text);
            ">ملف الفيديو (أو أدخل الرابط أدناه):</label>
            <input type="file" id="videoFile" accept="video/*" style="
              padding: 10px;
              border: 1px solid var(--input-border);
              border-radius: 5px;
              background: var(--input-bg);
              color: var(--text);
            ">
            <label for="videoUrl" style="
              font-weight: 600;
              color: var(--text);
            ">رابط الفيديو (اختياري):</label>
            <input type="url" id="videoUrl" value="${escapeAttr(video.video || '')}" placeholder="https://example.com/video.mp4" style="
              padding: 10px;
              border: 1px solid var(--input-border);
              border-radius: 5px;
              background: var(--input-bg);
              color: var(--text);
            ">
            <div style="
              display: flex;
              gap: 10px;
              justify-content: flex-end;
            ">
              <button type="submit" style="
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                background: var(--ok);
                color: white;
                cursor: pointer;
              ">حفظ</button>
              <button type="button" class="cancel" style="
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                background: var(--danger);
                color: white;
                cursor: pointer;
              ">إلغاء</button>
            </div>
          </form>
        </div>
      `;
  document.body.appendChild(modal);
  modal.querySelector('.cancel')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  const videoFormEl = modal.querySelector('#videoForm');
  if (!videoFormEl) { console.error('createQuickVideoForm: form not found'); modal.remove(); return; }
  videoFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = modal.querySelector('#videoTitle').value.trim();
    const file = modal.querySelector('#videoFile').files[0];
    const url = modal.querySelector('#videoUrl').value.trim();
    if (!title) return showToast('يرجى إدخال العنوان');
    if (!file && !url) return showToast('يرجى اختيار ملف أو إدخال رابط');
    let videoPath = url || video.video || '';
    if (file) {
      const formData = new FormData();
      // Save as files under images/videos/ by default
      const ext = (file.name || '').split('.').pop() || (file.type && file.type.split('/').pop()) || 'mp4';
      const uniqueName = `${Date.now()}-${Math.floor(Math.random() * 1e9)}.${ext}`;
      const relPath = `images/videos/${uniqueName}`;
      formData.append('file', file);
      formData.append('path', relPath);
      try {
        const res = await fetch('/save-image', { method: 'POST', body: formData });
        if (res.ok) {
          // For '/save-image' we don't get path back; use relPath
          videoPath = relPath;
        } else {
          // Attempt to fallback to local DataURL storage when server upload fails
          try {
            const toDataUrl = (f) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(f); });
            const dataUrl = await toDataUrl(file);
            const key = 'video_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
            localStorage.setItem(key, dataUrl);
            videoPath = key;
            showToast('تم حفظ الفيديو محليًا (بدون رفع للسيرفر)');
          } catch (err2) {
            showToast('فشل في رفع الفيديو والمتابعة بدلًا من ذلك');
            return;
          }
        }
      } catch (err) {
        // Try to save locally to dataURL as fallback
        try {
          const toDataUrl = (f) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(f); });
          const dataUrl = await toDataUrl(file);
          const key = 'video_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
          localStorage.setItem(key, dataUrl);
          videoPath = key;
          showToast('تم حفظ الفيديو محليًا (بدون رفع للسيرفر)');
        } catch (err2) {
          showToast('خطأ في رفع الفيديو');
          return;
        }
      }
    }

    // Upload video if selected
    if (selectedVideoFile) {
      const logPrefix = '[Save and Continue Video Upload]';
      const fileSizeMB = (selectedVideoFile.size / 1024 / 1024).toFixed(2);
      videoPreviewArea.innerHTML = `<p style="color:var(--muted)">⏳ جاري رفع الفيديو... (${fileSizeMB}MB)</p>`;
      try {
        const uploadResult = await backendUploadProductVideo(selectedVideoFile, status);
        if (uploadResult && uploadResult.success && uploadResult.videoUrl) {
          videoPath = uploadResult.videoUrl;
          videoUrlInput.value = videoPath;
          updateVideoPreviewMessage(videoPath, `✅ تم حفظ الفيديو • ${fileSizeMB}MB`);
        }
      } catch (err) {
        console.error(`${logPrefix} Upload FAILED:`, err);
        showUploadError(err);
      }
    } else if (videoPath) {
      updateVideoPreviewMessage(videoPath, 'معاينة الرابط');
    }
    if (isNew) {
      VIDEOS.push({ title, video: videoPath });
    }
    await saveVideos();
    renderVideos();
    modal.remove();
    showToast('تم حفظ الفيديو!');
  });
}

window.createQuickVideoForm = createQuickVideoForm;

function createQuickActionsMenu(item, x, y, anchorEl) {
  document.querySelectorAll('.quick-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'quick-menu';
  menu.addEventListener('click', e => e.stopPropagation());
  menu.style.cssText = `
        position: fixed;
        background: var(--card);
        border: 1px solid #ffffff25;
        border-radius: 8px;
        padding: 8px;
        z-index: 4000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        max-width: 240px;
      `;
  // Compute coordinates near the anchor element when available
  let px = x, py = y;
  if ((!px || !py) && anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    px = Math.round(rect.left + 8);
    py = Math.round(rect.bottom + 8);
  }
  // Fallback to center if coordinates missing
  if (!px || !py) {
    px = Math.round(window.innerWidth / 2) - 100;
    py = Math.round(window.innerHeight / 2) - 60;
  }
  menu.style.top = py + 'px';
  menu.style.left = px + 'px';

  const actions = [
    { label: '✏️ Edit Details', action: async () => createProductEditor(item) },
    {
      label: '🆕 Mark as New', action: async () => {
        item.status = 'today';
        resetDiscountPricing(item);
        await saveCatalog();
        render();
      }
    },
    {
      label: '🏷️ -15%', action: async () => {
        applySale(item, 15);
        await saveCatalog();
        render();
      }
    },
    {
      label: '🏷️ -20%', action: async () => {
        applySale(item, 20);
        await saveCatalog();
        render();
      }
    },
    {
      label: '🗑️ Delete', action: async () => {
        if (confirm(DELETE_CONFIRM_MESSAGE)) {
          CATALOG = CATALOG.filter(p => p.id !== item.id);
          await saveCatalog();
          render();
        }
      }
    }
  ];

  actions.forEach(({ label, action }) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.style.cssText = `
          display: block;
          width: 100%;
          padding: 8px 12px;
          margin: 4px 0;
          border: none;
          background: #ffffff12;
          color: var(--text);
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
        `;
    button.onmouseover = () => button.style.background = '#ffffff20';
    button.onmouseout = () => button.style.background = '#ffffff12';
    button.onclick = () => {
      action();
      document.body.removeChild(menu);
    };
    menu.appendChild(button);
  });

  document.body.appendChild(menu);
  // Ensure menu stays within viewport bounds
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth) {
    menu.style.left = (window.innerWidth - r.width - 12) + 'px';
  }
  if (r.bottom > window.innerHeight) {
    menu.style.top = (window.innerHeight - r.height - 12) + 'px';
  }

  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 100);
}

function createProductEditor(item) {
  const modal = document.createElement('div');
  modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

  const form = document.createElement('form');
  form.style.cssText = `
        background: var(--card);
        padding: 20px;
        border-radius: 18px;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        overflow-y: auto;
      `;

  const sizeGroups = [
    { label: 'الكبار', sizes: ["5XL", "4XL", "3XL", "2XL", "XXL", "XL", "L", "M", "S", "XS", "XXS"] },
    { label: 'الأطفال', sizes: ["16", "14", "12", "10", "8", "6", "4", "2"] },
    { label: 'البيبي', sizes: ["24M", "18-24M", "12-18M", "9-12M", "6-9M", "3-6M", "0-3M"] }
  ];
  const colors = ["أبيض", "أسود", "بيج", "زيتي", "أزرق", "وردي", "أحمر"];

  form.innerHTML = `
        <h3 style="margin-top:0">تعديل المنتج • Edit Product</h3>
        
        <div style="margin:15px 0">
          <label>العنوان • Title</label>
          <input type="text" value="${escapeAttr(item.title || '')}" id="prod-title" style="width:100%;padding:8px;border-radius:8px;background:#ffffff12;border:1px solid #ffffff25;color:var(--text)">
        </div>
        
        <div style="margin:15px 0">
          <label>السعر • Price</label>
          <input type="number" value="${item.price || ''}" id="prod-price" step="any" min="0" style="width:100%;padding:8px;border-radius:8px;background:#ffffff12;border:1px solid #ffffff25;color:var(--text)">
        </div>
        
        <div style="margin:15px 0">
          <label>الجنس • Gender</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            <label style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#ffffff08;border:1px solid #ffffff15;border-radius:999px;cursor:pointer">
              <input type="radio" name="prod-gender" value="m" ${item.gender === 'm' ? 'checked' : ''}>
              <span>👨 للرجال</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#ffffff08;border:1px solid #ffffff15;border-radius:999px;cursor:pointer">
              <input type="radio" name="prod-gender" value="f" ${item.gender === 'f' ? 'checked' : ''}>
              <span>👗 للنساء</span>
            </label>
          </div>
        </div>
        
        <div style="margin:15px 0">
          <label>الحالة • Status</label>
          <select id="prod-status" style="width:100%;padding:8px;border-radius:8px;background:#ffffff12;border:1px solid #ffffff25;color:var(--text)">
            ${["today", "discount"].map(s =>
    `<option value="${s}" ${item.status === s ? "selected" : ""}>${label(s) || s}</option>`
  ).join('')}
          </select>
        </div>
        
        <div id="sale-fields" style="margin:15px 0;display:${item.status === "discount" ? "block" : "none"}">
          <label>السعر القديم • Original Price</label>
          <input type="number" value="${item.was || ''}" id="prod-was" step="any" min="0" style="width:100%;padding:8px;border-radius:8px;background:#ffffff12;border:1px solid #ffffff25;color:var(--text)">
        </div>
        
        <div style="margin:15px 0">
          <label>المقاسات • Sizes</label>
          ${sizeGroups.map(group => `
            <div style="margin-bottom:10px;border:1px solid #ffffff20;border-radius:10px;padding:8px">
              <div style="font-weight:700;margin-bottom:6px;border-bottom:1px solid #ffffff20;padding-bottom:4px">${group.label}</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">
                ${group.sizes.map(s => `
                  <label style="display:flex;align-items:center;gap:4px">
                    <input type="checkbox" value="${s}" ${item.sizes?.includes(s) ? 'checked' : ''} name="size">
                    ${s}
                  </label>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        
        <div style="margin:15px 0">
          <label>الألوان • Colors</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
            ${colors.map(c => `
              <label style="display:flex;align-items:center;gap:4px">
                <input type="checkbox" value="${c}" ${item.colors?.includes(c) ? 'checked' : ''} name="color">
                ${c}
              </label>
            `).join('')}
          </div>
        </div>
        
        <div style="margin:15px 0">
          <label>ملاحظات • Notes</label>
          <textarea id="prod-note" style="width:100%;padding:8px;border-radius:8px;background:#ffffff12;border:1px solid #ffffff25;color:var(--text);min-height:60px">${item.note || ''}</textarea>
        </div>
        
        <div style="display:flex;gap:10px;margin-top:20px">
          <button type="submit" style="flex:1;padding:10px;border-radius:8px;background:var(--ok);color:#052e17;border:none;font-weight:bold">حفظ • Save</button>
          <button type="button" class="cancel" style="padding:10px;border-radius:8px;background:var(--danger);color:white;border:none">إلغاء • Cancel</button>
        </div>
      `;

  const statusSelect = form.querySelector('#prod-status');
  const saleFields = form.querySelector('#sale-fields');

  const cleanup = () => {
    document.body.removeChild(modal);
    statusSelect.removeEventListener('change', handleStatusChange);
    form.removeEventListener('submit', handleSubmit);
  };

  const handleStatusChange = () => {
    saleFields.style.display = statusSelect.value === 'discount' ? 'block' : 'none';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      item.title = form.querySelector('#prod-title').value;
      item.price = Number(form.querySelector('#prod-price').value);
      item.status = form.querySelector('#prod-status').value;
      item.was = form.querySelector('#prod-was').value ? Number(form.querySelector('#prod-was').value) : 0;
      item.sizes = [...form.querySelectorAll('input[name="size"]:checked')].map(cb => cb.value);
      item.colors = [...form.querySelectorAll('input[name="color"]:checked')].map(cb => cb.value);
      item.note = form.querySelector('#prod-note').value;
      {
        const g = form.querySelector('input[name="prod-gender"]:checked')?.value;
        if (g === 'm' || g === 'f') item.gender = g;
      }
      item.date = new Date().toISOString().split('T')[0];

      await saveCatalog();
      render();
      showToast('✅ Product updated successfully!');
    } catch (err) {
      console.error('Error saving product:', err);
      showToast('❌ Failed to save product. Check console.');
    } finally {
      cleanup();
    }
  };

  statusSelect.addEventListener('change', handleStatusChange);
  form.addEventListener('submit', handleSubmit);

  form.querySelector('.cancel').addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  modal.appendChild(form);
  document.body.appendChild(modal);
}

// RTL Quick Settings side panel
function openQuickSettingsPanel(item) {
  // Close existing panels
  document.querySelectorAll('.quick-panel, .quick-backdrop').forEach(el => el.remove());

  // Create a deep backup of the original item state BEFORE any modifications
  // This preserves the exact state for restore on close
  const itemBackup = JSON.parse(JSON.stringify(item));
  let dirty = false;
  const originalStatus = itemBackup.status || 'today';

  const restoreItemState = () => {
    const restored = JSON.parse(JSON.stringify(itemBackup));
    Object.keys(restored).forEach(key => { item[key] = restored[key]; });
    Object.keys(item).forEach(key => { if (!(key in restored)) delete item[key]; });
    render();
  };

  // Ensure status is initialized for UI display - default to 'today' if undefined
  // This doesn't change the backup, just sets a safe default for the UI
  if (!item.status) {
    item.status = 'today';
  }

  // Define sizes and colors arrays
  const sizeGroups = [
    { label: 'الكبار', sizes: ["5XL", "4XL", "3XL", "2XL", "XXL", "XL", "L", "M", "S", "XS", "XXS"] },
    { label: 'الأطفال', sizes: ["16", "14", "12", "10", "8", "6", "4", "2"] },
    { label: 'البيبي', sizes: ["24M", "18-24M", "12-18M", "9-12M", "6-9M", "3-6M", "0-3M"] }
  ];
  const sizes = sizeGroups.flatMap(g => g.sizes);
  const colors = ["أبيض", "أسود", "بيج", "زيتي", "أزرق", "وردي", "أحمر", "بنفسجي", "أخضر"];

  const backdrop = document.createElement('div');
  backdrop.className = 'quick-backdrop';
  backdrop.setAttribute('role', 'presentation');
  backdrop.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:5000;`;

  const panel = document.createElement('div');
  panel.className = 'quick-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'إعدادات سريعة');
  panel.dir = 'rtl';
  panel.style.cssText = `position:fixed;top:0;right:0;height:100%;width:min(420px,95vw);background:var(--card);border-left:1px solid #ffffff20;z-index:5001;box-shadow:-8px 0 20px rgba(0,0,0,0.3);display:flex;flex-direction:column;`;

  const header = document.createElement('div');
  header.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line);`;
  header.innerHTML = `<strong>⚡ إعدادات سريعة</strong>`;

  const body = document.createElement('div');
  body.style.cssText = `flex:1;overflow:auto;padding:14px 16px;gap:12px;display:flex;flex-direction:column;`;

  let ensurePanelTimer = () => { };
  let clearPanelTimer = () => { };
  let syncTimerInput = () => { };

  // Section: الاسم
  const nameDiv = document.createElement('div');
  nameDiv.innerHTML = `<div style="font-weight:bold;margin-bottom:6px;font-size:1rem;color:var(--text)">الاسم</div>`;
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = item.title || '';
  nameInput.placeholder = 'اكتب اسم المنتج...';
  nameInput.dir = 'rtl';
  nameInput.style.cssText = `width:100%;padding:12px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text);font-weight:normal;cursor:text;font-size:1rem;transition:all 0.2s ease`;
  nameInput.addEventListener('mouseenter', () => {
    nameInput.style.transform = 'translateY(-2px)';
    nameInput.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
  });
  nameInput.addEventListener('mouseleave', () => {
    nameInput.style.transform = 'translateY(0)';
    nameInput.style.boxShadow = 'none';
  });
  nameInput.addEventListener('input', () => {
    item.title = nameInput.value.trim();
    dirty = true;
  });
  nameDiv.appendChild(nameInput);
  body.appendChild(nameDiv);

  // Section: الحالة
  const statuses = [
    { value: 'today', label: 'جديد اليوم' },
    { value: 'discount', label: 'عرض خاص' }
  ];
  const st = document.createElement('div');
  st.innerHTML = `<div style="font-weight:bold;margin-bottom:6px;font-size:1rem;color:var(--text)">الحالة</div>`;
  const stRow = document.createElement('div');
  stRow.style.cssText = `display:flex;gap:8px;flex-wrap:wrap`;
  const statusButtons = [];
  statuses.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s.label;
    b.style.cssText = `padding:8px 12px;border-radius:999px;border:1px solid var(--chip-border);background:var(--chip-bg);color:var(--text);font-weight:normal;font-size:1rem;cursor:pointer;transition:all 0.2s ease`;
    b.addEventListener('click', async () => {
      if (item.status === s.value) {
        updateSaleVisibility();
        updateStatusButtons();
        applyAccent();
        return;
      }
      const previousStatus = item.status;
      item.status = s.value;
      dirty = true;

      // Auto-fill discount fields when switching to discount status
      if (s.value === 'discount' && previousStatus !== 'discount') {
        ensurePanelTimer('⏱️ التخفيض يحتاج إلى مؤقت. تم ضبط 24 ساعة افتراضيًا، عدّل التوقيت إذا لزم');
        // Set original price to current price if not already set
        if (!item.was || item.was === 0) {
          item.was = item.price;
        }
        // Automatically activate ticker when moving from today to discount
        if (previousStatus === 'today') {
          const now = Date.now();
          item.tickerEnabled = true;
          // Set tickerStart to now if not already set
          if (!item.tickerStart) {
            item.tickerStart = now;
          }
          // Set tickerDays to 7 if not set
          if (!item.tickerDays || item.tickerDays === 0) {
            item.tickerDays = 7;
          }
          // Calculate tickerExpiresAt if not set or expired
          const startMs = item.tickerStart ? Number(item.tickerStart) : now;
          const days = item.tickerDays || 7;
          const expMs = Number(item.tickerExpiresAt);
          if (!item.tickerExpiresAt || !Number.isFinite(expMs) || expMs <= startMs) {
            item.tickerExpiresAt = startMs + (days * 86400000);
          }
          // Clear skipTickerUntil if set
          if (item.skipTickerUntil) {
            item.skipTickerUntil = null;
          }
          dirty = true;
        }
        // Update the discount fields after panel is fully rendered
        setTimeout(() => {
          const fromEl = panel.querySelector('#qs-from');
          const newEl = panel.querySelector('#qs-new');
          if (fromEl) fromEl.value = item.was || item.price || '';
          if (newEl) newEl.value = item.price || '';
          // Update ticker toggle if it exists
          const tickerToggle = panel.querySelector('#qs-ticker-toggle');
          if (tickerToggle) {
            tickerToggle.checked = item.tickerEnabled !== false;
          }
        }, 50);
      }

      if (previousStatus === 'discount' && s.value !== 'discount') {
        const originalPrice = item.was && item.was > 0 ? item.was : item.price;
        if (isFinite(originalPrice)) {
          item.price = round2(originalPrice);
          priceEl && (priceEl.value = item.price);
          newEl && (newEl.value = item.price);
        }
        item.was = 0;
        fromEl && (fromEl.value = '');
        pctOut && (pctOut.textContent = '-0%');
        clearPanelTimer('🕒 تم إزالة مؤقت التخفيض بعد نقل المنتج إلى قسم جديد اليوم');
      }

      updateSaleVisibility();
      updateStatusButtons();
      applyAccent();
    });
    statusButtons.push({ value: s.value, el: b });
    stRow.appendChild(b);
  });
  st.appendChild(stRow);
  body.appendChild(st);

  // Section: شريط الأخبار
  const tickerBox = document.createElement('div');
  tickerBox.style.cssText = `margin-top:10px;display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--input-border);border-radius:12px;background:var(--input-bg);`;

  // Title row with switch: "شريط الأخبار : [switch]"
  const tickerTitleRow = document.createElement('div');
  tickerTitleRow.style.cssText = `display:flex;align-items:center;gap:10px;`;
  const tickerTitle = document.createElement('div');
  tickerTitle.style.cssText = `font-weight:bold;font-size:1rem;color:var(--text);`;
  tickerTitle.textContent = 'شريط الأخبار :';
  tickerTitleRow.appendChild(tickerTitle);

  // Check if article was posted more than 7 days ago
  const articleDate = item.date ? new Date(item.date).getTime() : null;
  const sevenDaysAgo = Date.now() - (7 * 86400000);
  const isOlderThan7Days = articleDate && articleDate < sevenDaysAgo;

  // Check if ticker has expired FIRST
  const expMs = Number(item.tickerExpiresAt);
  const isExpired = Number.isFinite(expMs) && expMs <= Date.now();

  // If article is older than 7 days OR expired, automatically disable it immediately
  if (isOlderThan7Days || isExpired) {
    item.tickerEnabled = false;
    if (isExpired) {
      item.tickerExpiresAt = Date.now();
    }
    dirty = true;
  }

  // Use shouldShowInTicker to determine actual ticker state (after handling expiration)
  // This checks all conditions: tickerEnabled, expiration, skipTickerUntil
  const isCurrentlyShowing = shouldShowInTicker(item);

  // If item is showing in ticker but tickerEnabled is not explicitly set, set it to true for consistency
  // BUT only if it's NOT expired AND NOT older than 7 days
  if (!isExpired && !isOlderThan7Days && isCurrentlyShowing && item.tickerEnabled !== true && item.tickerEnabled !== false) {
    item.tickerEnabled = true;
    // If tickerDays is not set, default to 7 days
    if (!item.tickerDays || item.tickerDays === 0) {
      item.tickerDays = 7;
    }
    // If tickerExpiresAt is not set or invalid, calculate expiration
    // Use tickerStart if available, otherwise use item.date, otherwise use now
    const startMs = item.tickerStart ? Number(item.tickerStart) : (item.date ? new Date(item.date).getTime() : Date.now());
    if (!item.tickerExpiresAt || !Number.isFinite(Number(item.tickerExpiresAt)) || Number(item.tickerExpiresAt) <= startMs) {
      const days = item.tickerDays || 7;
      item.tickerExpiresAt = startMs + (days * 86400000);
      if (!item.tickerStart) {
        item.tickerStart = startMs;
      }
    }
    dirty = true;
  }

  const tickerToggle = document.createElement('input');
  tickerToggle.type = 'checkbox';
  tickerToggle.id = 'qs-ticker-toggle';
  // Switch is OFF if expired OR older than 7 days, otherwise based on actual ticker state
  tickerToggle.checked = !isExpired && !isOlderThan7Days && isCurrentlyShowing;
  tickerToggle.style.cssText = 'position:absolute;opacity:0;width:0;height:0;';
  const toggleWrap = document.createElement('label');
  toggleWrap.htmlFor = 'qs-ticker-toggle';
  toggleWrap.style.cssText = `display:inline-flex;align-items:center;cursor:pointer;`;
  const slider = document.createElement('span');
  slider.style.cssText = `position:relative;display:inline-flex;align-items:center;width:46px;height:24px;border-radius:999px;background:rgba(148,163,184,0.4);transition:all 0.2s ease;box-shadow:inset 0 1px 2px rgba(0,0,0,0.25);`;
  const knob = document.createElement('span');
  knob.style.cssText = `position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform 0.2s ease;box-shadow:0 2px 6px rgba(0,0,0,0.25);`;
  slider.appendChild(knob);
  toggleWrap.appendChild(tickerToggle);
  toggleWrap.appendChild(slider);
  tickerTitleRow.appendChild(toggleWrap);
  tickerBox.appendChild(tickerTitleRow);

  const daysRow = document.createElement('div');
  daysRow.style.cssText = `display:none;align-items:center;gap:8px;`;
  const daysLabel = document.createElement('label');
  daysLabel.htmlFor = 'qs-ticker-days';
  daysLabel.textContent = 'عدد الأيام';
  daysLabel.style.cssText = `font-weight:700;`;
  const daysInput = document.createElement('input');
  daysInput.type = 'number';
  daysInput.min = '1';
  daysInput.max = '60';
  daysInput.id = 'qs-ticker-days';
  daysInput.value = Number(item.tickerDays) || 7;
  daysInput.style.cssText = `width:120px;padding:10px;border-radius:10px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text);font-weight:700;`;
  daysRow.appendChild(daysLabel);
  daysRow.appendChild(daysInput);
  tickerBox.appendChild(daysRow);

  const updateToggleVisual = (enabled) => {
    slider.style.background = enabled ? 'linear-gradient(135deg, rgba(34,197,94,0.9), rgba(56,189,248,0.8))' : 'rgba(148,163,184,0.4)';
    knob.style.transform = enabled ? 'translateX(22px)' : 'translateX(0)';
  };

  const applyTicker = () => {
    const enabled = tickerToggle.checked;
    let days = Number(daysInput.value);
    if (!Number.isFinite(days) || days <= 0) days = 7;
    days = Math.min(Math.max(days, 1), 60);
    daysInput.value = days;
    item.tickerEnabled = enabled;
    item.tickerDays = days;
    const now = Date.now();
    item.tickerStart = now;
    item.tickerExpiresAt = enabled ? now + days * 86400000 : now;
    daysInput.disabled = !enabled;
    daysRow.style.display = enabled ? 'flex' : 'none';
    updateToggleVisual(enabled);
    dirty = true;
  };

  tickerToggle.addEventListener('change', applyTicker);
  slider.addEventListener('click', (e) => {
    e.preventDefault();
    tickerToggle.checked = !tickerToggle.checked;
    applyTicker();
  });
  daysInput.addEventListener('change', applyTicker);

  // Set initial state based on toggle (already checked for expiration above)
  daysRow.style.display = tickerToggle.checked ? 'flex' : 'none';
  daysInput.disabled = !tickerToggle.checked;
  updateToggleVisual(tickerToggle.checked);
  body.appendChild(tickerBox);

  // Section: السعر (visible only for non-discount statuses)
  const priceSimple = document.createElement('div');
  priceSimple.id = 'qs-price-simple';
  priceSimple.style.cssText = `display:${item.status === 'discount' ? 'none' : 'block'}`;
  priceSimple.innerHTML = `
        <div style="font-weight:bold;margin-top:8px;margin-bottom:6px;font-size:1rem;color:var(--text)">السعر</div>
        <div>
          <label style="font-weight:normal;font-size:1rem;color:var(--text)">السعر الحالي</label>
          <input id="qs-price" type="number" step="any" min="0" placeholder="0.00" style="width:100%;padding:12px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text);font-weight:normal;cursor:text;font-size:1rem" value="${item.price || 0}">
        </div>`;
  body.appendChild(priceSimple);

  // Section: تخفيض (visible only if sale) - Advanced Design
  const saleBox = document.createElement('div');
  saleBox.id = 'qs-sale';
  saleBox.style.cssText = `display:${item.status === 'discount' ? 'block' : 'none'};margin-top:16px`;
  saleBox.innerHTML = `
        <div style="background:var(--card, #ffffff);border:1px solid var(--line, rgba(2,6,23,0.12));border-radius:16px;padding:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <div style="font-weight:bold;font-size:1rem;color:var(--text, #1e293b);">تخفيض</div>
          </div>
          
          <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:16px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end">
              <div style="min-width:140px;max-width:180px">
                <label style="font-weight:normal;display:block;margin-bottom:8px;font-size:1rem;color:var(--text);">السعر الأصلي</label>
                <input id="qs-from" type="text" inputmode="decimal" placeholder="0.00" style="width:100%;padding:12px 16px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text);font-weight:normal;cursor:text;font-size:1rem;transition:all 0.2s ease;appearance:none;-moz-appearance:textfield" value="${item.was ? String(item.was).replace(',', '.') : ''}" onfocus="this.style.borderColor='#ef4444';this.style.boxShadow='0 0 0 3px rgba(239,68,68,0.1)';this.style.background='var(--card)'" onblur="this.style.borderColor='var(--input-border)';this.style.boxShadow='none';this.style.background='var(--input-bg)';this.value=this.value.replace(',','.')" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1)'" onmouseleave="if(document.activeElement !== this) {this.style.transform='translateY(0)';this.style.boxShadow='none'}" oninput="this.value=this.value.replace(/[^0-9.,]/g,'').replace(/,/g,'.')">
          </div>
              
              <div style="min-width:140px;max-width:180px">
                <label style="font-weight:normal;display:block;margin-bottom:8px;font-size:1rem;color:var(--text);">السعر التخفيض</label>
                <input id="qs-new" type="text" inputmode="decimal" placeholder="0.00" style="width:100%;padding:12px 16px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text);font-weight:normal;cursor:text;font-size:1rem;transition:all 0.2s ease;appearance:none;-moz-appearance:textfield" value="${item.price ? String(item.price).replace(',', '.') : ''}" onfocus="this.style.borderColor='#22c55e';this.style.boxShadow='0 0 0 3px rgba(34,197,94,0.1)';this.style.background='var(--card)'" onblur="this.style.borderColor='var(--input-border)';this.style.boxShadow='none';this.style.background='var(--input-bg)';this.value=this.value.replace(',','.')" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1)'" onmouseleave="if(document.activeElement !== this) {this.style.transform='translateY(0)';this.style.boxShadow='none'}" oninput="this.value=this.value.replace(/[^0-9.,]/g,'').replace(/,/g,'.')">
          </div>
        </div>
            
            <div style="display:flex;justify-content:center;align-items:center">
              <div style="display:inline-flex;flex-direction:column;align-items:center">
                <label style="font-weight:normal;display:block;margin-bottom:4px;font-size:1rem;color:var(--text);text-align:center">الخصم</label>
                <output id="qs-pct" style="display:inline-block;padding:7px 13px;border-radius:8px;background:linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.12) 100%);border:2px solid rgba(239,68,68,0.3);font-weight:normal;text-align:center;font-size:0.88rem;color:#ef4444;min-height:18px;line-height:1.2;box-shadow:0 1px 3px rgba(239,68,68,0.15);white-space:nowrap;min-width:fit-content">-0%</output>
              </div>
            </div>
          </div>
          
          <div style="border-top:1px solid rgba(239,68,68,0.2);padding-top:14px">
            <div style="font-weight:normal;font-size:1rem;color:var(--text);margin-bottom:10px;text-align:center">اختر نسبة سريعة:</div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
              ${[10, 15, 20, 25, 30].map(p => `<button type="button" class="qs-chip" data-pct="${p}" style="padding:10px 18px;border-radius:10px;border:2px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:#ef4444;font-weight:normal;cursor:pointer;font-size:1rem;transition:all 0.2s ease;min-width:60px" onmouseover="this.style.background='rgba(239,68,68,0.2)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(239,68,68,0.2)'" onmouseout="this.style.background='rgba(239,68,68,0.08)';this.style.transform='translateY(0)';this.style.boxShadow='none'">-${p}%</button>`).join('')}
            </div>
          </div>
        </div>`;
  body.appendChild(saleBox);

  // Timer controls for discount
  const timerBox = document.createElement('div');
  timerBox.id = 'qs-timer';
  timerBox.style.cssText = `display:${item.status === 'discount' ? 'block' : 'none'};margin-top:12px;padding:12px;border-radius:14px;background:rgba(239,68,68,0.08);border:2px solid rgba(239,68,68,0.25)`;
  const localEnds = item.ends ? isoToLocalInputValue(item.ends) : '';
  timerBox.innerHTML = `
        <div style="font-weight:bold;color:var(--text);margin-bottom:8px;display:flex;align-items:center;gap:8px;font-size:1rem">
          ⏱️ مدة التخفيض
          ${item.ends ? `<span style="font-size:1rem;color:var(--muted, #64748b)">(${item.ends.split('T')[0]})</span>` : ''}
        </div>
        <input type="datetime-local" id="qs-ends" value="${localEnds}" style="width:100%;padding:12px;border-radius:12px;background:var(--input-bg);border:2px solid rgba(239,68,68,0.5);color:var(--text);font-weight:normal;font-size:1rem;transition:all 0.2s ease" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1)'" onmouseleave="if(document.activeElement !== this) {this.style.transform='translateY(0)';this.style.boxShadow='none'}"
        <div class="qs-timer-actions" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px">
          ${[6, 12, 24, 48, 72].map(h => `<button type="button" class="qs-timer-btn" data-add-hours="${h}" style="padding:8px 12px;border-radius:999px;border:2px solid rgba(239,68,68,0.4);background:transparent;color:#ef4444;font-weight:normal;font-size:1rem;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(239,68,68,0.2)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">+${h >= 24 ? `${Math.round(h / 24)}ي` : `${h}س`}</button>`).join('')}
          <button type="button" class="qs-timer-clear" style="padding:8px 12px;border-radius:999px;border:2px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.1);color:#ef4444;font-weight:normal;font-size:1rem;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(239,68,68,0.2)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">مسح العداد</button>
        </div>
        <small style="display:block;margin-top:6px;color:var(--muted, #64748b);font-size:1rem">اضغط على زر لتقريب موعد الانتهاء أو أدخل التاريخ يدويًا.</small>
      `;
  body.appendChild(timerBox);

  const qsEndsInput = timerBox.querySelector('#qs-ends');
  const qsTimerButtons = timerBox.querySelectorAll('.qs-timer-btn');
  const qsTimerClear = timerBox.querySelector('.qs-timer-clear');

  const notifyToast = (msg) => {
    if (msg && typeof showToast === 'function') {
      showToast(msg);
    }
  };

  syncTimerInput = () => {
    if (!qsEndsInput) return;
    qsEndsInput.value = item.ends ? isoToLocalInputValue(item.ends) : '';
  };

  ensurePanelTimer = (message = null) => {
    const hadTimer = !!item.ends;
    const iso = ensureDiscountTimerValue(item);
    if (!hadTimer && iso) {
      syncTimerInput();
      notifyToast(message);
    }
    return iso;
  };

  clearPanelTimer = (message = null) => {
    const hadTimer = !!item.ends;
    clearDiscountTimerValue(item);
    syncTimerInput();
    if (hadTimer) {
      notifyToast(message);
    }
  };

  const applyEndsValue = (isoString) => {
    if (isoString) {
      item.ends = new Date(isoString).toISOString();
    } else {
      clearDiscountTimerValue(item);
    }
    syncTimerInput();
  };

  if (item.status === 'discount' && !item.ends) {
    ensurePanelTimer();
  } else {
    syncTimerInput();
  }

  qsEndsInput?.addEventListener('change', () => {
    const val = qsEndsInput.value;
    if (val) {
      item.ends = localInputValueToIso(val);
      syncTimerInput();
      dirty = true;
      return;
    }
    if (item.status === 'discount') {
      ensurePanelTimer('⚠️ التخفيض يحتاج إلى مؤقت. تم ضبط 24 ساعة تلقائيًا، عدّلها إذا رغبت');
    } else {
      clearPanelTimer('🧹 تم مسح العداد');
    }
    dirty = true;
  });

  qsTimerButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const hours = parseInt(btn.dataset.addHours || '0', 10);
      const base = item.ends ? new Date(item.ends) : new Date();
      const newDate = new Date(base.getTime() + hours * 60 * 60 * 1000);
      applyEndsValue(newDate.toISOString());
      showToast(`⏱️ تم تمديد التخفيض ${hours >= 24 ? `${Math.round(hours / 24)} يوم` : `${hours} ساعة`}`);
    });
  });

  qsTimerClear?.addEventListener('click', () => {
    if (item.status === 'discount') {
      clearPanelTimer();
      ensurePanelTimer('⚠️ التخفيض يحتاج إلى مؤقت. تم إعادة ضبطه لمدة 24 ساعة');
    } else {
      clearPanelTimer('🧹 تم مسح العداد');
    }
  });

  // Collapsible Sizes Section
  const sizesSection = document.createElement('div');
  sizesSection.style.cssText = `margin-top:12px`;
  const sizesHeader = document.createElement('button');
  sizesHeader.type = 'button';
  sizesHeader.style.cssText = `width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;border:2px solid var(--chip-border);background:var(--chip-bg);color:var(--text);font-weight:bold;cursor:pointer;font-size:1rem;transition:all 0.2s ease`;
  sizesHeader.innerHTML = `<span>📏 المقاسات</span><span class="sizes-toggle">▼</span>`;
  sizesHeader.addEventListener('mouseenter', () => {
    sizesHeader.style.transform = 'translateY(-2px)';
    sizesHeader.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
  });
  sizesHeader.addEventListener('mouseleave', () => {
    sizesHeader.style.transform = 'translateY(0)';
    sizesHeader.style.boxShadow = 'none';
  });

  const sizesContent = document.createElement('div');
  sizesContent.style.cssText = `display:none;margin-top:10px;padding:10px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border)`;
  const sizesChips = document.createElement('div');
  sizesChips.style.cssText = `display:flex;gap:8px;flex-wrap:wrap`;

  // Initialize sizes array if not exists
  if (!item.sizes) item.sizes = [];

  sizeGroups.forEach((group, idx) => {
    if (idx > 0) {
      const divider = document.createElement('div');
      divider.style.cssText = `width:100%;border-top:1px solid var(--line);margin:8px 0;`;
      sizesChips.appendChild(divider);
    }
    const groupLabel = document.createElement('div');
    groupLabel.textContent = group.label;
    groupLabel.style.cssText = `width:100%;font-weight:bold;font-size:1rem;color:var(--text);margin-bottom:4px;`;
    sizesChips.appendChild(groupLabel);

    const groupRow = document.createElement('div');
    groupRow.style.cssText = `display:flex;gap:8px;flex-wrap:wrap`;

    group.sizes.forEach(s => {
      const chip = document.createElement('label');
      chip.style.cssText = `display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--chip-bg);border:2px solid var(--chip-border);border-radius:999px;cursor:pointer;font-size:1rem;font-weight:normal;color:var(--text);transition:all 0.2s ease`;
      chip.addEventListener('mouseenter', () => {
        chip.style.transform = 'translateY(-2px)';
        chip.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
      });
      chip.addEventListener('mouseleave', () => {
        chip.style.transform = 'translateY(0)';
        chip.style.boxShadow = 'none';
      });
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = s;
      checkbox.checked = item.sizes?.includes(s) || false;
      checkbox.addEventListener('change', () => {
        if (!item.sizes) item.sizes = [];
        if (checkbox.checked) {
          if (!item.sizes.includes(s)) item.sizes.push(s);
        } else {
          item.sizes = item.sizes.filter(sz => sz !== s);
        }
      });
      chip.appendChild(checkbox);
      const span = document.createElement('span');
      span.textContent = s;
      chip.appendChild(span);
      groupRow.appendChild(chip);
    });

    sizesChips.appendChild(groupRow);
  });

  // Add Font Size group (28-56, +2 increments) to sizes section
  const fontSizeDivider = document.createElement('div');
  fontSizeDivider.style.cssText = `width:100%;border-top:1px solid var(--line);margin:8px 0;`;
  sizesChips.appendChild(fontSizeDivider);

  const fontSizeGroupLabel = document.createElement('div');
  fontSizeGroupLabel.textContent = '📐 الحجم';
  fontSizeGroupLabel.style.cssText = `width:100%;font-weight:bold;font-size:1rem;color:var(--text);margin-bottom:4px;`;
  sizesChips.appendChild(fontSizeGroupLabel);

  const fontSizeGroupRow = document.createElement('div');
  fontSizeGroupRow.style.cssText = `display:flex;gap:8px;flex-wrap:wrap`;

  // Generate size values from 28 to 56 with +2 increments
  const fontSizeValues = [];
  for (let i = 28; i <= 56; i += 2) {
    fontSizeValues.push(String(i));
  }

  // Initialize item.fontSizes array if not exists
  if (!item.fontSizes) item.fontSizes = [];

  fontSizeValues.forEach(size => {
    const chip = document.createElement('label');
    chip.style.cssText = `display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--chip-bg);border:2px solid var(--chip-border);border-radius:999px;cursor:pointer;font-size:1rem;font-weight:normal;color:var(--text);transition:all 0.2s ease`;
    chip.addEventListener('mouseenter', () => {
      chip.style.transform = 'translateY(-2px)';
      chip.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    });
    chip.addEventListener('mouseleave', () => {
      chip.style.transform = 'translateY(0)';
      chip.style.boxShadow = 'none';
    });
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = size;
    checkbox.checked = item.fontSizes?.includes(size) || false;
    checkbox.addEventListener('change', () => {
      if (!item.fontSizes) item.fontSizes = [];
      if (checkbox.checked) {
        if (!item.fontSizes.includes(size)) item.fontSizes.push(size);
      } else {
        item.fontSizes = item.fontSizes.filter(sz => sz !== size);
      }
      dirty = true;
    });
    chip.appendChild(checkbox);
    const span = document.createElement('span');
    span.textContent = size;
    chip.appendChild(span);
    fontSizeGroupRow.appendChild(chip);
  });

  sizesChips.appendChild(fontSizeGroupRow);

  sizesContent.appendChild(sizesChips);
  sizesSection.appendChild(sizesHeader);
  sizesSection.appendChild(sizesContent);
  body.appendChild(sizesSection);

  // Always start collapsed - user must click to see values
  let sizesExpanded = false;

  sizesHeader.addEventListener('click', () => {
    sizesExpanded = !sizesExpanded;
    sizesContent.style.display = sizesExpanded ? 'block' : 'none';
    sizesHeader.querySelector('.sizes-toggle').textContent = sizesExpanded ? '▲' : '▼';
  });

  // Collapsible Colors Section
  const colorsSection = document.createElement('div');
  colorsSection.style.cssText = `margin-top:12px`;
  const colorsHeader = document.createElement('button');
  colorsHeader.type = 'button';
  colorsHeader.style.cssText = `width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;border:2px solid var(--chip-border);background:var(--chip-bg);color:var(--text);font-weight:bold;cursor:pointer;font-size:1rem;transition:all 0.2s ease`;
  colorsHeader.addEventListener('mouseenter', () => {
    colorsHeader.style.transform = 'translateY(-2px)';
    colorsHeader.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
  });
  colorsHeader.addEventListener('mouseleave', () => {
    colorsHeader.style.transform = 'translateY(0)';
    colorsHeader.style.boxShadow = 'none';
  });
  colorsHeader.innerHTML = `<span>🎨 الألوان</span><span class="colors-toggle">▼</span>`;

  const colorsContent = document.createElement('div');
  colorsContent.style.cssText = `display:none;margin-top:10px;padding:10px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border)`;
  const colorsChips = document.createElement('div');
  colorsChips.style.cssText = `display:flex;gap:8px;flex-wrap:wrap`;

  // Initialize colors array if not exists
  if (!item.colors) item.colors = [];

  colors.forEach(c => {
    const chip = document.createElement('label');
    chip.style.cssText = `display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--chip-bg);border:2px solid var(--chip-border);border-radius:999px;cursor:pointer;font-size:1rem;font-weight:normal;color:var(--text);transition:all 0.2s ease`;
    chip.addEventListener('mouseenter', () => {
      chip.style.transform = 'translateY(-2px)';
      chip.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    });
    chip.addEventListener('mouseleave', () => {
      chip.style.transform = 'translateY(0)';
      chip.style.boxShadow = 'none';
    });
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = c;
    checkbox.checked = item.colors?.includes(c) || false;
    checkbox.addEventListener('change', () => {
      if (!item.colors) item.colors = [];
      if (checkbox.checked) {
        if (!item.colors.includes(c)) item.colors.push(c);
      } else {
        item.colors = item.colors.filter(col => col !== c);
        if (item.selectedColor === c) {
          item.selectedColor = null;
        }
      }
      dirty = true;
    });
    chip.appendChild(checkbox);
    const span = document.createElement('span');
    span.textContent = c;
    chip.appendChild(span);
    colorsChips.appendChild(chip);
  });

  colorsContent.appendChild(colorsChips);
  colorsSection.appendChild(colorsHeader);
  colorsSection.appendChild(colorsContent);
  body.appendChild(colorsSection);

  // Always start collapsed - user must click to see values
  let colorsExpanded = false;

  colorsHeader.addEventListener('click', () => {
    colorsExpanded = !colorsExpanded;
    colorsContent.style.display = colorsExpanded ? 'block' : 'none';
    colorsHeader.querySelector('.colors-toggle').textContent = colorsExpanded ? '▲' : '▼';
  });

  // Display selected colors if any (removed per user request)

  // Note
  const noteDiv = document.createElement('div');
  noteDiv.innerHTML = `<div style="font-weight:bold;margin-top:8px;margin-bottom:6px;font-size:1rem;color:var(--text)">ملاحظة</div>`;
  const noteInput = document.createElement('textarea');
  noteInput.value = item.note || '';
  noteInput.placeholder = 'اكتب ملاحظة هنا…';
  noteInput.dir = 'rtl';
  noteInput.style.cssText = `width:100%;padding:12px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text);min-height:68px;font-weight:normal;font-size:1rem;cursor:text;transition:all 0.2s ease`;
  noteInput.addEventListener('mouseenter', () => {
    noteInput.style.transform = 'translateY(-2px)';
    noteInput.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
  });
  noteInput.addEventListener('mouseleave', () => {
    if (document.activeElement !== noteInput) {
      noteInput.style.transform = 'translateY(0)';
      noteInput.style.boxShadow = 'none';
    }
  });
  noteInput.addEventListener('input', () => { item.note = noteInput.value; });
  noteInput.addEventListener('input', () => { dirty = true; });
  noteDiv.appendChild(noteInput);
  body.appendChild(noteDiv);

  // Image upload section
  const imageDiv = document.createElement('div');
  imageDiv.innerHTML = `
        <div style="font-weight:700;margin-top:8px;margin-bottom:6px">📷 الصورة</div>
        <div id="qs-image-preview-area" style="margin-top:10px;text-align:center"></div>
        <input type="text" id="qs-image-url" placeholder="أو اكتب رابط الصورة" value="${item.img || ''}" style="width:100%;padding:12px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text);font-size:14px;margin-top:10px">
      `;
  body.appendChild(imageDiv);

  // Create file input and button separately to avoid emoji handler interference
  const qsImageFileInput = document.createElement('input');
  qsImageFileInput.type = 'file';
  qsImageFileInput.accept = 'image/*';
  qsImageFileInput.style.display = 'none';
  qsImageFileInput.id = 'qs-image-file-input';

  const qsChooseImageBtn = document.createElement('button');
  qsChooseImageBtn.type = 'button';
  qsChooseImageBtn.id = 'qs-choose-image-btn';
  qsChooseImageBtn.textContent = '📁 اختر صورة من جهازك';
  qsChooseImageBtn.style.cssText = 'width:100%;padding:12px;border-radius:12px;background:var(--chip-bg);border:2px solid var(--chip-border);color:var(--text);cursor:pointer;font-weight:bold;font-size:14px;display:block;text-align:center;margin-top:10px';

  // Insert button before preview area
  const qsImagePreviewArea = imageDiv.querySelector('#qs-image-preview-area');
  imageDiv.insertBefore(qsImageFileInput, qsImagePreviewArea);
  imageDiv.insertBefore(qsChooseImageBtn, qsImagePreviewArea);

  const qsImageUrl = imageDiv.querySelector('#qs-image-url');
  let qsSelectedImageFile = null;

  const qsClearImageBtn = document.createElement('button');
  qsClearImageBtn.type = 'button';
  qsClearImageBtn.textContent = '🗑️ إزالة الصورة';
  qsClearImageBtn.style.cssText = 'width:100%;padding:10px;border-radius:12px;background:#ef4444;color:#fff;border:none;font-weight:700;cursor:pointer;margin-top:8px';
  qsClearImageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    item.img = '';
    qsSelectedImageFile = null;
    if (qsImageUrl) qsImageUrl.value = '';
    if (qsImageFileInput) qsImageFileInput.value = '';
    qsImagePreviewArea.innerHTML = `<p style="color:var(--muted);font-size:12px">تم حذف الصورة</p>`;
    showToast('🗑️ تم حذف الصورة من هذا المنتج');
    dirty = true;
  });
  imageDiv.appendChild(qsClearImageBtn);

  qsChooseImageBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (qsImageFileInput) {
      qsImageFileInput.click();
    } else {
      console.error('❌ File input not found!');
    }
  });

  qsImageFileInput?.addEventListener('change', async (e) => {
    const logPrefix = '[Quick Settings Image]';

    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      console.error(`${logPrefix} Invalid file type:`, file.type);
      showToast('❌ نوع الملف غير مدعوم. استخدم: JPG, PNG, WEBP, GIF');
      return;
    }

    // Re-read status RIGHT BEFORE upload to ensure we use the current status
    // (user might have changed status after selecting the file)
    const status = item.status;
    // Show loading
    qsImagePreviewArea.innerHTML = `<p style="color:var(--muted)">⏳ جاري رفع الصورة...</p>`;

    try {
      // Use backend adapter for image upload
      const uploadResult = await backendUploadImage(file, status);

      if (uploadResult && uploadResult.success && uploadResult.imageUrl) {
        // Update item with image path/key
        qsSelectedImageFile = null;
        item.img = uploadResult.imageUrl;
        dirty = true;

        if (qsImageUrl) {
          qsImageUrl.value = uploadResult.imageUrl;
        }

        // Get the image source (handles both localStorage and server paths)
        const imgSrc = getImageSrc(uploadResult.imageUrl);
        const metadata = uploadResult.metadata || {};
        const originalSize = metadata.originalSize ? (metadata.originalSize / 1024).toFixed(1) : 'N/A';
        const compressedSize = metadata.compressedSize ? (metadata.compressedSize / 1024).toFixed(1) : 'N/A';

        // If image is in IndexedDB, load it asynchronously
        if (uploadResult.imageUrl.startsWith('idb:')) {
          getImageFromIndexedDB(uploadResult.imageUrl.replace('idb:', '')).then(dataUrl => {
            if (dataUrl && qsImagePreviewArea.querySelector('img')) {
              qsImagePreviewArea.querySelector('img').src = dataUrl;
            }
          }).catch(err => console.warn('Failed to load image from IndexedDB:', err));
        }

        // Show preview
        qsImagePreviewArea.innerHTML = `
              <img src="${imgSrc}" style="max-width:150px;max-height:150px;border-radius:8px;border:2px solid var(--line);margin:8px 0;object-fit:contain;background:#0a162c" onerror="this.style.display='none'">
              <p style="color:var(--ok);font-size:13px;margin:4px 0">✅ تم حفظ الصورة بنجاح</p>
              <p style="color:var(--muted);font-size:11px">${file.name}</p>
              <p style="color:var(--muted);font-size:10px">الحجم: ${originalSize}KB → ${compressedSize}KB</p>
            `;
        showToast(`📷 تم رفع الصورة بنجاح`);
      }
    } catch (err) {
      console.error(`${logPrefix} Upload FAILED:`, {
        message: err.message,
        stack: err.stack,
        error: err
      });
      qsImagePreviewArea.innerHTML = `<p style="color:var(--err)">❌ فشل رفع الصورة</p>`;
      showUploadError(err); // Use user-friendly error handler
    }
  });

  qsImageUrl?.addEventListener('input', (e) => {
    item.img = e.target.value.trim();
    dirty = true;
  });

  // Video upload section
  const videoDiv = document.createElement('div');
  videoDiv.innerHTML = `
    <div style="font-weight:700;margin-top:8px;margin-bottom:6px">🎥 الفيديو (اختياري)</div>
    <div id="qs-video-preview-area" style="margin-top:10px;text-align:center"></div>
    <input type="text" id="qs-video-url" placeholder="أو اكتب رابط الفيديو" value="${item.video || ''}" style="width:100%;padding:12px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text);font-size:14px;margin-top:10px">
  `;
  body.appendChild(videoDiv);

  const qsVideoFileInput = document.createElement('input');
  qsVideoFileInput.type = 'file';
  qsVideoFileInput.accept = 'video/*,video/quicktime,video/x-m4v,video/m4v,.mov,.m4v,.mp4,.webm,.ogg';
  qsVideoFileInput.style.display = 'none';
  qsVideoFileInput.id = 'qs-video-file-input';

  const qsChooseVideoBtn = document.createElement('button');
  qsChooseVideoBtn.type = 'button';
  qsChooseVideoBtn.id = 'qs-choose-video-btn';
  qsChooseVideoBtn.textContent = '🎬 اختر فيديو من جهازك';
  qsChooseVideoBtn.style.cssText = 'width:100%;padding:12px;border-radius:12px;background:var(--chip-bg);border:2px solid var(--chip-border);color:var(--text);cursor:pointer;font-weight:bold;font-size:14px;display:block;text-align:center;margin-top:10px';

  const qsVideoPreviewArea = videoDiv.querySelector('#qs-video-preview-area');
  videoDiv.insertBefore(qsVideoFileInput, qsVideoPreviewArea);
  videoDiv.insertBefore(qsChooseVideoBtn, qsVideoPreviewArea);

  const qsVideoUrl = videoDiv.querySelector('#qs-video-url');
  let qsSelectedVideoFile = null;

  const qsClearVideoBtn = document.createElement('button');
  qsClearVideoBtn.type = 'button';
  qsClearVideoBtn.textContent = '🗑️ إزالة الفيديو';
  qsClearVideoBtn.style.cssText = 'width:100%;padding:10px;border-radius:12px;background:#ef4444;color:#fff;border:none;font-weight:700;cursor:pointer;margin-top:8px';
  qsClearVideoBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    item.video = '';
    qsSelectedVideoFile = null;
    if (qsVideoUrl) qsVideoUrl.value = '';
    if (qsVideoFileInput) qsVideoFileInput.value = '';
    qsVideoPreviewArea.innerHTML = `<p style="color:var(--muted);font-size:12px">تم حذف الفيديو</p>`;
    showToast('🗑️ تم حذف الفيديو من هذا المنتج');
    dirty = true;
  });
  videoDiv.appendChild(qsClearVideoBtn);

  const updateQsVideoPreview = (src, meta = '') => {
    if (!qsVideoPreviewArea) return;
    const isIndexedDB = src && src.startsWith('idb:');
    const safeSrc = src ? getImageSrc(src) : '';
    qsVideoPreviewArea.innerHTML = src ? `
      <video ${isIndexedDB ? `data-video-path="${escapeAttr(src)}"` : `src="${escapeAttr(safeSrc)}"`} controls style="max-width:100%;max-height:220px;border-radius:8px;border:2px solid var(--line);margin:8px 0"></video>
      ${meta ? `<p style="color:var(--muted);font-size:12px;margin:4px 0">${meta}</p>` : ''}
    ` : '';
    if (isIndexedDB) {
      const videoEl = qsVideoPreviewArea.querySelector('video');
      if (videoEl) loadIndexedDBVideo(videoEl, src);
    }
  };

  // Show existing video
  if (item.video) {
    updateQsVideoPreview(item.video, 'الفيديو الحالي');
  }

  qsChooseVideoBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    qsVideoFileInput?.click();
  });

  qsVideoFileInput?.addEventListener('change', async (e) => {
    const logPrefix = '[Quick Settings Video]';
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'video/mp4', 'video/webm', 'video/ogg',
      'video/quicktime', 'video/x-m4v', 'video/m4v', 'video/mov',
      'video/3gpp', 'video/x-msvideo'
    ];
    const validExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.3gp', '.avi'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!validTypes.includes(file.type) && !hasValidExt) {
      showToast('❌ نوع الفيديو غير مدعوم. استخدم MP4 / MOV / WEBM');
      return;
    }

    const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
    if (file.size > MAX_VIDEO_SIZE) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      showToast(`❌ حجم الفيديو كبير (${fileSizeMB}MB). الحد الأقصى 200MB.`);
      return;
    }

    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    qsVideoPreviewArea.innerHTML = `<p style="color:var(--muted)">⏳ جاري رفع الفيديو... (${fileSizeMB}MB)</p>`;

    try {
      const uploadResult = await backendUploadProductVideo(file, item.status);
      qsSelectedVideoFile = null;
      if (uploadResult && uploadResult.success && uploadResult.videoUrl) {
        item.video = uploadResult.videoUrl;
        if (qsVideoUrl) qsVideoUrl.value = uploadResult.videoUrl;
        updateQsVideoPreview(uploadResult.videoUrl, `✅ تم حفظ الفيديو • ${fileSizeMB}MB`);
        showToast('✅ تم رفع الفيديو بنجاح');
        dirty = true;
      }
    } catch (err) {
      console.error(`${logPrefix} Upload FAILED:`, err);
      showUploadError(err);
    }
  });

  qsVideoUrl?.addEventListener('input', (e) => {
    item.video = e.target.value.trim();
    if (item.video) {
      updateQsVideoPreview(item.video, 'معاينة الرابط');
    } else {
      updateQsVideoPreview('');
    }
    dirty = true;
  });

  // Footer actions
  const footer = document.createElement('div');
  footer.style.cssText = `display:flex;gap:10px;padding:14px 16px;border-top:1px solid #ffffff18`;
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'حفظ';
  saveBtn.style.cssText = `flex:1;padding:10px;border-radius:8px;background:var(--ok);color:#052e17;border:none;font-weight:700;cursor:pointer`;
  const toggleHideBtn = document.createElement('button');
  toggleHideBtn.type = 'button';
  toggleHideBtn.textContent = item.hidden ? '👀 إظهار' : '🙈 إخفاء';
  toggleHideBtn.style.cssText = `flex:1;padding:10px;border-radius:8px;background:#334155;color:#f8fafc;border:none;font-weight:700;cursor:pointer`;
  toggleHideBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    item.hidden = !item.hidden;
    toggleHideBtn.textContent = item.hidden ? '👀 إظهار' : '🙈 إخفاء';
    await saveCatalog();
    render();
    showToast(item.hidden ? '🙈 تم إخفاء المنتج' : '👀 تم إظهار المنتج');
  });
  saveBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (item.status === 'discount' && !item.ends) {
      ensurePanelTimer();
      if (typeof showToast === 'function') {
        showToast('⚠️ لا يمكن حفظ تخفيض بدون مؤقت. عدّل الوقت أو حافظ على المؤقت الافتراضي');
      }
      if (qsEndsInput) qsEndsInput.focus();
      return;
    }
    // Reset date only if status/section changed
    if (item.status !== originalStatus) {
      item.date = new Date().toISOString().split('T')[0];
    }
    // Image is already uploaded when selected, just save catalog
    await saveCatalog();
    render();
    dirty = false;
    closePanel();
  });
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'إغلاق';
  closeBtn.style.cssText = `flex:1;padding:10px;border-radius:8px;background:#ffffff12;color:var(--text);border:1px solid #ffffff25;font-weight:700;cursor:pointer`;
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dirty) {
      restoreItemState();
    }
    closePanel();
  });
  footer.appendChild(saveBtn);
  footer.appendChild(toggleHideBtn);
  footer.appendChild(closeBtn);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  // Focus trap + close handlers
  function closePanel() {
    try { backdrop.remove(); panel.remove(); } catch { }
  }
  setTimeout(() => {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dirty) restoreItemState();
        closePanel();
      }
    }, { once: true });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        if (dirty) restoreItemState();
        closePanel();
      }
    }, { once: true });
  }, 10);

  const priceEl = panel.querySelector('#qs-price');
  const fromEl = panel.querySelector('#qs-from');
  const newEl = panel.querySelector('#qs-new');
  const pctOut = panel.querySelector('#qs-pct');

  // Strong focus/hover feedback for better visibility

  function addFocusRing(el) {
    if (!el) return;
    el.addEventListener('focus', () => {
      const ac = accentFor(item.status);
      el.style.outline = `3px solid ${ac}`;
      el.style.outlineOffset = '2px';
      el.style.borderColor = ac;
      el.style.caretColor = ac;
      el.style.background = 'var(--input-bg)';
    });
    el.addEventListener('blur', () => {
      el.style.outline = 'none';
      el.style.borderColor = 'var(--input-border)';
      el.style.background = 'var(--input-bg)';
    });
    el.addEventListener('pointerenter', () => { el.style.borderColor = accentFor(item.status); });
    el.addEventListener('pointerleave', () => { el.style.borderColor = 'var(--input-border)'; });
  }
  [priceEl, fromEl, newEl, noteInput].forEach(addFocusRing);

  function accentFor(s) {
    return s === 'discount' ? '#f59e0b' : '#22c55e';
  }

  function updateStatusButtons() {
    statusButtons.forEach(({ value, el }) => {
      const active = item.status === value;
      el.style.background = active ? accentFor(value) : '#ffffff10';
      el.style.color = active ? '#052e17' : 'var(--text)';
    });
  }

  function applyAccent() {
    const ac = accentFor(item.status);
    header.style.boxShadow = `inset 0 -3px 0 ${ac}`;
    panel.style.borderLeft = `4px solid ${ac}`;
  }

  function updateSaleVisibility() {
    const isSale = item.status === 'discount';
    saleBox.style.display = isSale ? 'block' : 'none';
    if (priceSimple) priceSimple.style.display = isSale ? 'none' : 'block';
    if (timerBox) timerBox.style.display = isSale ? 'block' : 'none';
  }

  function updateDiscount() {
    // Convert comma to dot and normalize values
    const fromValue = fromEl?.value ? String(fromEl.value).replace(',', '.') : '';
    const newValue = newEl?.value ? String(newEl.value).replace(',', '.') : '';

    // Update input values to always show dot
    if (fromEl && fromValue !== fromEl.value) {
      fromEl.value = fromValue;
    }
    if (newEl && newValue !== newEl.value) {
      newEl.value = newValue;
    }

    const from = parseFloat(fromValue) || 0;
    const now = parseFloat(newValue) || 0;

    // Always update the item price when user types in السعر التخفيض
    if (newEl && newValue && isFinite(now) && now >= 0) {
      item.price = round2(now);
    }

    // Calculate percentage automatically when both values are valid
    if (isFinite(from) && from > 0 && isFinite(now) && now >= 0) {
      if (now <= from) {
        // Valid discount: price is less than or equal to original
        const pct = Math.round((1 - now / from) * 100);
        if (pctOut) {
          pctOut.textContent = `-${pct}%`;
          // Update visual feedback based on discount amount
          if (pct >= 50) {
            pctOut.style.color = '#dc2626';
            pctOut.style.background = 'linear-gradient(135deg, rgba(220,38,38,0.2) 0%, rgba(185,28,28,0.15) 100%)';
            pctOut.style.borderColor = 'rgba(220,38,38,0.4)';
          } else if (pct >= 25) {
            pctOut.style.color = '#ef4444';
            pctOut.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.12) 100%)';
            pctOut.style.borderColor = 'rgba(239,68,68,0.3)';
          } else {
            pctOut.style.color = '#f59e0b';
            pctOut.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.12) 100%)';
            pctOut.style.borderColor = 'rgba(245,158,11,0.3)';
          }
        }
        // Update item values
        if (fromEl && fromEl.value) item.was = round2(from);
      } else {
        // Price is higher than original (not a discount, maybe an increase?)
        if (pctOut) {
          const increase = Math.round(((now - from) / from) * 100);
          pctOut.textContent = `+${increase}%`;
          pctOut.style.color = '#22c55e';
          pctOut.style.background = 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.12) 100%)';
          pctOut.style.borderColor = 'rgba(34,197,94,0.3)';
        }
      }
    } else if (isFinite(now) && now > 0 && (!fromEl || !fromEl.value || from === 0)) {
      // If user only entered discount price without original price, show waiting state
      if (pctOut) {
        pctOut.textContent = '...';
        pctOut.style.color = 'var(--muted, #64748b)';
        pctOut.style.background = 'var(--input-bg)';
        pctOut.style.borderColor = 'var(--input-border)';
      }
    } else {
      // Reset to 0% if invalid or empty
      if (pctOut) {
        pctOut.textContent = '-0%';
        pctOut.style.color = '#ef4444';
        pctOut.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.12) 100%)';
        pctOut.style.borderColor = 'rgba(239,68,68,0.3)';
      }
    }
    dirty = true;
  }

  // Attach event listeners for real-time calculation
  fromEl?.addEventListener('input', updateDiscount);
  fromEl?.addEventListener('change', updateDiscount);
  newEl?.addEventListener('input', updateDiscount);
  newEl?.addEventListener('change', updateDiscount);

  // Calculate initial percentage on load
  if (item.status === 'discount') {
    updateDiscount();
  }

  priceEl?.addEventListener('input', () => { const v = parseFloat(priceEl.value); if (isFinite(v)) item.price = round2(v); });
  priceEl?.addEventListener('input', () => { dirty = true; });

  panel.querySelectorAll('.qs-chip').forEach(b => {
    b.addEventListener('click', async () => {
      const pct = parseFloat(b.dataset.pct);
      applySale(item, pct);
      ensurePanelTimer();
      priceEl.value = item.price;
      fromEl.value = item.was || '';
      newEl.value = item.price || '';
      pctOut.textContent = `-${pct}%`;
      // Don't change status - applySale already handles it
      updateSaleVisibility();
      updateStatusButtons();
      applyAccent();
    });
  });

  // Initialize accents and button states
  updateStatusButtons();
  applyAccent();
  updateSaleVisibility();
}
window.openQuickSettingsPanel = openQuickSettingsPanel;

// ERROR CODE: VID-DEL-001
async function deleteVideoDirect(index) {
  const ERROR_CODE = 'VID-DEL-001';
  if (confirm('هل تريد فعلاً حذف هذا الستوري؟ لن تتمكن من التراجع.')) {
    try {
      if (index < 0 || index >= VIDEOS.length) {
        console.error(`[${ERROR_CODE}] Invalid index: ${index}`);
        showToast(`❌ [${ERROR_CODE}] فهرس غير صالح`);
        return;
      }

      const video = VIDEOS[index];

      // Delete from Firestore if configured
      if (db && video && video.id && !video.id.startsWith('video_')) {
        try {
          const docRef = doc(db, "articles", video.id);
          await deleteDoc(docRef);
          console.log(`[${ERROR_CODE}] ✅ Video deleted from Firestore: ${video.id}`);
        } catch (firestoreError) {
          console.error(`[${ERROR_CODE}] ⚠️ Failed to delete from Firestore:`, firestoreError);
          // Continue with local deletion even if Firestore delete fails
        }
      }

      VIDEOS.splice(index, 1);
      await saveVideos();
      render();
    } catch (e) {
      console.error(`[VID-DEL-002] Error deleting video:`, e);
      showToast(`❌ [VID-DEL-002] فشل حذف الستوري: ${e.message || 'خطأ غير معروف'}`);
    }
  }
}
window.deleteVideoDirect = deleteVideoDirect;

// Hide/Unhide videos
async function hideVideoDirect(index) {
  const ERROR_CODE = 'VID-HIDE-001';
  try {
    if (index < 0 || index >= VIDEOS.length) return;
    const video = VIDEOS[index];
    if (!video) return;
    video.hidden = true;
    if (db && video.id && !video.id.startsWith('video_')) {
      try { await updateDoc(doc(db, "articles", video.id), { hidden: true }); } catch (e) { console.warn(`[${ERROR_CODE}] Firestore hide failed`, e); }
    }
    await saveVideos();
    render();
    showToast('🙈 تم إخفاء الستوري');
  } catch (e) {
    console.error(`[${ERROR_CODE}]`, e);
    showToast(`❌ [${ERROR_CODE}] فشل إخفاء الستوري`);
  }
}

async function unhideVideoDirect(videoId) {
  const ERROR_CODE = 'VID-UNHIDE-001';
  try {
    const idx = VIDEOS.findIndex(v => v.id === videoId);
    if (idx === -1) return;
    const video = VIDEOS[idx];
    video.hidden = false;
    if (db && video.id && !video.id.startsWith('video_')) {
      try { await updateDoc(doc(db, "articles", video.id), { hidden: false }); } catch (e) { console.warn(`[${ERROR_CODE}] Firestore unhide failed`, e); }
    }
    await saveVideos();
    render();
    showToast('👀 تم إظهار الستوري');
  } catch (e) {
    console.error(`[${ERROR_CODE}]`, e);
    showToast(`❌ [${ERROR_CODE}] فشل إظهار الستوري`);
  }
}

function hideAllVideos() {
  VIDEOS.forEach(v => { v.hidden = true; });
  saveVideos().then(render);
  showToast('🙈 تم إخفاء كل الستوري');
}

function unhideAllVideos() {
  VIDEOS.forEach(v => { v.hidden = false; });
  saveVideos().then(render);
  showToast('👀 تم إظهار كل الستوري');
}

// Reorder helpers for videos
function moveVideoToTop(index) {
  if (index < 0 || index >= VIDEOS.length) return;
  const [v] = VIDEOS.splice(index, 1);
  VIDEOS.unshift(v);
  saveVideos().then(render);
}

function moveVideoUp(index) {
  if (index <= 0 || index >= VIDEOS.length) return;
  const tmp = VIDEOS[index - 1];
  VIDEOS[index - 1] = VIDEOS[index];
  VIDEOS[index] = tmp;
  saveVideos().then(render);
}

function moveVideoDown(index) {
  if (index < 0 || index >= VIDEOS.length - 1) return;
  const tmp = VIDEOS[index + 1];
  VIDEOS[index + 1] = VIDEOS[index];
  VIDEOS[index] = tmp;
  saveVideos().then(render);
}

function moveVideoToTopById(id) {
  const idx = VIDEOS.findIndex(v => v.id === id);
  if (idx === -1) return;
  moveVideoToTop(idx);
}

function moveVideoUpById(id) {
  const idx = VIDEOS.findIndex(v => v.id === id);
  if (idx === -1) return;
  moveVideoUp(idx);
}

function moveVideoDownById(id) {
  const idx = VIDEOS.findIndex(v => v.id === id);
  if (idx === -1) return;
  moveVideoDown(idx);
}

// Modern reorder modal for articles and videos (drag to reorder)
function openOrderModal(kind = 'articles') {
  const isArticles = kind === 'articles' || kind === 'articles_today' || kind === 'articles_discount';
  let items = isArticles
    ? [...CATALOG].filter(p => {
      if (kind === 'articles_today') return p.status === 'today';
      if (kind === 'articles_discount') return p.status === 'discount';
      return true;
    })
    : [...VIDEOS];
  if (!items.length) {
    showToast('لا عناصر لإعادة الترتيب');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay reorder-modal';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 6000;
    padding: 16px;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--card);
    color: var(--text);
    border-radius: 16px;
    width: min(520px, 95vw);
    max-height: 90vh;
    overflow: hidden;
    border: 1px solid var(--chip-border);
    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
  `;

  const header = document.createElement('div');
  header.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line);`;
  const titleLabel = isArticles
    ? (kind === 'articles_discount' ? 'التخفيضات' : 'جديد اليوم')
    : 'الستوريات';
  header.innerHTML = `<strong>↕ إعادة ترتيب ${titleLabel}</strong><button type="button" style="border:none;background:transparent;color:var(--text);font-size:18px;cursor:pointer">×</button>`;

  const close = () => { overlay.remove(); };
  header.querySelector('button')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  setTimeout(() => { document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc, true); } }, true); }, 0);

  const body = document.createElement('div');
  body.style.cssText = `padding:12px 16px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:10px;`;

  const list = document.createElement('div');
  list.style.cssText = `display:flex;flex-direction:column;gap:8px;`;

  let dragIdx = null;
  function renderList() {
    list.innerHTML = items.map((it, idx) => {
      const title = isArticles ? (it.title || 'بدون عنوان') : (it.title || 'ستوري');
      const status = isArticles ? (it.status || '—') : (it.status || 'active');
      return `
        <div class="order-row" data-idx="${idx}" draggable="true" style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--chip-border);border-radius:12px;background:var(--input-bg);user-select:none;cursor:grab;">
          <div style="min-width:32px;font-weight:800;color:var(--muted)">☰</div>
          <div style="flex:1;overflow:hidden">
            <div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(title)}</div>
            <div style="font-size:12px;color:var(--muted)">${status}</div>
          </div>
          <div style="color:var(--muted);font-weight:700">${idx + 1}</div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.order-row').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        dragIdx = Number(row.dataset.idx);
        row.style.opacity = '0.6';
      });
      row.addEventListener('dragend', () => {
        row.style.opacity = '1';
        dragIdx = null;
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        const overIdx = Number(row.dataset.idx);
        if (dragIdx === null || dragIdx === overIdx) return;
        const [it] = items.splice(dragIdx, 1);
        items.splice(overIdx, 0, it);
        dragIdx = overIdx;
        renderList();
      });
    });
  }

  body.appendChild(list);
  renderList();

  const footer = document.createElement('div');
  footer.style.cssText = `display:flex;gap:10px;padding:12px 16px;border-top:1px solid var(--line);flex-wrap:wrap`;
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = '💾 حفظ الترتيب';
  saveBtn.style.cssText = `padding:10px 14px;border-radius:12px;background:var(--ok);color:#052e17;border:none;font-weight:800;cursor:pointer`;
  saveBtn.addEventListener('click', async () => {
    if (isArticles) {
      // Merge back into CATALOG keeping other sections
      const ids = new Set(items.map(i => i.id));
      const others = CATALOG.filter(p => !ids.has(p.id));
      const merged = [];
      if (kind === 'articles_today') {
        merged.push(...items, ...others);
      } else if (kind === 'articles_discount') {
        const today = others.filter(p => p.status === 'today');
        const discounts = items;
        const rest = others.filter(p => p.status !== 'today' && p.status !== 'discount');
        merged.push(...today, ...discounts, ...rest);
      } else {
        merged.push(...items, ...others);
      }
      assignSequentialPositions(merged);
      CATALOG = merged;
      await saveCatalog();
      await persistPositionsToFirestore(merged);
    } else {
      assignSequentialPositions(items);
      VIDEOS = items;
      await saveVideos();
    }
    render();
    close();
    showToast('✅ تم حفظ الترتيب');
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'إلغاء';
  cancelBtn.style.cssText = `padding:10px 14px;border-radius:12px;background:var(--chip-bg);border:1px solid var(--chip-border);color:var(--text);font-weight:700;cursor:pointer`;
  cancelBtn.addEventListener('click', close);

  footer.appendChild(saveBtn);
  footer.appendChild(cancelBtn);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

window.hideVideoDirect = hideVideoDirect;
window.unhideVideoDirect = unhideVideoDirect;
window.hideAllVideos = hideAllVideos;
window.unhideAllVideos = unhideAllVideos;
window.moveVideoToTop = moveVideoToTop;
window.moveVideoUp = moveVideoUp;
window.moveVideoDown = moveVideoDown;
window.moveVideoToTopById = moveVideoToTopById;
window.moveVideoUpById = moveVideoUpById;
window.moveVideoDownById = moveVideoDownById;
window.openOrderModal = openOrderModal;

// RTL Quick Video Settings side panel
function openQuickVideoPanel(video, index) {
  // Close existing panels
  document.querySelectorAll('.quick-panel, .quick-backdrop').forEach(el => el.remove());

  const backdrop = document.createElement('div');
  backdrop.className = 'quick-backdrop';
  backdrop.setAttribute('role', 'presentation');
  backdrop.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:5000;`;

  const panel = document.createElement('div');
  panel.className = 'quick-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'إعدادات سريعة للستوري');
  panel.dir = 'rtl';
  panel.style.cssText = `position:fixed;top:0;right:0;height:100%;width:min(420px,95vw);background:var(--card);border-left:1px solid #ffffff20;z-index:5001;box-shadow:-8px 0 20px rgba(0,0,0,0.3);display:flex;flex-direction:column;`;

  const header = document.createElement('div');
  header.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line);`;
  header.innerHTML = `<strong>⚡ إعدادات سريعة - ستوري</strong>`;

  const body = document.createElement('div');
  body.style.cssText = `flex:1;overflow:auto;padding:14px 16px;gap:12px;display:flex;flex-direction:column;`;

  // Section: العنوان
  const titleDiv = document.createElement('div');
  titleDiv.innerHTML = `<div style="font-weight:700;margin-bottom:6px">العنوان</div>`;
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'qv-title';
  titleInput.value = video.title || '';
  titleInput.placeholder = 'اكتب عنوان الستوري...';
  titleInput.dir = 'rtl';
  titleInput.style.cssText = `width:100%;padding:12px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text);font-weight:700;cursor:text`;
  titleInput.addEventListener('input', () => { video.title = titleInput.value.trim(); });
  titleDiv.appendChild(titleInput);
  body.appendChild(titleDiv);

  // Video upload section
  const videoDiv = document.createElement('div');
  videoDiv.innerHTML = `
        <div style="font-weight:700;margin-top:8px;margin-bottom:6px">🎥 الفيديو</div>
        <div id="qv-video-preview-area" style="margin-top:10px;text-align:center"></div>
        <input type="text" id="qv-video-url" placeholder="أو اكتب رابط الفيديو" value="${video.video || ''}" style="width:100%;padding:12px;border-radius:12px;background:var(--input-bg);border:2px solid var(--input-border);color:var(--text);font-size:14px;margin-top:10px">
      `;
  body.appendChild(videoDiv);

  // Create file input and button
  // Support iPhone video formats: quicktime, mov, m4v, and popular formats
  const qvVideoFileInput = document.createElement('input');
  qvVideoFileInput.type = 'file';
  qvVideoFileInput.accept = 'video/*,video/quicktime,video/x-m4v,video/m4v,.mov,.m4v,.mp4,.webm,.ogg';
  // Enable camera/gallery access on mobile devices
  if (qvVideoFileInput.capture !== undefined) {
    qvVideoFileInput.capture = 'environment'; // Use back camera, or 'user' for front
  }
  qvVideoFileInput.style.display = 'none';
  qvVideoFileInput.id = 'qv-video-file-input';

  const qvChooseVideoBtn = document.createElement('button');
  qvChooseVideoBtn.type = 'button';
  qvChooseVideoBtn.id = 'qv-choose-video-btn';
  qvChooseVideoBtn.textContent = '📁 اختر فيديو من جهازك (iPhone مدعوم)';
  qvChooseVideoBtn.style.cssText = 'width:100%;padding:12px;border-radius:12px;background:var(--chip-bg);border:2px solid var(--chip-border);color:var(--text);cursor:pointer;font-weight:bold;font-size:14px;display:block;text-align:center;margin-top:10px';

  const qvVideoPreviewArea = videoDiv.querySelector('#qv-video-preview-area');
  videoDiv.insertBefore(qvVideoFileInput, qvVideoPreviewArea);
  videoDiv.insertBefore(qvChooseVideoBtn, qvVideoPreviewArea);

  const qvVideoUrl = videoDiv.querySelector('#qv-video-url');
  let qvSelectedVideoFile = null;

  // Show current video if exists
  if (video.video) {
    const videoSrc = getImageSrc(video.video);
    const isIndexedDB = video.video.startsWith('idb:');
    qvVideoPreviewArea.innerHTML = `
          <video ${isIndexedDB ? `data-video-path="${escapeAttr(video.video)}"` : `src="${escapeAttr(videoSrc)}"`} controls style="max-width:100%;max-height:200px;border-radius:8px;border:2px solid var(--line);margin:8px 0" onerror="this.style.display='none'"></video>
            <p style="color:var(--muted);font-size:11px">الفيديو الحالي</p>
          `;
    if (isIndexedDB) {
      const videoEl = qvVideoPreviewArea.querySelector('video');
      if (videoEl) loadIndexedDBVideo(videoEl, video.video);
    }
  }

  qvChooseVideoBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (qvVideoFileInput) {
      qvVideoFileInput.click();
    }
  });

  qvVideoFileInput?.addEventListener('change', async (e) => {
    const ERROR_CODE = 'VID-PANEL-002';
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type - Support iPhone and popular video formats
    const validTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',  // iPhone MOV format
      'video/x-m4v',      // iPhone M4V format
      'video/m4v',       // iPhone M4V format (alternative)
      'video/mov',        // QuickTime MOV
      'video/3gpp',       // 3GP format
      'video/x-msvideo'   // AVI format
    ];

    // Also check file extension for iPhone videos (sometimes MIME type is missing)
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.3gp', '.avi'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      showToast(`❌ [${ERROR_CODE}] نوع الملف غير مدعوم. استخدم: MP4, MOV, M4V, WEBM, OGG (iPhone مدعوم)`);
      return;
    }

    // Check file size
    // For localStorage: 200MB limit (will attempt storage, browser may enforce quota)
    // For server: 200MB limit (supports iPhone high quality videos)
    const MAX_LOCAL_SIZE = 200 * 1024 * 1024; // 200MB for localStorage
    const MAX_SERVER_SIZE = 200 * 1024 * 1024; // 200MB for server (iPhone videos)
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    const isFileProtocol = window.location.protocol === 'file:';

    // Only check maximum limit, allow localStorage to attempt storage
    if (isFileProtocol && file.size > MAX_LOCAL_SIZE) {
      const errorMsg = `[VID-PANEL-003] حجم الفيديو كبير جداً (${fileSizeMB}MB). الحد الأقصى 200MB. يرجى ضغط الفيديو.`;
      qvVideoPreviewArea.innerHTML = `<p style="color:var(--danger)">❌ ${errorMsg}</p>`;
      showToast(`❌ ${errorMsg}`);
      return;
    }

    if (!isFileProtocol && file.size > MAX_SERVER_SIZE) {
      const errorMsg = `[VID-PANEL-004] حجم الفيديو كبير جداً (${fileSizeMB}MB). الحد الأقصى 200MB. يرجى ضغط الفيديو.`;
      qvVideoPreviewArea.innerHTML = `<p style="color:var(--danger)">❌ ${errorMsg}</p>`;
      showToast(`❌ ${errorMsg}`);
      return;
    }


    qvVideoPreviewArea.innerHTML = `<p style="color:var(--muted)">⏳ جاري رفع الفيديو إلى Firebase... (${fileSizeMB}MB)</p>`;

    try {
      // Upload video to Firebase Storage
      const uploadResult = await uploadStoryVideoToFirebase(file);
      qvSelectedVideoFile = null;

      // Update video object with Firebase URL
      video.video = uploadResult.videoUrl;

      // Ensure video has a default title if empty
      if (!video.title || !video.title.trim()) {
        video.title = `ستوري ${new Date().toLocaleDateString('ar-TN')}`;
        if (titleInput) {
          titleInput.value = video.title;
        }
      }

      // Update video URL input
      if (qvVideoUrl) {
        qvVideoUrl.value = uploadResult.videoUrl;
      }

      // Show preview with Firebase URL
      qvVideoPreviewArea.innerHTML = `
            <video src="${uploadResult.videoUrl}" controls style="max-width:100%;max-height:200px;border-radius:8px;border:2px solid var(--line);margin:8px 0" onerror="this.style.display='none'"></video>
            <p style="color:var(--ok);font-size:13px;margin:4px 0">✅ تم رفع الفيديو إلى Firebase بنجاح</p>
            <p style="color:var(--muted);font-size:11px">الحجم: ${fileSizeMB}MB</p>
          `;

      showToast(`✅ تم رفع الفيديو إلى Firebase بنجاح`);
    } catch (err) {
      const ERROR_CODE = 'VID-PANEL-001';
      console.error(`[${ERROR_CODE}] Video upload failed:`, err);
      const errorMsg = err.message || 'خطأ غير معروف';
      qvVideoPreviewArea.innerHTML = `<p style="color:var(--danger)">❌ فشل رفع الفيديو [${ERROR_CODE}]: ${errorMsg}</p>`;
      showToast(`❌ فشل رفع الفيديو [${ERROR_CODE}]: ${errorMsg}`);
    }
  });

  qvVideoUrl?.addEventListener('input', (e) => {
    video.video = e.target.value.trim();
    if (video.video) {
      const videoSrc = getImageSrc(video.video);
      const isIndexedDB = video.video.startsWith('idb:');
      qvVideoPreviewArea.innerHTML = `
            <video ${isIndexedDB ? `data-video-path="${escapeAttr(video.video)}"` : `src="${escapeAttr(videoSrc)}"`} controls style="max-width:100%;max-height:200px;border-radius:8px;border:2px solid var(--line);margin:8px 0" onerror="this.style.display='none'"></video>
              <p style="color:var(--muted);font-size:11px">معاينة الفيديو</p>
            `;
      if (isIndexedDB) {
        const videoEl = qvVideoPreviewArea.querySelector('video');
        if (videoEl) loadIndexedDBVideo(videoEl, video.video);
      }
    }
  });

  // Footer actions - Save and Cancel buttons
  const footer = document.createElement('div');
  footer.style.cssText = `display:flex;gap:10px;padding:14px 16px;border-top:1px solid #ffffff18`;

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = '💾 حفظ';
  saveBtn.style.cssText = `flex:1;padding:12px;border-radius:8px;background:var(--ok);color:#052e17;border:none;font-weight:700;cursor:pointer;font-size:14px;transition:opacity 0.2s`;
  saveBtn.addEventListener('mouseenter', () => { saveBtn.style.opacity = '0.9'; });
  saveBtn.addEventListener('mouseleave', () => { saveBtn.style.opacity = '1'; });
  saveBtn.addEventListener('click', async () => {
    const ERROR_CODE = 'VID-PANEL-SAVE';
    const logPrefix = `[openQuickVideoPanel:${ERROR_CODE}]`;
    try {
      if (!video.title || !video.title.trim()) {
        showToast('⚠️ يرجى إدخال عنوان الستوري');
        titleInput.focus();
        return;
      }
      if (!video.video || !video.video.trim()) {
        showToast('⚠️ يرجى إضافة فيديو أو رابط فيديو');
        return;
      }

      // Update video object
      video.title = titleInput.value.trim();
      video.video = qvVideoUrl ? qvVideoUrl.value.trim() : video.video;

      if (!video.id) {
        video.id = 'video_' + generateArticleId().slice(1);
      }

      // Save to Firestore if configured, otherwise use localStorage
      // Stories are stored in "articles" collection with section: "story"
      if (db) {
        const storyData = {
          title: video.title || '',
          videoUrl: video.video || video.video_url || '',
          thumbUrl: video.thumb_url || null,
          status: video.status || 'active',
          section: 'story', // Distinguish from regular articles
          createdAt: serverTimestamp()
        };

        let savedStory;

        if (video.id && !video.id.startsWith('video_')) {
          // Update existing story (has Firestore document ID)
          const docRef = doc(db, "articles", video.id);
          const updateData = { ...storyData };
          delete updateData.createdAt; // Don't update createdAt on edit
          await updateDoc(docRef, updateData);

          savedStory = { id: video.id, ...updateData };
        } else {
          // New story or legacy ID
          const docRef = await addDoc(collection(db, "articles"), storyData);
          savedStory = { id: docRef.id, ...storyData };
        }

        // Map Firestore result back to video format
        video = {
          id: savedStory.id,
          title: savedStory.title,
          video: savedStory.videoUrl || savedStory.video_url || '',
          video_url: savedStory.videoUrl || savedStory.video_url || '',
          thumb_url: savedStory.thumbUrl || savedStory.thumb_url || null,
          status: savedStory.status,
          date: savedStory.createdAt && savedStory.createdAt.toDate ? savedStory.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        };
      } else {
        // Fallback: generate unique ID if new
        if (!video.id) {
          video.id = 'video_' + generateArticleId().slice(1);
        }
      }

      // Update in VIDEOS array
      if (typeof index === 'number' && index >= 0 && index < VIDEOS.length) {
        VIDEOS[index] = video;
      } else {
        VIDEOS.unshift(video);
      }

      // Save to localStorage (for fallback mode or cache)
      await saveVideos();

      console.log(`${logPrefix} ✅ Saving video:`, video);
      renderVideos();
      showToast('✅ تم حفظ الستوري بنجاح');
      closePanel();
    } catch (err) {
      console.error(`${logPrefix} ❌ Error saving video:`, err);
      showToast(`❌ [${ERROR_CODE}] خطأ في حفظ الستوري: ${err.message || 'Unknown error'}`);
    }
  });

  const toggleHideBtn = document.createElement('button');
  toggleHideBtn.type = 'button';
  toggleHideBtn.textContent = video.hidden ? '👀 إظهار' : '🙈 إخفاء';
  toggleHideBtn.style.cssText = `flex:1;padding:12px;border-radius:8px;background:#334155;color:#f8fafc;border:none;font-weight:700;cursor:pointer;font-size:14px;transition:opacity 0.2s`;
  toggleHideBtn.addEventListener('mouseenter', () => { toggleHideBtn.style.opacity = '0.9'; });
  toggleHideBtn.addEventListener('mouseleave', () => { toggleHideBtn.style.opacity = '1'; });
  toggleHideBtn.addEventListener('click', async () => {
    video.hidden = !video.hidden;
    toggleHideBtn.textContent = video.hidden ? '👀 إظهار' : '🙈 إخفاء';
    await saveVideos();
    renderVideos();
    showToast(video.hidden ? '🙈 تم إخفاء الستوري' : '👀 تم إظهار الستوري');
  });

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = '❌ إلغاء';
  cancelBtn.style.cssText = `flex:1;padding:12px;border-radius:8px;background:#ffffff12;color:var(--text);border:1px solid #ffffff25;font-weight:700;cursor:pointer;font-size:14px;transition:opacity 0.2s`;
  cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.opacity = '0.9'; });
  cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.opacity = '1'; });
  cancelBtn.addEventListener('click', () => {
    showToast('تم الإلغاء');
    closePanel();
  });

  footer.appendChild(saveBtn);
  footer.appendChild(toggleHideBtn);
  footer.appendChild(cancelBtn);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  // Focus trap + close handlers
  function closePanel() { try { backdrop.remove(); panel.remove(); } catch { } }
  setTimeout(() => {
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); }, { once: true });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePanel(); }, { once: true });
  }, 10);
}
window.openQuickVideoPanel = openQuickVideoPanel;

// ERROR CODE: CAT-SAVE-001
async function saveCatalog() {
  const ERROR_CODE = 'CAT-SAVE-001';
  try {
    localStorage.setItem('catalog', JSON.stringify(CATALOG));
    window.CATALOG = CATALOG; // Keep in sync for external access
  } catch (e) {
    const errorCode = e.message?.includes('quota') ? 'CAT-SAVE-002' : ERROR_CODE;
    console.error(`[${errorCode}] Error saving catalog to localStorage:`, e);
    const errorMsg = e.message?.includes('quota')
      ? `[${errorCode}] Storage quota exceeded. Catalog too large. Please clear some data.`
      : `[${errorCode}] Failed to save catalog: ${e.message || 'Unknown error'}`;
    showToast(`❌ ${errorMsg}`);
  }
}

// ERROR CODE: CAT-LOAD-001
/**
 * Load products from Firestore Database or localStorage fallback
 * 
 * Firestore Collection: "articles" with section: "article"
 * Fields: title, price, was, status, imageUrl, sizes, colors, note, gender, cat, createdAt
 */
async function loadCatalog() {
  const ERROR_CODE = 'CAT-LOAD-001';
  const logPrefix = '[loadCatalog]';

  // If Firebase is configured, load from Firestore
  if (db) {
    try {
      console.log(`${logPrefix} 📥 Loading products from Firestore...`);

      // Fetch all articles with section: "article" (products), ordered by creation date (newest first)
      const q = query(
        collection(db, "articles"),
        where("section", "==", "article"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Map Firestore data to CATALOG format (for compatibility with existing code)
      CATALOG = articles.map(article => ({
        id: article.id,
        title: article.title || '',
        price: article.price || 0,
        was: article.was || 0,
        status: article.status || 'today',
        img: article.imageUrl || article.image_url || '',
        image_url: article.imageUrl || article.image_url || '',
        video: article.videoUrl || article.video_url || article.video || '',
        video_url: article.videoUrl || article.video_url || article.video || '',
        videoUrl: article.videoUrl || article.video_url || article.video || '',
        hidden: !!article.hidden,
        sizes: article.sizes || [],
        colors: article.colors || [],
        note: article.note || null,
        gender: article.gender || 'f',
        cat: article.cat || 'clothes',
        ends: article.ends || null,
        date: article.createdAt && article.createdAt.toDate ? article.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        position: typeof article.position === 'number' ? article.position : null
      }));

      // Ensure positions exist and sort by them to keep manual order
      const positionsChanged = ensurePositions(CATALOG);
      CATALOG = sortByPosition(CATALOG);

      console.log(`${logPrefix} ✅ Loaded ${CATALOG.length} products from Firestore`);
      window.CATALOG = CATALOG; // Keep in sync for external access

      // Also save to localStorage as cache
      await saveCatalog();
      return;
    } catch (e) {
      console.error(`[${ERROR_CODE}] Error loading from Firestore:`, e);
      console.warn(`[${ERROR_CODE}] Falling back to localStorage`);
    }
  }

  // Fallback to localStorage
  try {
    const storedCatalog = localStorage.getItem('catalog');
    if (storedCatalog) {
      CATALOG = JSON.parse(storedCatalog);
    } else {
      // First run: try to bootstrap from catalog.json
      try {
        const res = await fetch('catalog.json', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const products = Array.isArray(data?.products) ? data.products : (Array.isArray(data) ? data : []);
          CATALOG = Array.isArray(products) ? products : [];
          await saveCatalog(); // persist to localStorage for subsequent loads
        } else {
          CATALOG = [];
        }
      } catch (err) {
        console.warn(`[CAT-LOAD-002] Failed to fetch catalog.json, using empty catalog:`, err);
        CATALOG = [];
      }
    }
    // Ensure every article has a unique id (avoids bugs when two have same name)
    if (ensureCatalogIds()) await saveCatalog();
    // Normalize positions and sort to maintain saved order
    ensurePositions(CATALOG);
    CATALOG = sortByPosition(CATALOG);
    window.CATALOG = CATALOG; // Keep in sync for external access
  } catch (e) {
    console.error(`[CAT-LOAD-003] Error loading catalog:`, e);
    showToast(`❌ [CAT-LOAD-003] Failed to load catalog: ${e.message || 'Unknown error'}`);
    CATALOG = [];
    window.CATALOG = CATALOG;
  }
}

// ERROR CODE: VID-SAVE-001
async function saveVideos() {
  const ERROR_CODE = 'VID-SAVE-001';
  try {
    localStorage.setItem('videos', JSON.stringify(VIDEOS));
    window.VIDEOS = VIDEOS; // Keep in sync for external access
  } catch (e) {
    const errorCode = e.message?.includes('quota') ? 'VID-SAVE-002' : ERROR_CODE;
    console.error(`[${errorCode}] Error saving videos to localStorage:`, e);
    const errorMsg = e.message?.includes('quota')
      ? `[${errorCode}] Storage quota exceeded. Too many videos. Please delete some or use a server.`
      : `[${errorCode}] Failed to save videos: ${e.message || 'Unknown error'}`;
    showToast(`❌ ${errorMsg}`);
  }
}

// ERROR CODE: VID-LOAD-001
/**
 * Load stories/videos from Firestore Database or localStorage fallback
 * 
 * Firestore Collection: "articles" with section: "story"
 * Fields: title, videoUrl, createdAt
 */
async function loadVideos() {
  const ERROR_CODE = 'VID-LOAD-001';
  const logPrefix = '[loadVideos]';

  // If Firebase is not configured, use localStorage fallback
  if (!db) {
    console.warn(`${logPrefix} ⚠️ Firebase not configured, loading from localStorage`);
    return await loadVideosFromLocalStorage();
  }

  try {
    console.log(`${logPrefix} 📥 Loading stories from Firestore...`);

    // Fetch all stories from Firestore, ordered by creation date (newest first)
    // Stories are stored in "articles" collection with section: "story"
    const q = query(
      collection(db, "articles"),
      where("section", "==", "story"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    const stories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Map Firestore data to VIDEOS format (for compatibility with existing code)
    VIDEOS = stories.map(story => ({
      id: story.id,
      title: story.title || '',
      video: story.videoUrl || story.video_url || '',
      video_url: story.videoUrl || story.video_url || '',
      thumb_url: story.thumbUrl || story.thumb_url || null,
      status: story.status || 'active',
      hidden: !!story.hidden,
      date: story.createdAt && story.createdAt.toDate ? story.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    }));

    console.log(`${logPrefix} ✅ Loaded ${VIDEOS.length} stories from Firestore`);
    window.VIDEOS = VIDEOS; // Keep in sync for external access
  } catch (e) {
    console.error(`[${ERROR_CODE}] Error loading videos:`, e);
    console.warn(`[${ERROR_CODE}] Falling back to localStorage`);
    return await loadVideosFromLocalStorage();
  }
}

/**
 * Fallback: Load videos from localStorage
 */
async function loadVideosFromLocalStorage() {
  const ERROR_CODE = 'VID-LOAD-001';
  const logPrefix = '[loadVideosFromLocalStorage]';

  try {
    const storedVideos = localStorage.getItem('videos');
    if (storedVideos) {
      VIDEOS = JSON.parse(storedVideos);
      console.log(`${logPrefix} ✅ Loaded ${VIDEOS.length} videos from localStorage`);
    } else {
      // If not stored, initialize from static CONFIG if available (sample videos)
      VIDEOS = Array.isArray(CONFIG.VIDEOS) ? CONFIG.VIDEOS.slice() : [];
      console.log(`${logPrefix} ℹ️ No videos in localStorage, using CONFIG defaults`);
    }
    if (ensureVideoIds()) await saveVideos();
    window.VIDEOS = VIDEOS; // Keep in sync for external access
  } catch (e) {
    console.error(`[${ERROR_CODE}] Error loading videos:`, e);
    showToast(`❌ [${ERROR_CODE}] Failed to load videos: ${e.message || 'Unknown error'}`);
    VIDEOS = [];
    window.VIDEOS = VIDEOS;
  }
}


function isArabicText(str) {
  return /[\u0600-\u06FF]/.test(str || '');
}

// Normalize Arabic + Emoji text so the emoji stays visually on the left
function normalizeEmojiLeftForArabic(root = document) {
  const emojiRe = /\p{Extended_Pictographic}/u;
  const targets = root.querySelectorAll([
    'h1', 'h2', 'h3',
    'button', 'label',
    '.pill', '.badge', '.chip', '.muted', '.colors-title',
    '.section h2',
  ].join(','));
  targets.forEach(el => {
    const t = el.textContent || '';
    if (!t) return;
    if (!isArabicText(t)) return;
    if (!emojiRe.test(t)) return;
    if (el.querySelector('.emoji-left')) return;
    const m = t.match(emojiRe);
    const em = m ? m[0] : '';
    const rest = t.replace(em, '').trim();
    // Special-case: labels often include inputs; replace only text nodes
    if (el.tagName && el.tagName.toLowerCase() === 'label' && el.children && el.children.length > 0) {
      const textNodes = [];
      el.childNodes.forEach(node => { if (node.nodeType === 3 && node.textContent.trim()) textNodes.push(node); });
      textNodes.forEach(node => el.removeChild(node));
      const span = document.createElement('span');
      span.className = 'emoji-left';
      span.innerHTML = `<span class="emoji">${em}</span><span class="txt">${rest}</span>`;
      el.appendChild(span);
      return;
    }
    if (el.children && el.children.length > 0) return; // avoid altering other elements with nested controls
    el.innerHTML = `<span class="emoji-left"><span class="emoji">${em}</span><span class="txt">${rest}</span></span>`;
  });
}

// Apply on initial load and watch for dynamic UI insertions
document.addEventListener('DOMContentLoaded', async () => {
  try {
    normalizeEmojiLeftForArabic(document);

    // Load ticker phrases from JSON
    await loadTickerPhrases();
    updateNewsTicker();
  } catch (e) {
    console.error('DOMContentLoaded handler failed:', e);
    try { showToast('خطأ عند تحميل الصفحة — تحقق من الكونسول'); } catch (err) { }
  }
  // Start auto-reloading phrases (HTTP mode only)
  if (ENABLE_TICKER_AUTO_RELOAD && (location.protocol === 'http:' || location.protocol === 'https:') && !TICKER_RELOAD_TIMER) {
    TICKER_RELOAD_TIMER = setInterval(async () => {
      const before = TICKER_PHRASES;
      await loadTickerPhrases();
      if (!phrasesEqual(before, TICKER_PHRASES)) {
        console.log('🔄 Ticker phrases updated, refreshing ticker');
        updateNewsTicker();
      }
    }, 5000); // every 5s
  }

  // Detect mode and log
  const currentOrigin = window.location.origin;
  if (window.location.protocol === 'file:') {
    console.log('💾 STANDALONE MODE: Images will be stored in localStorage');
    console.log('ℹ️ For server mode with persistent storage, run: node server.js');
  } else {
    console.log('🌐 SERVER MODE: Origin detected:', currentOrigin);
    console.log('📡 Upload endpoint:', `${currentOrigin}/upload`);
    console.log('ℹ️ Will fallback to localStorage if server is unreachable');
  }

  // Quick manual refresh: double-click the ticker to reload phrases
  const tickerEl = document.getElementById('newsTicker');
  tickerEl?.addEventListener('dblclick', async () => {
    await loadTickerPhrases();
    updateNewsTicker();
    try { showToast('🔄 تم تحديث شريط الأخبار'); } catch { }
  });

  // Real visitor count (index.html only, once per device per day)
  initVisitorCounter();
});
const emojiObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (!m.addedNodes) continue;
    m.addedNodes.forEach(node => {
      if (node && node.nodeType === 1) normalizeEmojiLeftForArabic(node);
    });
  }
});
emojiObserver.observe(document.body, { childList: true, subtree: true });

function round2(n) { return Math.round(n * 100) / 100; }

function isoToLocalInputValue(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function localInputValueToIso(localValue) {
  if (!localValue) return null;
  const parsed = new Date(localValue);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function ensureDiscountTimerValue(item, hours = 24) {
  if (!item) return null;
  if (item.ends) return item.ends;
  const defaultEnd = new Date(Date.now() + hours * 60 * 60 * 1000);
  const iso = defaultEnd.toISOString();
  item.ends = iso;
  return iso;
}

function clearDiscountTimerValue(item) {
  if (!item) return;
  item.ends = null;
}
function resetDiscountPricing(item) {
  if (!item) return;
  // Restore original price from 'was' field if available
  if (isFinite(item.was) && item.was > 0) {
    item.price = round2(item.was);
  }
  // Clear discount-related fields
  item.was = 0;
  clearDiscountTimerValue(item); // This clears item.ends
}
function applySale(item, pct) {
  item.status = 'discount';
  ensureDiscountTimerValue(item);
  // garder le "was" d'origine si déjà en promo, sinon figer le prix courant
  if (!item.was || (item.price > 0 && item.price >= item.was)) item.was = item.price;
  const base = item.was > 0 ? item.was : item.price;
  item.price = round2(base * (1 - pct / 100));
}

function genderEmoji(g) { return g === 'm' ? '👨' : '👗'; }
function renderTitleEmoji(title, gender) {
  const cls = isArabicText(title) ? 'ar' : 'fr';
  const t = cleanTitle(title);
  const em = genderEmoji(gender);
  return `<span class="title-emoji ${cls}"><span class="txt">${t}</span><span class="emoji">${em}</span></span>`;
}

// Get media source: handles both server paths and localStorage keys (images & videos)
// ERROR CODE: IMG-SRC-001
// Get image source: handles folder-organized keys and all storage types
/**
 * Get image source URL from storage key or URL
 * 
 * This function handles multiple image storage formats:
 * - Firebase Storage URLs (https://*.firebasestorage.googleapis.com/...): Returns as-is
 * - HTTP/HTTPS URLs: Returns as-is (for Cloudinary, Firebase, etc.)
 * - Data URLs: Returns as-is
 * - localStorage keys (img_*): Retrieves data URL from localStorage (legacy/fallback)
 * - IndexedDB keys (idb:*): Returns placeholder (legacy/fallback)
 * 
 * @param {string} imgPath - Image path/key/URL
 * @returns {string} - Image source URL or data URL
 */
function getImageSrc(imgPath) {
  if (!imgPath) return '';
  // Si c'est une URL absolue (http ou https), on la retourne telle quelle
  if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
    return imgPath;
  }
  // Si c'est une clé R2 (ex: today/123.jpg) et que R2_PUBLIC_URL est défini, on construit l'URL
  if (typeof window.R2_PUBLIC_URL !== 'undefined' && window.R2_PUBLIC_URL) {
    return window.R2_PUBLIC_URL + '/' + imgPath;
  }
  // Gestion des anciens stockages locaux
  if (imgPath.startsWith('img_') || imgPath.startsWith('images_')) {
    const dataUrl = localStorage.getItem(imgPath);
    if (dataUrl) return dataUrl;
  }
  if (imgPath.startsWith('idb:')) {
    // Placeholder pour IndexedDB, le chargement se fait via loadIndexedDBImage
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
  return imgPath;
}

// Cloudinary image optimization helper (from solu.txt)
// Automatically optimizes Cloudinary images for better performance
function getOptimizedImageUrl(cloudinaryUrl, options = {}) {
  if (!cloudinaryUrl || !cloudinaryUrl.includes('cloudinary')) {
    return cloudinaryUrl; // Not a Cloudinary URL, return as-is
  }

  const { width = 800, height = 800, quality = 'auto' } = options;

  // Insert Cloudinary transformations for optimal loading
  const urlParts = cloudinaryUrl.split('/upload/');
  if (urlParts.length === 2) {
    // Add transformations: width, height, crop, quality, format auto
    const transformations = `w_${width},h_${height},c_fill,q_${quality},f_auto`;
    return `${urlParts[0]}/upload/${transformations}/${urlParts[1]}`;
  }

  return cloudinaryUrl; // Return original if can't parse
}

// Load IndexedDB image and update image element
// ERROR CODE: IDB-IMG-LOAD-001
async function loadIndexedDBImage(imageElement, imagePath) {
  const ERROR_CODE = 'IDB-IMG-LOAD-001';
  const logPrefix = `[loadIndexedDBImage:${ERROR_CODE}]`;
  if (!imagePath || !imagePath.startsWith('idb:')) return;

  try {
    console.log(`${logPrefix} 🔄 START: Loading image ${imagePath}`);
    const imageId = imagePath.substring(4); // Remove 'idb:' prefix
    const dataUrl = await getImageFromIndexedDB(imageId);
    if (dataUrl && imageElement) {
      imageElement.src = dataUrl;
      console.log(`${logPrefix} ✅ Image loaded successfully: ${imageId}`);
    } else {
      console.warn(`${logPrefix} ⚠️ Image not found or element missing: ${imageId}`);
    }
  } catch (err) {
    console.error(`${logPrefix} ❌ Failed to load image:`, err);
  }
}

// Load IndexedDB video and update video element
// ERROR CODE: IDB-LOAD-001
async function loadIndexedDBVideo(videoElement, videoPath) {
  const ERROR_CODE = 'IDB-LOAD-001';
  const logPrefix = `[loadIndexedDBVideo:${ERROR_CODE}]`;
  if (!videoPath || !videoPath.startsWith('idb:')) return;

  try {
    console.log(`${logPrefix} 🔄 START: Loading video ${videoPath}`);
    const videoId = videoPath.substring(4); // Remove 'idb:' prefix
    const dataUrl = await getVideoFromIndexedDB(videoId);
    if (dataUrl && videoElement) {
      videoElement.src = dataUrl;
      videoElement.load();
      console.log(`${logPrefix} ✅ Video loaded successfully: ${videoId}`);
    } else {
      console.warn(`${logPrefix} ⚠️ Video not found or element missing: ${videoId}`);
    }
  } catch (err) {
    console.error(`${logPrefix} ❌ Failed to load video:`, err);
  }
}

function formatCompactDate(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('ar-TN', { day: 'numeric', month: 'short' });
    }
  } catch (e) {
  }
  return String(value);
}

function truncateText(text, maxLength = 60) {
  const clean = String(text || '').trim();
  if (!clean) return '';
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

function compactCard(item) {
  const hasImg = item.img?.trim();
  const hasVideo = item.video?.trim();
  const videoPath = hasVideo ? item.video.trim() : '';
  const videoSrc = hasVideo ? getImageSrc(videoPath) : '';
  const isVideoIndexedDB = hasVideo && videoPath.startsWith('idb:');
  const dateLabel = formatCompactDate(item.date);
  const statusLabel = label(item.status);
  const metaParts = [];
  if (dateLabel) metaParts.push(`📅 ${escapeHtml(dateLabel)}`);
  if (statusLabel) metaParts.push(escapeHtml(statusLabel));
  const metaText = metaParts.join(' • ');
  const excerpt = truncateText(item.note || item.cat || '');
  const mediaHtml = hasVideo
    ? `<video ${isVideoIndexedDB ? `data-video-path="${escapeAttr(videoPath)}"` : `src="${escapeAttr(videoSrc)}"`} preload="metadata" muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:12px;"></video>`
    : hasImg
      ? `<img src="${getImageSrc(item.img)}" ${item.img.startsWith('idb:') ? `data-image-path="${escapeAttr(item.img)}"` : ''} loading="lazy" decoding="async" alt="${escapeAttr(item.title || 'Product image')}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;display:block;" onerror="this.style.display='none'" />`
      : `<div class="compact-placeholder">🧺</div>`;

  const idBadge = READ_ONLY_MODE ? '' : `<span class="article-id-badge" title="معرّف المنتج">${escapeAttr(item.id || '')}</span>`;
  return `
        <article class="card compact-card" data-id="${item.id}" data-status="${item.status}">
          ${idBadge}
          <div class="compact-thumb img ${hasImg || hasVideo ? 'has-photo' : ''}" role="img" aria-label="${escapeAttr(item.title || 'Product media')}" data-article-title="${escapeAttr(item.title || '')}">
            <div class="img-frame">
              ${mediaHtml}
            </div>
          </div>
          <div class="compact-body">
            <h3 class="title">${renderTitleEmoji(item.title, item.gender)}</h3>
            ${metaText ? `<div class="compact-meta">${metaText}</div>` : ''}
            ${excerpt ? `<div class="compact-excerpt">${escapeHtml(excerpt)}</div>` : ''}
          </div>
        </article>
      `;
}

/** Showcase tile card: image + floating price badge + name. Used by todayListStep2Grid. */
function articleGridCard(item) {
  const hasImg = item.img?.trim();
  const imgSrc = hasImg ? getImageSrc(item.img) : '';
  const imgAttr = hasImg && item.img.startsWith('idb:') ? ` data-image-path="${escapeAttr(item.img)}"` : '';
  const mediaHtml = hasImg
    ? `<img src="${imgSrc}"${imgAttr} loading="lazy" decoding="async" alt="${escapeAttr(item.title || '')}" onerror="this.style.display='none'" />`
    : '<div class="product-tile__empty" aria-hidden="true">📦</div>';
  const title = renderTitleEmoji(item.title, item.gender);
  const price = fmtPrice(item.price);
  const idBadge = READ_ONLY_MODE ? '' : `<span class="article-id-badge" title="معرّف المنتج">${escapeAttr(item.id || '')}</span>`;
  return `
        <article class="card product-tile" data-id="${item.id}" data-status="${item.status}" role="listitem">
          ${idBadge}
          <div class="product-tile__frame">
            <div class="product-tile__badge">${escapeHtml(price)}</div>
            ${mediaHtml}
          </div>
          <div class="product-tile__details">
            <h3 class="product-tile__name">${title}</h3>
          </div>
        </article>
      `;
}

function card(item) {
  const hasImg = item.img?.trim();
  const hasVideo = item.video?.trim();
  const videoPath = hasVideo ? item.video.trim() : '';
  const videoSrc = hasVideo ? getImageSrc(videoPath) : '';
  const isVideoIndexedDB = hasVideo && videoPath.startsWith('idb:');
  const pct = item.was > 0 ? Math.round((1 - item.price / item.was) * 100) : 0;
  const saleMeta = item.status === "discount" ?
    `<span class="chip">قبل: ${fmtPrice(item.was)}</span><span class="chip trend down">-${pct}%</span>` : "";
  // Ultra-advanced timer for discount items - positioned at top of card
  const advancedTimer = (item.status === "discount" && item.ends) ?
    `<div class="ultra-countdown-timer" data-countdown-end="${item.ends}">${getAdvancedCountdownTimer(item.ends)}</div>` : "";
  const ends = ""; // Removed old timer from row

  const iconType = item.status === 'discount' ? '٪' : '★';
  const iconClass = item.status === 'discount' ? 'icon-sale' : 'icon-new';
  const statusLabel = label(item.status);

  const quickActionButton = READ_ONLY_MODE ? '' : `
     <button type="button" class="quick-action-btn left" aria-label="إعدادات سريعة للمنتج" onclick="event.stopPropagation(); window.openQuickSettingsPanel(window.CATALOG.find(x => x.id === '${item.id}'))" style="background:#0ea5e9;color:#052e17;border:none;border-radius:999px;padding:8px 12px;font-weight:700;cursor:pointer">
       ⚡ إعدادات سريعة
     </button>
     <button type="button" class="quick-action-btn right" aria-label="${item.hidden ? 'إظهار المنتج' : 'إخفاء المنتج'}" onclick="event.stopPropagation(); ${item.hidden ? `window.unhideItemDirect('${escapeAttr(item.id)}')` : `window.hideItemDirect('${escapeAttr(item.id)}')`}" style="background:${item.hidden ? '#22c55e' : '#334155'};color:#f8fafc;border:none;border-radius:999px;padding:8px 12px;font-weight:700;cursor:pointer">
       ${item.hidden ? '👀 إظهار' : '🙈 إخفاء'}
     </button>
       `;
  const idBadge = READ_ONLY_MODE ? '' : `<span class="article-id-badge" title="معرّف المنتج">${escapeAttr(item.id || '')}</span>`;
  return `
        <article class="card" data-id="${item.id}" data-status="${item.status}">
        ${idBadge}
        ${READ_ONLY_MODE ? '' : `<button type="button" class="delete-btn" aria-label="Delete this item" title="Delete" onclick="event.stopPropagation(); window.deleteItemDirect('${escapeAttr(item.id)}')">×</button>`}
        ${advancedTimer}
      <div class="img ${hasImg || hasVideo ? 'has-photo' : ''}" role="img" aria-label="${escapeAttr(item.title || 'Product media')}" data-article-title="${escapeAttr(item.title || '')}">
            ${quickActionButton}
            <div class="img-frame">
          ${hasVideo
      ? `<video ${isVideoIndexedDB ? `data-video-path="${escapeAttr(videoPath)}"` : `src="${escapeAttr(videoSrc)}"`} controls preload="metadata" playsinline webkit-playsinline style="width:100%;height:100%;object-fit:cover;border-radius:8px;"></video>`
      : hasImg
        ? `<img src="${getImageSrc(item.img)}" ${item.img.startsWith('idb:') ? `data-image-path="${escapeAttr(item.img)}"` : ''} loading="lazy" decoding="async" alt="${escapeAttr(item.title || 'Product image')}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:block;" onerror="this.style.display='none'" />`
        : ''
    }
            </div>
            <div class="price-block" dir="rtl">
              <div class="now">${fmtPrice(item.price)}</div>
              ${item.was > item.price ? `
                <div class="was">${fmtPrice(item.was)}</div>
                <div class="pct">-${Math.round((1 - item.price / item.was) * 100)}%</div>
              ` : ``}
            </div>
          </div>
          <div class="content">
            <div class="card-header">
              <span class="icon-badge ${iconClass}" aria-label="${statusLabel}" title="${statusLabel}">${iconType}</span>
              <div class="title-area">
                <h3 class="title">${renderTitleEmoji(item.title, item.gender)}</h3>
              </div>
            </div>
            ${ends}
            ${hasVideo ? `<span class="chip">🎥 فيديو</span>` : ""}
            ${(item.sizes?.length || item.colors?.length) ? `
              <div class="variants-box" aria-label="خيارات المنتج">
                ${item.sizes?.length ? `
                  <div class="variant-line">
                    <span class="variant-label">المقاسات:</span>
                    <span class="sizes-text">${summarizeSizesForDisplay(item.sizes)}</span>
                  </div>
                ` : ``}
                ${item.colors?.length ? `
                  <div class="variant-line">
                    <span class="variant-label">الألوان:</span>
                    <div class="colors-swatches" role="listbox">
                      ${item.colors.map(c => {
      const hex = resolveColorCode(c);
      return `<button type="button" class="color-swatch" style="--swatch:${hex}" role="option" aria-selected="false" aria-label="Select color: ${escapeAttr(c)}" title="${escapeAttr(c)}" data-color-name="${escapeAttr(c)}" onclick="selectItemColor(event, '${item.id}', '${c.replace(/'/g, "\\'")}')"></button>`
    }).join('')}
                    </div>
                    <div class="color-msg" data-color-msg aria-live="polite" hidden></div>
                  </div>
                ` : ``}
              </div>
            ` : ``}
            ${item.note ? `<div class="muted">${item.note}</div>` : ""}
          </div>
          <!-- Admin checklist removed to avoid duplicated title/price/status -->
          ${READ_ONLY_MODE ? '' : `<div class="footer">
            <span class="muted">${item.date || ""}</span>
          </div>`}
        </article>
      `;
}

function renderVideoCard(video, index = 0) {
  if (!video) return '';
  const rawTitle = (video.title && String(video.title).trim()) || `Video ${index + 1}`;
  const safeTitleHtml = escapeHtml(rawTitle);
  const safeTitleAttr = escapeAttr(rawTitle);
  const videoPath = typeof video.video === 'string' ? video.video.trim() : '';
  const videoSrc = videoPath ? getImageSrc(videoPath) : '';
  const isIndexedDB = videoPath && videoPath.startsWith('idb:');
  const hasVideo = !!(videoPath && (videoSrc || isIndexedDB));
  const videoId = video.id || `video_${index}`;
  const videoIdBadge = READ_ONLY_MODE ? '' : `<span class="article-id-badge video-id-badge" title="معرّف الستوري">${escapeAttr(videoId)}</span>`;

  // Use same icon structure as products
  const iconType = '🎥';
  const iconClass = 'icon-new';
  const statusLabel = 'Video';

  const quickActionButton = READ_ONLY_MODE ? '' : `
     <button type="button" class="quick-action-btn left" aria-label="إعدادات سريعة للستوري" onclick="event.stopPropagation(); window.openQuickVideoPanel(window.VIDEOS[` + index + `], ` + index + `)" style="background:#0ea5e9;color:#052e17;border:none;border-radius:999px;padding:8px 12px;font-weight:700;cursor:pointer">
           ⚡ إعدادات سريعة
         </button>
     <button type="button" class="quick-action-btn right" aria-label="${video.hidden ? 'إظهار الستوري' : 'إخفاء الستوري'}" onclick="event.stopPropagation(); ${video.hidden ? `window.unhideVideoDirect('${escapeAttr(videoId)}')` : `window.hideVideoDirect(${index})`}" style="background:${video.hidden ? '#22c55e' : '#334155'};color:#f8fafc;border:none;border-radius:999px;padding:8px 12px;font-weight:700;cursor:pointer">
       ${video.hidden ? '👀 إظهار' : '🙈 إخفاء'}
     </button>
       `;

  const thumbInner = hasVideo
    ? `<video ${isIndexedDB ? `data-video-path="${escapeAttr(videoPath)}"` : `src="${escapeAttr(videoSrc)}"`} controls preload="metadata" playsinline webkit-playsinline style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;"></video>`
    : `<div class="img-frame" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, rgba(14,165,233,0.25), rgba(56,189,248,0.4));color:#f8fafc;font-weight:800;font-size:1.5rem;">${escapeHtml(rawTitle.slice(0, 2) || 'ST')}</div>`;

  // Get date if available (similar to products)
  const videoDate = video.date || '';

  return `
        <article class="card" data-video-id="${escapeAttr(videoId)}" data-video-index="${index}" data-status="today">
          ${videoIdBadge}
          ${READ_ONLY_MODE ? '' : `<button type="button" class="delete-btn" aria-label="Delete this video" title="Delete" onclick="event.stopPropagation(); window.deleteVideoDirect(${index})">×</button>`}
          <div class="img ${hasVideo ? 'has-photo' : ''}" role="img" aria-label="${safeTitleAttr}">
            ${quickActionButton}
            <div class="img-frame">
              ${thumbInner}
            </div>
          </div>
          <div class="content">
            <div class="card-header">
              <span class="icon-badge ${iconClass}" aria-label="${statusLabel}" title="${statusLabel}">${iconType}</span>
              <div class="title-area">
                <h3 class="title">${safeTitleHtml}</h3>
              </div>
            </div>
            <div class="row">
              <span class="chip">🎥 فيديو</span>
            </div>
          </div>
          ${READ_ONLY_MODE ? '' : `<div class="footer">
            <span class="muted">${videoDate}</span>
          </div>`}
        </article>
      `;
}

// ERROR CODE: RENDER-VID-001
function renderVideos() {
  const ERROR_CODE = 'RENDER-VID-001';
  try {
    const titleEl = document.getElementById('videosTitle');
    if (titleEl) {
      titleEl.textContent = CONFIG.VIDEOS_TITLE || '🎥 ستوري اليوم';
    }
    const grid = document.getElementById('videosGrid');
    if (!grid) {
      console.warn(`[${ERROR_CODE}] videosGrid element not found`);
      return;
    }
    const videos = Array.isArray(VIDEOS) ? VIDEOS.filter(v => v && !v.hidden) : [];
    if (!videos.length) {
      grid.innerHTML = `<p class="muted">لا توجد ستوريات اليوم.</p>`;
      normalizeEmojiLeftForArabic(grid);
      return;
    }
    grid.innerHTML = videos.map((video, idx) => renderVideoCard(video, idx)).join('');
    normalizeEmojiLeftForArabic(grid);
    // Load IndexedDB videos asynchronously
    setTimeout(() => {
      grid.querySelectorAll('video[data-video-path]').forEach(async (videoEl) => {
        const videoPath = videoEl.getAttribute('data-video-path');
        if (videoPath && videoPath.startsWith('idb:')) {
          await loadIndexedDBVideo(videoEl, videoPath);
        }
      });
    }, 100);
    console.log(`[${ERROR_CODE}] Rendered ${videos.length} videos`);
  } catch (e) {
    console.error(`[RENDER-VID-002] Error rendering videos:`, e);
    const grid = document.getElementById('videosGrid');
    if (grid) {
      grid.innerHTML = `<p class="muted">❌ [RENDER-VID-002] خطأ في عرض الستوريات</p>`;
    }
  }
}

// Render hidden items (products + videos)
function renderHiddenSection() {
  // In read-only mode, don't render hidden section at all
  if (READ_ONLY_MODE) return;

  const section = document.getElementById('hiddenSection');
  if (!section) return;
  const hiddenProducts = CATALOG.filter(p => p.hidden);
  const hiddenVideos = VIDEOS.filter(v => v.hidden);
  const empty = (!hiddenProducts.length && !hiddenVideos.length);
  section.style.display = empty ? 'none' : 'block';
  const emptyEl = document.getElementById('hiddenEmpty');
  if (emptyEl) emptyEl.style.display = empty ? 'block' : 'none';

  const productsEl = document.getElementById('hiddenProducts');
  if (productsEl) {
    productsEl.innerHTML = hiddenProducts.map(item => {
      const media = item.video
        ? `<video ${item.video.startsWith('idb:') ? `data-video-path="${escapeAttr(item.video)}"` : `src="${escapeAttr(getImageSrc(item.video))}"`} controls preload="metadata" playsinline style="width:100%;border-radius:10px;border:1px solid var(--line);background:#0a162c;"></video>`
        : item.img
          ? `<img src="${getImageSrc(item.img)}" ${item.img.startsWith('idb:') ? `data-image-path="${escapeAttr(item.img)}"` : ''} style="width:100%;border-radius:10px;border:1px solid var(--line);object-fit:cover;background:#0a162c;">`
          : `<div class="muted" style="padding:12px;border:1px dashed var(--line);border-radius:10px">لا صورة</div>`;
      const hiddenIdBadge = READ_ONLY_MODE ? '' : `<span class="article-id-badge" title="معرّف المنتج">${escapeAttr(item.id || '')}</span>`;
      return `
        <article class="card" data-id="${escapeAttr(item.id)}" data-status="${item.status}">
          ${hiddenIdBadge}
          <div class="img has-photo">
            <div class="img-frame">${media}</div>
          </div>
          <div class="content">
            <div class="card-header">
              <h3 class="title">${renderTitleEmoji(item.title, item.gender)}</h3>
            </div>
            <span class="chip">${getStatusText(item.status, 0).ar}</span>
            <span class="chip muted">مخفي</span>
          </div>
          <div class="footer" style="display:flex;gap:8px;flex-wrap:wrap">
            ${READ_ONLY_MODE ? '' : `<button type="button" class="btn" style="background:#22c55e;color:#052e17;border:none" onclick="window.unhideItemDirect('${escapeAttr(item.id)}')">👀 إظهار</button>`}
          </div>
        </article>
      `;
    }).join('') || '';
  }

  const videosEl = document.getElementById('hiddenVideos');
  if (videosEl) {
    videosEl.innerHTML = hiddenVideos.map(video => {
      const media = video.video
        ? `<video ${video.video.startsWith('idb:') ? `data-video-path="${escapeAttr(video.video)}"` : `src="${escapeAttr(getImageSrc(video.video))}"`} controls preload="metadata" playsinline style="width:100%;border-radius:10px;border:1px solid var(--line);background:#0a162c;"></video>`
        : `<div class="muted" style="padding:12px;border:1px dashed var(--line);border-radius:10px">لا فيديو</div>`;
      const hiddenVideoIdBadge = READ_ONLY_MODE ? '' : `<span class="article-id-badge video-id-badge" title="معرّف الستوري">${escapeAttr(video.id || '')}</span>`;
      return `
        <article class="card" data-video-id="${escapeAttr(video.id || '')}">
          ${hiddenVideoIdBadge}
          <div class="img has-photo">
            <div class="img-frame">${media}</div>
          </div>
          <div class="content">
            <div class="card-header">
              <h3 class="title">${escapeHtml(video.title || 'ستوري')}</h3>
            </div>
            <span class="chip">🎥 ستوري</span>
            <span class="chip muted">مخفي</span>
          </div>
          <div class="footer" style="display:flex;gap:8px;flex-wrap:wrap">
            ${READ_ONLY_MODE ? '' : `<button type="button" class="btn" style="background:#22c55e;color:#052e17;border:none" onclick="window.unhideVideoDirect('${escapeAttr(video.id || '')}')">👀 إظهار</button>`}
          </div>
        </article>
      `;
    }).join('') || '';
  }

  // Load IndexedDB media for hidden section
  setTimeout(() => {
    section.querySelectorAll('img[data-image-path]').forEach(imgEl => {
      const p = imgEl.getAttribute('data-image-path');
      if (p && p.startsWith('idb:')) loadIndexedDBImage(imgEl, p);
    });
    section.querySelectorAll('video[data-video-path]').forEach(videoEl => {
      const p = videoEl.getAttribute('data-video-path');
      if (p && p.startsWith('idb:')) loadIndexedDBVideo(videoEl, p);
    });
  }, 50);
}

// Center clicked Sale card within the horizontal scroller
function setupSaleGridCentering() {
  const container = document.getElementById('saleGrid');
  if (!container || container.dataset.centeringApplied === 'true') return;
  container.addEventListener('click', (e) => {
    const card = e.target.closest('article.card');
    if (!card || !container.contains(card)) return;
    if (container.classList.contains('sale-carousel') || container.classList.contains('h-scroll')) {
      const left = card.offsetLeft;
      const target = Math.max(0, left - (container.clientWidth / 2) + (card.clientWidth / 2));
      container.scrollLeft = target; // direct positioning (no smooth) per request
    } else {
      card.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  });
  container.dataset.centeringApplied = 'true';
}

// Debounced render to prevent ticker flicker
let renderTimer = null;
function render() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(_doRender, 50);
}

function _doRender() {
  const now = new Date();

  // Update config-driven header elements
  $("#brand").textContent = CONFIG.BRAND;
  const taglineEl = $("#heroTagline");
  if (taglineEl && CONFIG.HEADER_TAGLINE) {
    taglineEl.textContent = CONFIG.HEADER_TAGLINE;
  }
  const followTop = $("#followMainTop");
  if (followTop) followTop.href = CONFIG.FOLLOW_MAIN;
  const dateEl = $("#currentDate");
  if (dateEl) dateEl.textContent = headerDateFormatter.format(now);

  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = now.getFullYear();

  applyFooterSettings();

  // Update social media links safely
  const followMain = $("#followMain");
  if (followMain) followMain.href = CONFIG.FOLLOW_MAIN;

  const fbBtn = $("#fb");
  if (fbBtn && CONFIG.FOLLOW_MAIN) fbBtn.href = CONFIG.FOLLOW_MAIN;

  const igBtn = $("#ig");
  if (igBtn && CONFIG.IG) igBtn.href = CONFIG.IG;

  const ttBtn = $("#tt");
  if (ttBtn && CONFIG.TT) ttBtn.href = CONFIG.TT;

  // Detect product changes and generate notifications
  detectProductChanges();

  // Filter items by status
  normalizeCatalogPricing();
  const today = getSortedItems(CATALOG.filter(x => x.status === "today" && !x.hidden), 'today');
  const sale = getSortedItems(CATALOG.filter(x => x.status === "discount" && !x.hidden), 'discount');
  const queryFilteredToday = today.filter(matchesSearch);
  const queryFilteredSale = sale.filter(matchesSearch);

  const todayCountEl = $("#todayCount");
  if (todayCountEl) todayCountEl.textContent = queryFilteredToday.length;
  const saleCountEl = $("#saleCount");
  if (saleCountEl) saleCountEl.textContent = queryFilteredSale.length;

  // Render grids - split articles if more than 4
  // Today section
  const todayFirst4 = queryFilteredToday.slice(0, 4);
  const todayRemaining = queryFilteredToday.slice(4);

  const todayGridEl = $("#todayGrid");
  if (queryFilteredToday.length === 0) {
    todayGridEl.innerHTML = `<p class="muted">لا عناصر اليوم.</p>`;
  } else {
    todayGridEl.innerHTML = todayFirst4.map(card).join("");
  }

  // Today list_step_2 section (Amazon-style article grid: image + name + price only)
  const todayListStep2Section = document.getElementById('todayListStep2');
  const todayListStep2Grid = document.getElementById('todayListStep2Grid');
  if (todayRemaining.length > 0) {
    todayListStep2Section.style.display = 'block';
    if (todayListStep2Grid && todayListStep2Grid.classList.contains('today-article-grid')) {
      todayListStep2Grid.innerHTML = todayRemaining.map(articleGridCard).join("");
    } else if (todayListStep2Grid) {
      todayListStep2Grid.innerHTML = todayRemaining.map(card).join("");
    }
  } else {
    todayListStep2Section.style.display = 'none';
    if (todayListStep2Grid) {
      todayListStep2Grid.innerHTML = '';
    }
  }

  // Sale section
  const saleFirst4 = queryFilteredSale.slice(0, 4);
  const saleRemaining = queryFilteredSale.slice(4);

  const saleGridEl = document.getElementById('saleGrid');
  if (queryFilteredSale.length === 0) {
    saleGridEl.innerHTML = `<div class="sale-empty"><div class="sale-empty-icon">🏷️</div>لا تخفيضات حالياً</div>`;
  } else {
    saleGridEl.innerHTML = saleFirst4.map(card).join("");
  }

  // Sale list_step_2 section
  const saleListStep2Section = document.getElementById('saleListStep2');
  const saleListStep2Grid = document.getElementById('saleListStep2Grid');
  if (saleRemaining.length > 0) {
    saleListStep2Section.style.display = 'block';
    if (saleListStep2Grid) {
      saleListStep2Grid.innerHTML = saleRemaining.map(card).join("");
    }
  } else {
    saleListStep2Section.style.display = 'none';
    if (saleListStep2Grid) {
      saleListStep2Grid.innerHTML = '';
    }
  }

  // Load IndexedDB images asynchronously after cards are rendered
  const allCards = document.querySelectorAll('.card img[data-image-path]');
  allCards.forEach(imgEl => {
    const imagePath = imgEl.getAttribute('data-image-path');
    if (imagePath && imagePath.startsWith('idb:')) {
      loadIndexedDBImage(imgEl, imagePath);
    }
  });

  // Load IndexedDB videos for product cards
  const productVideos = document.querySelectorAll('.card video[data-video-path]');
  productVideos.forEach(videoEl => {
    const videoPath = videoEl.getAttribute('data-video-path');
    if (videoPath && videoPath.startsWith('idb:')) {
      loadIndexedDBVideo(videoEl, videoPath);
    }
  });

  // Enable click-to-center behavior on Sale scroller
  setupSaleGridCentering();

  try { renderVideos(); } catch (e) { console.error('[RENDER-VID-003] renderVideos error:', e); }

  try { renderHiddenSection(); } catch (e) { console.error('[RENDER-HIDDEN] renderHiddenSection error:', e); }

  // Update news ticker
  try { updateNewsTicker(); } catch (e) { console.error('updateNewsTicker error:', e); }

  // Update countdown timers
  try { updateCountdownTimers(); } catch (e) { console.error('updateCountdownTimers error:', e); }

  // Ensure emoji placement for Arabic text across UI
  normalizeEmojiLeftForArabic(document);
}

// Helper: wrap title with styled span for ticker
function wrapTickerTitle(text, title) {
  const isArabic = /[\u0600-\u06FF]/.test(title);
  const langClass = isArabic ? 'ar' : 'fr';
  const wrapped = `<span class="ticker-title ${langClass}">${title}</span>`;
  return text.replace('{title}', wrapped);
}

function updateNewsTicker() {
  const newsTicker = document.getElementById('newsTicker');
  if (!newsTicker) {
    console.warn('⚠️ Ticker element not found, will retry...');
    setTimeout(updateNewsTicker, 100);
    return;
  }
  if (!TICKER_PHRASES) {
    console.warn('⚠️ Ticker phrases not loaded yet');
    return;
  }
  const phrases = normalizeTickerPhrases(TICKER_PHRASES);
  try {
    const { todayPhrases, discountPhrases, emptyMessage, statusEmojis } = phrases;

    // Filter only 'today' and 'discount' items from last 7 days (exclude hidden items)
    const recentItems = CATALOG.filter(item => {
      if (item.hidden) return false; // Don't show hidden items in ticker
      if (item.status !== 'today' && item.status !== 'discount') return false;
      if (!shouldShowInTicker(item)) return false;
      const days = Number(item.tickerDays) || 7;
      const startMs = item.tickerStart ? new Date(item.tickerStart).getTime() : (item.date ? new Date(item.date).getTime() : NaN);
      if (!Number.isFinite(startMs)) return false;
      const cutoff = Date.now() - (days * 86400000);
      return startMs >= cutoff;
    }).slice(0, 8);

    // Create welcome message HTML (repeated multiple times to make it longer and more visible)
    // Repeat the welcome message 5 times to create a longer welcome section
    const singleWelcomeHTML = `
          <div class="ticker-item">
            <span>${emptyMessage}</span>
            <span class="emoji">✨</span>
          </div>
        `;
    const welcomeHTML = singleWelcomeHTML.repeat(5);

    // Create articles HTML (shown 2 times per cycle if items exist)
    let articlesHTML = '';
    if (recentItems.length > 0) {
      // Get phrases from loaded JSON
      const statusEmoji = statusEmojis || {};

      // Get current day of year for consistent daily random selection
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);

      recentItems.forEach((item, index) => {
        const emoji = statusEmoji[item.status] || '📦';
        const cleanedTitle = cleanTitle(item.title);

        let message = '';

        if (item.status === 'today') {
          // Pick random phrase based on day + item index
          const phraseIndex = (dayOfYear + index) % todayPhrases.length;
          const template = todayPhrases[phraseIndex];
          message = wrapTickerTitle(template, cleanedTitle);
        } else if (item.status === 'discount') {
          // Calculate discount percentage
          let percent = 0;
          if (item.was && item.was > 0 && item.price >= 0) {
            percent = Math.round((1 - item.price / item.was) * 100);
          }
          // If no 'was' price, try to calculate from existing data
          if (percent === 0 && item.price > 0) {
            // Default to showing at least something
            percent = 20;
          }
          console.log(`[Ticker] ${cleanedTitle}: was=${item.was}, price=${item.price}, percent=${percent}%`);

          // Pick random phrase based on day + item index
          const phraseIndex = (dayOfYear + index) % discountPhrases.length;
          const template = discountPhrases[phraseIndex]
            .replace('{percent}٪', `<span class="ticker-title">${percent}٪</span>`)
            .replace('{percent}%', `<span class="ticker-title">${percent}%</span>`)
            .replace('{percent}', `<span class="ticker-title">${percent}</span>`);
          message = wrapTickerTitle(template, cleanedTitle);
        }

        articlesHTML += `
              <div class="ticker-item ticker-${item.status}">
                <span>${message}</span>
                <span class="emoji">${emoji}</span>
              </div>
            `;
      });
    }

    // Create the pattern: welcome (1x) + articles (2x) + welcome (1x) + articles (2x)...
    // Pattern: welcome → articles → articles → welcome → articles → articles → ...
    let tickerHTML = '';
    if (articlesHTML) {
      // If we have articles, create pattern: welcome + articles + articles (this creates one full cycle)
      // Then repeat this cycle multiple times
      const oneCycle = welcomeHTML + articlesHTML + articlesHTML; // welcome (1x) + articles (2x)
      tickerHTML = oneCycle; // Start with one cycle, will be repeated below
    } else {
      // If no articles, just show welcome message
      tickerHTML = welcomeHTML;
    }

    // Repeat content enough times to fill the screen width
    // This ensures the pattern continues: welcome → articles (2x) → welcome → articles (2x) → ...
    const repeatCount = 10;
    const repeatedContent = tickerHTML ? tickerHTML.repeat(repeatCount) : welcomeHTML.repeat(repeatCount);

    // Only update if we have content (avoid clearing ticker unnecessarily)
    if (repeatedContent) {
      // Create two ticker-content divs for seamless infinite scroll
      newsTicker.innerHTML = `
            <div class="ticker-content">${repeatedContent}</div>
            <div class="ticker-content">${repeatedContent}</div>
          `;
    } else if (!newsTicker.innerHTML.trim()) {
      // Only show empty message if ticker is completely empty
      const fallbackRepeated = welcomeHTML.repeat(repeatCount);
      newsTicker.innerHTML = `
            <div class="ticker-content">${fallbackRepeated}</div>
            <div class="ticker-content">${fallbackRepeated}</div>
          `;
    }
  } catch (err) {
    console.error('❌ Ticker update failed:', err);
    const fallbackMsg = (TICKER_PHRASES && TICKER_PHRASES.emptyMessage) || 'مرحباً';
    newsTicker.innerHTML = `
          <div class="ticker-content">
            <div class="ticker-item"><span>${fallbackMsg}</span><span class="emoji">✨</span></div>
          </div>
          <div class="ticker-content"></div>
        `;
  }
}

function setupThemeToggle() {
  const themeSwitch = document.getElementById('themeSwitch');
  const themeLabel = document.querySelector('.theme-label');
  const switchIcon = document.querySelector('.switch-icon');
  if (!themeSwitch || !themeLabel || !switchIcon) {
    console.warn('Theme switch elements not found; skipping theme toggle setup');
    return;
  }

  // Check for saved theme preference or use preferred color scheme
  const savedTheme = localStorage.getItem('theme');
  const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeSwitch.checked = true;
    themeLabel.textContent = 'الليل';
    switchIcon.textContent = '🌙';
  } else {
    themeLabel.textContent = 'النهار';
    switchIcon.textContent = '☀️';
  }

  // Toggle theme on change
  themeSwitch.addEventListener('change', () => {
    if (themeSwitch.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      themeLabel.textContent = 'الليل';
      switchIcon.textContent = '🌙';
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      themeLabel.textContent = 'النهار';
      switchIcon.textContent = '☀️';
    }
  });

  // Listen for system theme changes (auto mode)
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onMqChange = (e) => {
    const savedTheme = localStorage.getItem('theme');
    if (!savedTheme) { // only update if in auto mode
      if (e.matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeSwitch.checked = true;
        themeLabel.textContent = 'الليل';
        switchIcon.textContent = '🌙';
      } else {
        document.documentElement.removeAttribute('data-theme');
        themeSwitch.checked = false;
        themeLabel.textContent = 'النهار';
        switchIcon.textContent = '☀️';
      }
    }
  };
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onMqChange);
  else if (typeof mq.addListener === 'function') mq.addListener(onMqChange);
}


// Set up Firebase real-time listeners for read-only mode
function setupFirebaseRealtimeListeners() {
  if (!READ_ONLY_MODE || !FIREBASE_ENABLED || !db) {
    return;
  }

  console.log('🔄 Setting up Firebase real-time listeners...');

  // Listen to articles collection (products)
  const articlesRef = collection(db, 'articles');
  const articlesQuery = query(articlesRef, where('section', '==', 'article'));

  onSnapshot(articlesQuery, (snapshot) => {
    console.log('📥 Real-time update: Products changed');
    loadCatalog().then(() => {
      render();
      console.log('✅ Products updated from real-time listener');
    }).catch(err => {
      console.error('❌ Error reloading catalog:', err);
    });
  }, (error) => {
    console.error('❌ Real-time listener error (articles):', error);
  });

  // Listen to stories collection (videos)
  const storiesRef = collection(db, 'articles');
  const storiesQuery = query(storiesRef, where('section', '==', 'story'));

  onSnapshot(storiesQuery, (snapshot) => {
    console.log('📥 Real-time update: Videos changed');
    loadVideos().then(() => {
      render();
      console.log('✅ Videos updated from real-time listener');
    }).catch(err => {
      console.error('❌ Error reloading videos:', err);
    });
  }, (error) => {
    console.error('❌ Real-time listener error (stories):', error);
  });

  console.log('✅ Firebase real-time listeners active');
}

// Disable edit functionality in read-only mode
function disableEditFunctions() {
  if (!READ_ONLY_MODE) return;

  // Override edit functions to do nothing
  window.createQuickActionsMenu = () => { };
  window.createProductEditor = () => { };
  window.createQuickVideoForm = () => { };
  window.openQuickSettingsPanel = () => { };
  window.openQuickVideoPanel = () => { };
  window.deleteItemDirect = () => { };
  window.hideItemDirect = () => { };
  window.unhideItemDirect = () => { };
  window.deleteVideoDirect = () => { };
  window.hideVideoDirect = () => { };
  window.unhideVideoDirect = () => { };
  window.saveCatalog = async () => { };
  window.saveVideos = async () => { };

  // Hide admin buttons
  setTimeout(() => {
    $('#addProductBtn')?.style.setProperty('display', 'none');
    $('#addVideoBtn')?.style.setProperty('display', 'none');
    $('#hideAllArticlesBtn')?.style.setProperty('display', 'none');
    $('#hideAllSaleBtn')?.style.setProperty('display', 'none');
    $('#hideAllVideosBtn')?.style.setProperty('display', 'none');
    $('#orderTodayBtn')?.style.setProperty('display', 'none');
    $('#orderSaleBtn')?.style.setProperty('display', 'none');
    $('#orderVideosBtn')?.style.setProperty('display', 'none');

    // Hide quick action buttons on cards
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.style.setProperty('display', 'none');
    });

    // Remove context menu listeners
    document.querySelectorAll('[oncontextmenu]').forEach(el => {
      el.removeAttribute('oncontextmenu');
    });
  }, 100);
}

async function init() {
  await loadCatalog();
  await loadVideos();

  // Set up real-time listeners if in read-only mode
  if (READ_ONLY_MODE) {
    setupFirebaseRealtimeListeners();
    disableEditFunctions();
  }

  try { setupThemeToggle(); } catch (e) { console.error('Error in setupThemeToggle:', e); }
  try { render(); } catch (e) { console.error('Error in render():', e); }
  setupSearchControls();

  // Bascule d’affichage pour la liste "Aujourd’hui – étape 2" (horizontal ↔ vertical)
  const toggleTodayListViewBtn = document.getElementById('toggleTodayListViewBtn');
  if (toggleTodayListViewBtn) {
    let todayListExpanded = false;
    toggleTodayListViewBtn.addEventListener('click', () => {
      const todayListSection = document.getElementById('todayListStep2');
      const todayListGrid = document.getElementById('todayListStep2Grid');
      if (!todayListGrid || !todayListSection || todayListSection.style.display === 'none') {
        return;
      }

      todayListExpanded = !todayListExpanded;
      todayListGrid.classList.toggle('vertical-view', todayListExpanded);
      toggleTodayListViewBtn.setAttribute('aria-expanded', todayListExpanded ? 'true' : 'false');
      toggleTodayListViewBtn.textContent = todayListExpanded
        ? '⬅ عرض كشريط أفقي'
        : '⬇ عرض كل المنتجات';
    });
  }

  if (!READ_ONLY_MODE) {
    $('#addProductBtn')?.addEventListener('click', async () => {
      const newProduct = {
        id: 'P' + Date.now(),
        title: '',
        img: '',
        video: '',
        hidden: false,
        position: CATALOG.length + 1,
        price: 0,
        was: 0,
        sizes: [],
        colors: [],
        status: 'today',
        cat: 'clothes',
        note: '',
        date: new Date().toISOString().split('T')[0],
        gender: 'f'
      };
      createQuickProductForm(newProduct, true);
    });

    $('#addVideoBtn')?.addEventListener('click', async () => {
      const newVideo = {
        id: 'video_' + generateArticleId().slice(1),
        title: '',
        video: '',
        hidden: false
      };
      VIDEOS.push(newVideo);
      const index = VIDEOS.length - 1;
      openQuickVideoPanel(newVideo, index);
    });

    $('#hideAllArticlesBtn')?.addEventListener('click', () => hideAllArticles());
    $('#hideAllSaleBtn')?.addEventListener('click', () => hideDiscountArticles());
    $('#hideAllVideosBtn')?.addEventListener('click', () => hideAllVideos());
    $('#orderTodayBtn')?.addEventListener('click', () => openOrderModal('articles_today'));
    $('#orderSaleBtn')?.addEventListener('click', () => openOrderModal('articles_discount'));
    $('#orderVideosBtn')?.addEventListener('click', () => openOrderModal('videos'));
  }

  // Sorting controls for today/discount grids
  setupSortControls();
  syncSortBars();


  if (ENABLE_PERIODIC_RENDER) setInterval(render, 60000);

  // Update countdown timers every second
  setInterval(updateCountdownTimers, 1000);
  updateCountdownTimers(); // Initial update
}

if (window.__APP_WIRED__) {
  console.info('init skipped (already wired)');
} else {
  window.__APP_WIRED__ = true;
  init();
}

// Performance metrics validation (LCP, FID, CLS)
(function setupPerfObservers() {
  if (typeof PerformanceObserver !== 'function') return;
  try {
    const lcpObs = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const last = entries[entries.length - 1];
      if (last) console.log('[Perf] LCP:', Math.round(last.startTime), 'ms', last);
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) { }

  try {
    const fidObs = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const first = entries[0];
      if (first) console.log('[Perf] FID:', Math.round(first.processingStart - first.startTime), 'ms', first);
    });
    fidObs.observe({ type: 'first-input', buffered: true });
  } catch (e) { }

  try {
    const clsObs = new PerformanceObserver((entryList) => {
      let cls = 0;
      for (const entry of entryList.getEntries()) cls += entry.value || 0;
      console.log('[Perf] CLS:', cls.toFixed(3));
    });
    clsObs.observe({ type: 'layout-shift', buffered: true });
  } catch (e) { }
})();

function getStoredToggle(key, defaultValue = true) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    return value !== 'false';
  } catch (e) {
    return defaultValue;
  }
}

function setStoredToggle(key, value) {
  try {
    localStorage.setItem(key, value ? 'true' : 'false');
  } catch (e) {
    // ignore storage failures
  }
}

// Function to parse Google Maps URL and extract location
function parseGoogleMapsUrl(url) {
  try {
    // Remove any whitespace
    url = url.trim();

    // Check if it's a Google Maps URL
    if (!url.includes('google.com/maps') && !url.includes('goo.gl/maps') && !url.includes('maps.app.goo.gl')) {
      return null;
    }

    // Handle short URLs - we'll need to follow redirects or extract from full URL
    // For now, we'll handle the common patterns

    // Pattern 1: https://www.google.com/maps/place/NAME/@LAT,LNG
    let match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      return {
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2])
      };
    }

    // Pattern 2: https://maps.google.com/?q=LAT,LNG
    match = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      return {
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2])
      };
    }

    // Pattern 3: https://maps.google.com/?ll=LAT,LNG
    match = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      return {
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2])
      };
    }

    // Pattern 4: Extract place name from /place/NAME
    match = url.match(/\/place\/([^/@]+)/);
    if (match) {
      return {
        placeName: decodeURIComponent(match[1].replace(/\+/g, ' '))
      };
    }

    // Pattern 5: Extract from query parameter
    match = url.match(/[?&]q=([^&]+)/);
    if (match) {
      const query = decodeURIComponent(match[1]);
      // Check if it's coordinates
      const coordMatch = query.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
      if (coordMatch) {
        return {
          lat: parseFloat(coordMatch[1]),
          lng: parseFloat(coordMatch[2])
        };
      }
      // Otherwise it's a place name
      return {
        placeName: query
      };
    }

    return null;
  } catch (e) {
    console.error('Error parsing URL:', e);
    return null;
  }
}


// Function to display address in the box
function displayAddressInfo(address, place) {
  const displayBox = document.getElementById('locationDisplayBox');
  const displayAddress = document.getElementById('displayAddress');
  const displayDetails = document.getElementById('displayDetails');

  displayAddress.textContent = address;

  // Get additional details
  let details = [];
  if (place && place.address_components) {
    place.address_components.forEach(component => {
      if (component.types.includes('locality')) {
        details.push('المدينة: ' + component.long_name);
      }
      if (component.types.includes('administrative_area_level_1')) {
        details.push('المنطقة: ' + component.long_name);
      }
      if (component.types.includes('country')) {
        details.push('الدولة: ' + component.long_name);
      }
      if (component.types.includes('postal_code')) {
        details.push('الرمز البريدي: ' + component.long_name);
      }
    });
  }

  if (details.length > 0) {
    displayDetails.textContent = details.join(' | ');
  } else {
    displayDetails.textContent = '';
  }

  displayBox.classList.add('active');
}

// Function to process and display address
function processAddress(value) {
  if (!value || !value.trim()) return;

  const locationData = parseGoogleMapsUrl(value.trim());
  if (locationData) {
    if (locationData.lat && locationData.lng) {
      // Display coordinates directly
      displayAddressInfo('الإحداثيات: ' + locationData.lat + ', ' + locationData.lng, null);
    } else if (locationData.placeName) {
      // Display place name directly
      displayAddressInfo(locationData.placeName, null);
    }
  } else {
    // If not a URL, treat as regular address
    displayAddressInfo(value.trim(), null);
  }
}

// Initialize address input handlers
function initAutocomplete() {
  const addressInput = document.getElementById('addressInput');
  const displayBox = document.getElementById('locationDisplayBox');
  const displayAddress = document.getElementById('displayAddress');
  const displayDetails = document.getElementById('displayDetails');
  const pasteBtn = document.getElementById('pasteBtn');
  const deleteBtn = document.getElementById('deleteBtn');

  if (!addressInput) return;

  // Paste button functionality
  if (pasteBtn) {
    pasteBtn.addEventListener('click', async function () {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          addressInput.value = text;
          addressInput.focus();
          // Process the pasted content
          setTimeout(() => {
            processAddress(text);
          }, 100);
        }
      } catch (err) {
        // Fallback: try to paste using execCommand
        addressInput.focus();
        document.execCommand('paste');
        setTimeout(() => {
          processAddress(addressInput.value);
        }, 100);
      }
    });
  }

  // Delete button functionality
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function () {
      addressInput.value = '';
      displayBox.classList.remove('active');
      displayAddress.textContent = '';
      displayDetails.textContent = '';
      addressInput.focus();
    });
  }

  // Handle URL paste or input - but don't block manual editing
  addressInput.addEventListener('paste', function (e) {
    setTimeout(() => {
      processAddress(this.value);
    }, 100);
  });

  // Handle Enter key
  addressInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      processAddress(this.value);
    }
  });

  // Handle input changes - but only process on blur to avoid blocking typing
  let inputTimeout;
  addressInput.addEventListener('input', function () {
    // Clear any existing timeout
    clearTimeout(inputTimeout);
    // Don't process while typing - let user edit freely
  });

  // Process on blur (when user leaves the field)
  addressInput.addEventListener('blur', function () {
    if (this.value.trim()) {
      processAddress(this.value);
    }
  });

  // Make input field editable - remove any blocking behavior
  addressInput.addEventListener('keydown', function (e) {
    // Allow all normal editing keys
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End' ||
      (e.ctrlKey && (e.key === 'a' || e.key === 'c' || e.key === 'v' || e.key === 'x'))) {
      return true; // Allow these keys
    }
  });

}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(initAutocomplete, 500);
  });
} else {
  setTimeout(initAutocomplete, 500);
}

// Function to extract iframe src from iframe code
// Supports multiple formats:
// - Google Maps embed: https://www.google.com/maps/embed?######
// - Google Maps short links: https://maps.app.goo.gl/######
// - Full iframe tags with any attributes
function extractIframeSrc(iframeCode) {
  if (!iframeCode) return null;

  // Remove extra whitespace and newlines for easier parsing, but preserve structure
  const cleaned = iframeCode.replace(/\s+/g, ' ').trim();

  // First, try to extract src from iframe tag with various quote styles
  // Pattern: src="..." or src='...' or src=...
  const patterns = [
    // Standard: src="url" or src='url'
    /src\s*=\s*["']([^"']+)["']/i,
    // Without quotes: src=url
    /src\s*=\s*([^\s>]+)/i,
    // Full iframe tag match
    /<iframe[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/i,
    // Full iframe tag without quotes
    /<iframe[^>]*src\s*=\s*([^\s>]+)[^>]*>/i
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      let url = match[1].trim();
      // Remove any trailing characters that might be part of the tag
      url = url.replace(/[>'"\s]+$/, '');

      // Decode HTML entities if present
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = url;
      url = tempDiv.textContent || url;

      // Validate it's a URL
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
    }
  }

  // If it's just a URL (direct paste), return it
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return cleaned;
  }

  // Try to find any URL in the text
  const urlMatch = cleaned.match(/(https?:\/\/[^\s<>"']+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].trim();
  }

  return null;
}

// Function to save iframe to localStorage
function saveIframeToLocalStorage(src, iframeCode) {
  try {
    const iframeData = {
      src: src,
      iframeCode: iframeCode || '',
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('savedIframe', JSON.stringify(iframeData));
    console.log('✅ Iframe saved to localStorage');
  } catch (e) {
    console.error('❌ Error saving iframe to localStorage:', e);
  }
}

// Function to load iframe from localStorage
function loadIframeFromLocalStorage() {
  try {
    if (!getStoredToggle('iframeEnabled', true)) {
      return false;
    }
    const saved = localStorage.getItem('savedIframe');
    if (saved) {
      const iframeData = JSON.parse(saved);
      if (iframeData.src) {
        // Restore iframe code in textarea
        const iframeInput = document.getElementById('iframeInput');
        if (iframeInput && iframeData.iframeCode) {
          iframeInput.value = iframeData.iframeCode;
        }
        // Display the iframe
        displayIframeMap(iframeData.src);
        console.log('✅ Iframe loaded from localStorage');
        return true;
      }
    }
  } catch (e) {
    console.error('❌ Error loading iframe from localStorage:', e);
  }
  return false;
}

// Function to clear iframe from localStorage
function clearIframeFromLocalStorage() {
  try {
    localStorage.removeItem('savedIframe');
    console.log('✅ Iframe cleared from localStorage');
  } catch (e) {
    console.error('❌ Error clearing iframe from localStorage:', e);
  }
}

// Function to extract coordinates from iframe src
function extractCoordinatesFromSrc(src) {
  if (!src) return null;

  // Try to extract coordinates from embed URL
  // Pattern: https://www.google.com/maps/embed?pb=...&q=LAT,LNG or center=LAT,LNG
  let match = src.match(/[?&](?:q|center)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2])
    };
  }

  // Try to extract from @LAT,LNG pattern
  match = src.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2])
    };
  }

  // Try to extract place ID or place name
  match = src.match(/[?&]q=([^&]+)/);
  if (match) {
    const query = decodeURIComponent(match[1]);
    // Check if it's coordinates
    const coordMatch = query.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
    if (coordMatch) {
      return {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2])
      };
    }
    // Otherwise it's a place name/query
    return {
      query: query
    };
  }

  return null;
}

// Function to detect mobile device
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768 && window.innerHeight <= 1024);
}

// Function to open Google Maps on mobile
function openGoogleMaps(location) {
  if (!location) {
    console.warn('No location data available');
    return;
  }

  let mapsUrl = '';

  if (location.lat && location.lng) {
    // Use coordinates
    if (isMobileDevice()) {
      // Mobile: Use maps:// for iOS or geo:// for Android
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isIOS) {
        mapsUrl = `maps://maps.google.com/maps?q=${location.lat},${location.lng}`;
      } else {
        // Android
        mapsUrl = `geo:${location.lat},${location.lng}?q=${location.lat},${location.lng}`;
      }
    } else {
      // Desktop: Open in new tab
      mapsUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
    }
  } else if (location.query) {
    // Use place name/query
    if (isMobileDevice()) {
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isIOS) {
        mapsUrl = `maps://maps.google.com/maps?q=${encodeURIComponent(location.query)}`;
      } else {
        mapsUrl = `geo:0,0?q=${encodeURIComponent(location.query)}`;
      }
    } else {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.query)}`;
    }
  }

  if (mapsUrl) {
    // Try to open native app first, fallback to web
    if (isMobileDevice()) {
      window.location.href = mapsUrl;
      // Fallback after a delay
      setTimeout(() => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${location.lat ? `${location.lat},${location.lng}` : encodeURIComponent(location.query)}`, '_blank');
      }, 500);
    } else {
      window.open(mapsUrl, '_blank');
    }
  }
}

function openDirectLink(url) {
  if (!url || !url.startsWith('http')) return;
  if (isMobileDevice()) {
    window.location.href = url;
  } else {
    window.open(url, '_blank');
  }
}

// Store current location data
let currentLocationData = null;

// Store direct Google Maps link
let directMapsLink = null;

// Function to save direct link to localStorage and Firebase
async function saveDirectLinkToLocalStorage(link) {
  try {
    if (!getStoredToggle('mapsLinkEnabled', true)) {
      return;
    }
    // Save to localStorage
    localStorage.setItem('directMapsLink', link || '');
    console.log('✅ Direct link saved to localStorage:', link);

    // Try to save to Firebase if available (check if app.js has exposed db)
    if (typeof window !== 'undefined' && window.db) {
      try {
        // Import Firebase functions
        const { addDoc, collection, serverTimestamp, query, where, getDocs, updateDoc } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js");

        const db = window.db;

        // Check if a maps link document already exists
        const q = query(
          collection(db, "settings"),
          where("type", "==", "mapsDirectLink")
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          // Update existing document
          const docRef = snapshot.docs[0];
          await updateDoc(docRef.ref, {
            value: link || '',
            updatedAt: serverTimestamp()
          });
          console.log('✅ Direct link updated in Firebase');
        } else {
          // Create new document
          await addDoc(collection(db, "settings"), {
            type: "mapsDirectLink",
            value: link || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          console.log('✅ Direct link saved to Firebase');
        }
      } catch (firebaseError) {
        console.warn('⚠️ Could not save to Firebase (may not be configured):', firebaseError.message);
      }
    }
  } catch (e) {
    console.error('❌ Error saving direct link:', e);
  }
}

// Function to load direct link from localStorage
function loadDirectLinkFromLocalStorage() {
  try {
    if (!getStoredToggle('mapsLinkEnabled', true)) {
      return false;
    }
    const saved = localStorage.getItem('directMapsLink');
    if (saved) {
      directMapsLink = saved;
      const mapsLinkInput = document.getElementById('mapsLinkInput');
      if (mapsLinkInput) {
        mapsLinkInput.value = saved;
      }
      console.log('✅ Direct link loaded from localStorage:', saved);
      return true;
    }
  } catch (e) {
    console.error('❌ Error loading direct link from localStorage:', e);
  }
  return false;
}

// Function to clear direct link from localStorage and Firebase
async function clearDirectLinkFromLocalStorage() {
  try {
    // Clear from localStorage
    localStorage.removeItem('directMapsLink');
    directMapsLink = null;
    console.log('✅ Direct link cleared from localStorage');

    // Clear from Firebase if available
    if (typeof window !== 'undefined' && window.db) {
      try {
        const { query, where, getDocs, deleteDoc, collection } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js");

        const db = window.db;
        const q = query(
          collection(db, "settings"),
          where("type", "==", "mapsDirectLink")
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          await deleteDoc(snapshot.docs[0].ref);
          console.log('✅ Direct link deleted from Firebase');
        }
      } catch (firebaseError) {
        console.warn('⚠️ Could not delete from Firebase:', firebaseError.message);
      }
    }
  } catch (e) {
    console.error('❌ Error clearing direct link:', e);
  }
}

// Function to show Google Maps confirmation modal
function showMapsConfirmation(location, directUrl) {
  const hasDirectUrl = typeof directUrl === 'string' && directUrl.trim().startsWith('http');
  console.log('showMapsConfirmation called with:', location, directUrl);

  if (!location && !hasDirectUrl) {
    console.warn('No location data available');
    alert('لا توجد بيانات موقع متاحة');
    return;
  }

  // Create modal if it doesn't exist
  let modal = document.getElementById('mapsConfirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mapsConfirmModal';
    modal.className = 'maps-confirm-modal';
    document.body.appendChild(modal);
  }

  // Update modal content
  modal.innerHTML = `
        <div class="maps-confirm-content">
          <h3>فتح خرائط جوجل</h3>
          <p>هل تريد فتح تطبيق خرائط جوجل للانتقال إلى هذا الموقع؟</p>
          <div class="maps-confirm-buttons">
            <button class="maps-confirm-btn yes">نعم</button>
            <button class="maps-confirm-btn no">لا</button>
          </div>
        </div>
      `;

  // Add event listeners (remove old ones first by recreating)
  const yesBtn = modal.querySelector('.maps-confirm-btn.yes');
  const noBtn = modal.querySelector('.maps-confirm-btn.no');

  if (yesBtn) {
    yesBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      modal.classList.remove('active');
      if (hasDirectUrl) {
        console.log('User confirmed, opening direct Maps link');
        openDirectLink(directUrl.trim());
        return;
      }
      console.log('User confirmed, opening Google Maps');
      if (location) openGoogleMaps(location);
    });
  }

  if (noBtn) {
    noBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      modal.classList.remove('active');
      console.log('User cancelled');
    });
  }

  // Close on background click
  modal.addEventListener('click', function (e) {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  // Show modal
  modal.classList.add('active');
  console.log('Modal shown');
}

// Function to display iframe map
function displayIframeMap(src) {
  const iframeWrapper = document.getElementById('locationIframeWrapper');
  if (!getStoredToggle('iframeEnabled', true)) {
    return;
  }
  if (!iframeWrapper || !src || !src.trim()) {
    console.warn('Cannot display iframe: missing wrapper or src');
    return;
  }

  // Clean and validate the src URL
  const cleanSrc = src.trim();
  if (!cleanSrc.startsWith('http://') && !cleanSrc.startsWith('https://')) {
    console.error('Invalid iframe src URL:', cleanSrc);
    return;
  }

  try {
    // Extract and store location data
    currentLocationData = extractCoordinatesFromSrc(cleanSrc);

    // Clear existing iframe
    iframeWrapper.innerHTML = '';

    const shouldShowDelete = !READ_ONLY_MODE;
    let deleteBtn = null;
    if (shouldShowDelete) {
      deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'location-iframe-delete-btn';
      deleteBtn.id = 'iframeMapDeleteBtn';
      deleteBtn.title = 'حذف الخريطة';
      deleteBtn.textContent = '✕ حذف الخريطة';
    }

    // Create new iframe with mobile support
    const iframe = document.createElement('iframe');
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.loading = 'lazy';
    iframe.allowFullscreen = true;
    iframe.setAttribute('allowfullscreen', ''); // For better mobile support
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.src = cleanSrc;

    // Add error handling for iframe load
    iframe.onerror = function () {
      console.error('Error loading iframe:', cleanSrc);
      iframeWrapper.classList.remove('active');
    };

    iframe.onload = function () {
      console.log('Iframe loaded successfully');
      iframeWrapper.classList.add('active');
    };

    // Add mobile-friendly attributes
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    // Prevent iframe from capturing clicks
    iframe.style.pointerEvents = 'none';

    // Create clickable overlay
    const clickOverlay = document.createElement('div');
    clickOverlay.style.position = 'absolute';
    clickOverlay.style.top = '0';
    clickOverlay.style.left = '0';
    clickOverlay.style.right = '0';
    clickOverlay.style.bottom = '0';
    clickOverlay.style.zIndex = '5';
    clickOverlay.style.cursor = 'pointer';
    clickOverlay.style.backgroundColor = 'transparent';
    clickOverlay.title = 'اضغط لفتح خرائط جوجل';

    // Add iframe and overlay to wrapper (delete button only in edit mode)
    if (deleteBtn) {
      iframeWrapper.appendChild(deleteBtn);
    }
    iframeWrapper.appendChild(iframe);
    iframeWrapper.appendChild(clickOverlay);
    iframeWrapper.classList.add('active');

    // Attach delete button event (stop propagation so it doesn't trigger map open)
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        e.stopImmediatePropagation();
        const clearIframeFunc = window.clearIframe;
        if (typeof clearIframeFunc === 'function') {
          clearIframeFunc();
        }
        return false;
      });
    }

    // Add click handler to overlay
    clickOverlay.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();

      console.log('Map overlay clicked');

      const buildDirectLinkFromLocation = (location) => {
        if (!location) return null;
        if (location.lat && location.lng) {
          return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
        }
        if (location.query) {
          return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.query)}`;
        }
        return null;
      };

      const mapsLinkEnabled = getStoredToggle('mapsLinkEnabled', true);

      // Check if we have a direct link - use it first
      let directLink = null;
      if (directMapsLink && typeof directMapsLink === 'string') {
        directLink = directMapsLink.trim();
      }
      if (!directLink) {
        try {
          const savedLink = localStorage.getItem('directMapsLink');
          if (savedLink) directLink = savedLink.trim();
        } catch (err) {
          console.warn('Error reading directMapsLink from localStorage:', err);
        }
      }
      if (!directLink) {
        const mapsLinkInput = document.getElementById('mapsLinkInput');
        if (mapsLinkInput && mapsLinkInput.value.trim()) {
          directLink = mapsLinkInput.value.trim();
        }
      }

      if (mapsLinkEnabled && directLink && directLink.startsWith('http')) {
        console.log('Opening direct link:', directLink);
        if (READ_ONLY_MODE) {
          const locationForConfirm = currentLocationData || extractCoordinatesFromSrc(cleanSrc) || { query: directLink };
          showMapsConfirmation(locationForConfirm, directLink);
        } else {
          openDirectLink(directLink);
        }
        return;
      }

      // Otherwise, use the existing confirmation modal
      console.log('No direct link, using location data:', currentLocationData);

      // Check if we have location data
      if (!currentLocationData) {
        console.warn('No location data available, re-extracting...');
        // Try to extract from src again
        currentLocationData = extractCoordinatesFromSrc(cleanSrc);
        console.log('Re-extracted location data:', currentLocationData);
      }

      if (currentLocationData) {
        if (READ_ONLY_MODE) {
          const fallbackDirectLink = buildDirectLinkFromLocation(currentLocationData);
          showMapsConfirmation(currentLocationData, fallbackDirectLink);
        } else {
          showMapsConfirmation(currentLocationData);
        }
      } else {
        // Fallback: try to use the src URL directly
        console.log('Using src as fallback:', cleanSrc);
        if (READ_ONLY_MODE) {
          const fallbackUrl = cleanSrc.includes('google.com/maps')
            ? cleanSrc.replace('/embed', '').replace('?pb=', '?')
            : cleanSrc;
          showMapsConfirmation({ query: cleanSrc }, fallbackUrl.startsWith('http') ? fallbackUrl : null);
        } else {
          showMapsConfirmation({ query: cleanSrc });
        }
      }
    });

    // Force reflow to ensure display on mobile
    iframeWrapper.offsetHeight;

    // Log for debugging (can be removed in production)
    console.log('Iframe displayed with src:', cleanSrc);
    console.log('Location data:', currentLocationData);
  } catch (error) {
    console.error('Error displaying iframe:', error);
    iframeWrapper.classList.remove('active');
    if (READ_ONLY_MODE) {
      iframeWrapper.innerHTML = '';
    } else {
      iframeWrapper.innerHTML = '<button type="button" class="location-iframe-delete-btn" id="iframeMapDeleteBtn" title="حذف الخريطة">✕ حذف الخريطة</button>';
      // Re-attach delete button event
      const newDeleteBtn = document.getElementById('iframeMapDeleteBtn');
      if (newDeleteBtn) {
        newDeleteBtn.addEventListener('click', function () {
          const clearIframeFunc = window.clearIframe || (() => {
            const wrapper = document.getElementById('locationIframeWrapper');
            const input = document.getElementById('iframeInput');
            if (wrapper) wrapper.classList.remove('active');
            if (input) input.value = '';
          });
          clearIframeFunc();
        });
      }
    }
  }
}

// Initialize iframe functionality
function initIframeEmbed() {
  const iframeInput = document.getElementById('iframeInput');
  const iframePasteBtn = document.getElementById('iframePasteBtn');
  const iframeDeleteBtn = document.getElementById('iframeDeleteBtn');
  const iframeWrapper = document.getElementById('locationIframeWrapper');
  const mapsLinkInput = document.getElementById('mapsLinkInput');
  const mapsLinkPasteBtn = document.getElementById('mapsLinkPasteBtn');
  const mapsLinkDeleteBtn = document.getElementById('mapsLinkDeleteBtn');
  const mapCta = document.getElementById('mapCta');
  const mapBox = document.getElementById('mapBox');
  const mapsLinkEnabledToggle = document.getElementById('mapsLinkEnabled');
  const iframeEnabledToggle = document.getElementById('iframeEnabled');

  const isMapsLinkEnabled = () => {
    if (mapsLinkEnabledToggle) return mapsLinkEnabledToggle.checked;
    return getStoredToggle('mapsLinkEnabled', true);
  };
  const isIframeEnabled = () => {
    if (iframeEnabledToggle) return iframeEnabledToggle.checked;
    return getStoredToggle('iframeEnabled', true);
  };

  const applyMapsLinkState = (enabled) => {
    if (mapsLinkInput) mapsLinkInput.disabled = !enabled;
    if (mapsLinkPasteBtn) mapsLinkPasteBtn.disabled = !enabled;
    if (mapsLinkDeleteBtn) mapsLinkDeleteBtn.disabled = !enabled;
    if (mapBox) mapBox.style.display = enabled ? '' : 'none';
    if (mapCta && !mapBox) mapCta.style.display = enabled ? '' : 'none';
    if (mapCta) mapCta.setAttribute('aria-hidden', enabled ? 'false' : 'true');
    if (!enabled && mapsLinkInput) {
      mapsLinkInput.value = '';
    }
    setStoredToggle('mapsLinkEnabled', enabled);
    if (enabled) {
      loadDirectLinkFromLocalStorage();
    }
  };

  const applyIframeState = (enabled) => {
    if (iframeInput) iframeInput.disabled = !enabled;
    if (iframePasteBtn) iframePasteBtn.disabled = !enabled;
    if (iframeDeleteBtn) iframeDeleteBtn.disabled = !enabled;
    setStoredToggle('iframeEnabled', enabled);
    if (iframeWrapper) iframeWrapper.style.display = enabled ? '' : 'none';
    if (!enabled && iframeWrapper) {
      iframeWrapper.classList.remove('active');
      iframeWrapper.innerHTML = READ_ONLY_MODE
        ? ''
        : '<button type="button" class="location-iframe-delete-btn" id="iframeMapDeleteBtn" title="حذف الخريطة">✕ حذف الخريطة</button>';
      currentLocationData = null;
    }
    if (enabled) {
      loadIframeFromLocalStorage();
    }
  };

  if (mapsLinkEnabledToggle) {
    const storedMapsEnabled = getStoredToggle('mapsLinkEnabled', true);
    mapsLinkEnabledToggle.checked = storedMapsEnabled;
    applyMapsLinkState(storedMapsEnabled);
    mapsLinkEnabledToggle.addEventListener('change', function () {
      applyMapsLinkState(mapsLinkEnabledToggle.checked);
    });
  } else {
    applyMapsLinkState(getStoredToggle('mapsLinkEnabled', true));
  }

  if (iframeEnabledToggle) {
    const storedIframeEnabled = getStoredToggle('iframeEnabled', true);
    iframeEnabledToggle.checked = storedIframeEnabled;
    applyIframeState(storedIframeEnabled);
    iframeEnabledToggle.addEventListener('change', function () {
      applyIframeState(iframeEnabledToggle.checked);
    });
  } else {
    applyIframeState(getStoredToggle('iframeEnabled', true));
  }

  // Initialize direct link field handlers
  if (mapsLinkInput) {
    // Save link when user types or pastes
    mapsLinkInput.addEventListener('input', function () {
      if (!isMapsLinkEnabled()) return;
      const link = this.value.trim();
      if (link && link.startsWith('http')) {
        directMapsLink = link;
        saveDirectLinkToLocalStorage(link);
      } else {
        directMapsLink = null;
        saveDirectLinkToLocalStorage('');
      }
    });

    mapsLinkInput.addEventListener('paste', function () {
      setTimeout(() => {
        if (!isMapsLinkEnabled()) return;
        const link = this.value.trim();
        if (link && link.startsWith('http')) {
          directMapsLink = link;
          saveDirectLinkToLocalStorage(link);
        }
      }, 100);
    });
  }

  // Paste button for direct link
  if (mapsLinkPasteBtn) {
    mapsLinkPasteBtn.addEventListener('click', async function () {
      if (!isMapsLinkEnabled()) return;
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          mapsLinkInput.value = text;
          mapsLinkInput.focus();
          directMapsLink = text.trim();
          saveDirectLinkToLocalStorage(text.trim());
        }
      } catch (err) {
        mapsLinkInput.focus();
        document.execCommand('paste');
        setTimeout(() => {
          if (!isMapsLinkEnabled()) return;
          const link = mapsLinkInput.value.trim();
          if (link) {
            directMapsLink = link;
            saveDirectLinkToLocalStorage(link);
          }
        }, 100);
      }
    });
  }

  if (!iframeInput) return;

  // Paste button for iframe
  if (iframePasteBtn) {
    iframePasteBtn.addEventListener('click', async function () {
      if (!isIframeEnabled()) return;
      try {
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            iframeInput.value = text.trim();
            iframeInput.focus();
            // Process the pasted content immediately
            processIframeInput(text.trim());
            return;
          }
        }
      } catch (err) {
        console.log('Clipboard API failed, trying fallback:', err);
      }

      // Fallback: Focus and let user paste manually
      iframeInput.focus();
      iframeInput.select();
      // Show message to user
      const originalPlaceholder = iframeInput.placeholder;
      iframeInput.placeholder = 'الرجاء الضغط على Ctrl+V للصق (Please press Ctrl+V to paste)';
      setTimeout(() => {
        iframeInput.placeholder = originalPlaceholder;
        // Check if value was pasted
        if (iframeInput.value.trim()) {
          if (!isIframeEnabled()) return;
          processIframeInput(iframeInput.value.trim());
        }
      }, 500);
    });
  }

  // Delete button for iframe (next to textarea)
  if (iframeDeleteBtn) {
    iframeDeleteBtn.addEventListener('click', function () {
      if (!isIframeEnabled()) return;
      clearIframe();
    });
  }

  // Delete button on the iframe map itself
  const iframeMapDeleteBtn = document.getElementById('iframeMapDeleteBtn');
  if (iframeMapDeleteBtn) {
    iframeMapDeleteBtn.addEventListener('click', function () {
      if (!isIframeEnabled()) return;
      clearIframe();
    });
  }

  // Function to clear iframe
  function clearIframe() {
    if (!isIframeEnabled()) return;
    iframeInput.value = '';
    iframeWrapper.classList.remove('active');
    iframeWrapper.innerHTML = '<button type="button" class="location-iframe-delete-btn" id="iframeMapDeleteBtn" title="حذف الخريطة">✕ حذف الخريطة</button>';
    iframeInput.focus();

    // Clear location data
    currentLocationData = null;

    // Clear from localStorage
    clearIframeFromLocalStorage();

    // Re-attach event listener to the new button
    const newDeleteBtn = document.getElementById('iframeMapDeleteBtn');
    if (newDeleteBtn) {
      newDeleteBtn.addEventListener('click', clearIframe);
    }
  }
  window.clearIframe = clearIframe;

  // Handle paste in textarea
  iframeInput.addEventListener('paste', function (e) {
    if (!isIframeEnabled()) return;
    // Get pasted data from clipboard
    const pastedData = (e.clipboardData || window.clipboardData).getData('text');
    if (pastedData && pastedData.trim()) {
      // Process immediately after paste
      setTimeout(() => {
        const currentValue = this.value || pastedData;
        if (currentValue.trim()) {
          if (!isIframeEnabled()) return;
          processIframeInput(currentValue.trim());
        }
      }, 50);
    }
  });

  // Process iframe input
  function processIframeInput(value) {
    if (!isIframeEnabled()) return;
    if (!value || !value.trim()) {
      // Clear iframe if input is empty
      if (iframeWrapper.classList.contains('active')) {
        clearIframe();
      }
      return;
    }

    const trimmedValue = value.trim();
    let src = extractIframeSrc(trimmedValue);

    // If extraction failed, check if it's a direct URL
    if (!src) {
      // Check if it's a direct Google Maps URL
      if (trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')) {
        // Check if it's a Google Maps URL
        if (trimmedValue.includes('google.com/maps') || trimmedValue.includes('maps.google.com')) {
          // Convert to embed URL if needed
          if (trimmedValue.includes('/embed')) {
            src = trimmedValue;
          } else {
            // Try to convert regular maps URL to embed URL
            const match = trimmedValue.match(/[?&]q=([^&]+)/);
            if (match) {
              src = `https://www.google.com/maps/embed?q=${encodeURIComponent(match[1])}`;
            } else {
              src = trimmedValue;
            }
          }
        } else {
          src = trimmedValue;
        }
      }
    }

    if (src) {
      // Validate the URL
      try {
        new URL(src);
        displayIframeMap(src);
        // Save to localStorage
        saveIframeToLocalStorage(src, trimmedValue);
      } catch (e) {
        console.error('Invalid URL:', src);
        // Still try to display if it looks like a valid iframe src
        if (src.includes('http')) {
          displayIframeMap(src);
          saveIframeToLocalStorage(src, trimmedValue);
        }
      }
    } else {
      console.warn('Could not extract iframe src from:', trimmedValue);
    }
  }

  // Process on blur (when user leaves the field)
  iframeInput.addEventListener('blur', function () {
    if (this.value.trim()) {
      processIframeInput(this.value.trim());
    } else {
      // Clear iframe if field is empty
      if (iframeWrapper.classList.contains('active')) {
        clearIframe();
      }
    }
  });

  // Process on Enter (Ctrl+Enter or Cmd+Enter for textarea)
  iframeInput.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (e.key === 'Enter' && e.shiftKey)) {
      e.preventDefault();
      if (this.value.trim()) {
        processIframeInput(this.value.trim());
      }
    }
  });

  // Also process on input change (debounced)
  let inputTimeout;
  iframeInput.addEventListener('input', function () {
    clearTimeout(inputTimeout);
    inputTimeout = setTimeout(() => {
      if (this.value.trim()) {
        processIframeInput(this.value.trim());
      }
    }, 1000); // Process 1 second after user stops typing
  });
}

// Update social media buttons visibility based on checkboxes (editor) or localStorage (public index)
function updateSocialButtonsVisibility() {
  const fbCheckboxEl = document.getElementById('facebookLinkEnabled');
  const igCheckboxEl = document.getElementById('instagramLinkEnabled');
  const ttCheckboxEl = document.getElementById('tiktokLinkEnabled');

  const fbEnabled = fbCheckboxEl
    ? fbCheckboxEl.checked
    : (localStorage.getItem('facebookLinkEnabled') !== 'false');
  const igEnabled = igCheckboxEl
    ? igCheckboxEl.checked
    : (localStorage.getItem('instagramLinkEnabled') !== 'false');
  const ttEnabled = ttCheckboxEl
    ? ttCheckboxEl.checked
    : (localStorage.getItem('tiktokLinkEnabled') !== 'false');

  const fbBtn = document.getElementById('fb');
  const igBtn = document.getElementById('ig');
  const ttBtn = document.getElementById('tt');
  const socialBox = document.getElementById('socialBox');

  if (fbBtn) {
    fbBtn.style.display = fbEnabled ? '' : 'none';
  }
  if (igBtn) {
    igBtn.style.display = igEnabled ? '' : 'none';
  }
  if (ttBtn) {
    ttBtn.style.display = ttEnabled ? '' : 'none';
  }

  // Hide social box if no buttons are enabled and have valid links
  if (socialBox) {
    const hasVisibleButtons = (fbEnabled && fbBtn && fbBtn.href && fbBtn.href !== '#' && fbBtn.style.display !== 'none') ||
      (igEnabled && igBtn && igBtn.href && igBtn.href !== '#' && igBtn.style.display !== 'none') ||
      (ttEnabled && ttBtn && ttBtn.href && ttBtn.href !== '#' && ttBtn.style.display !== 'none');
    socialBox.style.display = hasVisibleButtons ? '' : 'none';
  }

  // Save visibility states to localStorage
  localStorage.setItem('facebookLinkEnabled', fbEnabled);
  localStorage.setItem('instagramLinkEnabled', igEnabled);
  localStorage.setItem('tiktokLinkEnabled', ttEnabled);
}

// Social Media Links Management with Firebase
async function saveSocialLinksToFirebase() {
  try {
    const facebookLink = document.getElementById('facebookLinkInput')?.value.trim() || '';
    const instagramLink = document.getElementById('instagramLinkInput')?.value.trim() || '';
    const tiktokLink = document.getElementById('tiktokLinkInput')?.value.trim() || '';

    const fbEnabled = document.getElementById('facebookLinkEnabled')?.checked ?? true;
    const igEnabled = document.getElementById('instagramLinkEnabled')?.checked ?? true;
    const ttEnabled = document.getElementById('tiktokLinkEnabled')?.checked ?? true;

    // Save to localStorage as backup
    localStorage.setItem('facebookLink', facebookLink);
    localStorage.setItem('instagramLink', instagramLink);
    localStorage.setItem('tiktokLink', tiktokLink);
    localStorage.setItem('facebookLinkEnabled', fbEnabled);
    localStorage.setItem('instagramLinkEnabled', igEnabled);
    localStorage.setItem('tiktokLinkEnabled', ttEnabled);

    // Update button hrefs
    const fbBtn = document.getElementById('fb');
    const igBtn = document.getElementById('ig');
    const ttBtn = document.getElementById('tt');

    if (fbBtn) {
      fbBtn.href = facebookLink || '#';
    }
    if (igBtn) {
      igBtn.href = instagramLink || '#';
    }
    if (ttBtn) {
      ttBtn.href = tiktokLink || '#';
    }

    // Update visibility
    updateSocialButtonsVisibility();

    console.log('✅ Social links saved to localStorage');

    // Save to Firebase if available
    if (typeof window !== 'undefined' && window.db) {
      try {
        const { addDoc, collection, serverTimestamp, query, where, getDocs, updateDoc } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js");
        const db = window.db;

        // Save Facebook link
        await saveSocialLinkToFirebase(db, 'facebookLink', facebookLink, addDoc, collection, serverTimestamp, query, where, getDocs, updateDoc);

        // Save Instagram link
        await saveSocialLinkToFirebase(db, 'instagramLink', instagramLink, addDoc, collection, serverTimestamp, query, where, getDocs, updateDoc);

        // Save TikTok link
        await saveSocialLinkToFirebase(db, 'tiktokLink', tiktokLink, addDoc, collection, serverTimestamp, query, where, getDocs, updateDoc);

        console.log('✅ Social links saved to Firebase');
      } catch (firebaseError) {
        console.warn('⚠️ Could not save to Firebase (may not be configured):', firebaseError.message);
      }
    }
  } catch (e) {
    console.error('❌ Error saving social links:', e);
  }
}

async function saveSocialLinkToFirebase(db, linkType, linkValue, addDoc, collection, serverTimestamp, query, where, getDocs, updateDoc) {
  try {
    // Check if a social link document already exists
    const q = query(
      collection(db, "settings"),
      where("type", "==", linkType)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Update existing document
      const docRef = snapshot.docs[0];
      await updateDoc(docRef.ref, {
        value: linkValue || '',
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new document
      await addDoc(collection(db, "settings"), {
        type: linkType,
        value: linkValue || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error(`❌ Error saving ${linkType} to Firebase:`, error);
  }
}

async function loadSocialLinksFromFirebase() {
  try {
    // Load from localStorage first (faster)
    let facebookLink = localStorage.getItem('facebookLink') || '';
    let instagramLink = localStorage.getItem('instagramLink') || '';
    let tiktokLink = localStorage.getItem('tiktokLink') || '';

    // Try to load from Firebase if available
    if (typeof window !== 'undefined' && window.db) {
      try {
        const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js");
        const db = window.db;

        // Load Facebook link
        const fbLink = await loadSocialLinkFromFirebase(db, 'facebookLink', collection, query, where, getDocs);
        if (fbLink) facebookLink = fbLink;

        // Load Instagram link
        const igLink = await loadSocialLinkFromFirebase(db, 'instagramLink', collection, query, where, getDocs);
        if (igLink) instagramLink = igLink;

        // Load TikTok link
        const ttLink = await loadSocialLinkFromFirebase(db, 'tiktokLink', collection, query, where, getDocs);
        if (ttLink) tiktokLink = ttLink;

        // Update localStorage with Firebase values
        localStorage.setItem('facebookLink', facebookLink);
        localStorage.setItem('instagramLink', instagramLink);
        localStorage.setItem('tiktokLink', tiktokLink);

        console.log('✅ Social links loaded from Firebase');
      } catch (firebaseError) {
        console.warn('⚠️ Could not load from Firebase (may not be configured):', firebaseError.message);
      }
    }

    // Update UI
    const facebookInput = document.getElementById('facebookLinkInput');
    const instagramInput = document.getElementById('instagramLinkInput');
    const tiktokInput = document.getElementById('tiktokLinkInput');
    const fbBtn = document.getElementById('fb');
    const igBtn = document.getElementById('ig');
    const ttBtn = document.getElementById('tt');

    // Load visibility states from localStorage
    const fbEnabled = localStorage.getItem('facebookLinkEnabled') !== 'false';
    const igEnabled = localStorage.getItem('instagramLinkEnabled') !== 'false';
    const ttEnabled = localStorage.getItem('tiktokLinkEnabled') !== 'false';

    const fbCheckbox = document.getElementById('facebookLinkEnabled');
    const igCheckbox = document.getElementById('instagramLinkEnabled');
    const ttCheckbox = document.getElementById('tiktokLinkEnabled');

    if (fbCheckbox) {
      fbCheckbox.checked = fbEnabled;
    }
    if (igCheckbox) {
      igCheckbox.checked = igEnabled;
    }
    if (ttCheckbox) {
      ttCheckbox.checked = ttEnabled;
    }

    if (facebookInput) {
      facebookInput.value = facebookLink;
    }
    if (instagramInput) {
      instagramInput.value = instagramLink;
    }
    if (tiktokInput) {
      tiktokInput.value = tiktokLink;
    }
    if (fbBtn) {
      fbBtn.href = facebookLink || '#';
    }
    if (igBtn) {
      igBtn.href = instagramLink || '#';
    }
    if (ttBtn) {
      ttBtn.href = tiktokLink || '#';
    }

    // Update visibility
    updateSocialButtonsVisibility();

    console.log('✅ Social links loaded');
  } catch (e) {
    console.error('❌ Error loading social links:', e);
  }
}

async function loadSocialLinkFromFirebase(db, linkType, collection, query, where, getDocs) {
  try {
    const q = query(
      collection(db, "settings"),
      where("type", "==", linkType)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return doc.data().value || '';
    }
    return '';
  } catch (error) {
    console.error(`❌ Error loading ${linkType} from Firebase:`, error);
    return '';
  }
}

// Footer / Contact settings (phrase, region code, phone, shop name)
const FOOTER_DEFAULTS = {
  contactPhrase: 'Contactez-nous:',
  regionCode: '+216',
  phoneNumber: '93 430 636',
  shopName: 'Boutique Saïda'
};
function getFooterSettings() {
  return {
    contactPhrase: localStorage.getItem('footerContactPhrase') ?? FOOTER_DEFAULTS.contactPhrase,
    regionCode: localStorage.getItem('footerRegionCode') ?? FOOTER_DEFAULTS.regionCode,
    phoneNumber: localStorage.getItem('footerPhoneNumber') ?? FOOTER_DEFAULTS.phoneNumber,
    shopName: localStorage.getItem('footerShopName') ?? FOOTER_DEFAULTS.shopName
  };
}
function applyFooterSettings() {
  const s = getFooterSettings();
  let regionCode = (s.regionCode || '').trim();
  if (!regionCode && !READ_ONLY_MODE) {
    const otherEl = document.getElementById('footerRegionCodeOther');
    if (otherEl) regionCode = (otherEl.value || '').trim();
  }
  const phoneDigits = (s.phoneNumber || '').replace(/\D/g, '');
  const regionPart = (regionCode || '').trim();
  const telNumber = (regionPart ? (regionPart.startsWith('+') ? regionPart : '+' + regionPart) : '') + phoneDigits;
  const telHref = telNumber.replace(/\D/g, '').length > 0 ? 'tel:' + telNumber.replace(/\s/g, '') : '#';
  const displayPhone = [regionCode, s.phoneNumber].filter(Boolean).join(' ').trim() || '—';
  const contactText = document.getElementById('footerContactText');
  const phoneLink = document.getElementById('footerPhoneLink');
  const shopNameEl = document.getElementById('footerShopName');
  if (contactText) contactText.textContent = s.contactPhrase;
  if (phoneLink) {
    phoneLink.href = telHref;
    phoneLink.textContent = displayPhone;
    phoneLink.setAttribute('dir', 'ltr'); // keep number left-to-right in RTL (Arabic) layout
    if (telHref !== '#') phoneLink.style.cursor = 'pointer'; else phoneLink.removeAttribute('href');
  }
  if (shopNameEl) shopNameEl.textContent = s.shopName || FOOTER_DEFAULTS.shopName;
}
function loadFooterSettingsIntoForm() {
  const s = getFooterSettings();
  const phraseSelect = document.getElementById('footerContactPhraseSelect');
  const regionSelect = document.getElementById('footerRegionCodeSelect');
  const regionOther = document.getElementById('footerRegionCodeOther');
  const phoneInput = document.getElementById('footerPhoneInput');
  const shopInput = document.getElementById('footerShopNameInput');
  const otherWrap = document.getElementById('footerRegionCodeOtherWrap');
  if (phraseSelect) {
    phraseSelect.value = s.contactPhrase;
    if (![].find.call(phraseSelect.options, o => o.value === s.contactPhrase)) {
      phraseSelect.selectedIndex = 0;
    }
  }
  if (regionSelect) {
    const hasOption = [].find.call(regionSelect.options, o => o.value === s.regionCode);
    if (hasOption) regionSelect.value = s.regionCode; else regionSelect.value = '';
    if (otherWrap) otherWrap.style.display = regionSelect.value === '' ? 'block' : 'none';
    if (regionOther && !hasOption) regionOther.value = s.regionCode;
  }
  if (phoneInput) phoneInput.value = s.phoneNumber;
  if (shopInput) shopInput.value = s.shopName;
}
function saveFooterSettingsFromForm() {
  const phraseSelect = document.getElementById('footerContactPhraseSelect');
  const regionSelect = document.getElementById('footerRegionCodeSelect');
  const regionOther = document.getElementById('footerRegionCodeOther');
  const phoneInput = document.getElementById('footerPhoneInput');
  const shopInput = document.getElementById('footerShopNameInput');
  let regionCode = (regionSelect && regionSelect.value) || '';
  if (regionCode === '' && regionOther) regionCode = (regionOther.value || '').trim();
  const contactPhrase = (phraseSelect && phraseSelect.value) ? phraseSelect.value : FOOTER_DEFAULTS.contactPhrase;
  const phoneNumber = (phoneInput && phoneInput.value) ? phoneInput.value.trim() : FOOTER_DEFAULTS.phoneNumber;
  const shopName = (shopInput && shopInput.value) ? shopInput.value.trim() : FOOTER_DEFAULTS.shopName;
  try {
    localStorage.setItem('footerContactPhrase', contactPhrase);
    localStorage.setItem('footerRegionCode', regionCode || FOOTER_DEFAULTS.regionCode);
    localStorage.setItem('footerPhoneNumber', phoneNumber);
    localStorage.setItem('footerShopName', shopName || FOOTER_DEFAULTS.shopName);
  } catch (e) { console.warn('Footer settings save failed', e); }
  applyFooterSettings();
}
function initFooterSettings() {
  loadFooterSettingsIntoForm();
  const regionSelect = document.getElementById('footerRegionCodeSelect');
  const otherWrap = document.getElementById('footerRegionCodeOtherWrap');
  if (regionSelect && otherWrap) {
    regionSelect.addEventListener('change', function () {
      otherWrap.style.display = regionSelect.value === '' ? 'block' : 'none';
    });
  }
  const saveBtn = document.getElementById('footerContactSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', function () { saveFooterSettingsFromForm(); typeof showToast === 'function' && showToast('✅ تم حفظ التذييل'); });
}

// Initialize social media links handlers
function initSocialMediaLinks() {
  const facebookInput = document.getElementById('facebookLinkInput');
  const instagramInput = document.getElementById('instagramLinkInput');
  const tiktokInput = document.getElementById('tiktokLinkInput');
  const facebookPasteBtn = document.getElementById('facebookPasteBtn');
  const instagramPasteBtn = document.getElementById('instagramPasteBtn');
  const tiktokPasteBtn = document.getElementById('tiktokPasteBtn');

  // Facebook input handler
  if (facebookInput) {
    facebookInput.addEventListener('input', function () {
      saveSocialLinksToFirebase();
    });

    facebookInput.addEventListener('blur', function () {
      saveSocialLinksToFirebase();
    });
  }

  // Instagram input handler
  if (instagramInput) {
    instagramInput.addEventListener('input', function () {
      saveSocialLinksToFirebase();
    });

    instagramInput.addEventListener('blur', function () {
      saveSocialLinksToFirebase();
    });
  }

  // TikTok input handler
  if (tiktokInput) {
    tiktokInput.addEventListener('input', function () {
      saveSocialLinksToFirebase();
    });

    tiktokInput.addEventListener('blur', function () {
      saveSocialLinksToFirebase();
    });
  }

  // Facebook paste button
  if (facebookPasteBtn) {
    facebookPasteBtn.addEventListener('click', async function () {
      try {
        const text = await navigator.clipboard.readText();
        if (text && facebookInput) {
          facebookInput.value = text;
          facebookInput.focus();
          saveSocialLinksToFirebase();
        }
      } catch (err) {
        if (facebookInput) {
          facebookInput.focus();
          document.execCommand('paste');
          setTimeout(() => {
            saveSocialLinksToFirebase();
          }, 100);
        }
      }
    });
  }

  // Instagram paste button
  if (instagramPasteBtn) {
    instagramPasteBtn.addEventListener('click', async function () {
      try {
        const text = await navigator.clipboard.readText();
        if (text && instagramInput) {
          instagramInput.value = text;
          instagramInput.focus();
          saveSocialLinksToFirebase();
        }
      } catch (err) {
        if (instagramInput) {
          instagramInput.focus();
          document.execCommand('paste');
          setTimeout(() => {
            saveSocialLinksToFirebase();
          }, 100);
        }
      }
    });
  }

  // TikTok paste button
  if (tiktokPasteBtn) {
    tiktokPasteBtn.addEventListener('click', async function () {
      try {
        const text = await navigator.clipboard.readText();
        if (text && tiktokInput) {
          tiktokInput.value = text;
          tiktokInput.focus();
          saveSocialLinksToFirebase();
        }
      } catch (err) {
        if (tiktokInput) {
          tiktokInput.focus();
          document.execCommand('paste');
          setTimeout(() => {
            saveSocialLinksToFirebase();
          }, 100);
        }
      }
    });
  }

  // Checkbox handlers for enabling/disabling social links
  const fbCheckbox = document.getElementById('facebookLinkEnabled');
  const igCheckbox = document.getElementById('instagramLinkEnabled');
  const ttCheckbox = document.getElementById('tiktokLinkEnabled');

  if (fbCheckbox) {
    fbCheckbox.addEventListener('change', function () {
      updateSocialButtonsVisibility();
      saveSocialLinksToFirebase();
    });
  }

  if (igCheckbox) {
    igCheckbox.addEventListener('change', function () {
      updateSocialButtonsVisibility();
      saveSocialLinksToFirebase();
    });
  }

  if (ttCheckbox) {
    ttCheckbox.addEventListener('change', function () {
      updateSocialButtonsVisibility();
      saveSocialLinksToFirebase();
    });
  }

  // Map CTA click handler - open direct link in new tab
  const mapCta = document.getElementById('mapCta');
  if (mapCta) {
    mapCta.addEventListener('click', function (e) {
      const mapsLinkEnabled = getStoredToggle('mapsLinkEnabled', true);
      if (!mapsLinkEnabled) {
        e.preventDefault();
        console.warn('Maps direct link disabled');
        alert('تم تعطيل رابط خرائط جوجل.');
        return;
      }

      // Get direct link from localStorage
      let directLink = null;
      try {
        directLink = localStorage.getItem('directMapsLink');
        if (directLink) {
          directLink = directLink.trim();
        }
      } catch (err) {
        console.error('Error reading directMapsLink from localStorage:', err);
      }

      // Also check the global variable
      if (!directLink && typeof directMapsLink !== 'undefined' && directMapsLink) {
        directLink = directMapsLink.trim();
      }

      // Check the input field as well
      if (!directLink || !directLink.startsWith('http')) {
        const mapsLinkInput = document.getElementById('mapsLinkInput');
        if (mapsLinkInput && mapsLinkInput.value.trim()) {
          const inputLink = mapsLinkInput.value.trim();
          if (inputLink.startsWith('http')) {
            directLink = inputLink;
          }
        }
      }

      if (directLink && directLink.startsWith('http')) {
        // Let the anchor open in a new tab
        mapCta.setAttribute('href', directLink);
        mapCta.setAttribute('target', '_blank');
        mapCta.setAttribute('rel', 'noopener noreferrer');
        return;
      }

      // No link available, stop navigation and warn
      e.preventDefault();
      console.warn('No direct Maps link available');
      alert('لم يتم إضافة رابط خرائط جوجل. يرجى إضافة الرابط في قسم الإعدادات.');
    });
  }

}

// Initialize iframe embed when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    initIframeEmbed();
    initSocialMediaLinks();
    initFooterSettings();
    // Load saved iframe and direct link after initialization
    setTimeout(() => {
      loadIframeFromLocalStorage();
      loadDirectLinkFromLocalStorage();
      loadSocialLinksFromFirebase();
    }, 100);
    // Apply long-title class to titles with more than 5 characters
    applyLongTitleClass();
  });
} else {
  initIframeEmbed();
  initSocialMediaLinks();
  initFooterSettings();
  // Load saved iframe and direct link after initialization
  setTimeout(() => {
    loadIframeFromLocalStorage();
    loadDirectLinkFromLocalStorage();
    loadSocialLinksFromFirebase();
  }, 100);
  // Apply long-title class to titles with 7 or more letters
  applyLongTitleClass();
}

// Function to apply long-title class to titles with 7 or more letters
function applyLongTitleClass() {
  const titles = document.querySelectorAll('.card-header .title');
  titles.forEach(title => {
    const text = title.textContent.trim();
    const charCount = text.replace(/\s/g, '').length;
    if (charCount >= 7) {
      title.classList.add('long-title');
    } else {
      title.classList.remove('long-title');
    }
  });
}

// Apply long-title class when new cards are added (using MutationObserver)
const observer = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    if (mutation.addedNodes.length) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) { // Element node
          const titles = node.querySelectorAll ? node.querySelectorAll('.card-header .title') : [];
          titles.forEach(title => {
            const text = title.textContent.trim();
            const charCount = text.replace(/\s/g, '').length;
            if (charCount >= 7) {
              title.classList.add('long-title');
            } else {
              title.classList.remove('long-title');
            }
          });
        }
      });
    }
  });
});

// Start observing when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    observer.observe(document.body, { childList: true, subtree: true });
  });
} else {
  observer.observe(document.body, { childList: true, subtree: true });
}

// Advanced Back to Top Button
(function () {
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (!backToTopBtn) return;

  let scrollTimeout;
  let isScrolling = false;

  // Show/hide button based on scroll position
  function handleScroll() {
    if (isScrolling) return;

    const scrollY = window.scrollY || window.pageYOffset;
    const showThreshold = 300; // Show after scrolling 300px

    if (scrollY > showThreshold) {
      backToTopBtn.classList.add('show');
    } else {
      backToTopBtn.classList.remove('show');
    }

    // Throttle scroll events
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, 100);
    isScrolling = true;
  }

  // Smooth scroll to top
  function scrollToTop() {
    const startPosition = window.pageYOffset;
    const startTime = performance.now();
    const duration = 800; // milliseconds

    function easeInOutCubic(t) {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function animateScroll(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeInOutCubic(progress);

      window.scrollTo(0, startPosition * (1 - ease));

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      } else {
        // Scroll complete
        backToTopBtn.classList.remove('show');
      }
    }

    requestAnimationFrame(animateScroll);
  }

  // Event listeners
  window.addEventListener('scroll', handleScroll, { passive: true });
  backToTopBtn.addEventListener('click', scrollToTop);

  // Keyboard support
  backToTopBtn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToTop();
    }
  });

  // Initial check
  handleScroll();

  // Handle resize for mobile/desktop
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(handleScroll, 150);
  }, { passive: true });
})();

// Welcome alert (first-time visitors)
(function setupMobileWelcomeAlert() {
  const init = () => {
    const overlay = document.getElementById('mobileWelcomeOverlay');
    if (!overlay) return;
    const textEl = document.getElementById('mobileWelcomeText');
    const closeBtn = document.getElementById('mobileWelcomeClose');
    const checkbox = document.getElementById('mobileWelcomeDontShow');
    const settingsToggle = document.getElementById('welcomeAlertEnabled');
    const settingsMessageInput = document.getElementById('welcomeAlertMessageInput');
    const dismissKey = 'mobileWelcomeDontShow';
    const enabledKey = 'welcomeAlertEnabled';
    const messageKey = 'welcomeAlertMessage';
    const meta = document.querySelector('meta[name="mobile-welcome-message"]');
    const metaMessage = meta?.content?.trim() || '';

    const wasDismissed = () => {
      try {
        return localStorage.getItem(dismissKey) === 'true';
      } catch (e) {
        return false;
      }
    };

    const setDismissed = (value) => {
      try {
        if (value) localStorage.setItem(dismissKey, 'true');
        else localStorage.removeItem(dismissKey);
      } catch (e) {
        // ignore storage failures
      }
    };

    const getStoredMessage = () => {
      try {
        const stored = localStorage.getItem(messageKey);
        if (stored && stored.trim()) return stored.trim();
      } catch (e) {
      }
      return '';
    };

    const resolveMessage = () => {
      return getStoredMessage() || metaMessage || (textEl ? textEl.textContent.trim() : '');
    };

    const show = () => {
      overlay.classList.add('is-visible');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };

    const hide = () => {
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    const applySettingsState = () => {
      const enabled = getStoredToggle(enabledKey, true);
      if (settingsToggle) {
        settingsToggle.checked = enabled;
      }
      if (settingsMessageInput) {
        settingsMessageInput.disabled = !enabled;
        settingsMessageInput.value = resolveMessage();
      }
      return enabled;
    };

    const persistMessage = (value) => {
      const cleaned = value.trim();
      try {
        if (cleaned) localStorage.setItem(messageKey, cleaned);
        else localStorage.removeItem(messageKey);
      } catch (e) {
      }
      if (textEl) {
        textEl.textContent = cleaned || metaMessage || textEl.textContent.trim();
      }
    };

    const updateEnabled = (enabled) => {
      setStoredToggle(enabledKey, enabled);
      if (settingsMessageInput) settingsMessageInput.disabled = !enabled;
      if (!enabled) {
        hide();
        return;
      }
      // Re-enable should show the alert even if it was previously dismissed
      setDismissed(false);
      show();
    };

    const enabled = applySettingsState();
    const message = resolveMessage();
    if (textEl && message) {
      textEl.textContent = message;
    }

    const dismissed = wasDismissed();
    const shouldShow = enabled && !dismissed;
    if (shouldShow) show();
    else hide();

    if (settingsMessageInput) {
      settingsMessageInput.addEventListener('input', function () {
        persistMessage(this.value);
      });
      settingsMessageInput.addEventListener('blur', function () {
        persistMessage(this.value);
      });
    }

    if (settingsToggle) {
      settingsToggle.addEventListener('change', function () {
        updateEnabled(settingsToggle.checked);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const dontShow = checkbox?.checked === true;
        setDismissed(dontShow);
        hide();
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Remove install app label if it exists (immediate removal)
(function () {
  const removeInstallLabel = () => {
    const installLabel = document.getElementById('installAppLabel');
    if (installLabel) installLabel.remove();
    const installLabels = document.querySelectorAll('.install-app-label');
    installLabels.forEach(el => el.remove());
  };
  removeInstallLabel();
  document.addEventListener('DOMContentLoaded', removeInstallLabel);
  setTimeout(removeInstallLabel, 100);
  setTimeout(removeInstallLabel, 500);
  setTimeout(removeInstallLabel, 1000);

  // Watch for dynamically added install labels
  const observer = new MutationObserver(() => {
    removeInstallLabel();
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();

// Lightbox functionality
(function () {
  const lightboxOverlay = document.getElementById('lightboxOverlay');
  const lightboxImage = document.getElementById('lightboxImage');
  const lightboxVideo = document.getElementById('lightboxVideo');
  const lightboxInfoPanel = document.getElementById('lightboxInfoPanel');
  const lightboxClose = document.getElementById('lightboxClose');
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  const viewportContent = viewportMeta?.getAttribute('content') || 'width=device-width,initial-scale=1,viewport-fit=cover';
  let scrollLockState = null;

  function isMobileOrTouch() {
    return window.innerWidth <= 768 || ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  }

  function refreshViewport() {
    if (!viewportMeta) return;
    viewportMeta.setAttribute('content', viewportContent);
    setTimeout(() => {
      viewportMeta.setAttribute('content', viewportContent);
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  function lockViewportForModal() {
    if (scrollLockState) return;
    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    scrollLockState = { scrollY };
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    if (isMobileOrTouch()) {
      document.body.style.overflow = 'hidden';
      document.body.style.overflowX = 'hidden';
    } else {
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    }
  }

  function unlockViewportForModal() {
    if (!scrollLockState) return;
    const { scrollY } = scrollLockState;
    scrollLockState = null;
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.overflowX = '';
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
        refreshViewport();
        setTimeout(refreshViewport, 80);
      });
    });
  }

  window.addEventListener('pageshow', () => {
    if (!scrollLockState) refreshViewport();
  });
  window.addEventListener('orientationchange', () => {
    if (!scrollLockState) refreshViewport();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (!scrollLockState) refreshViewport();
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function capitalizeFirstLetter(htmlString) {
    // Create a temporary element to parse the HTML
    const temp = document.createElement('div');
    temp.innerHTML = htmlString;

    // Find the first text node and capitalize its first letter
    const walker = document.createTreeWalker(
      temp,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let firstTextNode = walker.nextNode();
    if (firstTextNode && firstTextNode.textContent) {
      const text = firstTextNode.textContent;
      // Find the first letter (skip emojis, numbers, and special chars)
      const firstLetterMatch = text.match(/[a-zA-Z]/);
      if (firstLetterMatch) {
        const firstLetterIndex = text.indexOf(firstLetterMatch[0]);
        const before = text.substring(0, firstLetterIndex);
        const firstLetter = text.substring(firstLetterIndex, firstLetterIndex + 1).toUpperCase();
        const after = text.substring(firstLetterIndex + 1);
        firstTextNode.textContent = before + firstLetter + after;
      }
    }

    return temp.innerHTML;
  }

  function openLightbox(mediaSrc, title, isVideo = false, cardElement = null, catalogItem = null) {
    if (!mediaSrc) return;

    // Hide both initially
    lightboxImage.style.display = 'none';
    lightboxVideo.style.display = 'none';

    if (isVideo) {
      lightboxVideo.src = mediaSrc;
      lightboxVideo.style.display = 'block';
    } else {
      lightboxImage.src = mediaSrc;
      lightboxImage.style.display = 'block';
    }

    // Build info panel content
    let infoHTML = '';

    // When catalogItem is provided (e.g. from product-tile in todayListStep2), build full info from it
    if (catalogItem) {
      const fmtP = (x) => (x && x > 0) ? (x + ' د.ت') : '—';
      const titleHTML = escapeHtml(catalogItem.title || title || 'بدون عنوان');
      infoHTML += `<h2 class="lightbox-title">${capitalizeFirstLetter(titleHTML)}</h2>`;
      infoHTML += `<div class="lightbox-info-section">
            <div class="lightbox-price">
              ${catalogItem.was > catalogItem.price ? `<span class="was">${escapeHtml(fmtP(catalogItem.was))}</span>` : ''}
              <span class="now">${escapeHtml(fmtP(catalogItem.price))}</span>
            </div>
          </div>`;
      if (catalogItem.sizes?.length) {
        const sizesHTML = catalogItem.sizes.map(s => {
          if (typeof s === 'string' && s.includes('/')) {
            return s.split('/').map(p => `<span class="lightbox-chip">${escapeHtml(p.trim())}</span>`).join('<span class="chip-separator">/</span>');
          }
          return `<span class="lightbox-chip">${escapeHtml(String(s))}</span>`;
        }).join('');
        infoHTML += `<div class="lightbox-info-section">
              <div class="lightbox-info-label">المقاسات</div>
              <div class="lightbox-chips">${sizesHTML}</div>
            </div>`;
      }
      if (catalogItem.colors?.length) {
        infoHTML += `<div class="lightbox-info-section">
              <div class="lightbox-info-label">الألوان</div>
              <div class="lightbox-chips">
                ${catalogItem.colors.map(c => `<span class="lightbox-chip">${escapeHtml(c)}</span>`).join('')}
              </div>
            </div>`;
      }
      if (catalogItem.note) {
        infoHTML += `<div class="lightbox-info-section">
              <div class="lightbox-info-text">${escapeHtml(catalogItem.note)}</div>
            </div>`;
      }
      if (catalogItem.date) {
        infoHTML += `<div class="lightbox-info-section lightbox-date">
              <div class="lightbox-info-text">${escapeHtml(catalogItem.date)}</div>
            </div>`;
      }
    } else if (cardElement) {
      // Title - preserve HTML structure to keep emojis with original colors
      const cardTitle = cardElement.querySelector('.title');
      let titleHTML = '';
      if (cardTitle) {
        // Clone the title to preserve its structure
        const titleClone = cardTitle.cloneNode(true);
        titleHTML = titleClone.innerHTML;
      } else {
        titleHTML = escapeHtml(title || 'بدون عنوان');
      }
      // Capitalize first letter of title
      titleHTML = capitalizeFirstLetter(titleHTML);
      infoHTML += `<h2 class="lightbox-title">${titleHTML}</h2>`;

      // Price
      const priceBlock = cardElement.querySelector('.price-block');
      if (priceBlock) {
        const priceNow = priceBlock.querySelector('.now')?.textContent.trim() || '';
        const priceWas = priceBlock.querySelector('.was')?.textContent.trim() || '';
        if (priceNow) {
          infoHTML += `<div class="lightbox-info-section">
                <div class="lightbox-price">
                  ${priceWas ? `<span class="was">${escapeHtml(priceWas)}</span>` : ''}
                  <span class="now">${escapeHtml(priceNow)}</span>
                </div>
              </div>`;
        }
      }

      // Extract sizes and colors first
      let sizesFound = [];
      let colorsFound = [];

      const variantsBox = cardElement.querySelector('.variants-box');
      if (variantsBox) {
        const variantLines = variantsBox.querySelectorAll('.variant-line');
        variantLines.forEach(line => {
          const label = line.querySelector('.variant-label');
          if (label) {
            const labelText = label.textContent.trim();

            // Sizes from variant box
            if (labelText.includes('مقاس') || labelText.includes('حجم') || labelText.includes('Size')) {
              const sizesEl = line.querySelector('.sizes-text');
              if (sizesEl) {
                const sizesText = sizesEl.textContent.trim();
                // Split by common delimiters
                const sizesArray = sizesText.split(/[\s⇠,،]+/).filter(s => s.trim());
                sizesFound = sizesFound.concat(sizesArray);
              }
            }

            // Colors from variant box
            if (labelText.includes('لون') || labelText.includes('ألوان') || labelText.includes('Color')) {
              const colorSwatches = line.querySelectorAll('.color-swatch');
              if (colorSwatches.length > 0) {
                const colors = Array.from(colorSwatches).map(sw => {
                  const colorName = sw.getAttribute('data-color-name') || sw.getAttribute('title') || '';
                  return colorName;
                }).filter(c => c);
                colorsFound = colorsFound.concat(colors);
              }
            }
          }
        });
      }

      // Also check row elements for sizes
      const rows = cardElement.querySelectorAll('.row');
      rows.forEach(row => {
        const chipsInRow = row.querySelectorAll('.chip');
        chipsInRow.forEach(chip => {
          const chipText = chip.textContent.trim();
          // Check if it's a size (usually short like S, M, L, XL or numbers)
          if (/^[XSML\d]+$|^[0-9]+$/.test(chipText) && chipText.length <= 5) {
            if (!sizesFound.includes(chipText)) {
              sizesFound.push(chipText);
            }
          }
        });
      });

      // Extract all chips, but exclude sizes
      const allChips = Array.from(cardElement.querySelectorAll('.chip')).map(chip => chip.textContent.trim()).filter(c => c);
      const infoChips = allChips.filter(chip => {
        // Exclude sizes
        return !(/^[XSML\d]+$|^[0-9]+$/.test(chip) && chip.length <= 5);
      });

      // Display info chips if found
      if (infoChips.length > 0) {
        infoHTML += `<div class="lightbox-info-section">
              <div class="lightbox-info-label">المعلومات</div>
              <div class="lightbox-chips">
                ${infoChips.map(chip => `<span class="lightbox-chip">${escapeHtml(chip)}</span>`).join('')}
              </div>
            </div>`;
      }

      // Display sizes if found
      if (sizesFound.length > 0) {
        // Process sizes: if size contains "/", split and render with separator
        let sizesHTML = '';
        sizesFound.forEach((size, index) => {
          if (size.includes('/')) {
            // Split by "/" and render parts as chips with plain "/" separator
            const parts = size.split('/').map(s => s.trim()).filter(s => s);
            parts.forEach((part, partIndex) => {
              if (part) {
                sizesHTML += `<span class="lightbox-chip">${escapeHtml(part)}</span>`;
              }
              if (partIndex < parts.length - 1) {
                sizesHTML += '<span class="chip-separator">/</span>';
              }
            });
          } else {
            sizesHTML += `<span class="lightbox-chip">${escapeHtml(size)}</span>`;
          }
        });
        infoHTML += `<div class="lightbox-info-section">
              <div class="lightbox-info-label">المقاسات</div>
              <div class="lightbox-chips">
                ${sizesHTML}
              </div>
            </div>`;
      }

      // Display colors if found
      if (colorsFound.length > 0) {
        infoHTML += `<div class="lightbox-info-section">
              <div class="lightbox-info-label">الألوان</div>
              <div class="lightbox-chips">
                ${colorsFound.map(color => `<span class="lightbox-chip">${escapeHtml(color)}</span>`).join('')}
              </div>
            </div>`;
      }

      // Note (muted) from card
      const mutedEl = cardElement.querySelector('.content .muted');
      if (mutedEl) {
        const mutedText = mutedEl.textContent.trim();
        if (mutedText) {
          infoHTML += `<div class="lightbox-info-section">
                <div class="lightbox-info-text muted">${escapeHtml(mutedText)}</div>
              </div>`;
        }
      }

      // Status Badge
      const statusBadge = cardElement.querySelector('.status-badge');
      if (statusBadge) {
        const statusText = statusBadge.textContent.trim();
        if (statusText) {
          infoHTML += `<div class="lightbox-info-section">
                <div class="lightbox-info-label">الحالة</div>
                <div class="lightbox-info-text">${escapeHtml(statusText)}</div>
              </div>`;
        }
      }

      // Footer info (date)
      const footer = cardElement.querySelector('.footer');
      if (footer) {
        const footerText = footer.textContent.trim();
        if (footerText) {
          infoHTML += `<div class="lightbox-info-section lightbox-date">
                <div class="lightbox-info-text">${escapeHtml(footerText)}</div>
              </div>`;
        }
      }
    } else {
      // Fallback if no card element
      let fallbackTitle = escapeHtml(title || '');
      fallbackTitle = capitalizeFirstLetter(fallbackTitle);
      infoHTML += `<h2 class="lightbox-title">${fallbackTitle}</h2>`;
    }

    lightboxInfoPanel.innerHTML = infoHTML;
    lightboxOverlay.classList.add('active');
    lockViewportForModal();

    // Reset scroll position when opening new article (especially important for mobile)
    // Use setTimeout to ensure DOM is updated before resetting scroll
    if (window.innerWidth <= 1024) {
      setTimeout(() => {
        if (lightboxInfoPanel) {
          lightboxInfoPanel.scrollTop = 0;
        }
      }, 0);
      // Also reset on next frame to be sure
      requestAnimationFrame(() => {
        if (lightboxInfoPanel) {
          lightboxInfoPanel.scrollTop = 0;
        }
      });
    }
  }

  function closeLightbox() {
    lightboxOverlay.classList.remove('active');
    unlockViewportForModal();
    // Pause video if playing
    if (lightboxVideo) {
      lightboxVideo.pause();
      lightboxVideo.currentTime = 0;
    }
    // Clear media after animation
    setTimeout(() => {
      lightboxImage.src = '';
      lightboxImage.style.display = 'none';
      lightboxVideo.src = '';
      lightboxVideo.style.display = 'none';
      lightboxInfoPanel.innerHTML = '';
    }, 300);
  }

  // Close button
  lightboxClose.addEventListener('click', closeLightbox);

  // Close on overlay click (but not on content click)
  lightboxOverlay.addEventListener('click', function (e) {
    if (e.target === lightboxOverlay) {
      closeLightbox();
    }
  });

  // Prevent closing when clicking inside content
  const lightboxContent = document.querySelector('.lightbox-content');
  if (lightboxContent) {
    lightboxContent.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lightboxOverlay.classList.contains('active')) {
      closeLightbox();
    }
  });

  // Helper function to get image source (handles IndexedDB paths)
  function getImageSource(img) {
    // Check for data-image-path attribute (IndexedDB images)
    const dataPath = img.getAttribute('data-image-path');
    if (dataPath) {
      // If it's an IndexedDB path, we need to get the blob URL
      // The app.js should have already set the src, but we'll use it as fallback
      return img.src || dataPath;
    }
    // For video elements, check data-video-path
    const videoPath = img.getAttribute('data-video-path');
    if (videoPath) {
      return img.src || videoPath;
    }
    // Regular image source
    return img.src || img.getAttribute('src') || '';
  }

  // Make images and titles clickable
  function setupLightboxListeners() {
    // Use event delegation for dynamically added content
    document.addEventListener('click', function (e) {
      // Prevent if clicking on action buttons
      if (e.target.closest('.quick-action-btn') || e.target.closest('.delete-btn')) {
        return;
      }

      // Check if clicked on product-tile (todayListStep2) - frame, img, or name
      const productTile = e.target.closest('.product-tile');
      if (productTile) {
        const frame = productTile.querySelector('.product-tile__frame');
        const img = frame && frame.querySelector('img');
        const clickedFrame = e.target.closest('.product-tile__frame');
        const clickedName = e.target.closest('.product-tile__name');
        if (clickedFrame || clickedName) {
          let mediaSrc = img ? getImageSource(img) : '';
          let isVideo = false;
          const catalog = (typeof window !== 'undefined' && window.CATALOG) ? window.CATALOG : [];
          const catalogItem = productTile.dataset.id ? catalog.find(x => x.id === productTile.dataset.id) : null;
          if (!mediaSrc && catalogItem) {
            if (catalogItem.video?.trim()) {
              mediaSrc = (typeof window.getImageSrc === 'function' ? window.getImageSrc : (p) => p || '')(catalogItem.video.trim());
              isVideo = true;
            } else if (catalogItem.img?.trim()) {
              mediaSrc = (typeof window.getImageSrc === 'function' ? window.getImageSrc : (p) => p || '')(catalogItem.img.trim());
            }
          }
          if (mediaSrc) {
            e.preventDefault();
            e.stopPropagation();
            const titleEl = productTile.querySelector('.product-tile__name');
            const title = titleEl ? titleEl.textContent.trim() : (catalogItem && catalogItem.title) || '';
            openLightbox(mediaSrc, title, isVideo, productTile, catalogItem);
            return;
          }
        }
      }

      // Check if clicked on an image container
      const imgContainer = e.target.closest('.img');
      if (imgContainer) {
        const media = imgContainer.querySelector('img, video');
        if (media) {
          e.preventDefault();
          e.stopPropagation();
          const mediaSrc = getImageSource(media);
          const isVideo = media.tagName === 'VIDEO';
          const card = imgContainer.closest('.card');
          let title = '';
          if (card) {
            const titleEl = card.querySelector('.title');
            if (titleEl) {
              title = titleEl.textContent.trim();
            }
          }
          if (mediaSrc) {
            openLightbox(mediaSrc, title, isVideo, card);
            return;
          }
        }
      }

      // Check if clicked on an image or video directly
      const media = e.target.closest('.img img, .img video, .img-frame img, .img-frame video');
      if (media) {
        e.preventDefault();
        e.stopPropagation();
        const mediaSrc = getImageSource(media);
        const isVideo = media.tagName === 'VIDEO';
        const card = media.closest('.card');
        let title = '';
        if (card) {
          const titleEl = card.querySelector('.title');
          if (titleEl) {
            title = titleEl.textContent.trim();
          }
        }
        if (mediaSrc) {
          openLightbox(mediaSrc, title, isVideo, card);
        }
      }

      // Check if clicked on a title
      const title = e.target.closest('.title');
      if (title && !e.target.closest('.quick-action-btn') && !e.target.closest('.delete-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const card = title.closest('.card');
        if (card) {
          const media = card.querySelector('.img img, .img video, .img-frame img, .img-frame video');
          if (media) {
            const mediaSrc = getImageSource(media);
            const isVideo = media.tagName === 'VIDEO' || media.closest('.img video, .img-frame video');
            const titleText = title.textContent.trim();
            if (mediaSrc) {
              openLightbox(mediaSrc, titleText, !!isVideo, card);
            }
          }
        }
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLightboxListeners);
  } else {
    setupLightboxListeners();
  }
})();

// Click and drag scrolling for horizontal lists
(function () {
  const initializedContainers = new Set();
  let rafId = null;

  function setupDragScroll(containerId) {
    const container = document.getElementById(containerId);
    if (!container || initializedContainers.has(containerId)) return;
    initializedContainers.add(containerId);

    let isDown = false;
    let startX;
    let scrollLeftStart;

    container.addEventListener('mousedown', (e) => {
      // Don't start dragging if clicking on interactive elements
      if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.delete-btn')) {
        return;
      }

      isDown = true;
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
      startX = e.pageX - container.offsetLeft;
      scrollLeftStart = container.scrollLeft;
      e.preventDefault();
    });

    container.addEventListener('mouseleave', () => {
      isDown = false;
      container.style.cursor = 'grab';
      container.style.userSelect = '';
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    });

    container.addEventListener('mouseup', () => {
      isDown = false;
      container.style.cursor = 'grab';
      container.style.userSelect = '';
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    });

    container.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();

      // Throttle with requestAnimationFrame for better performance
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed multiplier
        container.scrollLeft = scrollLeftStart - walk;
        rafId = null;
      });
    });

    // Set initial cursor style
    container.style.cursor = 'grab';
  }

  function initDragScroll() {
    setupDragScroll('todayListStep2Grid');
    setupDragScroll('saleListStep2Grid');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDragScroll);
  } else {
    initDragScroll();
  }

  // Re-initialize when sections are dynamically shown (after content is rendered)
  let debounceTimer = null;
  const observer = new MutationObserver((mutations) => {
    // Debounce to avoid multiple rapid calls
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const target = mutation.target;
          if ((target.id === 'todayListStep2' || target.id === 'saleListStep2') &&
            target.style.display !== 'none') {
            // Only re-init if containers exist and aren't initialized
            const todayContainer = document.getElementById('todayListStep2Grid');
            const saleContainer = document.getElementById('saleListStep2Grid');
            if (todayContainer && !initializedContainers.has('todayListStep2Grid')) {
              setupDragScroll('todayListStep2Grid');
            }
            if (saleContainer && !initializedContainers.has('saleListStep2Grid')) {
              setupDragScroll('saleListStep2Grid');
            }
          }
        }
      });
    }, 150);
  });

  // Observe both sections for display changes
  setTimeout(() => {
    const todaySection = document.getElementById('todayListStep2');
    const saleSection = document.getElementById('saleListStep2');
    if (todaySection) observer.observe(todaySection, { attributes: true, attributeFilter: ['style'] });
    if (saleSection) observer.observe(saleSection, { attributes: true, attributeFilter: ['style'] });
  }, 500);
})();

// Article selection highlight in horizontal scroll lists
(function () {
  const initializedContainers = new Set();
  const containerCache = { today: null, sale: null };
  let mousemoveRafId = null;

  function setupArticleSelection(containerId) {
    const container = document.getElementById(containerId);
    if (!container || initializedContainers.has(containerId)) return;
    initializedContainers.add(containerId);

    let dragStartX = null;
    let dragStartY = null;
    let isDragging = false;

    container.addEventListener('mousedown', (e) => {
      // Store initial mouse position
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      isDragging = false;
    });

    container.addEventListener('mousemove', (e) => {
      // Throttle mousemove with requestAnimationFrame
      if (mousemoveRafId) return;

      mousemoveRafId = requestAnimationFrame(() => {
        // If mouse moved more than 5px, consider it dragging
        if (dragStartX !== null && dragStartY !== null) {
          const deltaX = Math.abs(e.clientX - dragStartX);
          const deltaY = Math.abs(e.clientY - dragStartY);
          if (deltaX > 5 || deltaY > 5) {
            isDragging = true;
          }
        }
        mousemoveRafId = null;
      });
    });

    container.addEventListener('mouseup', (e) => {
      // Only select if it was a click, not a drag
      if (!isDragging && dragStartX !== null) {
        const card = e.target.closest('.card');

        // Don't select if clicking on interactive elements
        if (card &&
          !e.target.closest('button') &&
          !e.target.closest('a') &&
          !e.target.closest('.delete-btn') &&
          !e.target.closest('.quick-action-btn')) {

          // Remove selection from all cards in this container
          const allCards = container.querySelectorAll('.card');
          allCards.forEach(c => c.classList.remove('selected'));

          // Add selection to clicked card
          card.classList.add('selected');
        }
      }

      // Reset
      dragStartX = null;
      dragStartY = null;
      isDragging = false;
      if (mousemoveRafId) {
        cancelAnimationFrame(mousemoveRafId);
        mousemoveRafId = null;
      }
    });

    // Also handle touch events for mobile
    container.addEventListener('touchstart', (e) => {
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      isDragging = false;
    });

    container.addEventListener('touchmove', (e) => {
      if (dragStartX !== null && dragStartY !== null) {
        const deltaX = Math.abs(e.touches[0].clientX - dragStartX);
        const deltaY = Math.abs(e.touches[0].clientY - dragStartY);
        if (deltaX > 10 || deltaY > 10) {
          isDragging = true;
        }
      }
    });

    container.addEventListener('touchend', (e) => {
      if (!isDragging && dragStartX !== null) {
        const touch = e.changedTouches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const card = element ? element.closest('.card') : null;

        if (card &&
          !element.closest('button') &&
          !element.closest('a') &&
          !element.closest('.delete-btn')) {

          const allCards = container.querySelectorAll('.card');
          allCards.forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        }
      }

      dragStartX = null;
      dragStartY = null;
      isDragging = false;
    });
  }

  function initArticleSelection() {
    setupArticleSelection('todayListStep2Grid');
    setupArticleSelection('saleListStep2Grid');

    // Cache container references
    containerCache.today = document.getElementById('todayListStep2Grid');
    containerCache.sale = document.getElementById('saleListStep2Grid');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initArticleSelection);
  } else {
    initArticleSelection();
  }

  // Clear selection when clicking outside the containers (cached references)
  document.addEventListener('click', (e) => {
    const todayContainer = containerCache.today || document.getElementById('todayListStep2Grid');
    const saleContainer = containerCache.sale || document.getElementById('saleListStep2Grid');

    // Update cache if needed
    if (!containerCache.today) containerCache.today = todayContainer;
    if (!containerCache.sale) containerCache.sale = saleContainer;

    // Check if click is outside both containers
    const clickedInsideToday = todayContainer && todayContainer.contains(e.target);
    const clickedInsideSale = saleContainer && saleContainer.contains(e.target);

    if (!clickedInsideToday && !clickedInsideSale) {
      // Clear all selections
      if (todayContainer) {
        const todayCards = todayContainer.querySelectorAll('.card.selected');
        todayCards.forEach(c => c.classList.remove('selected'));
      }
      if (saleContainer) {
        const saleCards = saleContainer.querySelectorAll('.card.selected');
        saleCards.forEach(c => c.classList.remove('selected'));
      }
    }
  });

  // Re-initialize when content changes (optimized with debouncing and childList only)
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    // Debounce to prevent excessive re-initialization
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // Only re-init if containers exist and aren't initialized
      const todayContainer = document.getElementById('todayListStep2Grid');
      const saleContainer = document.getElementById('saleListStep2Grid');

      if (todayContainer && !initializedContainers.has('todayListStep2Grid')) {
        setupArticleSelection('todayListStep2Grid');
        containerCache.today = todayContainer;
      }
      if (saleContainer && !initializedContainers.has('saleListStep2Grid')) {
        setupArticleSelection('saleListStep2Grid');
        containerCache.sale = saleContainer;
      }
    }, 200);
  });

  setTimeout(() => {
    const todayContainer = document.getElementById('todayListStep2Grid');
    const saleContainer = document.getElementById('saleListStep2Grid');
    // Only observe direct children, not entire subtree for better performance
    if (todayContainer) observer.observe(todayContainer, { childList: true });
    if (saleContainer) observer.observe(saleContainer, { childList: true });
  }, 500);
})();

// Auto-adjust title sizes for long titles in mobile (more than 10 characters)
(function () {
  function adjustTitleSizes() {
    // Only run in mobile view
    if (window.innerWidth > 620) return;

    const todayGrid = document.getElementById('todayGrid');
    const saleGrid = document.getElementById('saleGrid');

    function processTitles(container) {
      if (!container) return;
      const titles = container.querySelectorAll('.title');
      titles.forEach(title => {
        const text = title.textContent.trim();
        const charCount = text.replace(/\s/g, '').length;
        if (charCount >= 7) {
          title.classList.add('long-title');
        } else {
          title.classList.remove('long-title');
        }
      });
    }

    processTitles(todayGrid);
    processTitles(saleGrid);
  }

  // Run on load
  function init() {
    adjustTitleSizes();

    // Watch for new cards being added
    const todayGrid = document.getElementById('todayGrid');
    const saleGrid = document.getElementById('saleGrid');

    if (todayGrid) {
      const observer1 = new MutationObserver(() => {
        adjustTitleSizes();
      });
      observer1.observe(todayGrid, { childList: true, subtree: true });
    }

    if (saleGrid) {
      const observer2 = new MutationObserver(() => {
        adjustTitleSizes();
      });
      observer2.observe(saleGrid, { childList: true, subtree: true });
    }

    // Also adjust on window resize (in case switching between mobile/desktop)
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(adjustTitleSizes, 250);
    });
  }

  // ... le reste du code existant ...

  // Exposer les fonctions pour qu'elles soient accessibles globalement
   // Exposer les fonctions pour qu'elles soient accessibles globalement
  window.uploadToR2 = uploadToR2;
  window.backendUploadImage = backendUploadImage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(); // fin de la IIFE
