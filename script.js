'use strict';

const APP_NAME = 'LEVEL UP';
const SCHEMA_VERSION = 1;
const DB_NAME = 'levelup-db';
const DB_VERSION = 1;
const STORE_ACCOUNTS = 'accounts';
const STORE_WORLDS = 'worlds';
const LS_SETTINGS_KEY = 'levelup.settings';
const LS_SESSION_KEY = 'levelup.session';
const LS_FALLBACK_PREFIX = 'levelup.fallback.';
const SAVE_DEBOUNCE_MS = 350;
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5];
const STAGE_LABELS = { primary: 'الابتدائية', middle: 'الإعدادية', secondary: 'الثانوية', university: 'الجامعة', other: 'مرحلة أخرى' };
const GOAL_LABELS = { 'top-score': 'التفوق والدرجات العالية', pass: 'النجاح بثقة', 'catch-up': 'تعويض ما فاتني', consistency: 'الانتظام في المذاكرة', 'exam-prep': 'الاستعداد لامتحان قريب' };
const LEVEL_LABELS = { 1: 'أحتاج لبداية قوية', 2: 'متوسط', 3: 'جيد', 4: 'متقدم' };
const DIFFICULTY_LABELS = { 1: 'سهلة', 2: 'متوسطة السهولة', 3: 'متوسطة', 4: 'صعبة', 5: 'صعبة جدًا' };
const MASTERY_LABELS = { 1: 'ضعيف', 2: 'متوسط', 3: 'جيد', 4: 'ممتاز' };
const SESSION_TYPES = { study: 'مذاكرة وفهم', continue: 'استكمال', practice: 'حل', review: 'مراجعة', selftest: 'اختبار ذاتي' };
const SESSION_STATUS_LABELS = { pending: 'لم تبدأ', active: 'جارية', done: 'مكتملة', missed: 'لم تكتمل' };
const LECTURE_STATUS_LABELS = { new: 'جديدة', progress: 'قيد المذاكرة', done: 'مكتملة' };
const REVIEW_STATUS_LABELS = { pending: 'مستحقة', done: 'تمت', skipped: 'تم تخطيها' };
const PET_SPECIES = { dragon: 'تنين الجمر', owl: 'بومة النجوم', fox: 'ثعلب الضباب', wisp: 'كائن الشفق' };
const MOTIFS = ['scroll', 'globe', 'sigma', 'flask', 'atom', 'pen', 'landmark', 'code', 'leaf'];
const TEACHER_AVATARS = ['sage', 'scroll', 'atom', 'pen', 'landmark', 'sigma'];
const SUBJECT_COLORS = ['#8b5cf6', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#f97316', '#2dd4bf', '#a3e635'];
const DEFAULT_REVIEW_INTERVALS = [1, 3, 7, 14];

const LIMITS = {
  subjects: 100,
  teachers: 200,
  lectures: 5000,
  sessions: 30000,
  reviews: 30000,
  exams: 200,
  studyLog: 20000,
  snapshots: 800,
  log: 1000,
  awards: 40000,
  reasons: 30000
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function uid(prefix = 'id') {
  let random = '';
  if (window.crypto && crypto.getRandomValues) {
    const arr = new Uint32Array(2);
    crypto.getRandomValues(arr);
    random = arr[0].toString(36) + arr[1].toString(36);
  } else {
    random = Math.random().toString(36).slice(2, 10);
  }
  return prefix + '_' + Date.now().toString(36) + random;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function toText(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function toId(value) {
  const s = String(value == null ? '' : value);
  return /^[\w\-]{1,64}$/.test(s) ? s : '';
}

function toColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value).toLowerCase() : SUBJECT_COLORS[0];
}

function toTime(value, fallback) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)) ? String(value) : fallback;
}

function toDayList(value) {
  const set = new Set();
  (Array.isArray(value) ? value : []).forEach((d) => {
    const n = Number(d);
    if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  });
  return Array.from(set).sort((a, b) => a - b);
}

function pick(value, list, fallback) {
  return list.includes(value) ? value : fallback;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateToStr(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

function todayStr() {
  return dateToStr(new Date());
}

function strToDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d;
}

function isValidDateStr(str) {
  return strToDate(str) !== null;
}

function toDateOrNull(value) {
  return isValidDateStr(value) ? String(value) : null;
}

function addDays(str, amount) {
  const d = strToDate(str) || new Date();
  d.setDate(d.getDate() + amount);
  return dateToStr(d);
}

function diffDays(from, to) {
  const a = strToDate(from);
  const b = strToDate(to);
  if (!a || !b) return 0;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

function dayOfWeek(str) {
  const d = strToDate(str);
  return d ? d.getDay() : 0;
}

function formatDateAr(str, withWeekday = true) {
  const d = strToDate(str);
  if (!d) return '';
  const options = withWeekday ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long' };
  try {
    return new Intl.DateTimeFormat('ar-EG-u-nu-latn', options).format(d);
  } catch (e) {
    return str;
  }
}

function relativeDayLabel(str) {
  const delta = diffDays(todayStr(), str);
  if (delta === 0) return 'اليوم';
  if (delta === 1) return 'غدًا';
  if (delta === -1) return 'أمس';
  if (delta > 1 && delta < 8) return 'بعد ' + (delta === 2 ? 'يومين' : delta + ' أيام');
  if (delta < -1 && delta > -8) return 'منذ ' + (delta === -2 ? 'يومين' : Math.abs(delta) + ' أيام');
  return formatDateAr(str, false);
}

function formatMinutes(total) {
  const m = Math.max(0, Math.round(Number(total) || 0));
  if (m < 60) return m + ' دقيقة';
  const h = Math.floor(m / 60);
  const r = m % 60;
  let label;
  if (h === 1) label = 'ساعة';
  else if (h === 2) label = 'ساعتان';
  else if (h <= 10) label = h + ' ساعات';
  else label = h + ' ساعة';
  return r ? label + ' و' + r + ' دقيقة' : label;
}

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (h ? pad2(h) + ':' : '') + pad2(m) + ':' + pad2(sec);
}

function formatPercent(value) {
  return Math.round(clamp(Number(value) || 0, 0, 100)) + '%';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, wait) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function deepClone(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch (e) {
      return JSON.parse(JSON.stringify(value));
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, value: null };
  }
}

function findById(list, id) {
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

function sortBy(list, keyFn, direction = 1) {
  return list.slice().sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (ka < kb) return -1 * direction;
    if (ka > kb) return 1 * direction;
    return 0;
  });
}

const bus = {
  handlers: {},
  on(name, fn) {
    if (!this.handlers[name]) this.handlers[name] = [];
    this.handlers[name].push(fn);
    return () => {
      this.handlers[name] = this.handlers[name].filter((h) => h !== fn);
    };
  },
  emit(name, data) {
    (this.handlers[name] || []).slice().forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error(e);
      }
    });
  }
};

function toast(message, kind = 'info', duration = 3600) {
  const host = $('#toasts');
  if (!host) return;
  const node = document.createElement('div');
  node.className = 'toast toast-' + kind;
  node.textContent = message;
  host.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 400);
  }, duration);
}

function setFieldError(key, message) {
  const holder = document.querySelector('[data-error-for="' + key + '"]');
  if (holder) {
    holder.textContent = message || '';
    holder.hidden = !message;
  }
  const input = document.getElementById(key);
  if (input) {
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}

function clearFieldErrors(root = document) {
  $$('[data-error-for]', root).forEach((node) => {
    node.textContent = '';
    node.hidden = true;
  });
  $$('[aria-invalid]', root).forEach((node) => node.removeAttribute('aria-invalid'));
}

const deviceSettings = { quality: 'medium', reduceMotion: false, sound: false };

function loadDeviceSettings() {
  const mobile = /Mobi|Android/i.test(navigator.userAgent || '');
  deviceSettings.quality = mobile ? 'low' : 'medium';
  deviceSettings.reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (['low', 'medium', 'high'].includes(parsed.quality)) deviceSettings.quality = parsed.quality;
    if (typeof parsed.reduceMotion === 'boolean') deviceSettings.reduceMotion = parsed.reduceMotion;
    if (typeof parsed.sound === 'boolean') deviceSettings.sound = parsed.sound;
  } catch (e) {
    return;
  }
}

function saveDeviceSettings() {
  try {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(deviceSettings));
  } catch (e) {
    toast('تعذر حفظ إعدادات الجهاز', 'warn');
  }
  bus.emit('settings:device', deviceSettings);
}

function getSessionAccountId() {
  try {
    return localStorage.getItem(LS_SESSION_KEY) || '';
  } catch (e) {
    return '';
  }
}

function setSessionAccountId(id) {
  try {
    localStorage.setItem(LS_SESSION_KEY, id);
  } catch (e) {
    return;
  }
}

function clearSessionAccountId() {
  try {
    localStorage.removeItem(LS_SESSION_KEY);
  } catch (e) {
    return;
  }
}

const storage = { driver: null, db: null };
const memoryStore = { accounts: new Map(), worlds: new Map() };
const keyFields = { accounts: 'id', worlds: 'accountId' };

function openIndexedDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window) || !window.indexedDB) {
      reject(new Error('no-idb'));
      return;
    }
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) db.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_WORLDS)) db.createObjectStore(STORE_WORLDS, { keyPath: 'accountId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('idb-open'));
    request.onblocked = () => reject(new Error('idb-blocked'));
  });
}

function idbRequest(storeName, mode, action) {
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = storage.db.transaction(storeName, mode);
    } catch (e) {
      reject(e);
      return;
    }
    const store = tx.objectStore(storeName);
    let result;
    let request;
    try {
      request = action(store);
    } catch (e) {
      reject(e);
      return;
    }
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('tx-abort'));
  });
}

function lsKey(storeName, key) {
  return LS_FALLBACK_PREFIX + storeName + '.' + key;
}

const driverApi = {
  async get(storeName, key) {
    if (storage.driver === 'idb') {
      const value = await idbRequest(storeName, 'readonly', (s) => s.get(key));
      return value === undefined ? null : value;
    }
    if (storage.driver === 'ls') {
      const raw = localStorage.getItem(lsKey(storeName, key));
      return raw ? JSON.parse(raw) : null;
    }
    return memoryStore[storeName].has(key) ? deepClone(memoryStore[storeName].get(key)) : null;
  },
  async put(storeName, value) {
    if (storage.driver === 'idb') {
      await idbRequest(storeName, 'readwrite', (s) => s.put(value));
      return;
    }
    const key = value[keyFields[storeName]];
    if (storage.driver === 'ls') {
      localStorage.setItem(lsKey(storeName, key), JSON.stringify(value));
      return;
    }
    memoryStore[storeName].set(key, deepClone(value));
  },
  async remove(storeName, key) {
    if (storage.driver === 'idb') {
      await idbRequest(storeName, 'readwrite', (s) => s.delete(key));
      return;
    }
    if (storage.driver === 'ls') {
      localStorage.removeItem(lsKey(storeName, key));
      return;
    }
    memoryStore[storeName].delete(key);
  },
  async all(storeName) {
    if (storage.driver === 'idb') {
      const rows = await idbRequest(storeName, 'readonly', (s) => s.getAll());
      return rows || [];
    }
    if (storage.driver === 'ls') {
      const prefix = lsKey(storeName, '');
      const rows = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.indexOf(prefix) === 0) {
          const parsed = safeJsonParse(localStorage.getItem(key));
          if (parsed.ok && parsed.value) rows.push(parsed.value);
        }
      }
      return rows;
    }
    return Array.from(memoryStore[storeName].values()).map((v) => deepClone(v));
  },
  async clear(storeName) {
    if (storage.driver === 'idb') {
      await idbRequest(storeName, 'readwrite', (s) => s.clear());
      return;
    }
    if (storage.driver === 'ls') {
      const prefix = lsKey(storeName, '');
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.indexOf(prefix) === 0) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
      return;
    }
    memoryStore[storeName].clear();
  }
};

async function initStorage() {
  try {
    storage.db = await openIndexedDb();
    storage.driver = 'idb';
    storage.db.onversionchange = () => {
      storage.db.close();
    };
    await idbRequest(STORE_ACCOUNTS, 'readonly', (s) => s.count());
  } catch (e) {
    storage.db = null;
    storage.driver = 'ls';
    try {
      localStorage.setItem(LS_FALLBACK_PREFIX + 'probe', '1');
      localStorage.removeItem(LS_FALLBACK_PREFIX + 'probe');
    } catch (err) {
      storage.driver = 'memory';
    }
  }
  return storage.driver;
}

function storageNotice() {
  if (storage.driver === 'idb') return '';
  if (storage.driver === 'ls') return 'قاعدة IndexedDB غير متاحة في هذا المتصفح، لذلك تُحفظ بياناتك في LocalStorage بسعة أقل.';
  return 'التخزين المحلي غير متاح (ربما بسبب التصفح الخاص). ستضيع بياناتك عند إغلاق الصفحة، فصدّر نسخة احتياطية قبل الخروج.';
}

async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch (e) {
    return false;
  }
  return false;
}

function randomSalt() {
  const arr = new Uint8Array(16);
  if (window.crypto && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i += 1) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function cyrb53(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

function subtleAvailable() {
  return !!(window.crypto && crypto.subtle && window.TextEncoder);
}

async function hashPassword(password, salt, algo) {
  const data = salt + ':' + password;
  if (algo === 'sha256') {
    if (!subtleAvailable()) return null;
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return cyrb53(data);
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function validateUsername(username) {
  const name = String(username || '').trim();
  if (name.length < 3) return 'اسم المستخدم يجب ألا يقل عن 3 أحرف';
  if (name.length > 24) return 'اسم المستخدم يجب ألا يزيد على 24 حرفًا';
  if (!/^[\p{L}\p{N}_.\-]+$/u.test(name)) return 'يُسمح بالحروف والأرقام والرموز _ . - فقط';
  return '';
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 4) return 'كلمة المرور يجب ألا تقل عن 4 أحرف';
  if (value.length > 64) return 'كلمة المرور يجب ألا تزيد على 64 حرفًا';
  return '';
}

async function listAccounts() {
  const rows = await driverApi.all(STORE_ACCOUNTS);
  return rows
    .map((a) => ({ id: a.id, username: a.username, lastLoginAt: a.lastLoginAt || 0 }))
    .sort((a, b) => b.lastLoginAt - a.lastLoginAt);
}

function createEmptyState(account) {
  const now = Date.now();
  return {
    schema: SCHEMA_VERSION,
    accountId: account.id,
    username: account.username,
    createdAt: now,
    updatedAt: now,
    profile: { name: '', stage: '', grade: '', country: '', goal: '', goalText: '', level: 2, onboarded: false },
    availability: { minutes: { 0: 120, 1: 120, 2: 120, 3: 120, 4: 120, 5: 60, 6: 120 }, busy: [], rest: [] },
    exams: [],
    subjects: [],
    teachers: [],
    lectures: [],
    sessions: [],
    reviews: [],
    pet: null,
    progress: { totalXp: 0, gems: 0, sessionsDone: 0, lecturesDone: 0, reviewsDone: 0, minutesStudied: 0, backlogCleared: 0 },
    achievements: { badges: {}, cosmetics: { owned: [], equipped: [] }, log: [] },
    awards: {},
    studyLog: [],
    backlogSnapshots: [],
    plan: { generatedAt: null, horizon: 14, reasons: {}, notes: [] },
    world: { unlockedStages: {} },
    settings: { reviewIntervals: DEFAULT_REVIEW_INTERVALS.slice() }
  };
}

async function createAccount(username, password) {
  const usernameError = validateUsername(username);
  if (usernameError) return { ok: false, field: 'signupUsername', message: usernameError };
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, field: 'signupPassword', message: passwordError };
  const id = normalizeUsername(username);
  const existing = await driverApi.get(STORE_ACCOUNTS, id);
  if (existing) return { ok: false, field: 'signupUsername', message: 'اسم المستخدم مستخدم بالفعل على هذا الجهاز' };
  const salt = randomSalt();
  const algo = subtleAvailable() ? 'sha256' : 'cyrb';
  const hash = await hashPassword(password, salt, algo);
  const account = { id, username: String(username).trim(), salt, algo, hash, createdAt: Date.now(), lastLoginAt: Date.now() };
  await driverApi.put(STORE_ACCOUNTS, account);
  const world = createEmptyState(account);
  await driverApi.put(STORE_WORLDS, world);
  return { ok: true, account: { id: account.id, username: account.username } };
}

async function verifyLogin(username, password) {
  const id = normalizeUsername(username);
  if (!id) return { ok: false, field: 'loginUsername', message: 'اكتب اسم المستخدم' };
  if (!password) return { ok: false, field: 'loginPassword', message: 'اكتب كلمة المرور' };
  const account = await driverApi.get(STORE_ACCOUNTS, id);
  if (!account) return { ok: false, field: 'loginUsername', message: 'لا يوجد حساب بهذا الاسم على هذا الجهاز' };
  const hash = await hashPassword(password, account.salt, account.algo);
  if (hash === null) return { ok: false, field: 'loginPassword', message: 'تعذر التحقق من كلمة المرور في هذا السياق. افتح الصفحة عبر localhost أو Live Server' };
  if (hash !== account.hash) return { ok: false, field: 'loginPassword', message: 'كلمة المرور غير صحيحة' };
  account.lastLoginAt = Date.now();
  await driverApi.put(STORE_ACCOUNTS, account);
  return { ok: true, account: { id: account.id, username: account.username } };
}

async function getAccount(id) {
  const account = await driverApi.get(STORE_ACCOUNTS, id);
  return account ? { id: account.id, username: account.username } : null;
}

function sanitizeProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    name: toText(p.name, 40),
    stage: pick(p.stage, Object.keys(STAGE_LABELS), ''),
    grade: toText(p.grade, 40),
    country: toText(p.country, 40),
    goal: pick(p.goal, Object.keys(GOAL_LABELS), ''),
    goalText: toText(p.goalText, 120),
    level: toInt(p.level, 1, 4, 2),
    onboarded: p.onboarded === true
  };
}

function sanitizeAvailability(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const source = a.minutes && typeof a.minutes === 'object' ? a.minutes : {};
  const defaults = { 0: 120, 1: 120, 2: 120, 3: 120, 4: 120, 5: 60, 6: 120 };
  const minutes = {};
  for (let d = 0; d <= 6; d += 1) minutes[d] = toInt(source[d], 0, 720, defaults[d]);
  return { minutes, busy: toDayList(a.busy), rest: toDayList(a.rest) };
}

function sanitizeSubject(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const id = toId(raw.id);
  const name = toText(raw.name, 40);
  if (!id || !name) return null;
  return {
    id,
    name,
    motif: pick(raw.motif, MOTIFS, 'scroll'),
    color: toColor(raw.color),
    difficulty: toInt(raw.difficulty, 1, 5, 3),
    mastery: toInt(raw.mastery, 1, 4, 2),
    expectedTotal: toInt(raw.expectedTotal, 0, 999, 0),
    order: toInt(raw.order, 0, 9999, index),
    createdAt: toInt(raw.createdAt, 0, 8.64e15, Date.now())
  };
}

function sanitizeTeacher(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = toId(raw.id);
  const subjectId = toId(raw.subjectId);
  const name = toText(raw.name, 40);
  if (!id || !subjectId || !name) return null;
  return {
    id,
    subjectId,
    name,
    avatar: pick(raw.avatar, TEACHER_AVATARS, 'sage'),
    publishDays: toDayList(raw.publishDays),
    publishTime: toTime(raw.publishTime, '18:00'),
    avgDuration: toInt(raw.avgDuration, 5, 480, 45),
    startNumber: toInt(raw.startNumber, 1, 999, 1),
    publishedCount: toInt(raw.publishedCount, 0, 999, 0),
    expectedTotal: toInt(raw.expectedTotal, 0, 999, 0),
    lastPublishedAt: toDateOrNull(raw.lastPublishedAt),
    createdAt: toInt(raw.createdAt, 0, 8.64e15, Date.now())
  };
}

function sanitizeLecture(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = toId(raw.id);
  const teacherId = toId(raw.teacherId);
  if (!id || !teacherId) return null;
  const number = toInt(raw.number, 1, 999, 0);
  if (!number) return null;
  return {
    id,
    teacherId,
    subjectId: toId(raw.subjectId),
    number,
    title: toText(raw.title, 80),
    notes: toText(raw.notes, 300),
    duration: toInt(raw.duration, 5, 480, 45),
    difficulty: toInt(raw.difficulty, 1, 5, 3),
    publishedAt: toDateOrNull(raw.publishedAt) || todayStr(),
    createdAt: toInt(raw.createdAt, 0, 8.64e15, Date.now()),
    status: pick(raw.status, Object.keys(LECTURE_STATUS_LABELS), 'new'),
    completedAt: toDateOrNull(raw.completedAt),
    manualDone: raw.manualDone === true,
    understanding: toInt(raw.understanding, 0, 4, 0)
  };
}

function sanitizeSession(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const id = toId(raw.id);
  const lectureId = toId(raw.lectureId);
  if (!id || !lectureId) return null;
  return {
    id,
    lectureId,
    type: pick(raw.type, Object.keys(SESSION_TYPES), 'study'),
    minutes: toInt(raw.minutes, 5, 480, 30),
    description: toText(raw.description, 300),
    date: toDateOrNull(raw.date),
    status: pick(raw.status, Object.keys(SESSION_STATUS_LABELS), 'pending'),
    progress: toInt(raw.progress, 0, 100, 0),
    order: toInt(raw.order, 0, 9999, index),
    createdAt: toInt(raw.createdAt, 0, 8.64e15, Date.now()),
    completedAt: raw.completedAt ? toInt(raw.completedAt, 0, 8.64e15, 0) || null : null,
    actualMinutes: toInt(raw.actualMinutes, 0, 720, 0),
    postponedCount: toInt(raw.postponedCount, 0, 999, 0)
  };
}

function sanitizeReview(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = toId(raw.id);
  const lectureId = toId(raw.lectureId);
  const dueDate = toDateOrNull(raw.dueDate);
  if (!id || !lectureId || !dueDate) return null;
  return {
    id,
    lectureId,
    sessionId: toId(raw.sessionId),
    stage: toInt(raw.stage, 0, 20, 0),
    dueDate,
    status: pick(raw.status, Object.keys(REVIEW_STATUS_LABELS), 'pending'),
    rating: toInt(raw.rating, 0, 4, 0),
    doneAt: raw.doneAt ? toInt(raw.doneAt, 0, 8.64e15, 0) || null : null,
    minutes: toInt(raw.minutes, 5, 120, 15)
  };
}

function sanitizeExam(raw, subjectIds) {
  if (!raw || typeof raw !== 'object') return null;
  const id = toId(raw.id);
  const title = toText(raw.title, 60);
  const date = toDateOrNull(raw.date);
  if (!id || !title || !date) return null;
  const subjectId = toId(raw.subjectId);
  return {
    id,
    title,
    subjectId: subjectIds.has(subjectId) ? subjectId : '',
    subjectName: toText(raw.subjectName, 40),
    date
  };
}

function sanitizePet(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const species = pick(raw.species, Object.keys(PET_SPECIES), '');
  if (!species) return null;
  const equipped = Array.isArray(raw.equipped) ? raw.equipped.map((v) => toId(v)).filter(Boolean).slice(0, 20) : [];
  return {
    species,
    name: toText(raw.name, 20) || PET_SPECIES[species],
    adoptedAt: toInt(raw.adoptedAt, 0, 8.64e15, Date.now()),
    seenStage: toInt(raw.seenStage, 0, 4, 0),
    equipped
  };
}

function sanitizeProgress(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    totalXp: toInt(p.totalXp, 0, 1e9, 0),
    gems: toInt(p.gems, 0, 1e9, 0),
    sessionsDone: toInt(p.sessionsDone, 0, 1e9, 0),
    lecturesDone: toInt(p.lecturesDone, 0, 1e9, 0),
    reviewsDone: toInt(p.reviewsDone, 0, 1e9, 0),
    minutesStudied: toInt(p.minutesStudied, 0, 1e9, 0),
    backlogCleared: toInt(p.backlogCleared, 0, 1e9, 0)
  };
}

function sanitizeAchievements(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const badges = {};
  if (a.badges && typeof a.badges === 'object') {
    Object.keys(a.badges).slice(0, 200).forEach((key) => {
      if (/^[\w\-]{1,60}$/.test(key)) badges[key] = toText(a.badges[key], 30) || todayStr();
    });
  }
  const cosmetics = a.cosmetics && typeof a.cosmetics === 'object' ? a.cosmetics : {};
  const idList = (v) => (Array.isArray(v) ? Array.from(new Set(v.map((x) => toId(x)).filter(Boolean))).slice(0, 300) : []);
  const log = [];
  (Array.isArray(a.log) ? a.log.slice(-LIMITS.log) : []).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const title = toText(entry.title, 80);
    if (!title) return;
    log.push({
      id: toId(entry.id) || uid('log'),
      type: toText(entry.type, 20) || 'general',
      title,
      text: toText(entry.text, 200),
      date: toDateOrNull(entry.date) || todayStr(),
      xp: toInt(entry.xp, 0, 1e7, 0)
    });
  });
  return { badges, cosmetics: { owned: idList(cosmetics.owned), equipped: idList(cosmetics.equipped) }, log };
}

function sanitizeAwards(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.keys(raw).slice(0, LIMITS.awards).forEach((key) => {
    if (/^[\w:\-.]{1,100}$/.test(key) && raw[key]) out[key] = true;
  });
  return out;
}

function sanitizeStudyLog(raw) {
  const out = [];
  (Array.isArray(raw) ? raw.slice(-LIMITS.studyLog) : []).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const date = toDateOrNull(entry.date);
    if (!date) return;
    out.push({
      id: toId(entry.id) || uid('log'),
      date,
      minutes: toInt(entry.minutes, 0, 720, 0),
      kind: toText(entry.kind, 20) || 'study',
      refId: toId(entry.refId)
    });
  });
  return out;
}

function sanitizeSnapshots(raw) {
  const out = [];
  (Array.isArray(raw) ? raw.slice(-LIMITS.snapshots) : []).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const date = toDateOrNull(entry.date);
    if (!date) return;
    out.push({ date, count: toInt(entry.count, 0, 99999, 0), sessions: toInt(entry.sessions, 0, 99999, 0) });
  });
  return out;
}

function sanitizePlan(raw, validIds) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const reasons = {};
  if (p.reasons && typeof p.reasons === 'object') {
    Object.keys(p.reasons).slice(0, LIMITS.reasons).forEach((key) => {
      if (validIds.has(key)) reasons[key] = toText(p.reasons[key], 220);
    });
  }
  const notes = (Array.isArray(p.notes) ? p.notes : []).slice(0, 30).map((n) => toText(n, 220)).filter(Boolean);
  return {
    generatedAt: p.generatedAt ? toInt(p.generatedAt, 0, 8.64e15, 0) || null : null,
    horizon: toInt(p.horizon, 7, 60, 14),
    reasons,
    notes
  };
}

function sanitizeWorld(raw) {
  const unlocked = {};
  if (raw && raw.unlockedStages && typeof raw.unlockedStages === 'object') {
    Object.keys(raw.unlockedStages).slice(0, 20000).forEach((key) => {
      if (/^[\w:\-.]{1,100}$/.test(key) && raw.unlockedStages[key]) unlocked[key] = true;
    });
  }
  return { unlockedStages: unlocked };
}

function sanitizeIntervals(raw) {
  const arr = Array.isArray(raw) ? raw.slice(0, 4).map((n) => toInt(n, 1, 365, 0)) : [];
  if (arr.length === 4 && arr.every((n) => n >= 1)) return arr;
  return DEFAULT_REVIEW_INTERVALS.slice();
}

function collect(rawList, limit, sanitizer, seen, onDrop, accept) {
  const out = [];
  const list = Array.isArray(rawList) ? rawList.slice(0, limit) : [];
  list.forEach((item, index) => {
    const clean = sanitizer(item, index);
    if (!clean || seen.has(clean.id) || (accept && !accept(clean))) {
      onDrop();
      return;
    }
    seen.add(clean.id);
    out.push(clean);
  });
  return out;
}

function normalizeState(raw, account) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'محتوى البيانات غير صالح' };
  const schema = Number(raw.schema);
  if (!Number.isFinite(schema) || schema < 1) return { ok: false, error: 'رقم نسخة البيانات غير معروف' };
  if (schema > SCHEMA_VERSION) return { ok: false, error: 'هذه البيانات أحدث من النسخة التي يدعمها التطبيق' };

  const dropped = { subjects: 0, teachers: 0, lectures: 0, sessions: 0, reviews: 0, exams: 0 };
  const state = createEmptyState(account);
  state.createdAt = toInt(raw.createdAt, 0, 8.64e15, state.createdAt);
  state.updatedAt = toInt(raw.updatedAt, 0, 8.64e15, state.updatedAt);
  state.profile = sanitizeProfile(raw.profile);
  state.availability = sanitizeAvailability(raw.availability);

  const subjectIds = new Set();
  state.subjects = collect(raw.subjects, LIMITS.subjects, sanitizeSubject, subjectIds, () => { dropped.subjects += 1; });

  const teacherIds = new Set();
  state.teachers = collect(raw.teachers, LIMITS.teachers, sanitizeTeacher, teacherIds, () => { dropped.teachers += 1; }, (t) => subjectIds.has(t.subjectId));
  const teacherMap = new Map(state.teachers.map((t) => [t.id, t]));

  const lectureIds = new Set();
  const lectureKeys = new Set();
  state.lectures = collect(raw.lectures, LIMITS.lectures, sanitizeLecture, lectureIds, () => { dropped.lectures += 1; }, (l) => {
    const teacher = teacherMap.get(l.teacherId);
    if (!teacher) return false;
    const key = l.teacherId + ':' + l.number;
    if (lectureKeys.has(key)) return false;
    lectureKeys.add(key);
    l.subjectId = teacher.subjectId;
    return true;
  });

  state.teachers.forEach((teacher) => {
    state.lectures.forEach((lecture) => {
      if (lecture.teacherId === teacher.id && lecture.number > teacher.publishedCount) teacher.publishedCount = lecture.number;
    });
  });

  const sessionIds = new Set();
  state.sessions = collect(raw.sessions, LIMITS.sessions, sanitizeSession, sessionIds, () => { dropped.sessions += 1; }, (s) => lectureIds.has(s.lectureId));

  const reviewIds = new Set();
  state.reviews = collect(raw.reviews, LIMITS.reviews, sanitizeReview, reviewIds, () => { dropped.reviews += 1; }, (r) => lectureIds.has(r.lectureId));

  const examIds = new Set();
  state.exams = collect(raw.exams, LIMITS.exams, (item) => sanitizeExam(item, subjectIds), examIds, () => { dropped.exams += 1; });

  state.pet = sanitizePet(raw.pet);
  state.progress = sanitizeProgress(raw.progress);
  state.achievements = sanitizeAchievements(raw.achievements);
  state.awards = sanitizeAwards(raw.awards);
  state.studyLog = sanitizeStudyLog(raw.studyLog);
  state.backlogSnapshots = sanitizeSnapshots(raw.backlogSnapshots);

  const planIds = new Set(state.sessions.map((s) => s.id).concat(state.reviews.map((r) => r.id)));
  state.plan = sanitizePlan(raw.plan, planIds);
  state.world = sanitizeWorld(raw.world);
  state.settings = { reviewIntervals: sanitizeIntervals(raw.settings && raw.settings.reviewIntervals) };

  return { ok: true, state, dropped };
}

function summarizeState(state) {
  return {
    name: state.profile.name,
    subjects: state.subjects.length,
    teachers: state.teachers.length,
    lectures: state.lectures.length,
    sessions: state.sessions.length,
    reviews: state.reviews.length,
    totalXp: state.progress.totalXp,
    hasPet: !!state.pet
  };
}

let appState = null;
let currentAccount = null;
let saveTimer = null;
let saveInFlight = null;
let dirty = false;
let lastSavedAt = 0;

async function openWorld(account) {
  const raw = await driverApi.get(STORE_WORLDS, account.id);
  let state;
  if (!raw) {
    state = createEmptyState(account);
    await driverApi.put(STORE_WORLDS, state);
  } else {
    const result = normalizeState(raw, account);
    if (!result.ok) return { ok: false, error: result.error };
    state = result.state;
  }
  appState = state;
  currentAccount = { id: account.id, username: account.username };
  dirty = false;
  lastSavedAt = Date.now();
  setSessionAccountId(account.id);
  bus.emit('world:opened', appState);
  return { ok: true };
}

async function restoreSession() {
  const id = getSessionAccountId();
  if (!id) return { ok: false };
  const account = await getAccount(id);
  if (!account) {
    clearSessionAccountId();
    return { ok: false };
  }
  return openWorld(account);
}

function commit(reason) {
  if (!appState) return;
  appState.updatedAt = Date.now();
  dirty = true;
  scheduleSave();
  bus.emit('state:changed', { reason: reason || 'change' });
}

function mutate(reason, fn) {
  if (!appState) return undefined;
  const result = fn(appState);
  commit(reason);
  return result;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveNow();
  }, SAVE_DEBOUNCE_MS);
}

async function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!appState) return true;
  while (saveInFlight) await saveInFlight;
  if (!dirty) return true;
  dirty = false;
  const snapshot = deepClone(appState);
  saveInFlight = driverApi
    .put(STORE_WORLDS, snapshot)
    .then(() => {
      lastSavedAt = Date.now();
      bus.emit('state:saved', lastSavedAt);
      return true;
    })
    .catch((error) => {
      dirty = true;
      bus.emit('state:saveError', error);
      return false;
    })
    .finally(() => {
      saveInFlight = null;
    });
  return saveInFlight;
}

function getLastSavedAt() {
  return lastSavedAt;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow();
});
window.addEventListener('pagehide', () => {
  saveNow();
});
window.addEventListener('beforeunload', () => {
  saveNow();
});

async function logoutAccount() {
  await saveNow();
  appState = null;
  currentAccount = null;
  dirty = false;
  clearSessionAccountId();
  bus.emit('world:closed');
}

async function deleteCurrentAccount() {
  if (!currentAccount) return;
  const id = currentAccount.id;
  clearTimeout(saveTimer);
  await driverApi.remove(STORE_WORLDS, id);
  await driverApi.remove(STORE_ACCOUNTS, id);
  appState = null;
  currentAccount = null;
  dirty = false;
  clearSessionAccountId();
  bus.emit('world:closed');
}

async function wipeAllData() {
  clearTimeout(saveTimer);
  await driverApi.clear(STORE_WORLDS);
  await driverApi.clear(STORE_ACCOUNTS);
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.indexOf('levelup.') === 0) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    return;
  }
  appState = null;
  currentAccount = null;
  dirty = false;
  bus.emit('world:closed');
}

function readFileText(file) {
  if (file && typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read-failed'));
    reader.readAsText(file);
  });
}

function buildBackupPayload() {
  return {
    app: APP_NAME,
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    username: currentAccount ? currentAccount.username : '',
    world: deepClone(appState)
  };
}

async function exportBackup() {
  if (!appState) return false;
  await saveNow();
  const payload = buildBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'levelup-backup-' + todayStr() + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

async function inspectBackupFile(file) {
  if (!file) return { ok: false, errors: ['لم يتم اختيار ملف'] };
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, errors: ['حجم الملف أكبر من الحد المسموح'] };
  let text;
  try {
    text = await readFileText(file);
  } catch (e) {
    return { ok: false, errors: ['تعذرت قراءة الملف'] };
  }
  const parsed = safeJsonParse(text);
  if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') return { ok: false, errors: ['الملف ليس بصيغة JSON صحيحة'] };
  const payload = parsed.value;
  if (payload.app !== APP_NAME) return { ok: false, errors: ['هذا الملف ليس نسخة احتياطية من LEVEL UP'] };
  if (!payload.world || typeof payload.world !== 'object') return { ok: false, errors: ['النسخة لا تحتوي على بيانات العالم'] };
  if (!currentAccount) return { ok: false, errors: ['سجّل الدخول أولًا'] };
  const result = normalizeState(payload.world, currentAccount);
  if (!result.ok) return { ok: false, errors: [result.error] };
  const droppedTotal = Object.keys(result.dropped).reduce((sum, key) => sum + result.dropped[key], 0);
  return {
    ok: true,
    state: result.state,
    dropped: result.dropped,
    droppedTotal,
    summary: summarizeState(result.state),
    exportedAt: toText(payload.exportedAt, 40)
  };
}

async function applyImportedState(state) {
  if (!currentAccount || !state) return false;
  state.accountId = currentAccount.id;
  state.username = currentAccount.username;
  state.updatedAt = Date.now();
  appState = state;
  dirty = true;
  const ok = await saveNow();
  bus.emit('state:replaced', appState);
  return ok;
}const BACKLOG_GRACE_DAYS = 2;
const MAX_SESSION_ROWS = 12;
const PRACTICE_HEAVY_MOTIFS = ['sigma', 'flask', 'atom', 'code'];
const ONBOARD_TOTAL = 9;
const NON_DISMISSIBLE_MODALS = ['modalSessionRun', 'modalReward'];
const SCREEN_IDS = { splash: 'splash', auth: 'authScreen', onboarding: 'onboarding', pet: 'petScreen', game: 'game' };
const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const actions = {};
const modalStack = [];
const quickAddLock = {};
const onboardState = { step: 1, exams: [] };
const petState = { species: 'dragon' };
let currentScreen = 'splash';
let lastFocused = null;
let confirmResolver = null;
let confirmWord = '';

function getRadio(name, root = document) {
  const node = root.querySelector('input[name="' + name + '"]:checked');
  return node ? node.value : '';
}

function setRadio(name, value, root = document) {
  $$('input[name="' + name + '"]', root).forEach((input) => {
    input.checked = String(input.value) === String(value);
  });
}

function getCheckedNumbers(name, root = document) {
  return $$('input[name="' + name + '"]:checked', root).map((input) => Number(input.value));
}

function setCheckedNumbers(name, values, root = document) {
  $$('input[name="' + name + '"]', root).forEach((input) => {
    input.checked = values.includes(Number(input.value));
  });
}

function readIntField(id, min, max) {
  const node = document.getElementById(id);
  if (!node) return NaN;
  const raw = String(node.value).trim();
  if (raw === '') return NaN;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return NaN;
  return n;
}

function readOptionalIntField(id, min, max) {
  const node = document.getElementById(id);
  if (!node) return 0;
  const raw = String(node.value).trim();
  if (raw === '') return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return NaN;
  return n;
}

function fillSelect(select, items, selected) {
  select.innerHTML = items
    .map((item) => '<option value="' + escapeHtml(item.value) + '"' + (String(item.value) === String(selected) ? ' selected' : '') + '>' + escapeHtml(item.label) + '</option>')
    .join('');
}

function sessionCountLabel(n) {
  if (n === 1) return 'جلسة واحدة';
  if (n === 2) return 'جلستين';
  if (n >= 3 && n <= 10) return n + ' جلسات';
  return n + ' جلسة';
}

function lectureLabel(lecture) {
  return 'المحاضرة ' + lecture.number + (lecture.title ? ' — ' + lecture.title : '');
}

function lectureFullLabel(lecture) {
  const subject = getSubject(lecture.subjectId);
  return (subject ? subject.name + ' · ' : '') + lectureLabel(lecture);
}

function requestReplan(reason) {
  bus.emit('plan:request', { reason });
}

function openModal(id) {
  const layer = $('#modalLayer');
  const modal = document.getElementById(id);
  if (!layer || !modal) return;
  if (!modalStack.length) lastFocused = document.activeElement;
  const index = modalStack.indexOf(id);
  if (index !== -1) modalStack.splice(index, 1);
  modalStack.push(id);
  layer.hidden = false;
  document.body.classList.add('modal-open');
  refreshModalStack();
  const target = modal.querySelector(FOCUSABLE);
  if (target) setTimeout(() => target.focus(), 60);
}

function refreshModalStack() {
  const layer = $('#modalLayer');
  if (!layer) return;
  $$('.modal', layer).forEach((modal) => {
    const position = modalStack.indexOf(modal.id);
    modal.hidden = position === -1;
    modal.classList.toggle('modal-top', position !== -1 && position === modalStack.length - 1);
    modal.classList.toggle('modal-under', position !== -1 && position !== modalStack.length - 1);
  });
}

function closeModal(id) {
  const target = id || modalStack[modalStack.length - 1];
  if (!target) return;
  const index = modalStack.indexOf(target);
  if (index === -1) return;
  modalStack.splice(index, 1);
  const modal = document.getElementById(target);
  if (modal) clearFieldErrors(modal);
  refreshModalStack();
  if (!modalStack.length) {
    const layer = $('#modalLayer');
    if (layer) layer.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try {
        lastFocused.focus();
      } catch (e) {
        lastFocused = null;
      }
    }
  }
  bus.emit('modal:closed', target);
}

function closeAllModals() {
  while (modalStack.length) closeModal();
}

function isModalOpen(id) {
  return modalStack.indexOf(id) !== -1;
}

function confirmDialog(options) {
  const o = Object.assign({ title: 'تأكيد', text: '', okLabel: 'تأكيد', cancelLabel: 'إلغاء', danger: true, typeToConfirm: '' }, options || {});
  if (confirmResolver) {
    const previous = confirmResolver;
    confirmResolver = null;
    previous(false);
  }
  $('#confirmTitle').textContent = o.title;
  $('#confirmText').textContent = o.text;
  const ok = $('#confirmOk');
  const cancel = $('#confirmCancel');
  ok.textContent = o.okLabel;
  cancel.textContent = o.cancelLabel;
  ok.classList.toggle('btn-danger', !!o.danger);
  ok.classList.toggle('btn-primary', !o.danger);
  confirmWord = o.typeToConfirm || '';
  const wrap = $('#confirmTypeWrap');
  const input = $('#confirmTypeInput');
  wrap.hidden = !confirmWord;
  input.value = '';
  $('#confirmTypeLabel').textContent = confirmWord ? 'اكتب الكلمة: ' + confirmWord : '';
  ok.disabled = !!confirmWord;
  return new Promise((resolve) => {
    confirmResolver = resolve;
    openModal('modalConfirm');
  });
}

function settleConfirm(result) {
  const resolver = confirmResolver;
  confirmResolver = null;
  closeModal('modalConfirm');
  if (resolver) resolver(result);
}

function showScreen(name) {
  if (!SCREEN_IDS[name]) return;
  Object.keys(SCREEN_IDS).forEach((key) => {
    const node = document.getElementById(SCREEN_IDS[key]);
    if (node) node.hidden = key !== name;
  });
  currentScreen = name;
  document.body.dataset.screen = name;
  bus.emit('screen:changed', name);
}

function getSubject(id) {
  return findById(appState.subjects, id);
}

function getTeacher(id) {
  return findById(appState.teachers, id);
}

function getLecture(id) {
  return findById(appState.lectures, id);
}

function getSession(id) {
  return findById(appState.sessions, id);
}

function teachersOfSubject(subjectId) {
  return appState.teachers.filter((t) => t.subjectId === subjectId);
}

function lecturesOfTeacher(teacherId) {
  return sortBy(appState.lectures.filter((l) => l.teacherId === teacherId), (l) => l.number);
}

function lecturesOfSubject(subjectId) {
  return sortBy(appState.lectures.filter((l) => l.subjectId === subjectId), (l) => l.number);
}

function sessionsOfLecture(lectureId) {
  return sortBy(appState.sessions.filter((s) => s.lectureId === lectureId), (s) => s.order);
}

function lectureAgeDays(lecture) {
  return Math.max(0, diffDays(lecture.publishedAt, todayStr()));
}

function isBacklogLecture(lecture) {
  return lecture.status !== 'done' && lectureAgeDays(lecture) >= BACKLOG_GRACE_DAYS;
}

function isNewLecture(lecture) {
  return lecture.status === 'new' && lectureAgeDays(lecture) < BACKLOG_GRACE_DAYS;
}

function computeLectureStatus(lecture, sessions) {
  if (!sessions.length) return lecture.manualDone ? 'done' : 'new';
  if (sessions.every((s) => s.status === 'done')) return 'done';
  if (sessions.some((s) => s.status === 'done' || s.status === 'active' || s.progress > 0)) return 'progress';
  return 'new';
}

function refreshLectureStatus(lecture) {
  const sessions = sessionsOfLecture(lecture.id);
  const previous = lecture.status;
  const next = computeLectureStatus(lecture, sessions);
  lecture.status = next;
  if (next === 'done' && !lecture.completedAt) lecture.completedAt = todayStr();
  if (next !== 'done') lecture.completedAt = null;
  return { previous, next, becameDone: previous !== 'done' && next === 'done', reopened: previous === 'done' && next !== 'done' };
}

function refreshAllLectureStatuses() {
  appState.lectures.forEach((lecture) => refreshLectureStatus(lecture));
}

function lectureStats(lecture) {
  const sessions = sessionsOfLecture(lecture.id);
  const done = sessions.filter((s) => s.status === 'done');
  const pending = sessions.filter((s) => s.status !== 'done');
  let progress = 0;
  if (lecture.status === 'done') progress = 100;
  else if (sessions.length) progress = Math.round(sessions.reduce((sum, s) => sum + (s.status === 'done' ? 100 : s.progress), 0) / sessions.length);
  return {
    sessions,
    total: sessions.length,
    done: done.length,
    remaining: pending.length,
    minutesTotal: sessions.reduce((sum, s) => sum + s.minutes, 0),
    minutesRemaining: pending.reduce((sum, s) => sum + s.minutes, 0),
    progress
  };
}

function remainingWork(lectures) {
  let sessions = 0;
  let minutes = 0;
  lectures.forEach((lecture) => {
    if (lecture.status === 'done') return;
    const stats = lectureStats(lecture);
    sessions += stats.remaining;
    minutes += stats.minutesRemaining;
  });
  return { sessions, minutes };
}

function teacherStats(teacherId) {
  const teacher = getTeacher(teacherId);
  const lectures = lecturesOfTeacher(teacherId);
  const done = lectures.filter((l) => l.status === 'done');
  const studied = lectures.filter((l) => l.status !== 'new');
  const backlog = lectures.filter(isBacklogLecture);
  const lastReceived = lectures.reduce((max, l) => Math.max(max, l.number), 0);
  const expectedKnown = teacher.expectedTotal > 0;
  const studentTotal = Math.max(lectures.length, (expectedKnown ? teacher.expectedTotal : teacher.publishedCount) - teacher.startNumber + 1);
  return {
    teacher,
    lectures,
    tracked: lectures.length,
    published: teacher.publishedCount,
    expectedTotal: teacher.expectedTotal,
    done: done.length,
    studied: studied.length,
    backlog: backlog.length,
    remainingPublished: lectures.length - done.length,
    remainingToCome: expectedKnown ? Math.max(0, teacher.expectedTotal - teacher.publishedCount) : 0,
    lastReceived,
    studentTotal,
    progress: studentTotal ? Math.round((done.length / studentTotal) * 100) : 0
  };
}

function subjectStats(subjectId) {
  const subject = getSubject(subjectId);
  const teachers = teachersOfSubject(subjectId);
  const lectures = appState.lectures.filter((l) => l.subjectId === subjectId);
  const done = lectures.filter((l) => l.status === 'done');
  const studied = lectures.filter((l) => l.status !== 'new');
  const backlog = lectures.filter(isBacklogLecture);
  const published = teachers.reduce((sum, t) => sum + t.publishedCount, 0);
  const teacherExpected = teachers.reduce((sum, t) => sum + t.expectedTotal, 0);
  const studentTotal = teachers.reduce((sum, t) => sum + teacherStats(t.id).studentTotal, 0);
  const work = remainingWork(lectures);
  return {
    subject,
    teachers: teachers.length,
    total: subject.expectedTotal > 0 ? subject.expectedTotal : teacherExpected > 0 ? teacherExpected : published,
    published,
    tracked: lectures.length,
    studied: studied.length,
    done: done.length,
    backlog: backlog.length,
    studentTotal,
    progress: studentTotal ? Math.round((done.length / studentTotal) * 100) : 0,
    sessionsRemaining: work.sessions,
    minutesRemaining: work.minutes
  };
}

function pendingPublishDates(teacher) {
  if (!teacher.publishDays.length || !teacher.lastPublishedAt) return [];
  const today = todayStr();
  const gap = diffDays(teacher.lastPublishedAt, today);
  const out = [];
  for (let i = 1; i <= Math.min(gap, 28); i += 1) {
    const date = addDays(teacher.lastPublishedAt, i);
    if (teacher.publishDays.includes(dayOfWeek(date))) out.push(date);
  }
  if (teacher.expectedTotal > 0) return out.slice(0, Math.max(0, teacher.expectedTotal - teacher.publishedCount));
  return out;
}

function expectedPublishDates(teacher, count) {
  if (!teacher.publishDays.length) return [];
  const out = [];
  const today = todayStr();
  const limit = teacher.expectedTotal > 0 ? Math.max(0, teacher.expectedTotal - teacher.publishedCount) : Infinity;
  for (let i = 0; i < 90 && out.length < count && out.length < limit; i += 1) {
    const date = addDays(today, i);
    if (!teacher.publishDays.includes(dayOfWeek(date))) continue;
    if (teacher.lastPublishedAt && date <= teacher.lastPublishedAt) continue;
    out.push(date);
  }
  return out;
}

function backfillPublishDates(teacher, numbers) {
  const map = {};
  let cursor = todayStr();
  for (let i = numbers.length - 1; i >= 0; i -= 1) {
    let guard = 0;
    while (teacher.publishDays.length && !teacher.publishDays.includes(dayOfWeek(cursor)) && guard < 8) {
      cursor = addDays(cursor, -1);
      guard += 1;
    }
    map[numbers[i]] = cursor;
    cursor = addDays(cursor, -1);
  }
  return map;
}

function averageDailyMinutes() {
  const availability = appState.availability;
  const values = [0, 1, 2, 3, 4, 5, 6]
    .filter((d) => !availability.rest.includes(d))
    .map((d) => availability.minutes[d])
    .filter((m) => m > 0);
  if (!values.length) return 90;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function suggestSessionPlan(input) {
  const subject = getSubject(input.subjectId);
  const level = appState.profile.level;
  const duration = clamp(Number(input.duration) || 45, 5, 480);
  const difficulty = clamp(Number(input.difficulty) || 3, 1, 5);
  const factor = 1 + (difficulty - 1) * 0.15 + (4 - level) * 0.1;
  const studyTotal = Math.max(15, Math.round((duration * factor) / 5) * 5);
  const average = averageDailyMinutes();
  const chunk = clamp(Math.round(average / 3 / 5) * 5, 25, 50);
  const chunks = Math.max(1, Math.ceil(studyTotal / chunk));
  const per = Math.max(15, Math.round(studyTotal / chunks / 5) * 5);
  const label = input.title ? 'المحاضرة ' + input.number + ' (' + input.title + ')' : 'المحاضرة ' + input.number;
  const sessions = [];
  for (let i = 0; i < chunks; i += 1) {
    if (i === 0) sessions.push({ type: 'study', minutes: per, description: 'فهم وشرح ' + label + ' وتسجيل الملاحظات' });
    else sessions.push({ type: 'continue', minutes: per, description: 'استكمال وتثبيت ' + label });
  }
  const heavy = !!subject && PRACTICE_HEAVY_MOTIFS.includes(subject.motif);
  let practiceReason = '';
  if (heavy || difficulty >= 3 || level <= 2) {
    const minutes = clamp(Math.round((duration * (heavy ? 0.6 : 0.4)) / 5) * 5, 15, 60);
    sessions.push({ type: 'practice', minutes, description: 'حل تدريبات ' + label });
    practiceReason = heavy ? 'ولأن طبيعة المادة تحتاج إلى حل كثير' : 'ولأن الحل يثبّت الفهم عند هذا المستوى';
  }
  if (difficulty >= 4) sessions.push({ type: 'selftest', minutes: 20, description: 'اختبار ذاتي سريع على ' + label });
  let note = 'اقترحنا ' + sessionCountLabel(sessions.length) + ' لأن مدة المحاضرة ' + duration + ' دقيقة وصعوبتها ' + DIFFICULTY_LABELS[difficulty];
  note += '، وقسّمنا المذاكرة إلى ' + sessionCountLabel(chunks) + ' بما يناسب وقتك اليومي المتاح';
  if (practiceReason) note += ' ' + practiceReason;
  note += '. يمكنك تعديلها كما تشاء.';
  return { sessions, note };
}

function createSessionsForLecture(lecture, plan) {
  const suggestion = plan || suggestSessionPlan({
    duration: lecture.duration,
    difficulty: lecture.difficulty,
    subjectId: lecture.subjectId,
    number: lecture.number,
    title: lecture.title
  });
  suggestion.sessions.forEach((item, index) => {
    appState.sessions.push({
      id: uid('ses'),
      lectureId: lecture.id,
      type: item.type,
      minutes: item.minutes,
      description: item.description,
      date: null,
      status: 'pending',
      progress: 0,
      order: index,
      createdAt: Date.now(),
      completedAt: null,
      actualMinutes: 0,
      postponedCount: 0
    });
  });
}

function removeLectureData(lectureId) {
  const sessionIds = new Set(appState.sessions.filter((s) => s.lectureId === lectureId).map((s) => s.id));
  const reviewIds = appState.reviews.filter((r) => r.lectureId === lectureId).map((r) => r.id);
  appState.sessions = appState.sessions.filter((s) => s.lectureId !== lectureId);
  appState.reviews = appState.reviews.filter((r) => r.lectureId !== lectureId);
  appState.lectures = appState.lectures.filter((l) => l.id !== lectureId);
  sessionIds.forEach((id) => delete appState.plan.reasons[id]);
  reviewIds.forEach((id) => delete appState.plan.reasons[id]);
}

function removeTeacherData(teacherId) {
  lecturesOfTeacher(teacherId).forEach((lecture) => removeLectureData(lecture.id));
  appState.teachers = appState.teachers.filter((t) => t.id !== teacherId);
}

function removeSubjectData(subjectId) {
  teachersOfSubject(subjectId).forEach((teacher) => removeTeacherData(teacher.id));
  appState.lectures.filter((l) => l.subjectId === subjectId).forEach((l) => removeLectureData(l.id));
  appState.subjects = appState.subjects.filter((s) => s.id !== subjectId);
  appState.exams.forEach((exam) => {
    if (exam.subjectId === subjectId) exam.subjectId = '';
  });
}

function openSubjectModal(id) {
  const form = $('#subjectForm');
  form.reset();
  clearFieldErrors(form);
  const subject = id ? getSubject(id) : null;
  $('#subjectId').value = subject ? subject.id : '';
  $('#modalSubjectTitle').textContent = subject ? 'تعديل المادة' : 'إضافة مادة';
  $('#subjectDeleteBtn').hidden = !subject;
  if (subject) {
    $('#subjectName').value = subject.name;
    setRadio('subjectMotif', subject.motif, form);
    setRadio('subjectColor', subject.color, form);
    $('#subjectDifficulty').value = String(subject.difficulty);
    $('#subjectMastery').value = String(subject.mastery);
    $('#subjectTotal').value = subject.expectedTotal > 0 ? subject.expectedTotal : '';
  } else {
    setRadio('subjectColor', SUBJECT_COLORS[appState.subjects.length % SUBJECT_COLORS.length], form);
    setRadio('subjectMotif', MOTIFS[appState.subjects.length % MOTIFS.length], form);
  }
  openModal('modalSubject');
}

function handleSubjectSubmit(event) {
  event.preventDefault();
  const form = $('#subjectForm');
  clearFieldErrors(form);
  const id = $('#subjectId').value;
  const name = toText($('#subjectName').value, 40);
  let valid = true;
  if (name.length < 2) {
    setFieldError('subjectName', 'اكتب اسم المادة (حرفان على الأقل)');
    valid = false;
  } else if (appState.subjects.some((s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) {
    setFieldError('subjectName', 'هذه المادة موجودة بالفعل');
    valid = false;
  }
  const total = readOptionalIntField('subjectTotal', 0, 999);
  if (Number.isNaN(total)) {
    setFieldError('subjectTotal', 'اكتب رقمًا صحيحًا بين 0 و999');
    valid = false;
  }
  if (!valid) return;
  const values = {
    name,
    motif: pick(getRadio('subjectMotif', form), MOTIFS, 'scroll'),
    color: toColor(getRadio('subjectColor', form)),
    difficulty: toInt($('#subjectDifficulty').value, 1, 5, 3),
    mastery: toInt($('#subjectMastery').value, 1, 4, 2),
    expectedTotal: total
  };
  const existing = id ? getSubject(id) : null;
  if (existing) {
    Object.assign(existing, values);
    commit('subject:update');
    toast('تم تحديث المادة', 'success');
  } else {
    const order = appState.subjects.reduce((max, s) => Math.max(max, s.order), -1) + 1;
    appState.subjects.push(Object.assign({ id: uid('sub'), order, createdAt: Date.now() }, values));
    commit('subject:add');
    toast('ظهرت جزيرة ' + name + ' في عالمك', 'success');
  }
  closeModal('modalSubject');
  requestReplan('subject');
}

async function deleteSubjectFlow(id) {
  const subject = id ? getSubject(id) : null;
  if (!subject) return;
  const confirmed = await confirmDialog({
    title: 'حذف المادة',
    text: 'سيتم حذف مادة ' + subject.name + ' مع مدرسيها ومحاضراتها وجلساتها ومراجعاتها. نقاط الخبرة التي حصلت عليها لن تتأثر.',
    okLabel: 'حذف المادة'
  });
  if (!confirmed) return;
  removeSubjectData(id);
  commit('subject:delete');
  closeModal('modalSubject');
  toast('تم حذف المادة', 'info');
  requestReplan('subject-delete');
}

function openTeacherModal(id, presetSubjectId) {
  if (!appState.subjects.length) {
    toast('أضف مادة أولًا حتى تستطيع إضافة مدرس', 'warn');
    openSubjectModal();
    return;
  }
  const form = $('#teacherForm');
  form.reset();
  clearFieldErrors(form);
  const teacher = id ? getTeacher(id) : null;
  $('#teacherId').value = teacher ? teacher.id : '';
  $('#modalTeacherTitle').textContent = teacher ? 'تعديل المدرس' : 'إضافة مدرس';
  $('#teacherDeleteBtn').hidden = !teacher;
  const subjects = sortBy(appState.subjects, (s) => s.order);
  const selected = teacher ? teacher.subjectId : presetSubjectId && getSubject(presetSubjectId) ? presetSubjectId : subjects[0].id;
  fillSelect($('#teacherSubject'), subjects.map((s) => ({ value: s.id, label: s.name })), selected);
  $('#teacherStartNumber').disabled = !!teacher;
  $('#teacherDoneInitial').disabled = !!teacher;
  if (teacher) {
    $('#teacherName').value = teacher.name;
    setRadio('teacherAvatar', teacher.avatar, form);
    setCheckedNumbers('publishDays', teacher.publishDays, form);
    $('#teacherPublishTime').value = teacher.publishTime;
    $('#teacherAvgDuration').value = teacher.avgDuration;
    $('#teacherStartNumber').value = teacher.startNumber;
    $('#teacherPublished').value = teacher.publishedCount;
    $('#teacherExpectedTotal').value = teacher.expectedTotal > 0 ? teacher.expectedTotal : '';
    $('#teacherDoneInitial').value = lecturesOfTeacher(teacher.id).filter((l) => l.status === 'done').length;
  } else {
    setRadio('teacherAvatar', TEACHER_AVATARS[appState.teachers.length % TEACHER_AVATARS.length], form);
    $('#teacherPublishTime').value = '18:00';
    $('#teacherAvgDuration').value = 45;
    $('#teacherStartNumber').value = 1;
    $('#teacherPublished').value = 0;
    $('#teacherDoneInitial').value = 0;
  }
  openModal('modalTeacher');
}

function handleTeacherSubmit(event) {
  event.preventDefault();
  const form = $('#teacherForm');
  clearFieldErrors(form);
  const id = $('#teacherId').value;
  const existing = id ? getTeacher(id) : null;
  let valid = true;
  const name = toText($('#teacherName').value, 40);
  if (name.length < 2) {
    setFieldError('teacherName', 'اكتب اسم المدرس (حرفان على الأقل)');
    valid = false;
  }
  const subjectId = $('#teacherSubject').value;
  const subject = getSubject(subjectId);
  if (!subject) {
    setFieldError('teacherSubject', 'اختر المادة');
    valid = false;
  }
  const publishDays = getCheckedNumbers('publishDays', form);
  if (!publishDays.length) {
    setFieldError('publishDays', 'اختر يوم نشر واحدًا على الأقل');
    valid = false;
  }
  const avgDuration = readIntField('teacherAvgDuration', 5, 480);
  if (Number.isNaN(avgDuration)) {
    setFieldError('teacherAvgDuration', 'اكتب مدة بين 5 و480 دقيقة');
    valid = false;
  }
  const startNumber = existing ? existing.startNumber : readIntField('teacherStartNumber', 1, 999);
  if (Number.isNaN(startNumber)) {
    setFieldError('teacherStartNumber', 'اكتب رقمًا بين 1 و999');
    valid = false;
  }
  const published = readIntField('teacherPublished', 0, 999);
  if (Number.isNaN(published)) {
    setFieldError('teacherPublished', 'اكتب رقمًا بين 0 و999');
    valid = false;
  } else if (!Number.isNaN(startNumber) && !existing && published < startNumber - 1) {
    setFieldError('teacherPublished', 'عدد المنشورة لا يمكن أن يكون أقل من رقم أول محاضرة تتابعها ناقص واحد');
    valid = false;
  } else if (existing) {
    const maxTracked = lecturesOfTeacher(existing.id).reduce((max, l) => Math.max(max, l.number), 0);
    if (published < maxTracked) {
      setFieldError('teacherPublished', 'لديك محاضرات مسجلة حتى رقم ' + maxTracked + ' فلا يمكن أن يقل العدد عنه');
      valid = false;
    }
  }
  const expectedTotal = readOptionalIntField('teacherExpectedTotal', 0, 999);
  if (Number.isNaN(expectedTotal)) {
    setFieldError('teacherExpectedTotal', 'اكتب رقمًا بين 0 و999');
    valid = false;
  } else if (!Number.isNaN(published) && expectedTotal > 0 && expectedTotal < published) {
    setFieldError('teacherExpectedTotal', 'الإجمالي المتوقع لا يمكن أن يقل عن عدد المنشورة');
    valid = false;
  }
  let doneInitial = 0;
  if (!existing) {
    doneInitial = readOptionalIntField('teacherDoneInitial', 0, 999);
    const tracked = !Number.isNaN(published) && !Number.isNaN(startNumber) ? Math.max(0, published - startNumber + 1) : 0;
    if (Number.isNaN(doneInitial)) {
      setFieldError('teacherDoneInitial', 'اكتب رقمًا صحيحًا');
      valid = false;
    } else if (doneInitial > tracked) {
      setFieldError('teacherDoneInitial', 'لا يمكن أن يزيد عدد المنجز على عدد المحاضرات التي تتابعها (' + tracked + ')');
      valid = false;
    }
  }
  if (!valid) return;

  const values = {
    name,
    subjectId,
    avatar: pick(getRadio('teacherAvatar', form), TEACHER_AVATARS, 'sage'),
    publishDays,
    publishTime: toTime($('#teacherPublishTime').value, '18:00'),
    avgDuration,
    publishedCount: published,
    expectedTotal
  };

  if (existing) {
    const subjectChanged = existing.subjectId !== subjectId;
    Object.assign(existing, values);
    if (subjectChanged) lecturesOfTeacher(existing.id).forEach((lecture) => { lecture.subjectId = subjectId; });
    commit('teacher:update');
    toast('تم تحديث بيانات المدرس ومواعيده', 'success');
    closeModal('modalTeacher');
    requestReplan('teacher');
    return;
  }

  const teacher = Object.assign({ id: uid('tch'), startNumber, lastPublishedAt: null, createdAt: Date.now() }, values);
  appState.teachers.push(teacher);
  const numbers = [];
  for (let n = startNumber; n <= published; n += 1) numbers.push(n);
  const dates = backfillPublishDates(teacher, numbers);
  numbers.forEach((number, index) => {
    const isDone = index < doneInitial;
    const lecture = {
      id: uid('lec'),
      teacherId: teacher.id,
      subjectId,
      number,
      title: '',
      notes: '',
      duration: avgDuration,
      difficulty: subject.difficulty,
      publishedAt: dates[number],
      createdAt: Date.now(),
      status: isDone ? 'done' : 'new',
      completedAt: isDone ? todayStr() : null,
      manualDone: isDone,
      understanding: 0
    };
    appState.lectures.push(lecture);
    if (!isDone) createSessionsForLecture(lecture);
  });
  if (numbers.length) teacher.lastPublishedAt = dates[numbers[numbers.length - 1]];
  commit('teacher:add');
  closeModal('modalTeacher');
  const open = numbers.length - doneInitial;
  toast(open > 0 ? 'تمت إضافة ' + name + ' وأنشأنا ' + open + ' محاضرة غير مكتملة بجلساتها المقترحة' : 'تمت إضافة المدرس ' + name, 'success');
  requestReplan('teacher');
}

async function deleteTeacherFlow(id) {
  const teacher = id ? getTeacher(id) : null;
  if (!teacher) return;
  const confirmed = await confirmDialog({
    title: 'حذف المدرس',
    text: 'سيتم حذف المدرس ' + teacher.name + ' مع كل محاضراته وجلساته ومراجعاته. نقاط الخبرة التي حصلت عليها لن تتأثر.',
    okLabel: 'حذف المدرس'
  });
  if (!confirmed) return;
  removeTeacherData(id);
  commit('teacher:delete');
  closeModal('modalTeacher');
  toast('تم حذف المدرس', 'info');
  requestReplan('teacher-delete');
}

function addNextLecture(teacherId) {
  const teacher = getTeacher(teacherId);
  if (!teacher) return null;
  const now = Date.now();
  if (quickAddLock[teacherId] && now - quickAddLock[teacherId] < 700) return null;
  quickAddLock[teacherId] = now;
  const maxTracked = lecturesOfTeacher(teacherId).reduce((max, l) => Math.max(max, l.number), 0);
  const previous = Math.max(teacher.publishedCount, maxTracked);
  const number = previous + 1;
  if (number > 999) {
    toast('وصلت إلى الحد الأقصى لعدد المحاضرات لهذا المدرس', 'warn');
    return null;
  }
  const subject = getSubject(teacher.subjectId);
  const pending = pendingPublishDates(teacher);
  const publishedAt = pending.length ? pending[0] : todayStr();
  const lecture = {
    id: uid('lec'),
    teacherId,
    subjectId: teacher.subjectId,
    number,
    title: '',
    notes: '',
    duration: teacher.avgDuration,
    difficulty: subject ? subject.difficulty : 3,
    publishedAt,
    createdAt: Date.now(),
    status: 'new',
    completedAt: null,
    manualDone: false,
    understanding: 0
  };
  appState.lectures.push(lecture);
  createSessionsForLecture(lecture);
  teacher.publishedCount = number;
  if (!teacher.lastPublishedAt || publishedAt > teacher.lastPublishedAt) teacher.lastPublishedAt = publishedAt;
  if (teacher.expectedTotal > 0 && number > teacher.expectedTotal) teacher.expectedTotal = number;
  commit('lecture:add');
  requestReplan('new-lecture');
  bus.emit('lecture:added', { lectureId: lecture.id });
  toast('أُضيفت المحاضرة ' + number + ' للمدرس ' + teacher.name + ' وارتفع عدد المنشورة من ' + previous + ' إلى ' + number, 'success');
  return lecture;
}

function quickAddForSubject(subjectId) {
  const teachers = teachersOfSubject(subjectId);
  if (!teachers.length) {
    toast('أضف مدرسًا لهذه المادة أولًا', 'warn');
    openTeacherModal(null, subjectId);
    return;
  }
  if (teachers.length === 1) {
    addNextLecture(teachers[0].id);
    return;
  }
  openLectureModal(null, teachers[0].id);
}

function sessionRowHtml(row) {
  const locked = row.status === 'done' || row.status === 'active';
  const disabled = locked ? ' disabled' : '';
  const options = Object.keys(SESSION_TYPES)
    .map((key) => '<option value="' + key + '"' + (key === row.type ? ' selected' : '') + '>' + SESSION_TYPES[key] + '</option>')
    .join('');
  const tail = locked
    ? '<span class="row-state">' + SESSION_STATUS_LABELS[row.status] + '</span>'
    : '<button type="button" class="icon-btn row-remove" data-action="remove-session-row" aria-label="حذف الجلسة"><svg class="icon"><use href="#i-trash"/></svg></button>';
  return (
    '<div class="session-row' + (locked ? ' is-locked' : '') + '" data-row-id="' + escapeHtml(row.id || '') + '" data-status="' + row.status + '">' +
    '<select class="row-type" aria-label="نوع الجلسة"' + disabled + '>' + options + '</select>' +
    '<input class="row-minutes" type="number" min="5" max="480" step="5" inputmode="numeric" value="' + row.minutes + '" aria-label="المدة بالدقائق"' + disabled + '>' +
    '<input class="row-desc" type="text" maxlength="300" value="' + escapeHtml(row.description) + '" placeholder="وصف المطلوب" aria-label="وصف المطلوب"' + disabled + '>' +
    tail +
    '</div>'
  );
}

function appendSessionRow(row) {
  const holder = $('#sessionBuilder');
  if (holder.children.length >= MAX_SESSION_ROWS) {
    toast('الحد الأقصى ' + MAX_SESSION_ROWS + ' جلسة للمحاضرة', 'warn');
    return;
  }
  holder.insertAdjacentHTML('beforeend', sessionRowHtml(row));
}

function readSessionRows() {
  return $$('#sessionBuilder .session-row').map((node) => ({
    node,
    id: node.dataset.rowId || '',
    status: node.dataset.status || 'pending',
    locked: node.classList.contains('is-locked'),
    type: pick($('.row-type', node).value, Object.keys(SESSION_TYPES), 'study'),
    minutes: Number($('.row-minutes', node).value),
    description: toText($('.row-desc', node).value, 300)
  }));
}

function applyLectureTeacherDefaults(teacherId, resetFields) {
  const hint = $('#lectureTeacherHint');
  const teacher = getTeacher(teacherId);
  if (!teacher) {
    hint.textContent = '';
    return;
  }
  const subject = getSubject(teacher.subjectId);
  const maxTracked = lecturesOfTeacher(teacher.id).reduce((max, l) => Math.max(max, l.number), 0);
  const next = Math.max(teacher.publishedCount, maxTracked) + 1;
  const pending = pendingPublishDates(teacher);
  const upcoming = expectedPublishDates(teacher, 1);
  let text = 'آخر محاضرة منشورة لهذا المدرس: ' + teacher.publishedCount + '. المحاضرة التالية رقم ' + next + '.';
  if (pending.length) text += ' حان موعد نشر محاضرة متوقعة يوم ' + formatDateAr(pending[0]) + '.';
  else if (upcoming.length) text += ' الموعد المتوقع القادم: ' + formatDateAr(upcoming[0]) + '.';
  hint.textContent = text;
  if (resetFields) {
    $('#lectureNumber').value = next;
    $('#lecturePublishedAt').value = pending.length ? pending[0] : todayStr();
    $('#lectureDuration').value = teacher.avgDuration;
    $('#lectureDifficulty').value = String(subject ? subject.difficulty : 3);
  }
}

function openLectureModal(id, presetTeacherId) {
  if (!appState.teachers.length) {
    toast('أضف مدرسًا أولًا حتى تستطيع إضافة محاضرات', 'warn');
    openTeacherModal();
    return;
  }
  const form = $('#lectureForm');
  form.reset();
  clearFieldErrors(form);
  const lecture = id ? getLecture(id) : null;
  $('#lectureId').value = lecture ? lecture.id : '';
  $('#modalLectureTitle').textContent = lecture ? 'تعديل المحاضرة' : 'إضافة محاضرة جديدة';
  $('#lectureDeleteBtn').hidden = !lecture;
  $('#lecturePublishedAt').max = todayStr();
  $('#sessionBuilder').innerHTML = '';
  $('#sessionSuggestNote').textContent = '';
  const teachers = sortBy(appState.teachers, (t) => {
    const subject = getSubject(t.subjectId);
    return (subject ? String(subject.order).padStart(4, '0') : '9999') + t.name;
  });
  const selectedTeacher = lecture ? lecture.teacherId : presetTeacherId && getTeacher(presetTeacherId) ? presetTeacherId : teachers[0].id;
  fillSelect($('#lectureTeacher'), teachers.map((t) => {
    const subject = getSubject(t.subjectId);
    return { value: t.id, label: t.name + (subject ? ' — ' + subject.name : '') };
  }), selectedTeacher);
  $('#lectureTeacher').disabled = !!lecture;
  if (lecture) {
    applyLectureTeacherDefaults(lecture.teacherId, false);
    $('#lectureNumber').value = lecture.number;
    $('#lecturePublishedAt').value = lecture.publishedAt;
    $('#lectureTitle').value = lecture.title;
    $('#lectureNotes').value = lecture.notes;
    $('#lectureDuration').value = lecture.duration;
    $('#lectureDifficulty').value = String(lecture.difficulty);
    sessionsOfLecture(lecture.id).forEach((s) => appendSessionRow({ id: s.id, status: s.status, type: s.type, minutes: s.minutes, description: s.description }));
  } else {
    applyLectureTeacherDefaults(selectedTeacher, true);
    runSessionSuggestion();
  }
  openModal('modalLecture');
}

function runSessionSuggestion() {
  const teacher = getTeacher($('#lectureTeacher').value);
  if (!teacher) return;
  const duration = readIntField('lectureDuration', 5, 480);
  const number = readIntField('lectureNumber', 1, 999);
  const suggestion = suggestSessionPlan({
    duration: Number.isNaN(duration) ? teacher.avgDuration : duration,
    difficulty: Number($('#lectureDifficulty').value),
    subjectId: teacher.subjectId,
    number: Number.isNaN(number) ? teacher.publishedCount + 1 : number,
    title: toText($('#lectureTitle').value, 80)
  });
  $$('#sessionBuilder .session-row').forEach((node) => {
    if (!node.classList.contains('is-locked')) node.remove();
  });
  suggestion.sessions.forEach((item) => appendSessionRow({ id: '', status: 'pending', type: item.type, minutes: item.minutes, description: item.description }));
  $('#sessionSuggestNote').textContent = suggestion.note;
  setFieldError('sessionBuilder', '');
}

function handleLectureSubmit(event) {
  event.preventDefault();
  const form = $('#lectureForm');
  clearFieldErrors(form);
  const id = $('#lectureId').value;
  const existing = id ? getLecture(id) : null;
  let valid = true;
  const teacher = getTeacher($('#lectureTeacher').value);
  if (!teacher) {
    setFieldError('lectureTeacher', 'اختر المدرس');
    valid = false;
  }
  const number = readIntField('lectureNumber', 1, 999);
  if (Number.isNaN(number)) {
    setFieldError('lectureNumber', 'اكتب رقمًا بين 1 و999');
    valid = false;
  } else if (teacher && appState.lectures.some((l) => l.teacherId === teacher.id && l.number === number && l.id !== id)) {
    setFieldError('lectureNumber', 'هذه المحاضرة مسجلة بالفعل لهذا المدرس');
    valid = false;
  }
  const publishedAt = $('#lecturePublishedAt').value;
  if (!isValidDateStr(publishedAt)) {
    setFieldError('lecturePublishedAt', 'اختر تاريخ نشر صحيحًا');
    valid = false;
  } else if (publishedAt > todayStr()) {
    setFieldError('lecturePublishedAt', 'لا يمكن أن يكون تاريخ النشر في المستقبل');
    valid = false;
  }
  const duration = readIntField('lectureDuration', 5, 480);
  if (Number.isNaN(duration)) {
    setFieldError('lectureDuration', 'اكتب مدة بين 5 و480 دقيقة');
    valid = false;
  }
  const rows = readSessionRows();
  let rowsValid = true;
  rows.forEach((row) => {
    $('.row-minutes', row.node).removeAttribute('aria-invalid');
    if (!row.locked && (!Number.isInteger(row.minutes) || row.minutes < 5 || row.minutes > 480)) {
      $('.row-minutes', row.node).setAttribute('aria-invalid', 'true');
      rowsValid = false;
    }
  });
  if (!rows.length && !(existing && existing.status === 'done' && existing.manualDone)) {
    setFieldError('sessionBuilder', 'أضف جلسة واحدة على الأقل');
    valid = false;
  } else if (!rowsValid) {
    setFieldError('sessionBuilder', 'مدة كل جلسة يجب أن تكون بين 5 و480 دقيقة');
    valid = false;
  }
  if (!valid) return;

  const title = toText($('#lectureTitle').value, 80);
  const notes = toText($('#lectureNotes').value, 300);
  const difficulty = toInt($('#lectureDifficulty').value, 1, 5, 3);
  let lecture = existing;
  if (lecture) {
    Object.assign(lecture, { number, publishedAt, title, notes, duration, difficulty });
  } else {
    lecture = {
      id: uid('lec'),
      teacherId: teacher.id,
      subjectId: teacher.subjectId,
      number,
      title,
      notes,
      duration,
      difficulty,
      publishedAt,
      createdAt: Date.now(),
      status: 'new',
      completedAt: null,
      manualDone: false,
      understanding: 0
    };
    appState.lectures.push(lecture);
  }

  const currentSessions = sessionsOfLecture(lecture.id);
  const keptIds = new Set(rows.filter((r) => r.id).map((r) => r.id));
  const removedIds = currentSessions.filter((s) => !keptIds.has(s.id) && (s.status === 'pending' || s.status === 'missed')).map((s) => s.id);
  if (removedIds.length) {
    appState.sessions = appState.sessions.filter((s) => !removedIds.includes(s.id));
    removedIds.forEach((sid) => delete appState.plan.reasons[sid]);
  }
  let addedAny = false;
  rows.forEach((row, index) => {
    const session = row.id ? getSession(row.id) : null;
    if (session) {
      session.order = index;
      if (!row.locked) {
        session.type = row.type;
        session.minutes = row.minutes;
        session.description = row.description;
      }
    } else {
      addedAny = true;
      appState.sessions.push({
        id: uid('ses'),
        lectureId: lecture.id,
        type: row.type,
        minutes: row.minutes,
        description: row.description,
        date: null,
        status: 'pending',
        progress: 0,
        order: index,
        createdAt: Date.now(),
        completedAt: null,
        actualMinutes: 0,
        postponedCount: 0
      });
    }
  });
  if (addedAny) lecture.manualDone = false;
  refreshLectureStatus(lecture);
  if (number > teacher.publishedCount) teacher.publishedCount = number;
  if (!teacher.lastPublishedAt || publishedAt > teacher.lastPublishedAt) teacher.lastPublishedAt = publishedAt;
  if (teacher.expectedTotal > 0 && number > teacher.expectedTotal) teacher.expectedTotal = number;
  commit(existing ? 'lecture:update' : 'lecture:add');
  closeModal('modalLecture');
  toast(existing ? 'تم تحديث المحاضرة وجلساتها' : 'تمت إضافة المحاضرة ' + number + ' بجلساتها', 'success');
  requestReplan(existing ? 'lecture-update' : 'new-lecture');
}

async function deleteLectureFlow(id) {
  const lecture = id ? getLecture(id) : null;
  if (!lecture) return;
  const confirmed = await confirmDialog({
    title: 'حذف المحاضرة',
    text: 'سيتم حذف ' + lectureLabel(lecture) + ' مع جلساتها ومراجعاتها. نقاط الخبرة التي حصلت عليها لن تتأثر.',
    okLabel: 'حذف المحاضرة'
  });
  if (!confirmed) return;
  removeLectureData(id);
  commit('lecture:delete');
  closeModal('modalLecture');
  toast('تم حذف المحاضرة', 'info');
  requestReplan('lecture-delete');
}

function openSessionModal(id, lectureId) {
  const form = $('#sessionForm');
  form.reset();
  clearFieldErrors(form);
  const session = id ? getSession(id) : null;
  const lecture = session ? getLecture(session.lectureId) : lectureId ? getLecture(lectureId) : null;
  if (!lecture) {
    toast('اختر محاضرة أولًا', 'warn');
    return;
  }
  const done = !!session && session.status === 'done';
  $('#sessionId').value = session ? session.id : '';
  $('#sessionLectureId').value = lecture.id;
  $('#modalSessionTitle').textContent = session ? 'تعديل الجلسة' : 'إضافة جلسة';
  $('#sessionLectureLabel').textContent = lectureFullLabel(lecture);
  $('#sessionDeleteBtn').hidden = !session || done;
  $('#sessionDate').min = '';
  ['sessionType', 'sessionMinutes', 'sessionDate', 'sessionProgress'].forEach((fieldId) => {
    $('#' + fieldId).disabled = done;
  });
  if (session) {
    $('#sessionType').value = session.type;
    $('#sessionMinutes').value = session.minutes;
    $('#sessionDate').value = session.date || '';
    $('#sessionDescription').value = session.description;
    $('#sessionProgress').value = done ? 100 : session.progress;
  } else {
    $('#sessionType').value = 'study';
    $('#sessionMinutes').value = 30;
    $('#sessionDate').value = '';
    $('#sessionProgress').value = 0;
  }
  $('#sessionProgressOut').textContent = $('#sessionProgress').value + '%';
  openModal('modalSession');
}

function handleSessionSubmit(event) {
  event.preventDefault();
  const form = $('#sessionForm');
  clearFieldErrors(form);
  const id = $('#sessionId').value;
  const session = id ? getSession(id) : null;
  const lecture = getLecture($('#sessionLectureId').value);
  if (!lecture) return;
  const description = toText($('#sessionDescription').value, 300);
  if (session && session.status === 'done') {
    session.description = description;
    commit('session:update');
    closeModal('modalSession');
    toast('تم تحديث وصف الجلسة', 'success');
    return;
  }
  const minutes = readIntField('sessionMinutes', 5, 480);
  if (Number.isNaN(minutes)) {
    setFieldError('sessionMinutes', 'اكتب مدة بين 5 و480 دقيقة');
    return;
  }
  const dateValue = $('#sessionDate').value;
  const date = isValidDateStr(dateValue) ? dateValue : null;
  const type = pick($('#sessionType').value, Object.keys(SESSION_TYPES), 'study');
  const progress = toInt($('#sessionProgress').value, 0, 100, 0);
  let target = session;
  if (target) {
    target.type = type;
    target.minutes = minutes;
    target.description = description;
    target.date = date;
    target.progress = Math.min(progress, 95);
    if (target.status === 'missed') target.status = 'pending';
  } else {
    const order = sessionsOfLecture(lecture.id).reduce((max, s) => Math.max(max, s.order), -1) + 1;
    target = {
      id: uid('ses'),
      lectureId: lecture.id,
      type,
      minutes,
      description,
      date,
      status: 'pending',
      progress: Math.min(progress, 95),
      order,
      createdAt: Date.now(),
      completedAt: null,
      actualMinutes: 0,
      postponedCount: 0
    };
    appState.sessions.push(target);
    lecture.manualDone = false;
  }
  refreshLectureStatus(lecture);
  commit(session ? 'session:update' : 'session:add');
  closeModal('modalSession');
  toast(session ? 'تم تحديث الجلسة' : 'تمت إضافة الجلسة', 'success');
  if (progress >= 100) bus.emit('session:complete', { id: target.id });
  else requestReplan('session-change');
}

async function deleteSessionFlow(id) {
  const session = id ? getSession(id) : null;
  if (!session) return;
  if (session.status === 'done') {
    toast('الجلسة المكتملة لا تُحذف حفاظًا على سجل إنجازك', 'warn');
    return;
  }
  const confirmed = await confirmDialog({ title: 'حذف الجلسة', text: 'هل تريد حذف هذه الجلسة؟', okLabel: 'حذف الجلسة' });
  if (!confirmed) return;
  const lecture = getLecture(session.lectureId);
  appState.sessions = appState.sessions.filter((s) => s.id !== id);
  delete appState.plan.reasons[id];
  if (lecture) refreshLectureStatus(lecture);
  commit('session:delete');
  closeModal('modalSession');
  toast('تم حذف الجلسة', 'info');
  requestReplan('session-delete');
}

function validateExamInput(input) {
  const errors = {};
  const title = toText(input.title, 60);
  if (title.length < 2) errors.title = 'اكتب اسم الامتحان (حرفان على الأقل)';
  if (!isValidDateStr(input.date)) errors.date = 'اختر تاريخ الامتحان';
  else if (input.date < todayStr()) errors.date = 'تاريخ الامتحان يجب أن يكون اليوم أو بعده';
  return { ok: Object.keys(errors).length === 0, errors, title };
}

function buildExam(input, title) {
  return {
    id: uid('exm'),
    title,
    subjectId: input.subjectId && getSubject(input.subjectId) ? input.subjectId : '',
    subjectName: toText(input.subjectName, 40),
    date: input.date
  };
}

function addExam(input) {
  const check = validateExamInput(input);
  if (!check.ok) return check;
  appState.exams.push(buildExam(input, check.title));
  appState.exams = sortBy(appState.exams, (e) => e.date);
  commit('exam:add');
  requestReplan('exam');
  return check;
}

function removeExam(id) {
  appState.exams = appState.exams.filter((e) => e.id !== id);
  commit('exam:remove');
  requestReplan('exam-remove');
}

function setAuthTab(tab) {
  const isLogin = tab === 'login';
  $('#signupForm').hidden = isLogin;
  $('#loginForm').hidden = !isLogin;
  $$('.auth-tab').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.authTab === tab)));
  clearFieldErrors($('#authScreen'));
  if (isLogin) renderLocalAccounts();
}

function openAuth(tab) {
  showScreen('auth');
  setAuthTab(tab);
}

async function renderLocalAccounts() {
  const holder = $('#localAccounts');
  let accounts = [];
  try {
    accounts = await listAccounts();
  } catch (e) {
    accounts = [];
  }
  holder.innerHTML = accounts.length
    ? '<p class="hint">حسابات على هذا الجهاز</p>' +
      accounts.map((a) => '<button type="button" class="account-chip" data-action="pick-account" data-username="' + escapeHtml(a.username) + '">' + escapeHtml(a.username) + '</button>').join('')
    : '<p class="hint">لا توجد حسابات على هذا الجهاز بعد.</p>';
}

function setFormBusy(form, busy) {
  $$('button[type="submit"]', form).forEach((button) => {
    button.disabled = busy;
  });
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  const form = $('#signupForm');
  clearFieldErrors(form);
  const username = $('#signupUsername').value;
  const password = $('#signupPassword').value;
  const confirm = $('#signupConfirm').value;
  let valid = true;
  const usernameError = validateUsername(username);
  if (usernameError) {
    setFieldError('signupUsername', usernameError);
    valid = false;
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    setFieldError('signupPassword', passwordError);
    valid = false;
  }
  if (!passwordError && password !== confirm) {
    setFieldError('signupConfirm', 'كلمتا المرور غير متطابقتين');
    valid = false;
  }
  if (!valid) return;
  setFormBusy(form, true);
  try {
    const result = await createAccount(username, password);
    if (!result.ok) {
      setFieldError(result.field, result.message);
      return;
    }
    const opened = await openWorld(result.account);
    if (!opened.ok) {
      toast(opened.error, 'error');
      return;
    }
    form.reset();
    enterAfterAuth();
  } catch (e) {
    toast('تعذر إنشاء الحساب. تأكد من أن التخزين المحلي متاح في المتصفح', 'error');
  } finally {
    setFormBusy(form, false);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = $('#loginForm');
  clearFieldErrors(form);
  setFormBusy(form, true);
  try {
    const result = await verifyLogin($('#loginUsername').value, $('#loginPassword').value);
    if (!result.ok) {
      setFieldError(result.field, result.message);
      return;
    }
    const opened = await openWorld(result.account);
    if (!opened.ok) {
      toast(opened.error, 'error');
      return;
    }
    form.reset();
    enterAfterAuth();
  } catch (e) {
    toast('تعذر تسجيل الدخول. تأكد من أن التخزين المحلي متاح في المتصفح', 'error');
  } finally {
    setFormBusy(form, false);
  }
}

function enterAfterAuth() {
  if (!appState) {
    showScreen('splash');
    return;
  }
  if (!appState.profile.onboarded) {
    startOnboarding();
    return;
  }
  if (!appState.pet) {
    startPetSelection();
    return;
  }
  showScreen('game');
  bus.emit('game:enter');
}

function startOnboarding() {
  onboardState.step = 1;
  onboardState.exams = appState.exams.map((e) => Object.assign({}, e));
  const form = $('#onboardForm');
  form.reset();
  clearFieldErrors(form);
  const profile = appState.profile;
  $('#obName').value = profile.name;
  if (profile.stage) setRadio('stage', profile.stage, form);
  $('#obGrade').value = profile.grade;
  $('#obCountry').value = profile.country;
  if (profile.goal) setRadio('goal', profile.goal, form);
  $('#obGoalText').value = profile.goalText;
  if (profile.name) setRadio('level', profile.level, form);
  for (let d = 0; d <= 6; d += 1) {
    const input = $('input[name="min-' + d + '"]', form);
    if (input) input.value = appState.availability.minutes[d];
  }
  setCheckedNumbers('busy', appState.availability.busy, form);
  setCheckedNumbers('rest', appState.availability.rest, form);
  renderOnboardExams();
  showScreen('onboarding');
  renderOnboardStep();
}

function renderOnboardStep() {
  const step = onboardState.step;
  $$('.onboard-step').forEach((node) => {
    node.hidden = Number(node.dataset.step) !== step;
  });
  $('#onboardProgressBar').style.width = Math.round((step / ONBOARD_TOTAL) * 100) + '%';
  const current = $('.onboard-step[data-step="' + step + '"]');
  const name = toText($('#obName').value, 40);
  let guide = current ? current.dataset.guide : '';
  if (step === 2 && name) guide = 'تشرفنا يا ' + name + '. ' + guide;
  const bubble = $('#guideBubble');
  bubble.textContent = guide;
  bubble.classList.remove('is-typing');
  void bubble.offsetWidth;
  bubble.classList.add('is-typing');
  $('#obBack').hidden = step === 1;
  $('#obSkip').hidden = !(step === 4 || step === 9);
  $('#obNext').textContent = step === ONBOARD_TOTAL ? 'إنهاء الإعداد' : 'التالي';
  clearFieldErrors($('#onboardForm'));
  const focusTarget = current ? current.querySelector('input:not([type="radio"]):not([type="checkbox"]), input[type="radio"]') : null;
  if (focusTarget) setTimeout(() => focusTarget.focus(), 80);
}

function renderOnboardExams() {
  const list = $('#obExamList');
  list.innerHTML = onboardState.exams
    .map((exam) => '<li class="exam-item"><span class="exam-title">' + escapeHtml(exam.title) + (exam.subjectName ? ' · ' + escapeHtml(exam.subjectName) : '') + '</span><span class="exam-date">' + escapeHtml(formatDateAr(exam.date)) + '</span><button type="button" class="icon-btn" data-action="onboard-remove-exam" data-id="' + escapeHtml(exam.id) + '" aria-label="حذف الامتحان"><svg class="icon"><use href="#i-trash"/></svg></button></li>')
    .join('');
}

function tryAddOnboardExam() {
  const title = $('#obExamTitle').value;
  const date = $('#obExamDate').value;
  const check = validateExamInput({ title, date });
  if (!check.ok) {
    setFieldError('exam', check.errors.title || check.errors.date);
    return false;
  }
  if (onboardState.exams.length >= 20) {
    setFieldError('exam', 'يمكنك إضافة حتى 20 امتحانًا هنا، وأضف الباقي لاحقًا من الإعدادات');
    return false;
  }
  onboardState.exams.push(buildExam({ subjectName: $('#obExamSubject').value, date }, check.title));
  onboardState.exams = sortBy(onboardState.exams, (e) => e.date);
  $('#obExamTitle').value = '';
  $('#obExamSubject').value = '';
  $('#obExamDate').value = '';
  setFieldError('exam', '');
  renderOnboardExams();
  return true;
}

function validateOnboardStep(step) {
  const form = $('#onboardForm');
  clearFieldErrors(form);
  if (step === 1) {
    if (toText($('#obName').value, 40).length < 2) {
      setFieldError('obName', 'اكتب اسمك (حرفان على الأقل)');
      return false;
    }
  }
  if (step === 2 && !getRadio('stage', form)) {
    setFieldError('stage', 'اختر مرحلتك التعليمية');
    return false;
  }
  if (step === 3 && toText($('#obGrade').value, 40).length < 2) {
    setFieldError('obGrade', 'اكتب صفك أو سنتك الدراسية');
    return false;
  }
  if (step === 5 && !getRadio('goal', form)) {
    setFieldError('goal', 'اختر هدفك الدراسي');
    return false;
  }
  if (step === 6 && !getRadio('level', form)) {
    setFieldError('level', 'اختر مستواك الحالي');
    return false;
  }
  if (step === 7) {
    let total = 0;
    for (let d = 0; d <= 6; d += 1) {
      const input = $('input[name="min-' + d + '"]', form);
      const raw = String(input.value).trim();
      const n = Number(raw);
      if (raw === '' || !Number.isInteger(n) || n < 0 || n > 720) {
        setFieldError('dailyMinutes', 'اكتب لكل يوم رقمًا بين 0 و720 دقيقة');
        input.focus();
        return false;
      }
      total += n;
    }
    if (total <= 0) {
      setFieldError('dailyMinutes', 'أضف وقتًا للمذاكرة في يوم واحد على الأقل');
      return false;
    }
  }
  if (step === 8 && getCheckedNumbers('rest', form).length >= 7) {
    setFieldError('days', 'لا يمكن أن تكون كل الأيام أيام راحة');
    return false;
  }
  if (step === 9 && toText($('#obExamTitle').value, 60) && !tryAddOnboardExam()) return false;
  return true;
}

function readOnboardForm() {
  const form = $('#onboardForm');
  const minutes = {};
  for (let d = 0; d <= 6; d += 1) minutes[d] = toInt($('input[name="min-' + d + '"]', form).value, 0, 720, 0);
  return {
    name: toText($('#obName').value, 40),
    stage: pick(getRadio('stage', form), Object.keys(STAGE_LABELS), 'other'),
    grade: toText($('#obGrade').value, 40),
    country: toText($('#obCountry').value, 40),
    goal: pick(getRadio('goal', form), Object.keys(GOAL_LABELS), 'consistency'),
    goalText: toText($('#obGoalText').value, 120),
    level: toInt(getRadio('level', form), 1, 4, 2),
    minutes,
    busy: getCheckedNumbers('busy', form),
    rest: getCheckedNumbers('rest', form)
  };
}

function finishOnboarding() {
  const data = readOnboardForm();
  mutate('onboarding', (s) => {
    s.profile.name = data.name;
    s.profile.stage = data.stage;
    s.profile.grade = data.grade;
    s.profile.country = data.country;
    s.profile.goal = data.goal;
    s.profile.goalText = data.goalText;
    s.profile.level = data.level;
    s.profile.onboarded = true;
    s.availability = { minutes: data.minutes, busy: toDayList(data.busy), rest: toDayList(data.rest) };
    s.exams = onboardState.exams.map((e) => Object.assign({}, e));
  });
  requestReplan('onboarding');
  if (appState.pet) {
    enterAfterAuth();
    return;
  }
  startPetSelection();
}

function startPetSelection() {
  showScreen('pet');
  clearFieldErrors($('#petScreen'));
  const checked = $('input[name="petSpecies"]:checked');
  petState.species = checked ? checked.value : 'dragon';
  $('#petNameInput').value = '';
  updatePetPlaceholder();
  bus.emit('pet:preview', { species: petState.species });
}

function updatePetPlaceholder() {
  $('#petNameInput').placeholder = 'مثال: ' + (PET_SPECIES[petState.species] || 'رفيقي');
}

function handlePetNameSubmit(event) {
  event.preventDefault();
  clearFieldErrors($('#petScreen'));
  const name = toText($('#petNameInput').value, 20);
  if (name.length < 2) {
    setFieldError('petNameInput', 'اختر اسمًا من حرفين على الأقل');
    return;
  }
  mutate('pet:adopt', (s) => {
    s.pet = { species: petState.species, name, adoptedAt: Date.now(), seenStage: 0, equipped: [] };
  });
  bus.emit('pet:adopted', appState.pet);
  toast('انضم ' + name + ' إلى رحلتك', 'success');
  enterAfterAuth();
}

actions['start-journey'] = () => {
  if (appState) enterAfterAuth();
  else openAuth('signup');
};
actions['open-login'] = () => openAuth('login');
actions['open-signup'] = () => openAuth('signup');
actions['auth-back'] = () => showScreen('splash');
actions['pick-account'] = (target) => {
  $('#loginUsername').value = target.dataset.username || '';
  $('#loginPassword').focus();
};
actions['onboard-next'] = () => {
  const step = onboardState.step;
  if (!validateOnboardStep(step)) return;
  if (step >= ONBOARD_TOTAL) {
    finishOnboarding();
    return;
  }
  onboardState.step = step + 1;
  renderOnboardStep();
};
actions['onboard-back'] = () => {
  if (onboardState.step <= 1) return;
  onboardState.step -= 1;
  renderOnboardStep();
};
actions['onboard-skip'] = () => {
  if (onboardState.step === 4) {
    $('#obCountry').value = '';
    onboardState.step = 5;
    renderOnboardStep();
    return;
  }
  if (onboardState.step === 9) finishOnboarding();
};
actions['onboard-add-exam'] = () => {
  tryAddOnboardExam();
};
actions['onboard-remove-exam'] = (target) => {
  onboardState.exams = onboardState.exams.filter((e) => e.id !== target.dataset.id);
  renderOnboardExams();
};
actions['open-subject-modal'] = (target) => openSubjectModal(target.dataset.id || '');
actions['delete-subject'] = (target) => deleteSubjectFlow(target.dataset.id || $('#subjectId').value);
actions['open-teacher-modal'] = (target) => openTeacherModal(target.dataset.id || '', target.dataset.subjectId || '');
actions['delete-teacher'] = (target) => deleteTeacherFlow(target.dataset.id || $('#teacherId').value);
actions['open-lecture-modal'] = (target) => openLectureModal(target.dataset.id || '', target.dataset.teacherId || '');
actions['delete-lecture'] = (target) => deleteLectureFlow(target.dataset.id || $('#lectureId').value);
actions['add-lecture-quick'] = (target) => {
  addNextLecture(target.dataset.teacherId);
};
actions['suggest-sessions'] = () => runSessionSuggestion();
actions['add-session-row'] = () => appendSessionRow({ id: '', status: 'pending', type: 'study', minutes: 30, description: '' });
actions['remove-session-row'] = (target) => {
  const row = target.closest('.session-row');
  if (row) row.remove();
};
actions['open-session-modal'] = (target) => openSessionModal(target.dataset.id || '', target.dataset.lectureId || '');
actions['delete-session'] = (target) => deleteSessionFlow(target.dataset.id || $('#sessionId').value);
actions['close-modal'] = (target) => {
  const modal = target.closest('.modal');
  closeModal(modal ? modal.id : undefined);
};

function bindFlowEvents() {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const handler = actions[target.dataset.action];
    if (!handler) return;
    if (target.tagName === 'A') event.preventDefault();
    handler(target, event);
  });

  document.addEventListener('keydown', (event) => {
    if (!modalStack.length) return;
    const top = modalStack[modalStack.length - 1];
    if (event.key === 'Escape') {
      if (NON_DISMISSIBLE_MODALS.includes(top)) return;
      if (top === 'modalConfirm') settleConfirm(false);
      else closeModal(top);
      return;
    }
    if (event.key !== 'Tab') return;
    const modal = document.getElementById(top);
    if (!modal) return;
    const items = $$(FOCUSABLE, modal).filter((node) => node.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  $('#modalLayer').addEventListener('mousedown', (event) => {
    if (event.target !== $('#modalLayer')) return;
    const top = modalStack[modalStack.length - 1];
    if (!top || NON_DISMISSIBLE_MODALS.includes(top)) return;
    if (top === 'modalConfirm') settleConfirm(false);
    else closeModal(top);
  });

  $$('.auth-tab').forEach((button) => {
    button.addEventListener('click', () => setAuthTab(button.dataset.authTab));
  });
  $('#signupForm').addEventListener('submit', handleSignupSubmit);
  $('#loginForm').addEventListener('submit', handleLoginSubmit);

  $('#onboardForm').addEventListener('submit', (event) => {
    event.preventDefault();
    actions['onboard-next']();
  });
  $('#onboardForm').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const tag = event.target.tagName;
    if (tag === 'TEXTAREA' || tag === 'BUTTON') return;
    event.preventDefault();
    if (event.target.id === 'obExamTitle' || event.target.id === 'obExamSubject' || event.target.id === 'obExamDate') {
      if (toText($('#obExamTitle').value, 60)) tryAddOnboardExam();
      return;
    }
    actions['onboard-next']();
  });

  $('#petOptions').addEventListener('change', (event) => {
    if (event.target.name !== 'petSpecies') return;
    petState.species = event.target.value;
    updatePetPlaceholder();
    bus.emit('pet:preview', { species: petState.species });
  });
  $('#petNameForm').addEventListener('submit', handlePetNameSubmit);

  $('#subjectForm').addEventListener('submit', handleSubjectSubmit);
  $('#teacherForm').addEventListener('submit', handleTeacherSubmit);
  $('#lectureForm').addEventListener('submit', handleLectureSubmit);
  $('#sessionForm').addEventListener('submit', handleSessionSubmit);

  $('#lectureTeacher').addEventListener('change', (event) => {
    applyLectureTeacherDefaults(event.target.value, true);
    runSessionSuggestion();
  });
  $('#sessionProgress').addEventListener('input', (event) => {
    $('#sessionProgressOut').textContent = event.target.value + '%';
  });

  $('#confirmOk').addEventListener('click', () => settleConfirm(true));
  $('#confirmCancel').addEventListener('click', () => settleConfirm(false));
  $('#confirmTypeInput').addEventListener('input', (event) => {
    $('#confirmOk').disabled = confirmWord !== '' && event.target.value.trim() !== confirmWord;
  });

  bus.on('modal:closed', (id) => {
    if (id === 'modalConfirm' && confirmResolver) {
      const resolver = confirmResolver;
      confirmResolver = null;
      resolver(false);
    }
  });

  bus.on('world:closed', () => {
    closeAllModals();
    showScreen('splash');
  });
}const PLAN_UTILIZATION = 0.92;
const PLAN_MIN_HORIZON = 14;
const PLAN_MAX_HORIZON = 60;
const REVIEW_SHARE = 0.4;
const NEW_SHARE = 0.55;
const BACKLOG_SHARE = 0.7;
const SUBJECT_SHARE = 0.6;
const SUBJECT_SHARE_EXAM = 0.85;
const OVERFLOW_FACTOR = 1.3;
const GATE_SIZE = 5;
const MAX_REVIEW_STAGE = 6;
const REVIEW_INTERVAL_CAP = 120;
const MAX_LEVEL = 200;
const PET_STAGE_XP = [0, 150, 500, 1100, 2000];
const PET_STAGE_NAMES = ['مخلوق صغير', 'ناشئ يتعلم', 'يافع بقدرات جديدة', 'متقدم مهيب', 'الشكل الأسطوري'];
const PET_STAGE_NOTES = [
  'ما زال صغيرًا جدًا ويحتاج إلى رعايتك',
  'بدأ ينمو وتظهر عليه تفاصيل جديدة',
  'اكتسب قدرات وحركات إضافية',
  'صار مظهره متقدمًا ومهيبًا',
  'وصل إلى شكله المميز المتطور'
];
const LEVEL_TITLES = ['مستكشف', 'متدرب', 'مثابر', 'متقن', 'محترف', 'خبير', 'أستاذ', 'حكيم', 'أسطورة'];
const SESSION_XP_BASE = { study: 12, continue: 10, practice: 14, review: 8, selftest: 16 };
const SESSION_NOUNS = { study: 'جلسة الفهم', continue: 'جلسة الاستكمال', practice: 'جلسة الحل', review: 'جلسة المراجعة', selftest: 'جلسة الاختبار الذاتي' };
const SESSION_REASON_TAILS = {
  study: '',
  review: '',
  continue: '، وهي استكمال لجلسة الفهم بعد راحة يوم',
  practice: '، والحل يثبّت ما فهمته',
  selftest: '، والاختبار الذاتي يكشف ما يحتاج مراجعة'
};

const COSMETICS = [
  { id: 'aura-violet', name: 'هالة بنفسجية', slot: 'aura', cost: 8, color: '#8b5cf6', text: 'توهج بنفسجي ناعم حول رفيقك' },
  { id: 'aura-emerald', name: 'هالة زمردية', slot: 'aura', cost: 12, color: '#34d399', text: 'توهج أخضر هادئ حول رفيقك' },
  { id: 'aura-gold', name: 'هالة ذهبية', slot: 'aura', cost: 20, color: '#fbbf24', text: 'توهج ذهبي للمنجزين' },
  { id: 'trail-stars', name: 'أثر النجوم', slot: 'trail', cost: 15, color: '#38bdf8', text: 'نجوم صغيرة تتبعه أينما مشى' },
  { id: 'trail-embers', name: 'أثر الجمر', slot: 'trail', cost: 15, color: '#f97316', text: 'شرارات دافئة خلف خطواته' },
  { id: 'crown-light', name: 'تاج الضوء', slot: 'crown', cost: 30, color: '#fbbf24', text: 'تاج مضيء فوق رأسه' },
  { id: 'wings-glow', name: 'أجنحة مضيئة', slot: 'wings', cost: 40, color: '#a78bfa', text: 'أجنحة من الضوء تحيط به' },
  { id: 'charm-sky', name: 'قلادة سماوية', slot: 'charm', cost: 10, color: '#38bdf8', text: 'قلادة صغيرة تلمع بلون السماء' }
];

const BADGES = [
  { id: 'first-step', title: 'الخطوة الأولى', text: 'أنهيت أول جلسة مذاكرة', icon: 'i-play', check: (c) => c.sessions >= 1 },
  { id: 'sessions-10', title: 'عشر جلسات', text: 'أنهيت 10 جلسات', icon: 'i-session', check: (c) => c.sessions >= 10 },
  { id: 'sessions-50', title: 'مثابر', text: 'أنهيت 50 جلسة', icon: 'i-session', check: (c) => c.sessions >= 50 },
  { id: 'sessions-150', title: 'سيد الجلسات', text: 'أنهيت 150 جلسة', icon: 'i-trophy', check: (c) => c.sessions >= 150 },
  { id: 'first-lecture', title: 'محاضرة مكتملة', text: 'أنهيت أول محاضرة بكل جلساتها', icon: 'i-lecture', check: (c) => c.lectures >= 1 },
  { id: 'lectures-10', title: 'عشر محاضرات', text: 'أنهيت 10 محاضرات', icon: 'i-lecture', check: (c) => c.lectures >= 10 },
  { id: 'lectures-30', title: 'ثلاثون محاضرة', text: 'أنهيت 30 محاضرة', icon: 'i-book', check: (c) => c.lectures >= 30 },
  { id: 'hours-10', title: 'عشر ساعات', text: 'ذاكرت 10 ساعات', icon: 'i-flame', check: (c) => c.minutes >= 600 },
  { id: 'hours-50', title: 'خمسون ساعة', text: 'ذاكرت 50 ساعة', icon: 'i-flame', check: (c) => c.minutes >= 3000 },
  { id: 'hours-100', title: 'مئة ساعة', text: 'ذاكرت 100 ساعة', icon: 'i-star', check: (c) => c.minutes >= 6000 },
  { id: 'first-review', title: 'مراجع ذكي', text: 'أنهيت أول مراجعة', icon: 'i-review', check: (c) => c.reviews >= 1 },
  { id: 'reviews-25', title: 'ذاكرة قوية', text: 'أنهيت 25 مراجعة', icon: 'i-review', check: (c) => c.reviews >= 25 },
  { id: 'backlog-clear', title: 'نهاية المتراكم', text: 'أنهيت كل المحاضرات المتراكمة', icon: 'i-backlog', check: (c) => c.backlogCleared >= 1 },
  { id: 'first-gate', title: 'بوابة مفتوحة', text: 'فتحت أول بوابة على جزيرة', icon: 'i-map', check: (c) => c.gates >= 1 },
  { id: 'pet-grows', title: 'رفيق ينمو', text: 'تطور رفيقك إلى المرحلة الثانية', icon: 'i-pet', check: (c) => c.petStage >= 1 },
  { id: 'pet-legend', title: 'رفيق أسطوري', text: 'وصل رفيقك إلى شكله الأخير', icon: 'i-sparkle', check: (c) => c.petStage >= 4 },
  { id: 'level-5', title: 'المستوى 5', text: 'وصلت إلى المستوى 5', icon: 'i-star', check: (c) => c.level >= 5 },
  { id: 'level-10', title: 'المستوى 10', text: 'وصلت إلى المستوى 10', icon: 'i-star', check: (c) => c.level >= 10 },
  { id: 'level-20', title: 'المستوى 20', text: 'وصلت إلى المستوى 20', icon: 'i-trophy', check: (c) => c.level >= 20 },
  { id: 'days-7', title: 'سبعة أيام نشطة', text: 'ذاكرت في 7 أيام مختلفة', icon: 'i-today', check: (c) => c.activeDays >= 7 },
  { id: 'days-30', title: 'ثلاثون يومًا نشطًا', text: 'ذاكرت في 30 يومًا مختلفًا', icon: 'i-today', check: (c) => c.activeDays >= 30 },
  { id: 'sharp-mind', title: 'فهم ممتاز', text: 'قيّمت فهمك ممتازًا في 5 مراجعات', icon: 'i-gem', check: (c) => c.excellent >= 5 },
  { id: 'explorer', title: 'مستكشف الجزر', text: 'ذاكرت في 3 مواد مختلفة', icon: 'i-map', check: (c) => c.subjects >= 3 }
];

let planCache = null;
let replanTimer = null;
let replanReasons = [];
let lastMaintenanceDay = '';

function dateOfTimestamp(ts) {
  return dateToStr(new Date(ts));
}

function daysNom(n) {
  if (n === 1) return 'يوم';
  if (n === 2) return 'يومان';
  if (n >= 3 && n <= 10) return n + ' أيام';
  return n + ' يومًا';
}

function daysGen(n) {
  if (n === 1) return 'يوم';
  if (n === 2) return 'يومين';
  if (n >= 3 && n <= 10) return n + ' أيام';
  return n + ' يومًا';
}

function elapsedPhrase(n) {
  if (n === 7) return 'أسبوع';
  if (n === 14) return 'أسبوعان';
  return daysNom(n);
}

function ageText(age) {
  if (age <= 0) return 'نزلت اليوم';
  if (age === 1) return 'نزلت أمس';
  return 'نزلت منذ ' + daysGen(age);
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function xpToReachLevel(level) {
  const n = Math.max(0, level - 1);
  return 100 * n + 15 * n * (n - 1);
}

function levelInfo(totalXp) {
  let level = 1;
  while (level < MAX_LEVEL && xpToReachLevel(level + 1) <= totalXp) level += 1;
  const start = xpToReachLevel(level);
  const end = xpToReachLevel(level + 1);
  return {
    level,
    totalXp,
    start,
    end,
    into: totalXp - start,
    needed: end - start,
    remaining: Math.max(0, end - totalXp),
    ratio: clamp((totalXp - start) / (end - start), 0, 1),
    title: levelTitle(level)
  };
}

function levelTitle(level) {
  return LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((Math.max(1, level) - 1) / 3))];
}

function petStageInfo(totalXp) {
  let stage = 0;
  for (let i = 0; i < PET_STAGE_XP.length; i += 1) {
    if (totalXp >= PET_STAGE_XP[i]) stage = i;
  }
  const isMax = stage >= PET_STAGE_XP.length - 1;
  const start = PET_STAGE_XP[stage];
  const end = isMax ? start : PET_STAGE_XP[stage + 1];
  return {
    stage,
    name: PET_STAGE_NAMES[stage],
    note: PET_STAGE_NOTES[stage],
    isMax,
    start,
    end,
    into: totalXp - start,
    needed: isMax ? 0 : end - start,
    ratio: isMax ? 1 : clamp((totalXp - start) / (end - start), 0, 1)
  };
}

function xpForSession(session, minutes) {
  const base = SESSION_XP_BASE[session.type] || 10;
  return base + Math.round(minutes / 5) * 2;
}

function pushLog(type, title, text, xp) {
  appState.achievements.log.push({ id: uid('log'), type, title: toText(title, 80), text: toText(text, 200), date: todayStr(), xp: toInt(xp, 0, 1e7, 0) });
  if (appState.achievements.log.length > LIMITS.log) appState.achievements.log.splice(0, appState.achievements.log.length - LIMITS.log);
}

function pushStudyLog(minutes, kind, refId) {
  appState.studyLog.push({ id: uid('log'), date: todayStr(), minutes, kind, refId });
  if (appState.studyLog.length > LIMITS.studyLog) appState.studyLog.splice(0, appState.studyLog.length - LIMITS.studyLog);
}

function createCollector(kind) {
  return { kind, xp: 0, gems: 0, minutes: 0, levelUp: null, badges: [], evolved: null, gates: [], backlogCleared: false, lecture: null, sessionId: null, reviewId: null, mastered: false };
}

function checkPetEvolution(collector) {
  if (!appState.pet) return;
  const info = petStageInfo(appState.progress.totalXp);
  if (info.stage > appState.pet.seenStage) {
    const from = collector.evolved ? collector.evolved.from : appState.pet.seenStage;
    collector.evolved = { from, to: info.stage, name: info.name };
    appState.pet.seenStage = info.stage;
    pushLog('evolve', 'تطور ' + appState.pet.name, info.name, 0);
  }
}

function grantXp(collector, key, amount, gems) {
  if (key) {
    if (appState.awards[key]) return false;
    appState.awards[key] = true;
  }
  const before = levelInfo(appState.progress.totalXp).level;
  appState.progress.totalXp = Math.min(1e9, appState.progress.totalXp + amount);
  appState.progress.gems = Math.min(1e9, appState.progress.gems + gems);
  const after = levelInfo(appState.progress.totalXp).level;
  collector.xp += amount;
  collector.gems += gems;
  if (after > before) {
    const from = collector.levelUp ? collector.levelUp.from : before;
    collector.levelUp = { from, to: after, title: levelTitle(after) };
    pushLog('level', 'وصلت إلى المستوى ' + after, levelTitle(after), 0);
  }
  checkPetEvolution(collector);
  return true;
}

function badgeContext() {
  const p = appState.progress;
  const dates = new Set(appState.studyLog.map((e) => e.date));
  const studiedSubjects = new Set();
  appState.sessions.forEach((s) => {
    if (s.status !== 'done') return;
    const lecture = getLecture(s.lectureId);
    if (lecture) studiedSubjects.add(lecture.subjectId);
  });
  let gates = 0;
  Object.keys(appState.world.unlockedStages).forEach((key) => {
    if (key.indexOf('gate:') === 0) gates += 1;
  });
  return {
    sessions: p.sessionsDone,
    lectures: p.lecturesDone,
    reviews: p.reviewsDone,
    minutes: p.minutesStudied,
    level: levelInfo(p.totalXp).level,
    petStage: appState.pet ? petStageInfo(p.totalXp).stage : 0,
    gates,
    backlogCleared: p.backlogCleared,
    activeDays: dates.size,
    excellent: appState.reviews.filter((r) => r.status === 'done' && r.rating === 4).length,
    subjects: studiedSubjects.size
  };
}

function evaluateBadges(collector) {
  let changed = true;
  let guard = 0;
  while (changed && guard < 6) {
    changed = false;
    guard += 1;
    const context = badgeContext();
    BADGES.forEach((badge) => {
      if (appState.achievements.badges[badge.id] || !badge.check(context)) return;
      appState.achievements.badges[badge.id] = todayStr();
      pushLog('badge', badge.title, badge.text, 25);
      grantXp(collector, 'badge:' + badge.id, 25, 3);
      collector.badges.push({ id: badge.id, title: badge.title, text: badge.text, icon: badge.icon });
      changed = true;
    });
  }
}

function finalizeReward(collector, reason) {
  evaluateBadges(collector);
  commit('reward:' + collector.kind);
  requestReplan(reason);
  bus.emit('reward:summary', collector);
  return collector;
}

function ownedCosmetic(id) {
  return appState.achievements.cosmetics.owned.includes(id);
}

function equippedCosmetic(id) {
  return appState.achievements.cosmetics.equipped.includes(id);
}

function syncPetEquipment() {
  if (appState.pet) appState.pet.equipped = appState.achievements.cosmetics.equipped.slice(0, 20);
}

function buyCosmetic(id) {
  const item = COSMETICS.find((c) => c.id === id);
  if (!item) return { ok: false, message: 'هذه المقتنيات غير موجودة' };
  if (ownedCosmetic(id)) return { ok: false, message: 'تملك هذا العنصر بالفعل' };
  if (appState.progress.gems < item.cost) return { ok: false, message: 'جواهرك لا تكفي، تحتاج إلى ' + (item.cost - appState.progress.gems) + ' جواهر إضافية' };
  appState.progress.gems -= item.cost;
  appState.achievements.cosmetics.owned.push(id);
  appState.achievements.cosmetics.equipped = appState.achievements.cosmetics.equipped.filter((eid) => {
    const other = COSMETICS.find((c) => c.id === eid);
    return !other || other.slot !== item.slot;
  });
  appState.achievements.cosmetics.equipped.push(id);
  syncPetEquipment();
  pushLog('cosmetic', 'حصلت على ' + item.name, item.text, 0);
  commit('cosmetic:buy');
  bus.emit('cosmetics:changed', { id });
  return { ok: true, item };
}

function toggleCosmetic(id) {
  const item = COSMETICS.find((c) => c.id === id);
  if (!item || !ownedCosmetic(id)) return false;
  const list = appState.achievements.cosmetics.equipped;
  if (list.includes(id)) {
    appState.achievements.cosmetics.equipped = list.filter((eid) => eid !== id);
  } else {
    appState.achievements.cosmetics.equipped = list.filter((eid) => {
      const other = COSMETICS.find((c) => c.id === eid);
      return !other || other.slot !== item.slot;
    });
    appState.achievements.cosmetics.equipped.push(id);
  }
  syncPetEquipment();
  commit('cosmetic:toggle');
  bus.emit('cosmetics:changed', { id });
  return true;
}

function examMatchesSubject(exam, subject) {
  if (exam.subjectId) return { match: exam.subjectId === subject.id, specific: true };
  const name = normalizeName(exam.subjectName);
  if (name) return { match: name === normalizeName(subject.name), specific: true };
  return { match: true, specific: false };
}

function nearestExamFor(subject, fromDate) {
  let best = null;
  appState.exams.forEach((exam) => {
    if (exam.date < fromDate) return;
    const m = examMatchesSubject(exam, subject);
    if (!m.match) return;
    const days = diffDays(fromDate, exam.date);
    if (!best || days < best.days || (days === best.days && m.specific && !best.specific)) best = { exam, days, specific: m.specific };
  });
  return best;
}

function minutesStudiedOn(date) {
  return appState.studyLog.reduce((sum, entry) => (entry.date === date ? sum + entry.minutes : sum), 0);
}

function dayCapacity(date, subtractStudied) {
  const dow = dayOfWeek(date);
  const availability = appState.availability;
  if (availability.rest.includes(dow)) return 0;
  let base = availability.minutes[dow] || 0;
  if (availability.busy.includes(dow)) base = Math.round(base * 0.6);
  if (subtractStudied) base -= minutesStudiedOn(date);
  return Math.max(0, base);
}

function computeHorizon(today) {
  let horizon = clamp(appState.plan.horizon || PLAN_MIN_HORIZON, 7, PLAN_MAX_HORIZON);
  appState.exams.forEach((exam) => {
    const d = diffDays(today, exam.date);
    if (d >= 0) horizon = Math.max(horizon, Math.min(PLAN_MAX_HORIZON, d + 1));
  });
  return Math.min(PLAN_MAX_HORIZON, horizon);
}

function sessionCategory(lecture) {
  return lectureAgeDays(lecture) < BACKLOG_GRACE_DAYS ? 'new' : 'backlog';
}

function countBacklogLectures() {
  return appState.lectures.filter(isBacklogLecture).length;
}

function buildReason(c, date, exam) {
  const lecture = c.lecture;
  const subject = c.subject;
  const examDays = exam ? diffDays(date, exam.exam.date) : null;
  const examNear = examDays !== null && examDays >= 0 && examDays <= 14;
  const label = 'المحاضرة ' + lecture.number + ' في ' + subject.name;
  if (c.kind === 'review') {
    const review = c.ref;
    const since = lecture.completedAt ? Math.max(0, diffDays(lecture.completedAt, date)) : 0;
    let text = 'راجعنا ' + label;
    text += since > 0 ? ' لأنه مر عليها ' + elapsedPhrase(since) : ' لأن موعد مراجعتها حان';
    if (c.overdue > 0) text += '، وكانت مستحقة منذ ' + daysGen(c.overdue);
    if (review.stage > 0) text += ' (المراجعة رقم ' + (review.stage + 1) + ')';
    if (examNear) text += '، واقتراب الامتحان يرفع قيمتها';
    return text + '.';
  }
  const session = c.ref;
  const noun = SESSION_NOUNS[session.type] || 'الجلسة';
  const age = lectureAgeDays(lecture);
  let text;
  if (session.status === 'missed' && session.postponedCount > 0) {
    text = 'نقلنا ' + noun + ' للمحاضرة ' + lecture.number + ' في ' + subject.name + ' لأنها لم تكتمل سابقًا، دون أن نضغط بقية مهامك';
  } else if (c.category === 'new') {
    text = 'اخترنا ' + noun + ' للمحاضرة ' + lecture.number + ' في ' + subject.name + ' لأنها ' + ageText(age) + SESSION_REASON_TAILS[session.type];
  } else {
    text = 'اخترنا ' + noun + ' للمحاضرة ' + lecture.number + ' في ' + subject.name + ' لأنها متراكمة منذ ' + daysGen(age) + '، ووزّعنا المتراكم على الأيام بدل تكديسه' + SESSION_REASON_TAILS[session.type];
  }
  if (examNear) text += '، وامتحان ' + exam.exam.title + ' بعد ' + daysGen(examDays) + ' فرفعنا أهمية الجلسة';
  return text + '.';
}

function computePlan() {
  const today = todayStr();
  const horizon = computeHorizon(today);
  const subjectsById = new Map(appState.subjects.map((s) => [s.id, s]));
  const examCache = new Map();
  const examFor = (subject) => {
    if (!examCache.has(subject.id)) examCache.set(subject.id, nearestExamFor(subject, today));
    return examCache.get(subject.id);
  };

  const days = [];
  for (let i = 0; i < horizon; i += 1) {
    const date = addDays(today, i);
    const capacity = dayCapacity(date, i === 0);
    days.push({ date, index: i, capacity, usable: Math.floor(capacity * PLAN_UTILIZATION), used: 0, backlogMinutes: 0, items: [], subjectMinutes: {} });
  }

  const sessionAssign = new Map();
  const reviewAssign = new Map();
  const reasons = {};
  const oversized = [];
  const lectureStates = [];
  const pinned = [];

  appState.lectures.forEach((lecture) => {
    const subject = subjectsById.get(lecture.subjectId);
    if (!subject) return;
    let lastIdx = -Infinity;
    const queue = [];
    sessionsOfLecture(lecture.id).forEach((session) => {
      if (session.status === 'done') {
        if (session.completedAt) lastIdx = Math.max(lastIdx, diffDays(today, dateOfTimestamp(session.completedAt)));
      } else if (session.status === 'active') {
        pinned.push({ session, lecture, subject });
        lastIdx = Math.max(lastIdx, 0);
      } else {
        queue.push(session);
      }
    });
    if (queue.length) lectureStates.push({ lecture, subject, queue, idx: 0, lastIdx });
  });

  pinned.forEach((p) => {
    const day = days[0];
    day.used += p.session.minutes;
    day.subjectMinutes[p.subject.id] = (day.subjectMinutes[p.subject.id] || 0) + p.session.minutes;
    day.items.push({ kind: 'session', id: p.session.id, minutes: p.session.minutes, subjectId: p.subject.id, lectureId: p.lecture.id, category: 'active' });
    sessionAssign.set(p.session.id, today);
    reasons[p.session.id] = 'هذه الجلسة جارية الآن، أنهِها لتُسجَّل في إنجازك.';
  });

  const reviewPool = [];
  appState.reviews.forEach((review) => {
    if (review.status !== 'pending') return;
    const lecture = getLecture(review.lectureId);
    if (!lecture) return;
    const subject = subjectsById.get(lecture.subjectId);
    if (!subject) return;
    reviewPool.push({
      kind: 'review',
      ref: review,
      lecture,
      subject,
      minutes: review.minutes,
      category: 'review',
      earliest: Math.max(0, diffDays(today, review.dueDate)),
      overdue: Math.max(0, diffDays(review.dueDate, today)),
      taken: false
    });
  });

  const earliestOf = (session) => (session.status === 'missed' && session.date ? clamp(diffDays(today, session.date), 0, horizon) : 0);

  const blockedByExam = (c, date) => {
    if (c.kind !== 'session') return false;
    const exam = examFor(c.subject);
    if (!exam || !exam.specific) return false;
    const gap = diffDays(date, exam.exam.date);
    if (gap === 0) return true;
    return gap === 1 && c.ref.type === 'study';
  };

  const recentMinutes = (subjectId, i) => {
    let sum = 0;
    for (let k = 1; k <= 2; k += 1) {
      if (days[i - k]) sum += days[i - k].subjectMinutes[subjectId] || 0;
    }
    return sum;
  };

  const scoreCandidate = (c, day, i) => {
    const subject = c.subject;
    const exam = examFor(subject);
    const examDays = exam ? diffDays(day.date, exam.exam.date) : null;
    let score = subject.difficulty * 1.5 + (5 - subject.mastery) * 1.5;
    if (c.kind === 'review') {
      score += 55 + Math.min(40, (c.overdue + Math.max(0, i - c.earliest)) * 6) + (4 - (c.lecture.understanding || 3)) * 2;
    } else {
      const age = lectureAgeDays(c.lecture);
      score += c.category === 'new' ? 50 + (BACKLOG_GRACE_DAYS - age) * 6 : 30 + Math.min(age, 28) * 1.2;
      score += { study: 8, continue: 4, practice: 6, selftest: 4, review: 3 }[c.ref.type] || 0;
      if (c.lecture.status === 'progress') score += 10;
      score += Math.min(20, c.ref.postponedCount * 5);
      if (c.ref.date === day.date) score += day.date === today ? 25 : 8;
    }
    if (examDays !== null && examDays >= 0 && examDays <= 14) {
      score += (15 - examDays) * 2.5;
      const heavy = c.kind === 'review' || ['practice', 'selftest', 'review'].includes(c.ref.type);
      if (heavy) score += 8;
    }
    const taken = day.subjectMinutes[subject.id] || 0;
    score -= (taken / Math.max(day.usable, 30)) * 40;
    score -= Math.min(12, recentMinutes(subject.id, i) / 15);
    score -= c.lecture.number * 0.001;
    return score;
  };

  const subjectFits = (c, day, distinct) => {
    const taken = day.subjectMinutes[c.subject.id] || 0;
    if (taken === 0 || distinct < 2) return true;
    const exam = examFor(c.subject);
    const cap = exam && exam.days <= 7 ? SUBJECT_SHARE_EXAM : SUBJECT_SHARE;
    return taken + c.minutes <= day.usable * cap;
  };

  const assign = (c, day, i) => {
    c.taken = true;
    day.used += c.minutes;
    day.subjectMinutes[c.subject.id] = (day.subjectMinutes[c.subject.id] || 0) + c.minutes;
    if (c.category === 'backlog') day.backlogMinutes += c.minutes;
    day.items.push({ kind: c.kind, id: c.ref.id, minutes: c.minutes, subjectId: c.subject.id, lectureId: c.lecture.id, category: c.category });
    if (c.kind === 'session') {
      c.ls.idx += 1;
      c.ls.lastIdx = i;
      sessionAssign.set(c.ref.id, day.date);
    } else {
      reviewAssign.set(c.ref.id, day.date);
    }
    reasons[c.ref.id] = buildReason(c, day.date, examFor(c.subject)).slice(0, 220);
  };

  days.forEach((day, i) => {
    if (day.usable <= 0) return;
    const date = day.date;
    const candidates = [];
    lectureStates.forEach((ls) => {
      if (ls.idx >= ls.queue.length || !(i > ls.lastIdx)) return;
      const session = ls.queue[ls.idx];
      if (earliestOf(session) > i) return;
      candidates.push({ kind: 'session', ref: session, ls, lecture: ls.lecture, subject: ls.subject, minutes: session.minutes, category: sessionCategory(ls.lecture), taken: false });
    });
    reviewPool.forEach((rc) => {
      if (!rc.taken && rc.earliest <= i) candidates.push(rc);
    });
    if (!candidates.length) return;
    const distinct = new Set(candidates.map((c) => c.subject.id)).size;
    const othersExist = candidates.some((c) => c.category !== 'backlog');

    const pickFrom = (filter, limitFn) => {
      for (;;) {
        let best = null;
        let bestScore = -Infinity;
        for (let k = 0; k < candidates.length; k += 1) {
          const c = candidates[k];
          if (c.taken || !filter(c) || blockedByExam(c, date)) continue;
          if (day.used + c.minutes > limitFn()) continue;
          if (!subjectFits(c, day, distinct)) continue;
          const score = scoreCandidate(c, day, i);
          if (score > bestScore) {
            best = c;
            bestScore = score;
          }
        }
        if (!best) return;
        assign(best, day, i);
      }
    };

    const hasKind = (kind) => day.items.some((item) => item.kind === kind);
    const hasCategory = (category) => day.items.some((item) => item.category === category);

    pickFrom((c) => c.kind === 'review', () => (hasKind('review') ? day.usable * REVIEW_SHARE : day.usable));
    pickFrom((c) => c.kind === 'session' && c.category === 'new', () => (hasCategory('new') ? day.usable * NEW_SHARE : day.usable));
    pickFrom(
      (c) => c.category !== 'backlog' || day.backlogMinutes + c.minutes <= day.usable * (othersExist ? BACKLOG_SHARE : 1),
      () => day.usable
    );

    if (!day.items.length) {
      let best = null;
      let bestScore = -Infinity;
      candidates.forEach((c) => {
        if (c.taken || blockedByExam(c, date) || c.minutes > day.capacity * OVERFLOW_FACTOR) return;
        const score = scoreCandidate(c, day, i);
        if (score > bestScore) {
          best = c;
          bestScore = score;
        }
      });
      if (!best && day.capacity >= 20) {
        candidates.forEach((c) => {
          if (c.taken || blockedByExam(c, date)) return;
          if (!best || c.minutes < best.minutes) best = c;
        });
        if (best && best.kind === 'session') oversized.push(best.ref.id);
      }
      if (best) assign(best, day, i);
    }
  });

  const unscheduledSessions = [];
  lectureStates.forEach((ls) => {
    for (let j = ls.idx; j < ls.queue.length; j += 1) unscheduledSessions.push(ls.queue[j]);
  });
  const unscheduledReviews = reviewPool.filter((rc) => !rc.taken).map((rc) => rc.ref);

  const notes = [];
  if (days.every((d) => d.capacity === 0)) {
    notes.push('لا يوجد وقت دراسة متاح في إعداداتك، عدّل أوقات المذاكرة من الإعدادات ليبني النظام جدولك.');
  }
  const backlogLectures = appState.lectures.filter(isBacklogLecture);
  if (backlogLectures.length) {
    const ids = new Set(backlogLectures.map((l) => l.id));
    let lastDate = null;
    appState.sessions.forEach((s) => {
      if (s.status === 'done' || !ids.has(s.lectureId)) return;
      const assigned = sessionAssign.get(s.id);
      if (assigned && (!lastDate || assigned > lastDate)) lastDate = assigned;
    });
    let note = 'لديك ' + backlogLectures.length + ' محاضرة متراكمة';
    if (lastDate && unscheduledSessions.every((s) => !ids.has(s.lectureId))) note += '، ويتسع جدولك لإنهائها خلال ' + daysGen(diffDays(today, lastDate) + 1) + ' تقريبًا';
    notes.push(note + '.');
  }
  const fresh = appState.lectures.filter((l) => l.status !== 'done' && lectureAgeDays(l) < BACKLOG_GRACE_DAYS).length;
  if (fresh) notes.push('لديك ' + fresh + ' محاضرة جديدة وضعناها في أول الجدول حتى لا تتراكم.');
  const dueReviews = reviewPool.filter((rc) => rc.earliest === 0).length;
  if (dueReviews) notes.push('لديك ' + dueReviews + ' مراجعة مستحقة أدخلناها في جدولك بدل عرضها في قائمة منفصلة.');
  sortBy(appState.exams.filter((e) => e.date >= today && diffDays(today, e.date) <= 21), (e) => e.date).slice(0, 2).forEach((exam) => {
    const d = diffDays(today, exam.date);
    notes.push('امتحان ' + exam.title + ' ' + (d === 0 ? 'اليوم' : 'بعد ' + daysGen(d)) + '، فرفعنا وزن الحل والمراجعة في مادته.');
  });
  if (unscheduledSessions.length) notes.push('بقيت ' + unscheduledSessions.length + ' جلسة خارج أفق الخطة، وستدخل الجدول تلقائيًا كلما اتسع.');
  if (oversized.length) notes.push('هناك ' + oversized.length + ' جلسة أطول من وقتك المتاح في يوم واحد، فكّر في تقسيمها.');

  return {
    today,
    horizon,
    days,
    sessionAssign,
    reviewAssign,
    reasons,
    notes: notes.map((n) => n.slice(0, 220)).slice(0, 30),
    unscheduledSessions,
    unscheduledReviews,
    oversized
  };
}

function applyPlan(plan) {
  let changed = false;
  appState.sessions.forEach((session) => {
    if (session.status === 'done') return;
    if (session.status === 'active') {
      if (session.date !== plan.today) {
        session.date = plan.today;
        changed = true;
      }
      return;
    }
    const next = plan.sessionAssign.get(session.id) || null;
    if (session.date !== next) {
      session.date = next;
      changed = true;
    }
  });
  const reasonsChanged = JSON.stringify(appState.plan.reasons) !== JSON.stringify(plan.reasons);
  const notesChanged = JSON.stringify(appState.plan.notes) !== JSON.stringify(plan.notes);
  if (changed || reasonsChanged || notesChanged) {
    appState.plan.reasons = plan.reasons;
    appState.plan.notes = plan.notes;
    appState.plan.generatedAt = Date.now();
    return true;
  }
  return false;
}

function ensurePlan() {
  if (!appState) return null;
  if (!planCache || planCache.today !== todayStr()) planCache = computePlan();
  return planCache;
}

function replan(reason) {
  if (!appState || !appState.profile.onboarded) return false;
  const plan = computePlan();
  const changed = applyPlan(plan);
  if (changed) commit('plan');
  planCache = plan;
  bus.emit('plan:updated', { reason, changed });
  return changed;
}

function scheduleReplan(reason) {
  replanReasons.push(reason || 'change');
  clearTimeout(replanTimer);
  replanTimer = setTimeout(() => {
    const joined = replanReasons.join(',');
    replanReasons = [];
    replan(joined);
  }, 60);
}

function rolloverOverdue() {
  const today = todayStr();
  let count = 0;
  appState.sessions.forEach((session) => {
    if (session.status === 'done') return;
    if (session.date && session.date < today) {
      session.status = 'missed';
      session.postponedCount = Math.min(999, session.postponedCount + 1);
      session.date = null;
      count += 1;
    }
  });
  return count;
}

function resetStaleActive() {
  if (!appState) return 0;
  let count = 0;
  appState.sessions.forEach((session) => {
    if (session.status === 'active') {
      session.status = 'pending';
      count += 1;
    }
  });
  if (count) commit('session:reset-active');
  return count;
}

function recordBacklogSnapshot() {
  const today = todayStr();
  const backlog = appState.lectures.filter(isBacklogLecture);
  const work = remainingWork(backlog);
  const snapshots = appState.backlogSnapshots;
  const last = snapshots[snapshots.length - 1];
  if (last && last.date === today) {
    if (last.count === backlog.length && last.sessions === work.sessions) return false;
    last.count = backlog.length;
    last.sessions = work.sessions;
  } else {
    snapshots.push({ date: today, count: backlog.length, sessions: work.sessions });
    if (snapshots.length > LIMITS.snapshots) snapshots.splice(0, snapshots.length - LIMITS.snapshots);
  }
  return true;
}

function runDailyMaintenance() {
  if (!appState) return false;
  lastMaintenanceDay = todayStr();
  const rolled = rolloverOverdue();
  refreshAllLectureStatuses();
  const snapped = recordBacklogSnapshot();
  if (rolled || snapped) commit('maintenance');
  replan('daily');
  return true;
}

function ensureFreshDay() {
  if (!appState || lastMaintenanceDay === todayStr()) return false;
  return runDailyMaintenance();
}

function intervalDays(stage) {
  const list = appState.settings.reviewIntervals;
  if (stage < list.length) return list[Math.max(0, stage)];
  const extra = stage - list.length + 1;
  return Math.min(REVIEW_INTERVAL_CAP, list[list.length - 1] * Math.pow(2, extra));
}

function nextStageFor(stage, rating) {
  if (rating <= 1) return 0;
  if (rating === 2) return stage;
  if (rating === 3) return stage + 1;
  return stage + 2;
}

function reviewMinutes(lecture) {
  return clamp(Math.round((lecture.duration * 0.25) / 5) * 5, 10, 30);
}

function createReview(lecture, stage, fromDate) {
  if (appState.reviews.some((r) => r.lectureId === lecture.id && r.status === 'pending')) return null;
  const review = {
    id: uid('rev'),
    lectureId: lecture.id,
    sessionId: '',
    stage,
    dueDate: addDays(fromDate, intervalDays(stage)),
    status: 'pending',
    rating: 0,
    doneAt: null,
    minutes: reviewMinutes(lecture)
  };
  appState.reviews.push(review);
  return review;
}

function orderedLecturesOfSubject(subjectId) {
  return sortBy(
    appState.lectures.filter((l) => l.subjectId === subjectId),
    (l) => l.publishedAt + '|' + String(l.number).padStart(4, '0') + '|' + l.teacherId
  );
}

function checkGateUnlocks(subjectId, collector) {
  const ordered = orderedLecturesOfSubject(subjectId);
  const subject = getSubject(subjectId);
  for (let k = 1; k * GATE_SIZE <= ordered.length; k += 1) {
    const key = 'gate:' + subjectId + ':' + k;
    if (appState.world.unlockedStages[key]) continue;
    if (!ordered.slice(0, k * GATE_SIZE).every((l) => l.status === 'done')) continue;
    appState.world.unlockedStages[key] = true;
    const amount = 60 + k * 10;
    grantXp(collector, key, amount, 4);
    pushLog('gate', 'فتحت البوابة ' + k + (subject ? ' في ' + subject.name : ''), 'أنهيت ' + k * GATE_SIZE + ' محاضرات متتالية', amount);
    collector.gates.push({ subjectId, index: k, name: subject ? subject.name : '' });
  }
}

function islandStageModel(subjectId) {
  const ordered = orderedLecturesOfSubject(subjectId);
  let firstOpen = ordered.findIndex((l) => l.status !== 'done');
  if (firstOpen === -1) firstOpen = ordered.length;
  const stages = ordered.map((lecture, index) => {
    let state = 'locked';
    if (lecture.status === 'done') state = 'done';
    else if (index === firstOpen || lecture.status === 'progress') state = 'current';
    return { index, lecture, state, locked: state === 'locked', backlog: isBacklogLecture(lecture), progress: lectureStats(lecture).progress };
  });
  const gates = [];
  for (let k = 1; k * GATE_SIZE <= ordered.length; k += 1) {
    const key = 'gate:' + subjectId + ':' + k;
    const open = !!appState.world.unlockedStages[key] || ordered.slice(0, k * GATE_SIZE).every((l) => l.status === 'done');
    gates.push({ index: k, afterStage: k * GATE_SIZE - 1, key, open });
  }
  const doneCount = stages.filter((s) => s.state === 'done').length;
  return { stages, gates, doneCount, total: stages.length, nextGate: gates.find((g) => !g.open) || null };
}

function onLectureCompleted(lecture, collector, backlogBefore) {
  const today = todayStr();
  const subject = getSubject(lecture.subjectId);
  collector.lecture.done = true;
  const key = 'lecture:' + lecture.id;
  if (!appState.awards[key]) {
    const amount = 40 + lecture.difficulty * 8;
    appState.progress.lecturesDone += 1;
    grantXp(collector, key, amount, 2);
    pushLog('lecture', 'أنهيت ' + lectureLabel(lecture), subject ? subject.name : '', amount);
  }
  if (!appState.reviews.some((r) => r.lectureId === lecture.id)) createReview(lecture, 0, today);
  checkGateUnlocks(lecture.subjectId, collector);
  if (backlogBefore > 0 && countBacklogLectures() === 0) {
    collector.backlogCleared = true;
    appState.progress.backlogCleared += 1;
    grantXp(collector, 'backlog-clear:' + today, 50, 3);
    pushLog('backlog', 'أنهيت كل المتراكم', 'لا توجد محاضرات متأخرة الآن', 50);
  }
}

function startSession(id) {
  if (!appState) return false;
  const session = getSession(id);
  if (!session || session.status === 'done') return false;
  appState.sessions.forEach((other) => {
    if (other.id !== id && other.status === 'active') other.status = 'pending';
  });
  session.status = 'active';
  session.date = todayStr();
  commit('session:start');
  return true;
}

function releaseSession(id, progress) {
  const session = getSession(id);
  if (!session || session.status === 'done') return false;
  if (session.status === 'active') session.status = 'pending';
  if (Number.isFinite(Number(progress))) session.progress = clamp(Math.round(Number(progress)), 0, 95);
  const lecture = getLecture(session.lectureId);
  if (lecture) refreshLectureStatus(lecture);
  commit('session:release');
  requestReplan('session-release');
  return true;
}

function missSession(id) {
  const session = getSession(id);
  if (!session || session.status === 'done') return false;
  session.status = 'missed';
  session.postponedCount = Math.min(999, session.postponedCount + 1);
  session.date = addDays(todayStr(), 1);
  const lecture = getLecture(session.lectureId);
  if (lecture) refreshLectureStatus(lecture);
  commit('session:missed');
  requestReplan('session-missed');
  return true;
}

function completeSession(id, options) {
  if (!appState) return null;
  const opts = options || {};
  const session = getSession(id);
  if (!session || session.status === 'done') return null;
  const lecture = getLecture(session.lectureId);
  if (!lecture) return null;
  const today = todayStr();
  const collector = createCollector('session');
  const backlogBefore = countBacklogLectures();
  const requested = Number(opts.actualMinutes);
  const minutes = Number.isFinite(requested) && requested >= 1 ? clamp(Math.round(requested), 1, 720) : session.minutes;
  session.status = 'done';
  session.progress = 100;
  session.completedAt = Date.now();
  session.actualMinutes = minutes;
  session.date = today;
  delete appState.plan.reasons[session.id];
  appState.progress.sessionsDone += 1;
  appState.progress.minutesStudied += minutes;
  pushStudyLog(minutes, session.type, session.id);
  collector.minutes = minutes;
  collector.sessionId = session.id;
  grantXp(collector, 'session:' + session.id, xpForSession(session, minutes), Math.max(1, Math.floor(minutes / 15)));
  const subject = getSubject(lecture.subjectId);
  collector.lecture = { id: lecture.id, number: lecture.number, subjectId: lecture.subjectId, subjectName: subject ? subject.name : '', done: false };
  const change = refreshLectureStatus(lecture);
  if (change.becameDone) onLectureCompleted(lecture, collector, backlogBefore);
  return finalizeReward(collector, 'session-complete');
}

function setLectureUnderstanding(lectureId, rating) {
  const lecture = getLecture(lectureId);
  const grade = toInt(rating, 1, 4, 0);
  if (!lecture || !grade) return false;
  lecture.understanding = grade;
  const review = appState.reviews.find((r) => r.lectureId === lecture.id && r.status === 'pending' && r.stage <= 1);
  if (review && lecture.completedAt) {
    const stage = grade >= 3 ? 1 : 0;
    review.stage = stage;
    const due = addDays(lecture.completedAt, intervalDays(stage));
    review.dueDate = due < todayStr() ? todayStr() : due;
  }
  commit('lecture:understanding');
  requestReplan('understanding');
  return true;
}

function completeReview(id, rating) {
  if (!appState) return null;
  const review = findById(appState.reviews, id);
  if (!review || review.status !== 'pending') return null;
  const lecture = getLecture(review.lectureId);
  const grade = toInt(rating, 1, 4, 0);
  if (!lecture || !grade) return null;
  const today = todayStr();
  const collector = createCollector('review');
  review.status = 'done';
  review.rating = grade;
  review.doneAt = Date.now();
  lecture.understanding = grade;
  appState.progress.reviewsDone += 1;
  appState.progress.minutesStudied += review.minutes;
  pushStudyLog(review.minutes, 'review', review.id);
  collector.minutes = review.minutes;
  collector.reviewId = review.id;
  grantXp(collector, 'review:' + review.id, 10 + review.stage * 3 + (grade >= 3 ? 2 : 0), 1);
  const next = nextStageFor(review.stage, grade);
  const subject = getSubject(lecture.subjectId);
  collector.lecture = { id: lecture.id, number: lecture.number, subjectId: lecture.subjectId, subjectName: subject ? subject.name : '', done: false };
  if (next <= MAX_REVIEW_STAGE) {
    const created = createReview(lecture, next, today);
    collector.nextReview = created ? { dueDate: created.dueDate, stage: created.stage } : null;
  } else {
    collector.mastered = true;
    grantXp(collector, 'mastered:' + lecture.id, 30, 2);
    pushLog('mastered', 'ثبّتّ ' + lectureLabel(lecture), subject ? subject.name : '', 30);
  }
  return finalizeReward(collector, 'review-complete');
}

function postponeReview(id, days) {
  const review = findById(appState.reviews, id);
  if (!review || review.status !== 'pending') return false;
  const base = review.dueDate > todayStr() ? review.dueDate : todayStr();
  review.dueDate = addDays(base, clamp(Math.round(Number(days) || 1), 1, 30));
  commit('review:postpone');
  requestReplan('review-postpone');
  return true;
}

function dismissReview(id) {
  const review = findById(appState.reviews, id);
  if (!review || review.status !== 'pending') return false;
  review.status = 'skipped';
  commit('review:dismiss');
  requestReplan('review-dismiss');
  return true;
}

function buildSessionTask(session) {
  const lecture = getLecture(session.lectureId);
  if (!lecture) return null;
  const subject = getSubject(lecture.subjectId);
  const teacher = getTeacher(lecture.teacherId);
  return {
    key: 'session:' + session.id,
    kind: 'session',
    id: session.id,
    lectureId: lecture.id,
    subjectId: lecture.subjectId,
    teacherId: lecture.teacherId,
    type: session.type,
    typeLabel: SESSION_TYPES[session.type],
    title: SESSION_TYPES[session.type] + ' — ' + lectureLabel(lecture),
    subjectName: subject ? subject.name : '',
    teacherName: teacher ? teacher.name : '',
    color: subject ? subject.color : SUBJECT_COLORS[0],
    motif: subject ? subject.motif : 'scroll',
    minutes: session.minutes,
    description: session.description,
    status: session.status,
    progress: session.status === 'done' ? 100 : session.progress,
    date: session.date,
    reason: appState.plan.reasons[session.id] || '',
    lectureNumber: lecture.number,
    category: sessionCategory(lecture),
    postponed: session.postponedCount,
    backlog: isBacklogLecture(lecture)
  };
}

function buildReviewTask(review, plan) {
  const lecture = getLecture(review.lectureId);
  if (!lecture) return null;
  const subject = getSubject(lecture.subjectId);
  const teacher = getTeacher(lecture.teacherId);
  const planned = plan && plan.reviewAssign ? plan.reviewAssign.get(review.id) : null;
  return {
    key: 'review:' + review.id,
    kind: 'review',
    id: review.id,
    lectureId: lecture.id,
    subjectId: lecture.subjectId,
    teacherId: lecture.teacherId,
    type: 'review',
    typeLabel: 'مراجعة',
    title: 'مراجعة ' + lectureLabel(lecture),
    subjectName: subject ? subject.name : '',
    teacherName: teacher ? teacher.name : '',
    color: subject ? subject.color : SUBJECT_COLORS[0],
    motif: subject ? subject.motif : 'scroll',
    minutes: review.minutes,
    description: 'مراجعة سريعة لأهم أفكار المحاضرة ثم قيّم فهمك',
    status: review.status === 'done' ? 'done' : 'pending',
    progress: review.status === 'done' ? 100 : 0,
    date: planned || review.dueDate,
    dueDate: review.dueDate,
    stage: review.stage,
    rating: review.rating,
    overdueDays: Math.max(0, diffDays(review.dueDate, todayStr())),
    reason: appState.plan.reasons[review.id] || '',
    lectureNumber: lecture.number,
    category: 'review',
    postponed: 0,
    backlog: false
  };
}

function getTasksForDate(date) {
  if (!appState) return [];
  const plan = ensurePlan();
  const today = todayStr();
  const out = [];
  const seen = new Set();
  const push = (task) => {
    if (task && !seen.has(task.key)) {
      seen.add(task.key);
      out.push(task);
    }
  };
  if (date === today) {
    appState.sessions.forEach((s) => {
      if (s.status === 'active') push(buildSessionTask(s));
    });
  }
  const day = plan.days.find((d) => d.date === date);
  if (day) {
    day.items.forEach((item) => {
      if (item.kind === 'session') {
        const s = getSession(item.id);
        if (s && s.status !== 'done') push(buildSessionTask(s));
      } else {
        const r = findById(appState.reviews, item.id);
        if (r && r.status === 'pending') push(buildReviewTask(r, plan));
      }
    });
  }
  appState.sessions.forEach((s) => {
    if (s.status === 'done' && s.completedAt && dateOfTimestamp(s.completedAt) === date) push(buildSessionTask(s));
  });
  appState.reviews.forEach((r) => {
    if (r.status === 'done' && r.doneAt && dateOfTimestamp(r.doneAt) === date) push(buildReviewTask(r, plan));
  });
  return out;
}

function getTodayTasks() {
  return getTasksForDate(todayStr());
}

function getTodaySummary() {
  const today = todayStr();
  const tasks = getTasksForDate(today);
  const done = tasks.filter((t) => t.status === 'done');
  const pending = tasks.filter((t) => t.status !== 'done');
  const sum = (list) => list.reduce((total, t) => total + t.minutes, 0);
  return {
    tasks,
    total: tasks.length,
    done: done.length,
    pending: pending.length,
    minutesTotal: sum(tasks),
    minutesDone: sum(done),
    minutesRemaining: sum(pending),
    ratio: tasks.length ? done.length / tasks.length : 0,
    isRest: appState.availability.rest.includes(dayOfWeek(today)),
    capacity: dayCapacity(today, false),
    newCount: tasks.filter((t) => t.category === 'new').length,
    reviewCount: tasks.filter((t) => t.kind === 'review').length,
    practiceCount: tasks.filter((t) => t.type === 'practice' || t.type === 'selftest').length,
    backlogCount: tasks.filter((t) => t.category === 'backlog').length
  };
}

function explainToday() {
  if (!appState) return '';
  const summary = getTodaySummary();
  if (summary.isRest) return 'اليوم يوم راحة في جدولك، استرح واستعد للأيام القادمة. رفيقك لن ينقص منه شيء.';
  if (!summary.total) {
    if (summary.capacity <= 0) return 'لا يوجد وقت دراسة متاح لك اليوم حسب إعداداتك.';
    if (!appState.sessions.some((s) => s.status !== 'done') && !appState.reviews.some((r) => r.status === 'pending')) return 'لا توجد مهام الآن. أضف محاضرة جديدة عندما ينشرها مدرسك لأبني لك جدولك.';
    return 'لا توجد مهام لليوم لأن وقتك المتاح اليوم استُخدم بالفعل، وسنكمل غدًا.';
  }
  const pending = summary.tasks.filter((t) => t.status !== 'done');
  if (!pending.length) return 'أنهيت كل مهام اليوم. عمل رائع، ويمكنك الاستراحة الآن.';
  const reasons = pending.map((t) => t.reason).filter(Boolean).slice(0, 3);
  return reasons.join(' ');
}

function getWeekOverview(count) {
  const total = count || 7;
  const today = todayStr();
  const out = [];
  for (let i = 0; i < total; i += 1) {
    const date = addDays(today, i);
    const tasks = getTasksForDate(date);
    out.push({
      date,
      dow: dayOfWeek(date),
      label: DAY_NAMES[dayOfWeek(date)],
      relative: relativeDayLabel(date),
      capacity: dayCapacity(date, false),
      minutes: tasks.reduce((sum, t) => sum + t.minutes, 0),
      count: tasks.length,
      doneCount: tasks.filter((t) => t.status === 'done').length,
      isToday: i === 0,
      isRest: appState.availability.rest.includes(dayOfWeek(date)),
      exams: appState.exams.filter((e) => e.date === date)
    });
  }
  return out;
}

function getDueReviewTasks(date) {
  const target = date || todayStr();
  const plan = ensurePlan();
  return sortBy(appState.reviews.filter((r) => r.status === 'pending' && r.dueDate <= target), (r) => r.dueDate)
    .map((r) => buildReviewTask(r, plan))
    .filter(Boolean);
}

function getUpcomingReviewTasks(limit) {
  const today = todayStr();
  const plan = ensurePlan();
  return sortBy(appState.reviews.filter((r) => r.status === 'pending' && r.dueDate > today), (r) => r.dueDate)
    .slice(0, limit || 30)
    .map((r) => buildReviewTask(r, plan))
    .filter(Boolean);
}

function listSessionTasks(statusFilter, typeFilter) {
  const tasks = [];
  appState.sessions.forEach((s) => {
    if (statusFilter && statusFilter !== 'all' && s.status !== statusFilter) return;
    if (typeFilter && typeFilter !== 'all' && s.type !== typeFilter) return;
    const task = buildSessionTask(s);
    if (task) tasks.push(task);
  });
  const rank = { active: 0, pending: 1, missed: 2, done: 3 };
  return tasks.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    const da = a.date || '9999-99-99';
    const db = b.date || '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    return a.lectureNumber - b.lectureNumber;
  });
}

function listLectureCards(filters) {
  const f = Object.assign({ subjectId: 'all', teacherId: 'all', status: 'all' }, filters || {});
  const cards = [];
  appState.lectures.forEach((lecture) => {
    if (f.subjectId !== 'all' && lecture.subjectId !== f.subjectId) return;
    if (f.teacherId !== 'all' && lecture.teacherId !== f.teacherId) return;
    const backlog = isBacklogLecture(lecture);
    if (f.status === 'new' && !(lecture.status === 'new' && !backlog)) return;
    if (f.status === 'progress' && lecture.status !== 'progress') return;
    if (f.status === 'done' && lecture.status !== 'done') return;
    if (f.status === 'backlog' && !backlog) return;
    cards.push({
      lecture,
      subject: getSubject(lecture.subjectId),
      teacher: getTeacher(lecture.teacherId),
      stats: lectureStats(lecture),
      backlog,
      age: lectureAgeDays(lecture)
    });
  });
  return cards.sort((a, b) => {
    if (a.lecture.publishedAt !== b.lecture.publishedAt) return a.lecture.publishedAt < b.lecture.publishedAt ? 1 : -1;
    return b.lecture.number - a.lecture.number;
  });
}

function backlogPriority(lecture) {
  const subject = getSubject(lecture.subjectId);
  const age = lectureAgeDays(lecture);
  const exam = subject ? nearestExamFor(subject, todayStr()) : null;
  let score = Math.min(age, 45) * 1.5 + lecture.difficulty;
  if (subject) score += subject.difficulty * 2 + (5 - subject.mastery) * 2;
  if (exam && exam.days <= 21) score += (22 - exam.days) * 2;
  if (lecture.status === 'progress') score += 6;
  return score;
}

function getBacklogOverview() {
  const lectures = appState.lectures.filter(isBacklogLecture);
  const work = remainingWork(lectures);
  const bySubject = [];
  appState.subjects.forEach((subject) => {
    const list = lectures.filter((l) => l.subjectId === subject.id);
    if (!list.length) return;
    const w = remainingWork(list);
    bySubject.push({ subject, lectures: list.length, sessions: w.sessions, minutes: w.minutes });
  });
  bySubject.sort((a, b) => b.minutes - a.minutes);
  const top = sortBy(lectures, (l) => backlogPriority(l), -1).slice(0, 12).map((lecture) => {
    const subject = getSubject(lecture.subjectId);
    const exam = subject ? nearestExamFor(subject, todayStr()) : null;
    let reason = 'متراكمة منذ ' + daysGen(lectureAgeDays(lecture));
    if (exam && exam.days <= 21) reason += '، وامتحان ' + exam.exam.title + ' ' + (exam.days === 0 ? 'اليوم' : 'بعد ' + daysGen(exam.days));
    return { lecture, subject, age: lectureAgeDays(lecture), stats: lectureStats(lecture), priority: backlogPriority(lecture), reason };
  });
  const dailyPace = Math.max(30, Math.round(averageDailyMinutes() * 0.6));
  return {
    count: lectures.length,
    sessions: work.sessions,
    minutes: work.minutes,
    estimatedDays: work.minutes ? Math.ceil(work.minutes / dailyPace) : 0,
    bySubject,
    top
  };
}

function subjectMastery(subjectId) {
  const subject = getSubject(subjectId);
  const rated = appState.lectures.filter((l) => l.subjectId === subjectId && l.understanding > 0);
  if (!rated.length) return subject ? subject.mastery : 2;
  const average = rated.reduce((sum, l) => sum + l.understanding, 0) / rated.length;
  return Math.round(average * 10) / 10;
}

function getReportData() {
  const today = todayStr();
  const weekly = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const minutes = minutesStudiedOn(date);
    const capacity = dayCapacity(date, false);
    weekly.push({ date, label: DAY_NAMES[dayOfWeek(date)], minutes, capacity, ratio: capacity > 0 ? Math.min(100, Math.round((minutes / capacity) * 100)) : null });
  }
  const measured = weekly.filter((d) => d.ratio !== null);
  const commitment = measured.length ? Math.round(measured.reduce((sum, d) => sum + d.ratio, 0) / measured.length) : 0;
  const subjects = sortBy(appState.subjects, (s) => s.order).map((subject) => {
    const stats = subjectStats(subject.id);
    return { id: subject.id, name: subject.name, color: subject.color, progress: stats.progress, done: stats.done, studentTotal: stats.studentTotal, backlog: stats.backlog, mastery: subjectMastery(subject.id) };
  });
  const backlog = appState.lectures.filter(isBacklogLecture);
  const work = remainingWork(backlog);
  const trend = appState.backlogSnapshots.filter((s) => s.date < today).slice(-13).map((s) => ({ date: s.date, count: s.count }));
  trend.push({ date: today, count: backlog.length });
  const firstTrend = trend[0];
  const lastTrend = trend[trend.length - 1];
  const spanDays = Math.max(1, diffDays(firstTrend.date, lastTrend.date));
  return {
    totals: {
      lecturesDone: appState.lectures.filter((l) => l.status === 'done').length,
      sessionsDone: appState.progress.sessionsDone,
      reviewsDone: appState.progress.reviewsDone,
      minutesStudied: appState.progress.minutesStudied,
      activeDays: new Set(appState.studyLog.map((e) => e.date)).size,
      backlogLectures: backlog.length,
      backlogSessions: work.sessions,
      backlogMinutes: work.minutes
    },
    weekly,
    weeklyMinutes: weekly.reduce((sum, d) => sum + d.minutes, 0),
    commitment,
    subjects,
    backlogTrend: trend,
    backlogDropPerDay: Math.round(((firstTrend.count - lastTrend.count) / spanDays) * 10) / 10,
    backlogBySubject: getBacklogOverview().bySubject.map((row) => ({ id: row.subject.id, name: row.subject.name, color: row.subject.color, lectures: row.lectures, sessions: row.sessions, minutes: row.minutes }))
  };
}

bus.on('state:changed', () => {
  planCache = null;
});

bus.on('world:opened', () => {
  planCache = null;
  lastMaintenanceDay = '';
});

bus.on('world:closed', () => {
  planCache = null;
  lastMaintenanceDay = '';
  clearTimeout(replanTimer);
  replanReasons = [];
});

bus.on('state:replaced', () => {
  planCache = null;
  lastMaintenanceDay = '';
  scheduleReplan('import');
});

bus.on('plan:request', (event) => {
  scheduleReplan(event && event.reason);
});

bus.on('session:complete', (event) => {
  if (event && event.id) completeSession(event.id);
});

bus.on('game:enter', () => {
  resetStaleActive();
  runDailyMaintenance();
});const WORLD_COLORS = {
  fog: 0x0a0e2a,
  grass: 0x2f9d78,
  soil: 0x4a3a66,
  rock: 0x4b4678,
  stone: 0xd7dbff,
  gold: 0xfbbf24,
  cyan: 0x38bdf8,
  violet: 0x8b5cf6,
  emerald: 0x34d399,
  warm: 0xffd49a
};

const QUALITY_TABLE = {
  low: { dpr: 1, shadows: false, shadowSize: 0, decor: 5, clouds: 10, stars: 900, trees: 5, seg: 20 },
  medium: { dpr: 1.5, shadows: true, shadowSize: 1024, decor: 9, clouds: 16, stars: 1600, trees: 8, seg: 28 },
  high: { dpr: 2, shadows: true, shadowSize: 2048, decor: 14, clouds: 24, stars: 2600, trees: 11, seg: 36 }
};

const RING_CAPACITY = [6, 10, 14, 18, 22];
const RING_RADII = [19, 33, 47, 61, 75];
const ISLAND_RADIUS = 5.4;
const HUB_RADIUS = 7.6;
const WORLD_PET_SCALE = 1.5;
const MAX_STAGE_MARKERS = 15;
const MOTIF_LANDMARK = { scroll: 'tower', globe: 'dome', sigma: 'crystals', flask: 'dome', atom: 'dome', pen: 'temple', landmark: 'castle', code: 'crystals', leaf: 'grove' };
const SHOWCASE_ISLANDS = [
  { motif: 'scroll', color: '#8b5cf6' },
  { motif: 'globe', color: '#38bdf8' },
  { motif: 'sigma', color: '#fbbf24' },
  { motif: 'leaf', color: '#34d399' },
  { motif: 'landmark', color: '#fb7185' }
];

const world = {
  available: false,
  ready: false,
  paused: false,
  webglChecked: undefined,
  renderer: null,
  scene: null,
  camera: null,
  canvas: null,
  light: null,
  hubLight: null,
  sky: null,
  starsA: null,
  starsB: null,
  quality: QUALITY_TABLE.medium,
  qualityName: 'medium',
  time: 0,
  last: 0,
  skipFrame: false,
  rafId: 0,
  dprScale: 1,
  slowCount: 0,
  frameCount: 0,
  mode: 'showcase',
  extent: 27,
  syncedOnce: false,
  hoverId: '',
  focusedId: '',
  hubIsl: null,
  decor: [],
  clouds: [],
  islands: new Map(),
  showcase: [],
  bridges: { group: null, items: [], points: null, sig: '' },
  pickables: [],
  pointers: new Map(),
  pinch: null,
  lastHover: 0,
  fx: null,
  pet: null,
  flashes: [],
  glowTex: null,
  cloudTex: null,
  previewStage: null,
  viewStage: null,
  thumb: null,
  thumbCache: new Map(),
  tmp: null,
  syncTimer: null,
  returnTimer: null
};

const cam = { target: null, theta: 0.6, phi: 1.05, dist: 52, fov: 52, fovBase: 52, goal: null, tween: null, mode: 'showcase' };
const sharedGeometries = new Map();

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed | 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function angleLerp(a, b, t) {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function viewPanelClosed() {
  const panel = document.getElementById('viewPanel');
  return !panel || panel.hidden;
}

function webglSupported() {
  if (world.webglChecked !== undefined) return world.webglChecked;
  let ok = false;
  try {
    const probe = document.createElement('canvas');
    ok = !!(window.WebGLRenderingContext && (probe.getContext('webgl') || probe.getContext('experimental-webgl')));
  } catch (e) {
    ok = false;
  }
  world.webglChecked = ok && typeof THREE !== 'undefined';
  return world.webglChecked;
}

function sharedGeo(key, factory) {
  let geometry = sharedGeometries.get(key);
  if (!geometry) {
    geometry = factory();
    geometry.userData.shared = true;
    sharedGeometries.set(key, geometry);
  }
  return geometry;
}

function unitSphere(seg) {
  return sharedGeo('sphere' + seg, () => new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.7))));
}

function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();
    if (o.isInstancedMesh && typeof o.dispose === 'function') o.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach((mat) => {
      if (mat.map && !(mat.map.userData && mat.map.userData.shared)) mat.map.dispose();
      mat.dispose();
    });
  });
}

function stdMat(color, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.05 }, extra || {}));
}

function glowMat(color, opacity) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity == null ? 0.85 : opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function place(obj, x, y, z) {
  obj.position.set(x, y, z);
  return obj;
}

function ellipsoid(rx, ry, rz, mat, seg) {
  const m = new THREE.Mesh(unitSphere(seg || 18), mat);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

function ball(r, mat, seg) {
  const m = new THREE.Mesh(unitSphere(seg || 12), mat);
  m.scale.setScalar(r);
  return m;
}

function cyl(rt, rb, h, seg, mat) {
  return shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat));
}

function cone(r, h, seg, mat) {
  return shadowed(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat));
}

function box(w, h, d, mat) {
  return shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
}

function torus(r, tube, mat, seg) {
  return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, seg || 32), mat);
}

function getGlowTexture() {
  if (world.glowTex) return world.glowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  tex.userData = { shared: true };
    world.glowTex = tex;
  return tex;
}

function getCloudTexture() {
  if (world.cloudTex) return world.cloudTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const rng = mulberry32(77);
  for (let i = 0; i < 9; i += 1) {
    const x = 40 + rng() * 176;
    const y = 44 + rng() * 40;
    const r = 26 + rng() * 30;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
    tex.userData = { shared: true };
  world.cloudTex = tex;
  return tex;
}

function glowSprite(color, size, opacity) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, transparent: true, opacity: opacity == null ? 0.8 : opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

function createFx(capacity) {
  const positions = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity);
  const alphas = new Float32Array(capacity);
  const vel = new Float32Array(capacity * 3);
  const life = new Float32Array(capacity);
  const maxLife = new Float32Array(capacity);
  const grav = new Float32Array(capacity);
  const baseSize = new Float32Array(capacity);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    vertexShader: 'attribute float size; attribute float alpha; attribute vec3 customColor; uniform float uScale; varying float vAlpha; varying vec3 vColor; void main(){ vAlpha = alpha; vColor = customColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vAlpha; varying vec3 vColor; void main(){ float d = length(gl_PointCoord - vec2(0.5)); float a = smoothstep(0.5, 0.0, d) * vAlpha; if (a < 0.01) discard; gl_FragColor = vec4(vColor, a); }',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  const tmpColor = new THREE.Color();
  let ptr = 0;
  return {
    points,
    emit(x, y, z, vx, vy, vz, color, size, lifeTime, gravity) {
      const i = ptr;
      ptr = (ptr + 1) % capacity;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      vel[i * 3] = vx;
      vel[i * 3 + 1] = vy;
      vel[i * 3 + 2] = vz;
      tmpColor.set(color);
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
      life[i] = lifeTime;
      maxLife[i] = lifeTime;
      baseSize[i] = size;
      grav[i] = gravity || 0;
      sizes[i] = size;
      alphas[i] = 1;
    },
    burst(x, y, z, color, count, speed, size, lifeTime, gravity) {
      for (let k = 0; k < count; k += 1) {
        const u = Math.random() * 2 - 1;
        const a = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        const v = speed * (0.4 + Math.random() * 0.6);
        this.emit(x, y, z, Math.cos(a) * s * v, u * v + speed * 0.25, Math.sin(a) * s * v, color, size * (0.6 + Math.random() * 0.8), lifeTime * (0.7 + Math.random() * 0.6), gravity);
      }
    },
    update(dt) {
      let any = false;
      for (let i = 0; i < capacity; i += 1) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        any = true;
        if (life[i] <= 0) {
          alphas[i] = 0;
          sizes[i] = 0;
          continue;
        }
        const k = life[i] / maxLife[i];
        positions[i * 3] += vel[i * 3] * dt;
        positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] -= grav[i] * dt;
        alphas[i] = Math.min(1, k * 1.6);
        sizes[i] = baseSize[i] * (0.4 + 0.6 * k);
      }
      if (any) {
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.size.needsUpdate = true;
        geometry.attributes.alpha.needsUpdate = true;
        geometry.attributes.customColor.needsUpdate = true;
      }
    },
    setScale(value) {
      material.uniforms.uScale.value = value;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function pointScale(renderer, fov) {
  const height = renderer.domElement.height || 600;
  return height / (2 * Math.tan((fov * Math.PI) / 360));
}

function buildSceneBase() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(WORLD_COLORS.fog, 0.0075);
  world.scene = scene;

  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      cTop: { value: new THREE.Color(0x04061a) },
      cMid: { value: new THREE.Color(0x1a1148) },
      cLow: { value: new THREE.Color(0x0e2a5c) },
      uTime: { value: 0 }
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cLow; uniform float uTime; varying vec3 vDir; void main(){ float h = vDir.y; vec3 col = h > 0.0 ? mix(cMid, cTop, pow(h, 0.55)) : mix(cMid, cLow, pow(-h, 0.6)); col += vec3(0.10, 0.28, 0.45) * exp(-abs(h) * 9.0) * 0.6; float a = sin(vDir.x * 6.0 + uTime * 0.05) * sin(vDir.z * 4.0 - uTime * 0.04); col += vec3(0.06, 0.2, 0.28) * smoothstep(0.35, 0.95, a) * smoothstep(0.1, 0.5, h) * 0.35; gl_FragColor = vec4(col, 1.0); }',
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  world.sky = sky;

  const rng = mulberry32(2026);
  const starCount = QUALITY_TABLE.high.stars;
  const makeStars = (count, size, opacity) => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const u = rng() * 2 - 1;
      const a = rng() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      arr[i * 3] = Math.cos(a) * s * 420;
      arr[i * 3 + 1] = u * 420;
      arr[i * 3 + 2] = Math.sin(a) * s * 420;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ size, sizeAttenuation: false, map: getGlowTexture(), color: 0xdfe8ff, transparent: true, opacity, depthWrite: false, fog: false, toneMapped: false });
    const pts = new THREE.Points(geo, mat);
    pts.renderOrder = -9;
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  };
  world.starsA = makeStars(starCount, 4, 0.9);
  world.starsB = makeStars(Math.round(starCount * 0.25), 7, 0.8);

  const planet = new THREE.Mesh(new THREE.SphereGeometry(26, 32, 24), new THREE.MeshBasicMaterial({ color: 0x6d5bd0, fog: false }));
  planet.position.set(-170, 110, -260);
  scene.add(planet);
  const planetGlow = glowSprite(0x8b7cf6, 170, 0.45);
  planetGlow.material.fog = false;
  planetGlow.position.copy(planet.position);
  scene.add(planetGlow);
  const planetRing = torus(42, 1.4, new THREE.MeshBasicMaterial({ color: 0xb9a8ff, transparent: true, opacity: 0.45, fog: false }), 64);
  planetRing.position.copy(planet.position);
  planetRing.rotation.set(1.25, 0.2, 0.3);
  scene.add(planetRing);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshBasicMaterial({ color: 0x7dd3fc, fog: false }));
  moon.position.set(190, 70, -220);
  scene.add(moon);
  const moonGlow = glowSprite(0x38bdf8, 70, 0.4);
  moonGlow.material.fog = false;
  moonGlow.position.copy(moon.position);
  scene.add(moonGlow);

  const cloudRng = mulberry32(55);
  for (let i = 0; i < QUALITY_TABLE.high.clouds; i += 1) {
    const mat = new THREE.SpriteMaterial({ map: getCloudTexture(), color: i % 3 === 0 ? 0xb9a8ff : i % 3 === 1 ? 0x8fb8ff : 0xffffff, transparent: true, opacity: 0.12 + cloudRng() * 0.2, depthWrite: false, toneMapped: false });
    const sprite = new THREE.Sprite(mat);
    const radius = 30 + cloudRng() * 130;
    const ang = cloudRng() * Math.PI * 2;
    sprite.position.set(Math.sin(ang) * radius, -22 + cloudRng() * 60, Math.cos(ang) * radius);
    const size = 36 + cloudRng() * 50;
    sprite.scale.set(size, size * 0.5, 1);
    sprite.userData.speed = 0.4 + cloudRng() * 1.1;
    scene.add(sprite);
    world.clouds.push(sprite);
  }

  scene.add(new THREE.HemisphereLight(0x8a96ff, 0x24104a, 0.85));
  const light = new THREE.DirectionalLight(0xdbe4ff, 1.15);
  light.position.set(18, 34, 12);
  light.shadow.camera.left = -34;
  light.shadow.camera.right = 34;
  light.shadow.camera.top = 34;
  light.shadow.camera.bottom = -34;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 110;
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = 0.05;
  scene.add(light);
  scene.add(light.target);
  world.light = light;
  const rim = new THREE.DirectionalLight(0x9b6bff, 0.45);
  rim.position.set(-20, 10, -24);
  scene.add(rim);
  const hubLight = new THREE.PointLight(0x8b5cf6, 1.3, 46);
  hubLight.position.set(0, 7, 0);
  scene.add(hubLight);
  world.hubLight = hubLight;

  world.bridges.group = new THREE.Group();
  scene.add(world.bridges.group);
  world.fx = createFx(700);
  scene.add(world.fx.points);
}

function hillNoise(x, z, sa, sb) {
  return Math.sin(x * 0.55 + sa) * Math.cos(z * 0.5 + sb) * 0.5 + Math.sin((x + z) * 0.9 + sb) * 0.25;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawIslandLabel(canvas, data) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const color = data.color || '#8b5cf6';
  ctx.fillStyle = 'rgba(9, 12, 38, 0.8)';
  roundedRect(ctx, 6, 6, w - 12, h - 12, 44);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.globalAlpha = 1;
  const cx = 100;
  const cy = h / 2;
  const r = 52;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const ratio = clamp(data.ratio || 0, 0, 1);
  if (ratio > 0.001) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'ltr';
  ctx.font = '700 34px Cairo, Tajawal, sans-serif';
  ctx.fillText(String(data.centerText || ''), cx, cy + 2);
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  let size = 54;
  ctx.font = '800 ' + size + 'px Cairo, Tajawal, sans-serif';
  while (ctx.measureText(data.title).width > w - 250 && size > 26) {
    size -= 2;
    ctx.font = '800 ' + size + 'px Cairo, Tajawal, sans-serif';
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.title, w - 44, cy - 20);
  ctx.font = '600 30px Cairo, Tajawal, sans-serif';
  ctx.fillStyle = '#b9c4ff';
  ctx.fillText(data.subtitle || '', w - 44, cy + 38);
}

function createLabelSprite(data, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 200;
  drawIslandLabel(canvas, data);
  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  sprite.scale.set(scale * 3.2, scale, 1);
  sprite.renderOrder = 20;
  sprite.userData.canvas = canvas;
  sprite.userData.texture = tex;
  return sprite;
}

function redrawLabel(sprite, data) {
  drawIslandLabel(sprite.userData.canvas, data);
  sprite.userData.texture.needsUpdate = true;
}

function createIslandBase(opts) {
  const R = opts.radius;
  const rng = mulberry32(hashString(String(opts.seed)));
  const sa = rng() * 6.28;
  const sb = rng() * 6.28;
  const q = world.quality;
  const accent = new THREE.Color(opts.color);
  const group = new THREE.Group();
  const isl = {
    id: opts.id || '',
    kind: opts.kind,
    group,
    R,
    rng,
    accent,
    anim: [],
    pulses: [],
    uniforms: [],
    hover: 0,
    flash: 0,
    spawn: 0,
    spawnDelay: 0,
    removing: false,
    phase: rng() * 6.28,
    bobAmp: opts.bobAmp == null ? 0.22 : opts.bobAmp,
    home: new THREE.Vector3(),
    target: new THREE.Vector3(),
    waterAngle: rng() * Math.PI * 2,
    markers: [],
    gates: [],
    markerStates: {},
    gateStates: {},
    stageGroup: new THREE.Group(),
    label: null,
    ring: null,
    proxy: null,
    sig: '',
    snap: null,
    lm: null,
    surfaceY: null
  };
  const domeH = 0.15 * R;
  const rimR = R * 0.98;
  const grass = new THREE.Color(WORLD_COLORS.grass).lerp(accent, opts.kind === 'hub' ? 0.08 : 0.3);
  const seg = q.seg;
  const topGeo = new THREE.SphereGeometry(rimR, seg, Math.round(seg * 0.4), 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = topGeo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const f = Math.min(1, Math.sqrt(x * x + z * z) / rimR);
    const base = y * (domeH / rimR);
    const hill = y > 0.001 ? hillNoise(x, z, sa, sb) * 0.38 * (1 - f * f) : 0;
    pos.setY(i, base + hill);
  }
  topGeo.computeVertexNormals();
  const top = new THREE.Mesh(topGeo, stdMat(grass, { roughness: 0.9, flatShading: true }));
  top.receiveShadow = true;
  top.castShadow = true;
  group.add(top);
  isl.surfaceY = (x, z) => {
    const d = Math.sqrt(x * x + z * z) / rimR;
    if (d >= 1) return 0;
    return Math.sqrt(1 - d * d) * domeH + hillNoise(x, z, sa, sb) * 0.38 * (1 - d * d);
  };
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(rimR, R * 0.86, 0.8, seg, 1, true), stdMat(WORLD_COLORS.soil, { roughness: 0.95, flatShading: true }));
  soil.position.y = -0.4;
  soil.receiveShadow = true;
  group.add(soil);
  const rockH = R * 1.3;
  const rockGeo = new THREE.ConeGeometry(R * 0.88, rockH, 16, 6, true);
  const rp = rockGeo.attributes.position;
  for (let i = 0; i < rp.count; i += 1) {
    const x = rp.getX(i);
    const y = rp.getY(i);
    const z = rp.getZ(i);
    const n = (Math.sin(x * 1.7 + sa) + Math.cos(z * 1.9 + sb) + Math.sin(y * 2.3 + sa + sb)) * 0.18;
    rp.setXYZ(i, x * (1 + n * 0.3), y + n * 0.4, z * (1 + n * 0.3));
  }
  rockGeo.computeVertexNormals();
  const rockMat = stdMat(new THREE.Color(WORLD_COLORS.rock).lerp(accent, 0.12), { roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
  const rock = new THREE.Mesh(rockGeo, rockMat);
  rock.rotation.x = Math.PI;
  rock.position.y = -0.8 - rockH / 2;
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);
  [[-0.4, 0.55], [0.38, 0.42]].forEach((pair, index) => {
    const small = new THREE.Mesh(new THREE.ConeGeometry(R * (0.26 - index * 0.05), R * 0.8, 7, 2, true), rockMat);
    small.rotation.x = Math.PI;
    small.position.set(pair[0] * R, -0.9 - R * 0.35, pair[1] * R * (index ? -1 : 1) * 0.6);
    group.add(small);
  });
  const under = glowSprite(accent, R * 2.6, 0.22);
  under.position.y = -R * 0.8;
  group.add(under);
  const tip = glowSprite(accent, 1.6, 0.7);
  tip.position.y = -0.8 - rockH + 0.2;
  group.add(tip);
  isl.pulses.push({ target: tip.material, key: 'opacity', base: 0.65, amp: 0.2, speed: 2.1, phase: isl.phase });
  group.add(isl.stageGroup);
  return isl;
}

function lmGroup(isl, scale) {
  const g = new THREE.Group();
  g.position.set(0, isl.surfaceY(0, 0), 0);
  g.scale.setScalar(scale);
  isl.group.add(g);
  isl.lm = g;
  return g;
}

function addInstanced(group, geometry, material, transforms, colors, cast) {
  if (!transforms.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const dummy = new THREE.Object3D();
  transforms.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(0, t.ry || 0, 0);
    dummy.scale.set(t.sx, t.sy, t.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (colors) mesh.setColorAt(i, colors[i]);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (colors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = !!cast;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function angularGap(a, b) {
  return Math.abs((((a - b + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
}

function addTrees(isl, count, round) {
  const R = isl.R;
  const rng = isl.rng;
  const trunks = [];
  const low = [];
  const high = [];
  const colors = [];
  let attempts = 0;
  while (trunks.length < count && attempts < count * 14) {
    attempts += 1;
    const ang = rng() * Math.PI * 2;
    const dist = R * (0.7 + rng() * 0.22);
    if (angularGap(ang, isl.waterAngle) < 0.38) continue;
    const x = Math.sin(ang) * dist;
    const z = Math.cos(ang) * dist;
    const y = isl.surfaceY(x, z);
    const s = 0.7 + rng() * 0.7;
    const ry = rng() * 6.28;
    trunks.push({ x, y: y + 0.32 * s, z, ry, sx: s, sy: s, sz: s });
    low.push({ x, y: y + 0.85 * s, z, ry, sx: s, sy: s, sz: s });
    high.push({ x, y: y + 1.35 * s, z, ry, sx: s * 0.85, sy: s * 0.9, sz: s * 0.85 });
    colors.push(new THREE.Color(WORLD_COLORS.emerald).lerp(isl.accent, 0.2 + rng() * 0.45).multiplyScalar(0.8 + rng() * 0.3));
  }
  if (!trunks.length) return;
  const trunkMat = stdMat(0x4a3550, { roughness: 0.9 });
  const leafMat = stdMat(0xffffff, { roughness: 0.8, flatShading: true });
  addInstanced(isl.group, sharedGeo('trunk', () => new THREE.CylinderGeometry(0.08, 0.12, 0.7, 6)), trunkMat, trunks, null, true);
  if (round) {
    addInstanced(isl.group, sharedGeo('leafball', () => new THREE.IcosahedronGeometry(0.6, 0)), leafMat, low, colors, true);
    addInstanced(isl.group, sharedGeo('leafball', () => new THREE.IcosahedronGeometry(0.6, 0)), leafMat, high, colors, true);
  } else {
    addInstanced(isl.group, sharedGeo('pine1', () => new THREE.ConeGeometry(0.55, 1.0, 7)), leafMat, low, colors, true);
    addInstanced(isl.group, sharedGeo('pine2', () => new THREE.ConeGeometry(0.4, 0.8, 7)), leafMat, high, colors, true);
  }
}

function addRocksAndCrystals(isl, rockCount, crystalCount) {
  const R = isl.R;
  const rng = isl.rng;
  const rocks = [];
  for (let i = 0; i < rockCount; i += 1) {
    const ang = rng() * Math.PI * 2;
    const dist = R * (0.3 + rng() * 0.62);
    const x = Math.sin(ang) * dist;
    const z = Math.cos(ang) * dist;
    const s = 0.5 + rng() * 0.9;
    rocks.push({ x, y: isl.surfaceY(x, z) + 0.08, z, ry: rng() * 6, sx: s, sy: s * 0.7, sz: s });
  }
  addInstanced(isl.group, sharedGeo('rock', () => new THREE.DodecahedronGeometry(0.3, 0)), stdMat(0x6b6590, { roughness: 0.95, flatShading: true }), rocks, null, true);
  const crystals = [];
  for (let i = 0; i < crystalCount; i += 1) {
    const ang = rng() * Math.PI * 2;
    const dist = R * (0.4 + rng() * 0.5);
    const x = Math.sin(ang) * dist;
    const z = Math.cos(ang) * dist;
    const s = 0.7 + rng() * 0.9;
    crystals.push({ x, y: isl.surfaceY(x, z) + 0.18 * s, z, ry: rng() * 6, sx: s, sy: s * 2.1, sz: s });
  }
  addInstanced(isl.group, sharedGeo('crystalsmall', () => new THREE.OctahedronGeometry(0.14, 0)), stdMat(isl.accent, { emissive: isl.accent, emissiveIntensity: 0.9, roughness: 0.25, flatShading: true }), crystals, null, false);
}

function addWaterfall(isl, length) {
  const R = isl.R;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x67e8f9) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform float uTime; uniform vec3 uColor; varying vec2 vUv; void main(){ float streak = sin(vUv.x * 18.0 + sin(vUv.y * 6.0 - uTime * 3.0) * 0.8) * 0.5 + 0.5; float flow = fract(vUv.y * 5.0 + uTime * 1.4); float a = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x) * (0.3 + 0.4 * streak + 0.2 * flow) * smoothstep(0.0, 0.4, vUv.y); gl_FragColor = vec4(uColor + 0.25, a * 0.75); }',
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  isl.uniforms.push(mat.uniforms.uTime);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.95, length, 1, 12), mat);
  const a = isl.waterAngle;
  plane.position.set(Math.sin(a) * R * 0.95, -length / 2 + 0.05, Math.cos(a) * R * 0.95);
  plane.rotation.y = a;
  isl.group.add(plane);
  const mist = glowSprite(0xbdf3ff, 3.2, 0.32);
  mist.position.set(plane.position.x, -length + 0.4, plane.position.z);
  isl.group.add(mist);
  isl.pulses.push({ target: mist.material, key: 'opacity', base: 0.3, amp: 0.1, speed: 2.4, phase: 1 });
}

function windowsAround(g, mat, y, radius, count, size) {
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const w = box(size * 0.5, size, size * 0.2, mat);
    w.castShadow = false;
    w.position.set(Math.sin(a) * radius, y, Math.cos(a) * radius);
    w.rotation.y = a;
    g.add(w);
  }
}

function buildTower(isl, scale) {
  const g = lmGroup(isl, scale);
  const stone = stdMat(WORLD_COLORS.stone, { roughness: 0.75 });
  const roof = stdMat(isl.accent, { emissive: isl.accent, emissiveIntensity: 0.35, roughness: 0.5 });
  const warm = glowMat(WORLD_COLORS.warm, 0.95);
  g.add(place(cyl(1.15, 1.3, 0.6, 12, stone), 0, 0.3, 0));
  g.add(place(cyl(0.7, 0.85, 2.6, 12, stone), 0, 1.9, 0));
  g.add(place(cyl(1.0, 1.0, 0.18, 14, stone), 0, 3.3, 0));
  g.add(place(cyl(0.55, 0.65, 1.3, 12, stone), 0, 4.0, 0));
  g.add(place(cone(0.85, 1.5, 12, roof), 0, 5.4, 0));
  windowsAround(g, warm, 1.9, 0.8, 5, 0.3);
  windowsAround(g, warm, 4.0, 0.62, 4, 0.26);
  const orb = ball(0.12, glowMat(WORLD_COLORS.gold, 1), 8);
  orb.position.y = 6.3;
  g.add(orb);
  isl.pulses.push({ target: orb.material, key: 'opacity', base: 0.85, amp: 0.15, speed: 3, phase: 0 });
  for (let i = 0; i < 3; i += 1) {
    const ring = torus(0.95 + i * 0.12, 0.035, glowMat(isl.accent, 0.75), 40);
    ring.rotation.x = Math.PI / 2 + (i - 1) * 0.25;
    const baseY = 2.4 + i * 1.1;
    g.add(ring);
    isl.anim.push((t, dt) => {
      ring.rotation.z += dt * (0.5 + i * 0.2);
      ring.position.y = baseY + Math.sin(t * 0.9 + i * 2) * 0.14;
    });
  }
}

function buildCastle(isl, scale) {
  const g = lmGroup(isl, scale);
  const stone = stdMat(WORLD_COLORS.stone, { roughness: 0.75 });
  const roof = stdMat(isl.accent, { emissive: isl.accent, emissiveIntensity: 0.35, roughness: 0.5 });
  const warm = glowMat(WORLD_COLORS.warm, 0.95);
  g.add(place(box(1.8, 1.5, 1.8, stone), 0, 0.75, 0));
  [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach((p) => {
    g.add(place(cyl(0.38, 0.42, 2.0, 10, stone), p[0], 1.0, p[1]));
    g.add(place(cone(0.52, 0.9, 10, roof), p[0], 2.45, p[1]));
  });
  g.add(place(cyl(0.58, 0.64, 3.2, 12, stone), 0, 2.1, 0));
  g.add(place(cone(0.82, 1.3, 12, roof), 0, 4.35, 0));
  g.add(place(box(0.5, 0.75, 0.12, stdMat(0x1b1340, { roughness: 0.6 })), 0, 0.4, 0.92));
  windowsAround(g, warm, 2.4, 0.6, 5, 0.3);
  const poleTop = 5.0;
  g.add(place(cyl(0.02, 0.02, 0.8, 4, stone), 0, poleTop, 0));
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ color: WORLD_COLORS.gold, side: THREE.DoubleSide, toneMapped: false }));
  flag.position.set(0.26, poleTop + 0.25, 0);
  g.add(flag);
  isl.anim.push((t) => {
    flag.rotation.y = Math.sin(t * 3) * 0.35;
  });
}

function buildCrystals(isl, scale) {
  const g = lmGroup(isl, scale);
  const mat = stdMat(isl.accent, { emissive: isl.accent, emissiveIntensity: 0.65, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.92, flatShading: true });
  const rng = isl.rng;
  const items = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + rng();
    const d = i === 0 ? 0 : 0.7 + rng() * 0.5;
    const m = new THREE.Mesh(sharedGeo('octa1', () => new THREE.OctahedronGeometry(1, 0)), mat);
    const h = i === 0 ? 2.8 : 1.3 + rng() * 1.2;
    m.scale.set(0.5 + rng() * 0.2, h, 0.5 + rng() * 0.2);
    m.position.set(Math.sin(a) * d, h * 0.9, Math.cos(a) * d);
    m.rotation.y = rng() * 3;
    m.castShadow = true;
    g.add(m);
    items.push({ m, base: m.position.y, phase: rng() * 6 });
  }
  const halo = glowSprite(isl.accent, 5.2, 0.35);
  halo.position.y = 2.2;
  g.add(halo);
  isl.pulses.push({ target: halo.material, key: 'opacity', base: 0.32, amp: 0.12, speed: 1.6, phase: 0 });
  isl.anim.push((t) => {
    items.forEach((it, i) => {
      it.m.position.y = it.base + Math.sin(t * 0.8 + it.phase) * 0.12;
      it.m.rotation.y += 0.003 * (i + 1);
    });
  });
}

function buildDome(isl, scale) {
  const g = lmGroup(isl, scale);
  const glass = new THREE.MeshStandardMaterial({ color: new THREE.Color(isl.accent).lerp(new THREE.Color(0xffffff), 0.6), transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  g.add(place(cyl(1.65, 1.8, 0.35, 24, stdMat(WORLD_COLORS.stone, { roughness: 0.7 })), 0, 0.18, 0));
  g.add(place(new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass), 0, 0.35, 0));
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), stdMat(0xffffff, { emissive: isl.accent, emissiveIntensity: 1, roughness: 0.3 }));
  core.position.y = 1.0;
  g.add(core);
  const glow = glowSprite(isl.accent, 3.4, 0.55);
  glow.position.y = 1.0;
  g.add(glow);
  isl.pulses.push({ target: glow.material, key: 'opacity', base: 0.5, amp: 0.15, speed: 2.2, phase: 0 });
  const rings = [];
  for (let i = 0; i < 3; i += 1) {
    const ring = torus(1.1 + i * 0.28, 0.035, glowMat(i === 1 ? WORLD_COLORS.gold : isl.accent, 0.7), 48);
    ring.position.y = 1.0;
    ring.rotation.set(i * 1.05, i * 0.6, 0);
    g.add(ring);
    rings.push(ring);
  }
  const orbs = [0, 1, 2].map((i) => {
    const o = ball(0.09, glowMat(0xffffff, 1), 8);
    g.add(o);
    return o;
  });
  isl.anim.push((t, dt) => {
    core.rotation.y += dt * 0.9;
    core.position.y = 1.0 + Math.sin(t * 1.4) * 0.1;
    rings.forEach((r, i) => {
      r.rotation.x += dt * (0.3 + i * 0.15);
      r.rotation.y += dt * (0.4 - i * 0.1);
    });
    orbs.forEach((o, i) => {
      const a = t * (1.1 + i * 0.3) + i * 2.1;
      o.position.set(Math.cos(a) * (1.1 + i * 0.28), 1.0 + Math.sin(a * 1.3) * 0.5, Math.sin(a) * (1.1 + i * 0.28));
    });
  });
}

function buildTemple(isl, scale) {
  const g = lmGroup(isl, scale);
  const stone = stdMat(WORLD_COLORS.stone, { roughness: 0.75 });
  const roofMat = stdMat(isl.accent, { emissive: isl.accent, emissiveIntensity: 0.3, roughness: 0.5 });
  g.add(place(cyl(1.75, 1.9, 0.3, 18, stone), 0, 0.15, 0));
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    g.add(place(cyl(0.14, 0.16, 1.9, 10, stone), Math.sin(a) * 1.35, 1.25, Math.cos(a) * 1.35));
  }
  g.add(place(cyl(1.65, 1.65, 0.22, 18, stone), 0, 2.3, 0));
  g.add(place(cone(1.5, 1.0, 18, roofMat), 0, 2.9, 0));
  const orb = ball(0.32, glowMat(WORLD_COLORS.gold, 0.95), 14);
  orb.position.y = 1.2;
  g.add(orb);
  const halo = glowSprite(WORLD_COLORS.gold, 3, 0.5);
  halo.position.y = 1.2;
  g.add(halo);
  isl.pulses.push({ target: halo.material, key: 'opacity', base: 0.45, amp: 0.15, speed: 2, phase: 0 });
  isl.anim.push((t) => {
    orb.position.y = 1.2 + Math.sin(t * 1.3) * 0.18;
    halo.position.y = orb.position.y;
  });
}

function buildGrove(isl, scale) {
  const g = lmGroup(isl, scale);
  const rng = isl.rng;
  g.add(place(cyl(0.28, 0.45, 2.0, 8, stdMat(0x4a3550, { roughness: 0.9 })), 0, 1.0, 0));
  [[0, 2.5, 0, 1.15], [0.55, 2.0, 0.2, 0.8], [-0.5, 2.2, -0.2, 0.75]].forEach((p, i) => {
    const color = new THREE.Color(WORLD_COLORS.emerald).lerp(isl.accent, 0.25 + i * 0.12);
    const leaf = new THREE.Mesh(sharedGeo('leafball2', () => new THREE.IcosahedronGeometry(1, 1)), stdMat(color, { roughness: 0.8, flatShading: true }));
    leaf.scale.setScalar(p[3]);
    leaf.position.set(p[0], p[1], p[2]);
    leaf.castShadow = true;
    g.add(leaf);
  });
  const caps = [];
  for (let i = 0; i < 5; i += 1) {
    const a = rng() * Math.PI * 2;
    const d = 1.1 + rng() * 0.6;
    const stem = cyl(0.04, 0.05, 0.25, 6, stdMat(0xf1e8ff, { roughness: 0.8 }));
    stem.position.set(Math.sin(a) * d, 0.12, Math.cos(a) * d);
    const cap = ball(0.15, glowMat(i % 2 ? isl.accent : 0xffffff, 0.95), 8);
    cap.scale.y = 0.6;
    cap.position.set(stem.position.x, 0.28, stem.position.z);
    g.add(stem, cap);
    caps.push(cap);
  }
  const flies = [0, 1, 2, 3].map(() => {
    const f = glowSprite(WORLD_COLORS.warm, 0.5, 0.9);
    g.add(f);
    return f;
  });
  isl.anim.push((t) => {
    flies.forEach((f, i) => {
      const a = t * (0.5 + i * 0.12) + i * 1.7;
      f.position.set(Math.cos(a) * (1.6 + i * 0.25), 1.2 + Math.sin(a * 1.7) * 0.6 + i * 0.2, Math.sin(a) * (1.6 + i * 0.25));
    });
  });
}

function buildLandmark(isl, kind, scale) {
  if (kind === 'tower') buildTower(isl, scale);
  else if (kind === 'castle') buildCastle(isl, scale);
  else if (kind === 'dome') buildDome(isl, scale);
  else if (kind === 'temple') buildTemple(isl, scale);
  else if (kind === 'grove') buildGrove(isl, scale);
  else buildCrystals(isl, scale);
}

function addSelectionRing(isl) {
  const ring = torus(isl.R * 1.0, 0.07, glowMat(0x9be7ff, 0), 72);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;
  isl.group.add(ring);
  isl.ring = ring;
}

function addProxy(isl, pick, sx, sy, sz, cy) {
  const proxy = new THREE.Mesh(unitSphere(10), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  proxy.scale.set(sx, sy, sz);
  proxy.position.y = cy;
  proxy.userData.pick = pick;
  isl.group.add(proxy);
  isl.proxy = proxy;
}

function chooseStageWindow(model) {
  const stages = model.stages;
  if (stages.length <= MAX_STAGE_MARKERS) return { items: stages, start: 0 };
  let idx = stages.findIndex((s) => s.state === 'current');
  if (idx === -1) idx = stages.length - 1;
  const start = clamp(idx - 5, 0, stages.length - MAX_STAGE_MARKERS);
  return { items: stages.slice(start, start + MAX_STAGE_MARKERS), start };
}

function clearStageGroup(isl) {
  while (isl.stageGroup.children.length) {
    const child = isl.stageGroup.children[0];
    isl.stageGroup.remove(child);
    disposeObject(child);
  }
  isl.pulses = isl.pulses.filter((p) => !p.stage);
  isl.markers = [];
  isl.gates = [];
}

function rebuildIslandStages(isl, model) {
  clearStageGroup(isl);
  const win = chooseStageWindow(model);
  const items = win.items;
  const n = items.length;
  if (!n) return;
  const pathR = 2.95;
  const step = Math.min(0.27, (Math.PI * 1.7) / Math.max(1, n - 1));
  const span = step * (n - 1);
  const start = isl.waterAngle + Math.PI - span / 2;
  const angles = [];
  items.forEach((item, i) => {
    const ang = start + step * i;
    angles.push(ang);
    const r = pathR + Math.sin(i * 0.8) * 0.12;
    const x = Math.sin(ang) * r;
    const z = Math.cos(ang) * r;
    const y = isl.surfaceY(x, z) + 0.08;
    let color = 0x3a3566;
    let emissive = 0x1a1440;
    let intensity = 0.25;
    if (item.state === 'done') {
      color = WORLD_COLORS.gold;
      emissive = WORLD_COLORS.gold;
      intensity = 0.7;
    } else if (item.backlog) {
      color = 0xfb923c;
      emissive = 0xf97316;
      intensity = 0.6;
    } else if (item.state === 'current') {
      color = WORLD_COLORS.cyan;
      emissive = WORLD_COLORS.cyan;
      intensity = 1;
    }
    const radius = item.state === 'current' ? 0.34 : 0.27;
    const disc = new THREE.Mesh(sharedGeo('stage-disc', () => new THREE.CylinderGeometry(1, 1, 0.14, 12)), stdMat(color, { emissive, emissiveIntensity: intensity, roughness: 0.4 }));
    disc.scale.set(radius, 1, radius);
    disc.position.set(x, y, z);
    disc.receiveShadow = true;
    isl.stageGroup.add(disc);
    if (item.state === 'done' || item.state === 'current') {
      const sprite = glowSprite(item.state === 'done' ? WORLD_COLORS.gold : WORLD_COLORS.cyan, item.state === 'current' ? 1.6 : 0.9, item.state === 'current' ? 0.75 : 0.45);
      sprite.position.set(x, y + 0.2, z);
      isl.stageGroup.add(sprite);
      if (item.state === 'current') isl.pulses.push({ target: sprite.material, key: 'opacity', base: 0.65, amp: 0.25, speed: 3, phase: i, stage: true });
    }
    if (item.state === 'current') {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.16, 1.7, 8, 1, true), glowMat(WORLD_COLORS.cyan, 0.3));
      beam.position.set(x, y + 0.9, z);
      isl.stageGroup.add(beam);
    }
    const key = item.lecture ? item.lecture.id : 'stage:' + (win.start + i);
    isl.markers.push({ key, state: item.state, pos: new THREE.Vector3(x, y + 0.3, z) });
  });
  model.gates.forEach((gate) => {
    const localA = gate.afterStage - win.start;
    if (localA < 0 || localA >= n) return;
    const a1 = angles[localA];
    const a2 = localA + 1 < n ? angles[localA + 1] : a1 + step;
    const psi = (a1 + a2) / 2;
    const r = pathR + 0.3;
    const x = Math.sin(psi) * r;
    const z = Math.cos(psi) * r;
    const y = isl.surfaceY(x, z);
    const holder = new THREE.Group();
    holder.position.set(x, y + 0.85, z);
    holder.rotation.y = psi;
    const frame = torus(0.62, 0.08, stdMat(gate.open ? WORLD_COLORS.gold : 0x5a3f9a, { emissive: gate.open ? WORLD_COLORS.gold : 0x3b1f7a, emissiveIntensity: gate.open ? 0.9 : 0.4, roughness: 0.3 }), 32);
    frame.castShadow = true;
    holder.add(frame);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.56, 28), gate.open ? glowMat(WORLD_COLORS.cyan, 0.5) : new THREE.MeshBasicMaterial({ color: 0x120c30, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    holder.add(inner);
    if (gate.open) {
      const halo = glowSprite(WORLD_COLORS.gold, 2.2, 0.5);
      holder.add(halo);
      isl.pulses.push({ target: halo.material, key: 'opacity', base: 0.45, amp: 0.2, speed: 2.4, phase: gate.index, stage: true });
    } else {
      const seal = ball(0.1, glowMat(0xa78bfa, 0.9), 8);
      holder.add(seal);
      isl.pulses.push({ target: seal.material, key: 'opacity', base: 0.8, amp: 0.2, speed: 2.8, phase: gate.index, stage: true });
    }
    isl.stageGroup.add(holder);
    isl.gates.push({ key: gate.key, open: gate.open, pos: new THREE.Vector3(x, y + 0.85, z) });
  });
}

function createSubjectIsland(snap, demo) {
  const isl = createIslandBase({ radius: ISLAND_RADIUS, color: snap.color, seed: demo ? 'demo-' + snap.motif : snap.id, kind: demo ? 'demo' : 'subject', id: snap.id });
  const q = world.quality;
  const kind = MOTIF_LANDMARK[snap.motif] || 'crystals';
  addTrees(isl, q.trees, kind === 'grove');
  addRocksAndCrystals(isl, 6, 7);
  addWaterfall(isl, 9 + ISLAND_RADIUS);
  buildLandmark(isl, kind, 1);
  addSelectionRing(isl);
  rebuildIslandStages(isl, snap.model);
  if (!demo) {
    addProxy(isl, { type: 'island', id: snap.id }, ISLAND_RADIUS * 1.1, 3.8, ISLAND_RADIUS * 1.1, 1.8);
    isl.label = createLabelSprite(islandLabelData(snap), 2.3);
    isl.label.position.set(0, 9.4, 0);
    isl.group.add(isl.label);
  }
  isl.snap = snap;
  isl.sig = snap.sig;
  isl.markerStates = {};
  isl.markers.forEach((m) => {
    isl.markerStates[m.key] = m.state;
  });
  isl.gates.forEach((g) => {
    isl.gateStates[g.key] = g.open;
  });
  return isl;
}

function islandLabelData(snap) {
  return {
    title: snap.name,
    subtitle: snap.backlog > 0 ? 'متراكم ' + snap.backlog + ' · ' + snap.model.doneCount + ' من ' + snap.model.total : snap.model.total ? snap.model.doneCount + ' من ' + snap.model.total + ' محاضرة' : 'أضف محاضراتك',
    color: snap.color,
    ratio: snap.progress / 100,
    centerText: Math.round(snap.progress) + '%'
  };
}

function createHubIsland() {
  const isl = createIslandBase({ radius: HUB_RADIUS, color: '#8b5cf6', seed: 'hub', kind: 'hub', bobAmp: 0.12 });
  addTrees(isl, 7, true);
  addRocksAndCrystals(isl, 5, 10);
  addWaterfall(isl, 14);
  buildCastle(isl, 1.45);
  const lampMat = glowMat(WORLD_COLORS.warm, 1);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    if (angularGap(a, isl.waterAngle) < 0.4) continue;
    const x = Math.sin(a) * HUB_RADIUS * 0.82;
    const z = Math.cos(a) * HUB_RADIUS * 0.82;
    const y = isl.surfaceY(x, z);
    isl.group.add(place(cyl(0.04, 0.05, 0.9, 6, stdMat(WORLD_COLORS.stone)), x, y + 0.45, z));
    isl.group.add(place(ball(0.11, lampMat, 8), x, y + 0.95, z));
    const halo = glowSprite(WORLD_COLORS.warm, 1.1, 0.5);
    halo.position.set(x, y + 0.95, z);
    isl.group.add(halo);
  }
  addProxy(isl, { type: 'hub' }, HUB_RADIUS * 1.05, 3, HUB_RADIUS * 1.05, 1.8);
  isl.label = createLabelSprite({ title: 'مملكتك', subtitle: '', color: '#fbbf24', ratio: 0, centerText: '1' }, 2.6);
  isl.label.position.set(0, 12.2, 0);
  isl.group.add(isl.label);
  isl.label.visible = false;
  isl.spawn = 1;
  return isl;
}

function createDecorIsland(index) {
  const rng = mulberry32(hashString('decor' + index));
  const palette = ['#8b5cf6', '#38bdf8', '#2dd4bf', '#a78bfa', '#60a5fa', '#34d399'];
  const radius = 2.2 + rng() * 1.8;
  const isl = createIslandBase({ radius, color: palette[index % palette.length], seed: 'decor' + index, kind: 'decor', bobAmp: 0.35 });
  addTrees(isl, 3 + Math.floor(rng() * 3), index % 2 === 0);
  if (index % 3 !== 2) addWaterfall(isl, 8 + radius * 2);
  const kinds = ['tower', 'castle', 'crystals', 'dome', 'temple', 'grove'];
  buildLandmark(isl, kinds[index % kinds.length], 0.45 + radius * 0.1);
  const ang = rng() * Math.PI * 2;
  const dist = 72 + rng() * 60;
  isl.home.set(Math.sin(ang) * dist, -12 + rng() * 40, Math.cos(ang) * dist);
  isl.target.copy(isl.home);
  isl.spawn = 1;
  return isl;
}

function computeRings(total) {
  const rings = [];
  let remaining = total;
  let ring = 0;
  while (remaining > 0) {
    const cap = RING_CAPACITY[Math.min(ring, RING_CAPACITY.length - 1)];
    const n = Math.min(cap, remaining);
    rings.push(n);
    remaining -= n;
    ring += 1;
  }
  return rings;
}

function slotPosition(index, total) {
  const rings = computeRings(total);
  let ring = 0;
  let rem = index;
  while (ring < rings.length - 1 && rem >= rings[ring]) {
    rem -= rings[ring];
    ring += 1;
  }
  const n = rings[ring];
  const radius = RING_RADII[Math.min(ring, RING_RADII.length - 1)] + Math.max(0, ring - (RING_RADII.length - 1)) * 14;
  const angle = (rem / n) * Math.PI * 2 + 0.5 + ring * 0.55;
  const y = Math.sin(index * 1.7) * 1.8 + ring * 1.4;
  return new THREE.Vector3(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
}

function clearBridges() {
  const b = world.bridges;
  while (b.group.children.length) {
    const child = b.group.children[0];
    b.group.remove(child);
    disposeObject(child);
  }
  b.items = [];
  b.points = null;
  b.sig = '';
}

function rebuildBridges(entries) {
  clearBridges();
  const b = world.bridges;
  const hubPos = new THREE.Vector3(0, 0, 0);
  const links = [];
  entries.forEach((e) => {
    links.push({ a: hubPos, ar: HUB_RADIUS * 0.9, b: e.pos, br: ISLAND_RADIUS * 0.9, strength: 1 });
  });
  for (let i = 0; i < entries.length - 1; i += 1) {
    if (entries[i].ring === entries[i + 1].ring && entries[i].pos.distanceTo(entries[i + 1].pos) < 30) {
      links.push({ a: entries[i].pos, ar: ISLAND_RADIUS * 0.9, b: entries[i + 1].pos, br: ISLAND_RADIUS * 0.9, strength: 0.5 });
    }
  }
  const sampled = [];
  links.forEach((link) => {
    const dir = link.b.clone().sub(link.a);
    dir.y = 0;
    const len = dir.length();
    if (len < 0.1) return;
    dir.normalize();
    const start = link.a.clone().add(dir.clone().multiplyScalar(link.ar));
    const end = link.b.clone().sub(dir.clone().multiplyScalar(link.br));
    start.y = link.a.y + 0.2;
    end.y = link.b.y + 0.2;
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 1.2 + start.distanceTo(end) * 0.05;
    const curve = new THREE.CatmullRomCurve3([start, start.clone().lerp(end, 0.25).add(new THREE.Vector3(0, 0.5, 0)), mid, start.clone().lerp(end, 0.75).add(new THREE.Vector3(0, 0.5, 0)), end]);
    b.group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.07, 6, false), glowMat(WORLD_COLORS.cyan, 0.5 * link.strength)));
    sampled.push({ pts: curve.getPoints(48), speed: 0.12 + Math.random() * 0.08 });
  });
  if (!sampled.length) return;
  const perBridge = 8;
  const arr = new Float32Array(sampled.length * perBridge * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: getGlowTexture(), color: 0x9be7ff, size: 0.9, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false }));
  pts.frustumCulled = false;
  b.group.add(pts);
  b.points = pts;
  b.items = sampled.map((s) => Object.assign(s, { perBridge }));
}

function updateBridgeMotes(t) {
  const b = world.bridges;
  if (!b.points) return;
  const attr = b.points.geometry.attributes.position;
  let k = 0;
  b.items.forEach((item) => {
    for (let i = 0; i < item.perBridge; i += 1) {
      const u = (i / item.perBridge + t * item.speed) % 1;
      const idx = Math.min(item.pts.length - 1, Math.floor(u * (item.pts.length - 1)));
      const p = item.pts[idx];
      attr.setXYZ(k, p.x, p.y + 0.15, p.z);
      k += 1;
    }
  });
  attr.needsUpdate = true;
}

function newPetModel() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  return {
    root,
    body,
    head: null,
    wings: [],
    chains: [],
    legs: [],
    orbiters: [],
    spinners: [],
    pulses: [],
    floaters: [],
    ears: [],
    emitters: [],
    height: 3,
    stageScale: 1,
    floating: false,
    center: new THREE.Vector3(0, 1, 0),
    anchors: { head: new THREE.Vector3(0, 2.4, 0), chest: new THREE.Vector3(0, 1, 0.6), back: new THREE.Vector3(0, 1.4, -0.4) },
    trailColor: null,
    trailKind: '',
    anim: { mode: 'idle', timer: 0, walk: 0 },
    cues: [],
    species: '',
    stage: 0
  };
}

function addChain(m, parent, count, o) {
  let holder = parent;
  const chain = [];
  for (let i = 0; i < count; i += 1) {
    const g = new THREE.Group();
    g.position.set(0, 0, i === 0 ? 0 : -o.len);
    g.rotation.x = o.curl;
    holder.add(g);
    const k = i / Math.max(1, count - 1);
    const r = o.r0 + (o.r1 - o.r0) * k;
    const mat = o.matFn ? o.matFn(i, k) : o.mat;
    const seg = ellipsoid(r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1.15), mat, 14);
    seg.position.z = -o.len * 0.5;
    g.add(seg);
    chain.push({ g, amp: o.amp * (0.6 + k * 0.8), speed: o.speed, phase: i * 0.55 + (o.phase || 0) });
    holder = g;
  }
  m.chains.push(chain);
  return chain;
}

function addOrbiter(m, obj, r, speed, phase, y, bob) {
  m.root.add(obj);
  m.orbiters.push({ obj, r, speed, phase, y, bob: bob || 0.2 });
}

function wingGeometry(w, h) {
  return sharedGeo('wing:' + w.toFixed(2) + ':' + h.toFixed(2), () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(w * 0.45, h * 0.62);
    s.lineTo(w, h * 0.38);
    s.lineTo(w * 0.8, h * 0.02);
    s.lineTo(w * 0.92, -h * 0.32);
    s.lineTo(w * 0.55, -h * 0.16);
    s.lineTo(w * 0.3, -h * 0.5);
    s.lineTo(0, -h * 0.14);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  });
}

function pulseEntry(m, target, key, base, amp, speed, phase) {
  m.pulses.push({ target, key, base, amp, speed, phase: phase || 0 });
}

function buildDragon(st) {
  const m = newPetModel();
  const b = m.body;
  const pal = [0xe85d4f, 0xee6a45, 0xf47a3d, 0xf99042, 0xffb347][st];
  const bellyC = [0xffd9a8, 0xffdfae, 0xffe3b5, 0xffe9c0, 0xfff1cf][st];
  const bodyMat = stdMat(pal, { roughness: 0.5, emissive: pal, emissiveIntensity: 0.1 + st * 0.04 });
  const bellyMat = stdMat(bellyC, { roughness: 0.75 });
  const hornMat = stdMat(st >= 4 ? 0xffd36b : 0xf5e6c8, { roughness: 0.4, emissive: st >= 4 ? 0xffa500 : 0x000000, emissiveIntensity: st >= 4 ? 0.55 : 0 });
  const darkMat = stdMat(0x2b1220, { roughness: 0.4 });
  m.stageScale = [0.55, 0.72, 0.92, 1.12, 1.36][st];
  m.height = 2.55 + st * 0.1;
  m.center.set(0, 1.1, 0);
  m.anchors.head.set(0, 2.5 + st * 0.04, 0.78);
  m.anchors.chest.set(0, 0.95, 1.0);
  m.anchors.back.set(0, 1.5, -0.3);
  b.add(place(ellipsoid(0.85, 0.78, 1.05, bodyMat, 22), 0, 0.95, 0));
  b.add(place(ellipsoid(0.62, 0.56, 0.82, bellyMat, 16), 0, 0.8, 0.3));
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0.78);
  b.add(head);
  m.head = head;
  head.add(ellipsoid(0.62, 0.55, 0.6, bodyMat, 20));
  head.add(place(ellipsoid(0.34, 0.25, 0.42, bodyMat, 14), 0, -0.14, 0.5));
  [-1, 1].forEach((s) => {
    head.add(place(ball(0.045, darkMat, 8), s * 0.12, -0.08, 0.88));
    head.add(place(ball(0.15, stdMat(0xffffff, { roughness: 0.2 }), 12), s * 0.29, 0.12, 0.4));
    head.add(place(ellipsoid(0.05, 0.1, 0.05, darkMat, 8), s * 0.31, 0.12, 0.53));
    head.add(place(ball(0.025, glowMat(0xffffff, 1), 6), s * 0.33, 0.17, 0.56));
    const horn = cone(0.1 + st * 0.012, 0.36 + st * 0.12, 8, hornMat);
    horn.position.set(s * 0.3, 0.56, -0.08);
    horn.rotation.set(-0.5, 0, -s * 0.35);
    head.add(horn);
    if (st >= 4) {
      const horn2 = cone(0.07, 0.4, 8, hornMat);
      horn2.position.set(s * 0.5, 0.35, -0.15);
      horn2.rotation.set(-0.3, 0, -s * 0.9);
      head.add(horn2);
    }
  });
  const spikes = [0, 3, 4, 6, 7][st];
  for (let i = 0; i < spikes; i += 1) {
    const z = 0.62 - i * (1.2 / Math.max(1, spikes));
    const y = 0.95 + 0.78 * Math.sqrt(Math.max(0, 1 - Math.pow(z / 1.05, 2)));
    const sp = cone(0.08 + st * 0.018, 0.2 + st * 0.07, 6, st >= 3 ? hornMat : bodyMat);
    sp.position.set(0, y + 0.06, z);
    sp.rotation.x = -0.35;
    b.add(sp);
  }
  const wingSize = [0, 0.55, 0.95, 1.35, 1.8][st];
  [-1, 1].forEach((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.6, 1.42, -0.1);
    pivot.scale.x = s;
    b.add(pivot);
    if (st === 0) {
      const bud = cone(0.1, 0.32, 6, bodyMat);
      bud.rotation.z = -0.9;
      bud.position.set(0.12, 0.08, 0);
      pivot.add(bud);
    } else {
      const membrane = new THREE.Mesh(wingGeometry(wingSize, wingSize * 0.9), new THREE.MeshStandardMaterial({ color: st >= 4 ? 0xff8a3d : 0xb83a52, emissive: st >= 4 ? 0xff6a00 : 0x5a1020, emissiveIntensity: st >= 4 ? 0.5 : 0.25, roughness: 0.6, side: THREE.DoubleSide }));
      membrane.rotation.y = -0.35;
      membrane.castShadow = true;
      pivot.add(membrane);
      if (st >= 3) {
        const tipGlow = glowSprite(0xffa94d, 0.7, 0.7);
        tipGlow.position.set(wingSize * 0.95, wingSize * 0.35, 0.1);
        pivot.add(tipGlow);
        m.emitters.push({ obj: tipGlow, color: 0xffa94d, rate: 5, size: 0.12, speed: 0.5 });
      }
    }
    m.wings.push({ pivot, side: s, base: 0.35, amp: st === 0 ? 0.05 : 0.18, speed: 2.2 + st * 0.1, phase: 0 });
  });
  const tailAnchor = new THREE.Group();
  tailAnchor.position.set(0, 0.85, -0.85);
  b.add(tailAnchor);
  const chain = addChain(m, tailAnchor, st >= 2 ? 6 : 5, { len: 0.5, r0: 0.38, r1: 0.1, mat: bodyMat, curl: 0.12, amp: 0.22, speed: 1.6 });
  const last = chain[chain.length - 1].g;
  if (st >= 3) {
    const flame = glowSprite(0xff8a3d, 0.9 + st * 0.2, 0.9);
    flame.position.z = -0.5;
    last.add(flame);
    m.emitters.push({ obj: flame, color: 0xffa94d, rate: 14 + st * 4, size: 0.18, speed: 0.6 });
    pulseEntry(m, flame.material, 'opacity', 0.85, 0.15, 7, 0);
  } else {
    const tip = cone(0.12, 0.3, 6, hornMat);
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.55;
    last.add(tip);
  }
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach((p, i) => {
    const leg = new THREE.Group();
    leg.position.set(p[0] * 0.5, 0.62, p[1] * 0.55);
    b.add(leg);
    leg.add(place(cyl(0.15, 0.13, 0.5, 8, bodyMat), 0, -0.24, 0));
    leg.add(place(ellipsoid(0.17, 0.1, 0.24, bellyMat, 10), 0, -0.52, 0.06));
    m.legs.push({ g: leg, phase: i === 0 || i === 3 ? 0 : Math.PI });
  });
  if (st >= 3) {
    for (let i = -2; i <= 2; i += 1) {
      const fin = cone(0.08, 0.5 + st * 0.05, 5, glowMat(0xffc15a, 0.7));
      fin.position.set(i * 0.2, 0.42, -0.4);
      fin.rotation.set(-0.7, 0, i * 0.3);
      head.add(fin);
    }
  }
  if (st >= 4) {
    const ring = torus(1.7, 0.035, glowMat(0xffd36b, 0.55), 48);
    ring.position.y = 1.2;
    ring.rotation.x = Math.PI / 2.4;
    b.add(ring);
    m.spinners.push({ obj: ring, ax: 0, ay: 0.6, az: 0.2 });
    for (let i = 0; i < 3; i += 1) addOrbiter(m, ball(0.1, glowMat(0xffd36b, 1), 8), 1.6, 0.9, i * 2.1, 1.3, 0.3);
  }
  return m;
}

function buildOwl(st) {
  const m = newPetModel();
  const b = m.body;
  const pal = [0x6a64c8, 0x625bc0, 0x5750b6, 0x4c45aa, 0x40399c][st];
  const gold = 0xfde68a;
  const irisC = st >= 4 ? 0x7dd3fc : 0xfbbf24;
  const bodyMat = stdMat(pal, { roughness: 0.8, emissive: pal, emissiveIntensity: 0.06 });
  const chestMat = stdMat(0xe8e4ff, { roughness: 0.9 });
  const whiteMat = stdMat(0xffffff, { roughness: 0.3 });
  const darkMat = stdMat(0x120d30, { roughness: 0.4 });
  const irisMat = stdMat(irisC, { emissive: irisC, emissiveIntensity: 0.8, roughness: 0.3 });
  m.stageScale = [0.55, 0.72, 0.9, 1.1, 1.32][st];
  m.height = 2.9 + st * 0.05;
  m.center.set(0, 1.3, 0);
  m.anchors.head.set(0, 3.0, 0.05);
  m.anchors.chest.set(0, 1.1, 0.88);
  m.anchors.back.set(0, 1.6, -0.5);
  b.add(place(ellipsoid(0.9, 1.05, 0.85, bodyMat, 22), 0, 1.05, 0));
  b.add(place(ellipsoid(0.62, 0.8, 0.45, chestMat, 16), 0, 0.98, 0.5));
  const head = new THREE.Group();
  head.position.set(0, 2.05, 0.05);
  b.add(head);
  m.head = head;
  head.add(ellipsoid(1.0, 0.8, 0.85, bodyMat, 22));
  [-1, 1].forEach((s) => {
    head.add(place(ellipsoid(0.46, 0.46, 0.12, chestMat, 14), s * 0.42, 0.02, 0.7));
    head.add(place(ellipsoid(0.27, 0.27, 0.16, whiteMat, 14), s * 0.42, 0.03, 0.78));
    head.add(place(ellipsoid(0.17, 0.17, 0.1, irisMat, 12), s * 0.42, 0.03, 0.9));
    head.add(place(ball(0.085, darkMat, 8), s * 0.42, 0.03, 0.96));
    head.add(place(ball(0.03, glowMat(0xffffff, 1), 6), s * 0.46, 0.09, 0.99));
    const tuftLen = 0.4 + st * 0.09;
    const tuft = cone(0.13, tuftLen, 6, bodyMat);
    tuft.position.set(s * 0.62, 0.7, 0);
    tuft.rotation.z = -s * 0.35;
    head.add(tuft);
    m.ears.push({ g: tuft, base: -s * 0.35, amp: 0.05, phase: s });
    if (st >= 3) {
      const tipGlow = ball(0.06, glowMat(gold, 0.95), 6);
      tipGlow.position.set(0, tuftLen / 2, 0);
      tuft.add(tipGlow);
    }
  });
  const beak = cone(0.12, 0.3, 6, stdMat(0xffc857, { roughness: 0.4 }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.16, 0.96);
  head.add(beak);
  [-1, 1].forEach((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.88, 1.35, -0.05);
    b.add(pivot);
    const wing = ellipsoid(0.17, 0.78, 0.52, bodyMat, 14);
    wing.position.set(s * 0.05, -0.55, 0);
    wing.rotation.z = s * 0.12;
    pivot.add(wing);
    if (st >= 2) {
      for (let k = 0; k < 2; k += 1) {
        const feather = ellipsoid(0.12, 0.5 - k * 0.1, 0.4, stdMat(st >= 4 ? 0x5b4fd0 : pal, { roughness: 0.8, emissive: st >= 4 ? 0x3b2fa0 : 0x000000, emissiveIntensity: st >= 4 ? 0.4 : 0 }), 12);
        feather.position.set(s * (0.1 + k * 0.1), -0.85 - k * 0.15, -0.05 - k * 0.05);
        feather.rotation.z = s * (0.2 + k * 0.1);
        pivot.add(feather);
      }
    }
    m.wings.push({ pivot, side: s, base: 0.05, amp: 0.1, speed: 2.4, phase: 0 });
  });
  const tail = ellipsoid(0.4, 0.14, 0.6, bodyMat, 12);
  tail.position.set(0, 0.4, -0.8);
  tail.rotation.x = 0.5;
  b.add(tail);
  [-1, 1].forEach((s, i) => {
    const foot = new THREE.Group();
    foot.position.set(s * 0.35, 0.18, 0.5);
    b.add(foot);
    for (let k = -1; k <= 1; k += 1) {
      const talon = cone(0.05, 0.28, 5, stdMat(0xffc857, { roughness: 0.4 }));
      talon.rotation.x = Math.PI / 2 + 0.2;
      talon.position.set(k * 0.1, -0.08, 0.14);
      foot.add(talon);
    }
    m.legs.push({ g: foot, phase: i === 0 ? 0 : Math.PI });
  });
  const stars = st > 0 ? 2 + st * 2 : 0;
  for (let i = 0; i < stars; i += 1) {
    const ix = (i % 4) - 1.5;
    const iy = Math.floor(i / 4);
    const star = ball(0.035, glowMat(gold, 1), 6);
    star.position.set(ix * 0.18, 0.62 + iy * 0.2, 0.92 - Math.abs(ix) * 0.04);
    b.add(star);
    pulseEntry(m, star.material, 'opacity', 0.75, 0.25, 2 + (i % 3), i);
  }
  if (st >= 3) {
    const halo = torus(0.82, 0.045, glowMat(gold, 0.9), 40);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 3.0, 0.05);
    b.add(halo);
    m.floaters.push({ obj: halo, baseY: 3.0, amp: 0.06, speed: 2, phase: 0 });
  }
  if (st >= 4) {
    for (let i = 0; i < 5; i += 1) {
      const star = new THREE.Mesh(sharedGeo('octa-star', () => new THREE.OctahedronGeometry(0.1, 0)), glowMat(gold, 1));
      addOrbiter(m, star, 1.7, 0.7, i * 1.26, 1.5 + (i % 2) * 0.5, 0.3);
    }
  }
  return m;
}

function buildFox(st) {
  const m = newPetModel();
  const b = m.body;
  const pal = [0xa3a8ee, 0x9ba2ec, 0x929bec, 0x8793ee, 0x7b8cf4][st];
  const glowC = 0x67e8f9;
  const bodyMat = stdMat(pal, { roughness: 0.85, emissive: pal, emissiveIntensity: 0.05 });
  const bellyMat = stdMat(0xf4f6ff, { roughness: 0.9 });
  const sockMat = stdMat(0x2f3370, { roughness: 0.7 });
  const darkMat = stdMat(0x120d30, { roughness: 0.4 });
  m.stageScale = [0.55, 0.74, 0.95, 1.15, 1.38][st];
  m.height = 2.4 + st * 0.05;
  m.center.set(0, 1.0, 0);
  m.anchors.head.set(0, 2.45 + st * 0.05, 1.0);
  m.anchors.chest.set(0, 0.9, 1.2);
  m.anchors.back.set(0, 1.4, -0.4);
  b.add(place(ellipsoid(0.7, 0.62, 1.15, bodyMat, 22), 0, 0.95, 0));
  b.add(place(ellipsoid(0.45, 0.42, 0.4, bellyMat, 14), 0, 0.88, 0.85));
  const head = new THREE.Group();
  head.position.set(0, 1.38, 1.0);
  b.add(head);
  m.head = head;
  head.add(ellipsoid(0.58, 0.5, 0.55, bodyMat, 20));
  const snout = cone(0.24, 0.7, 10, bodyMat);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.12, 0.58);
  head.add(snout);
  head.add(place(ball(0.085, darkMat, 8), 0, -0.12, 0.94));
  [-1, 1].forEach((s) => {
    const earLen = 0.7 + st * 0.08;
    const ear = cone(0.2, earLen, 8, bodyMat);
    ear.position.set(s * 0.3, 0.52 + earLen * 0.2, -0.08);
    ear.rotation.z = -s * 0.18;
    head.add(ear);
    m.ears.push({ g: ear, base: -s * 0.18, amp: 0.06, phase: s * 1.3 });
    if (st >= 1) {
      const inner = cone(0.11, earLen * 0.7, 6, glowMat(glowC, 0.55));
      inner.position.set(0, -earLen * 0.08, 0.1);
      ear.add(inner);
    }
    const cheek = cone(0.18, 0.4, 6, bellyMat);
    cheek.rotation.z = -s * Math.PI / 2;
    cheek.position.set(s * 0.45, -0.15, 0.15);
    head.add(cheek);
    head.add(place(ellipsoid(0.075, 0.115, 0.05, darkMat, 10), s * 0.23, 0.1, 0.46));
    head.add(place(ball(0.022, glowMat(glowC, 1), 6), s * 0.24, 0.15, 0.5));
  });
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach((p, i) => {
    const leg = new THREE.Group();
    leg.position.set(p[0] * 0.38, 0.65, p[1] * 0.72);
    b.add(leg);
    leg.add(place(cyl(0.1, 0.1, 0.62, 8, sockMat), 0, -0.3, 0));
    leg.add(place(ball(0.13, sockMat, 8), 0, -0.62, 0.04));
    m.legs.push({ g: leg, phase: i === 0 || i === 3 ? 0 : Math.PI });
  });
  const tails = [1, 1, 1, 2, 3][st];
  for (let i = 0; i < tails; i += 1) {
    const anchor = new THREE.Group();
    anchor.position.set(0, 0.95, -1.0);
    anchor.rotation.y = (i - (tails - 1) / 2) * 0.6;
    b.add(anchor);
    const count = 5;
    const chain = addChain(m, anchor, count, {
      len: 0.42,
      r0: 0.3,
      r1: 0.22,
      sx: 1.1,
      sy: 1.1,
      sz: 1.2,
      matFn: (idx) => (idx >= count - 2 ? bellyMat : bodyMat),
      curl: 0.3,
      amp: 0.2,
      speed: 1.4,
      phase: i * 1.2
    });
    if (st >= 3) {
      const spirit = glowSprite(glowC, 1.0, 0.75);
      spirit.position.z = -0.45;
      chain[chain.length - 1].g.add(spirit);
      pulseEntry(m, spirit.material, 'opacity', 0.65, 0.2, 3, i);
    }
  }
  if (st >= 2) {
    for (let i = 0; i < st + 1; i += 1) {
      const wisp = ball(0.28 + i * 0.05, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false }), 10);
      addOrbiter(m, wisp, 1.1 + i * 0.12, 0.4 + i * 0.1, i * 1.7, 0.3, 0.12);
    }
  }
  if (st >= 3) {
    for (let i = -1; i <= 1; i += 1) {
      const mark = box(0.05, 0.22, 0.02, glowMat(glowC, 0.9));
      mark.castShadow = false;
      mark.position.set(i * 0.12, 0.34, 0.47);
      mark.rotation.z = -i * 0.25;
      head.add(mark);
    }
  }
  if (st >= 4) {
    for (let i = 0; i < 3; i += 1) {
      const flame = cone(0.1, 0.35, 6, glowMat(glowC, 0.85));
      flame.rotation.x = Math.PI;
      addOrbiter(m, flame, 1.4, 0.8, i * 2.1, 2.1, 0.25);
      m.emitters.push({ obj: flame, color: glowC, rate: 6, size: 0.1, speed: 0.3 });
    }
  }
  return m;
}

function buildWisp(st) {
  const m = newPetModel();
  const b = m.body;
  m.floating = true;
  const coreC = [0x7ee0d0, 0x6fd8e0, 0x7fc4f5, 0x9aa8ff, 0xc4a3ff][st];
  const second = 0xa78bfa;
  m.stageScale = [0.55, 0.72, 0.9, 1.1, 1.34][st];
  m.height = 3.0;
  m.center.set(0, 1.3, 0);
  m.anchors.head.set(0, 2.3, 0);
  m.anchors.chest.set(0, 1.3, 0.7);
  m.anchors.back.set(0, 1.4, -0.5);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 2), stdMat(0xffffff, { emissive: coreC, emissiveIntensity: 0.9, roughness: 0.3 }));
  core.position.set(0, 1.3, 0);
  b.add(core);
  m.head = core;
  const halo = glowSprite(coreC, 3.2 + st * 0.3, 0.55);
  halo.position.set(0, 1.3, 0);
  b.add(halo);
  pulseEntry(m, halo.material, 'opacity', 0.5, 0.15, 2.2, 0);
  const inner = glowSprite(0xffffff, 1.3, 0.6);
  inner.position.set(0, 1.3, 0);
  b.add(inner);
  const darkMat = stdMat(0x120d30, { roughness: 0.4 });
  [-1, 1].forEach((s) => {
    b.add(place(ellipsoid(0.09, 0.13, 0.05, darkMat, 10), s * 0.2, 1.36, 0.56));
    b.add(place(ball(0.025, glowMat(0xffffff, 1), 6), s * 0.21, 1.41, 0.6));
  });
  const rings = 1 + (st >= 1 ? 1 : 0) + (st >= 3 ? 1 : 0);
  for (let i = 0; i < rings; i += 1) {
    const ring = torus(0.95 + i * 0.22, 0.03, glowMat(i % 2 ? second : coreC, 0.75), 48);
    ring.position.set(0, 1.3, 0);
    ring.rotation.set(i * 1.1, i * 0.7, 0);
    b.add(ring);
    m.spinners.push({ obj: ring, ax: 0.3 + i * 0.2, ay: 0.5 - i * 0.15, az: 0.2 });
  }
  for (let i = 0; i < st * 2; i += 1) {
    const shard = new THREE.Mesh(sharedGeo('octa-shard', () => new THREE.OctahedronGeometry(0.1, 0)), glowMat(i % 2 ? second : coreC, 0.95));
    addOrbiter(m, shard, 1.4 + (i % 3) * 0.2, 0.6 + (i % 4) * 0.12, i * 0.9, 1.3, 0.4);
  }
  const tailAnchor = new THREE.Group();
  tailAnchor.position.set(0, 1.1, -0.4);
  b.add(tailAnchor);
  addChain(m, tailAnchor, 7 + st, {
    len: 0.3,
    r0: 0.3,
    r1: 0.06,
    sy: 0.8,
    matFn: (i, k) => glowMat(new THREE.Color(coreC).lerp(new THREE.Color(second), k).getHex(), 0.7 - k * 0.35),
    curl: -0.08,
    amp: 0.35,
    speed: 1.8
  });
  if (st >= 3) {
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      const ray = cone(0.06, 0.45, 5, glowMat(0xffffff, 0.8));
      ray.position.set(Math.sin(a) * 0.35, 2.05, Math.cos(a) * 0.35);
      ray.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
      b.add(ray);
    }
  }
  if (st >= 4) {
    [-1, 1].forEach((s, i) => {
      const anchor = new THREE.Group();
      anchor.position.set(s * 0.5, 1.35, -0.2);
      anchor.rotation.y = s * 0.7;
      b.add(anchor);
      addChain(m, anchor, 10, {
        len: 0.35,
        r0: 0.2,
        r1: 0.05,
        sy: 0.7,
        matFn: (idx, k) => glowMat(new THREE.Color(0x5eead4).lerp(new THREE.Color(second), k).getHex(), 0.6 - k * 0.3),
        curl: 0.05,
        amp: 0.45,
        speed: 1.5,
        phase: i * 2
      });
    });
  }
  return m;
}

function applyPetCosmetics(m, ids) {
  ids.forEach((id) => {
    const item = COSMETICS.find((c) => c.id === id);
    if (!item) return;
    const color = item.color;
    if (item.slot === 'aura') {
      const aura = glowSprite(color, m.height * 1.6, 0.42);
      aura.position.copy(m.center);
      m.root.add(aura);
      pulseEntry(m, aura.material, 'opacity', 0.4, 0.14, 1.8, 0);
    } else if (item.slot === 'trail') {
      m.trailColor = color;
      m.trailKind = id.indexOf('embers') !== -1 ? 'embers' : 'stars';
    } else if (item.slot === 'crown') {
      const crown = new THREE.Group();
      crown.position.copy(m.anchors.head);
      crown.position.y += 0.15;
      const ring = torus(0.42, 0.045, glowMat(color, 0.95), 32);
      ring.rotation.x = Math.PI / 2;
      crown.add(ring);
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        const spike = cone(0.06, 0.26, 5, glowMat(color, 0.95));
        spike.position.set(Math.sin(a) * 0.42, 0.15, Math.cos(a) * 0.42);
        crown.add(spike);
      }
      const sprite = glowSprite(color, 1.4, 0.45);
      crown.add(sprite);
      m.body.add(crown);
      m.floaters.push({ obj: crown, baseY: crown.position.y, amp: 0.05, speed: 2, phase: 0 });
    } else if (item.slot === 'wings') {
      [-1, 1].forEach((s) => {
        const pivot = new THREE.Group();
        pivot.position.copy(m.anchors.back);
        pivot.scale.x = s;
        const size = m.height * 0.5;
        const mesh = new THREE.Mesh(wingGeometry(size, size * 0.9), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        mesh.rotation.y = -0.35;
        pivot.add(mesh);
        m.body.add(pivot);
        m.wings.push({ pivot, side: s, base: 0.4, amp: 0.2, speed: 2.1, phase: 0.8 });
      });
    } else if (item.slot === 'charm') {
      const charm = new THREE.Group();
      charm.position.copy(m.anchors.chest);
      charm.add(ball(0.1, glowMat(color, 1), 10));
      charm.add(glowSprite(color, 0.6, 0.6));
      m.body.add(charm);
      pulseEntry(m, charm.children[0].material, 'opacity', 0.85, 0.15, 3, 0);
    }
  });
}

function buildPetModel(species, stage, equipped) {
  const st = clamp(Math.round(stage), 0, 4);
  let m;
  if (species === 'owl') m = buildOwl(st);
  else if (species === 'fox') m = buildFox(st);
  else if (species === 'wisp') m = buildWisp(st);
  else m = buildDragon(st);
  m.species = species;
  m.stage = st;
  applyPetCosmetics(m, equipped || []);
  return m;
}

function playPetAnim(m, name) {
  if (name === 'jump') {
    m.anim.mode = 'jump';
    m.anim.timer = 0;
    m.cues.push('dust');
  } else if (name === 'cheer') {
    m.anim.mode = 'cheer';
    m.anim.timer = 0;
    m.cues.push('burst');
  } else if (name === 'walk') {
    m.anim.mode = 'walk';
    m.anim.timer = 0;
  } else {
    m.anim.mode = 'idle';
  }
}

function updatePetModel(m, t, dt) {
  const a = m.anim;
  const walkTarget = a.mode === 'walk' ? 1 : 0;
  a.walk += (walkTarget - a.walk) * Math.min(1, dt * 8);
  const walk = a.walk;
  let jumpY = 0;
  let spin = 0;
  let wingBoost = 0;
  if (a.mode === 'jump' || a.mode === 'cheer') {
    a.timer += dt;
    const dur = a.mode === 'jump' ? 0.75 : 2.1;
    const p = a.timer / dur;
    if (p >= 1) {
      a.mode = 'idle';
      a.timer = 0;
    } else if (a.mode === 'jump') {
      jumpY = Math.sin(p * Math.PI) * 1.25;
    } else {
      jumpY = Math.abs(Math.sin(p * Math.PI * 2)) * 1.0 * (1 - p * 0.3);
      spin = easeInOutCubic(Math.min(1, p * 1.3)) * Math.PI * 4;
      wingBoost = 1;
    }
  }
  const breathe = (Math.sin(t * 1.9) + 1) / 2;
  if (m.floating) m.body.position.y = Math.sin(t * 1.6) * 0.14 + jumpY;
  else m.body.position.y = Math.abs(Math.sin(t * 9)) * 0.07 * walk + jumpY;
  m.body.scale.set(1 - breathe * 0.01, 1 + breathe * 0.03, 1 - breathe * 0.01);
  m.body.rotation.y = spin;
  m.body.rotation.x = m.floating ? walk * 0.18 : 0;
  m.body.rotation.z = !m.floating && m.species === 'owl' ? Math.sin(t * 9) * 0.08 * walk : 0;
  m.wings.forEach((w) => {
    const flap = Math.sin(t * w.speed * (1 + walk * 1.2 + wingBoost * 2.2) + w.phase);
    w.pivot.rotation.z = w.side * (w.base + flap * w.amp * (1 + wingBoost * 2.5 + walk * 0.8));
  });
  m.chains.forEach((chain) => {
    chain.forEach((seg) => {
      seg.g.rotation.y = Math.sin(t * seg.speed + seg.phase) * seg.amp * (1 + walk * 0.6);
    });
  });
  m.legs.forEach((leg) => {
    leg.g.rotation.x = Math.sin(t * 9 + leg.phase) * 0.7 * walk;
  });
  m.orbiters.forEach((o) => {
    const ang = t * o.speed + o.phase;
    o.obj.position.set(Math.cos(ang) * o.r, o.y + Math.sin(ang * 1.7) * o.bob, Math.sin(ang) * o.r);
  });
  m.spinners.forEach((s) => {
    s.obj.rotation.x += s.ax * dt;
    s.obj.rotation.y += s.ay * dt;
    s.obj.rotation.z += s.az * dt;
  });
  m.pulses.forEach((p) => {
    p.target[p.key] = p.base + Math.sin(t * p.speed + p.phase) * p.amp;
  });
  m.floaters.forEach((f) => {
    f.obj.position.y = f.baseY + Math.sin(t * f.speed + f.phase) * f.amp;
  });
  m.ears.forEach((e) => {
    e.g.rotation.z = e.base + Math.sin(t * 1.3 + e.phase) * e.amp;
  });
  if (m.head && m.species !== 'wisp') {
    m.head.rotation.y = Math.sin(t * 0.7) * 0.18 * (1 - walk);
    m.head.rotation.x = Math.sin(t * 0.5) * 0.05;
  }
}

function emitPetParticles(fx, m, dt, tmp) {
  m.emitters.forEach((e) => {
    if (Math.random() < e.rate * dt) {
      e.obj.getWorldPosition(tmp);
      fx.emit(tmp.x, tmp.y, tmp.z, (Math.random() - 0.5) * e.speed, e.speed * (0.5 + Math.random()), (Math.random() - 0.5) * e.speed, e.color, e.size, 0.9, -0.2);
    }
  });
}

function cuesToFx(fx, m, tmp) {
  while (m.cues.length) {
    const cue = m.cues.shift();
    m.root.getWorldPosition(tmp);
    const s = m.root.scale.x;
    if (cue === 'burst') {
      fx.burst(tmp.x, tmp.y + m.height * s * 0.6, tmp.z, 0xfde68a, 26, 3.2 * s, 0.5 * s, 1.3, 2.2);
      fx.burst(tmp.x, tmp.y + m.height * s * 0.6, tmp.z, 0x8b5cf6, 14, 2.6 * s, 0.42 * s, 1.2, 1.8);
    } else if (cue === 'dust') {
      fx.burst(tmp.x, tmp.y + 0.1, tmp.z, 0xbfd4ff, 8, 1.4 * s, 0.3 * s, 0.7, 1);
    }
  }
}

function addPetLights(scene) {
  scene.add(new THREE.HemisphereLight(0xbfc8ff, 0x2a1a55, 0.95));
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(4, 7, 5);
  scene.add(key);
  const p1 = new THREE.PointLight(0x8b5cf6, 0.9, 18);
  p1.position.set(-4, 3, -3);
  scene.add(p1);
  const p2 = new THREE.PointLight(0x38bdf8, 0.7, 18);
  p2.position.set(4, 2, -4);
  scene.add(p2);
}

function createPetStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 2.9, 8.8);
  camera.lookAt(0, 1.55, 0);
  addPetLights(scene);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.22, 40), stdMat(0x1d1850, { emissive: 0x2a1f7a, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.3 }));
  platform.position.y = -0.11;
  scene.add(platform);
  const rim = torus(2.15, 0.05, glowMat(WORLD_COLORS.cyan, 0.9), 64);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.01;
  scene.add(rim);
  const under = glowSprite(0x8b5cf6, 7, 0.4);
  under.position.y = -0.2;
  scene.add(under);
  const fx = createFx(260);
  scene.add(fx.points);
  const tmp = new THREE.Vector3();
  const stage = { renderer, scene, camera, fx, model: null, species: '', stageIndex: -1, sig: '', yaw: 0, userYaw: 0, dragging: false, running: true, raf: 0, last: 0, time: 0, pop: 1, walkTimer: 0, observer: null, listeners: [] };

  stage.resize = () => {
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 320;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fx.setScale(pointScale(renderer, camera.fov));
  };

    stage.setPet = (species, stageIndex, equipped, pop) => {
    const sig = species + ':' + stageIndex + ':' + (equipped || []).join(',');
    if (sig === stage.sig && !pop) return;
    stage.sig = sig;
    if (stage.model) {
      scene.remove(stage.model.root);
      disposeObject(stage.model.root);
    }
    stage.model = buildPetModel(species, stageIndex, equipped);
    stage.species = species;
    stage.stageIndex = stageIndex;
    stage.model.root.scale.setScalar(0.01);
    scene.add(stage.model.root);
    stage.pop = 0;
  };

  stage.play = (name) => {
    if (!stage.model) return;
    playPetAnim(stage.model, name);
    if (name === 'walk') stage.walkTimer = 3;
  };

  const frame = (now) => {
    if (!stage.running) return;
    stage.raf = requestAnimationFrame(frame);
    if (document.hidden || !canvas.clientWidth) {
      stage.last = now;
      return;
    }
    const dt = Math.min(0.1, (now - (stage.last || now)) / 1000);
    stage.last = now;
    stage.time += dt;
    const m = stage.model;
    if (m) {
      if (stage.pop < 1) stage.pop = Math.min(1, stage.pop + dt / 0.7);
      m.root.scale.setScalar(Math.max(0.01, m.stageScale * easeOutBack(stage.pop)));
      if (m.anim.mode === 'walk') {
        stage.walkTimer -= dt;
        if (stage.walkTimer <= 0) m.anim.mode = 'idle';
        stage.yaw += dt * 1.1;
        if (m.trailColor && Math.random() < 0.5) {
          m.root.getWorldPosition(tmp);
          fx.emit(tmp.x + (Math.random() - 0.5) * 0.8, tmp.y + 0.15, tmp.z + (Math.random() - 0.5) * 0.8, 0, 0.5, 0, m.trailColor, 0.16, 0.8, -0.1);
        }
      } else if (!stage.dragging) {
        stage.yaw += dt * 0.28;
      }
      m.root.rotation.y = stage.yaw;
      updatePetModel(m, stage.time, dt);
      emitPetParticles(fx, m, dt, tmp);
      cuesToFx(fx, m, tmp);
    }
    fx.update(dt);
    rim.material.opacity = 0.7 + Math.sin(stage.time * 2) * 0.2;
    renderer.render(scene, camera);
  };

  const onDown = (e) => {
    stage.dragging = true;
    stage.dragX = e.clientX;
    stage.moved = false;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      stage.dragging = true;
    }
  };
  const onMove = (e) => {
    if (!stage.dragging) return;
    const dx = e.clientX - stage.dragX;
    stage.dragX = e.clientX;
    if (Math.abs(dx) > 1) stage.moved = true;
    stage.yaw += dx * 0.012;
  };
  const onUp = () => {
    if (stage.dragging && !stage.moved) stage.play('jump');
    stage.dragging = false;
  };
  const onCancel = () => {
    stage.dragging = false;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.style.touchAction = 'pan-y';
  stage.listeners = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onCancel]];

  if (window.ResizeObserver) {
    stage.observer = new ResizeObserver(() => stage.resize());
    stage.observer.observe(canvas);
  } else {
    window.addEventListener('resize', stage.resize);
  }

  stage.dispose = () => {
    stage.running = false;
    cancelAnimationFrame(stage.raf);
    stage.listeners.forEach((l) => canvas.removeEventListener(l[0], l[1]));
    if (stage.observer) stage.observer.disconnect();
    window.removeEventListener('resize', stage.resize);
    if (stage.model) {
      scene.remove(stage.model.root);
      disposeObject(stage.model.root);
    }
    disposeObject(platform);
    disposeObject(rim);
    disposeObject(under);
    fx.dispose();
    renderer.dispose();
  };

  stage.resize();
  stage.raf = requestAnimationFrame(frame);
  return stage;
}

function renderPetThumbnail(species, stage, equipped, size) {
  if (!webglSupported()) return '';
  const px = size || 192;
  const key = species + ':' + stage + ':' + (equipped || []).join(',') + ':' + px;
  if (world.thumbCache.has(key)) return world.thumbCache.get(key);
  if (!world.thumb) {
    const canvas = document.createElement('canvas');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) {
      return '';
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    addPetLights(scene);
    world.thumb = { renderer, scene, camera: new THREE.PerspectiveCamera(32, 1, 0.1, 100) };
  }
  const t = world.thumb;
  t.renderer.setPixelRatio(1);
  t.renderer.setSize(px, px, false);
  const m = buildPetModel(species, stage, equipped);
  m.root.scale.setScalar(m.stageScale);
  m.root.rotation.y = 0.5;
  t.scene.add(m.root);
  updatePetModel(m, 0.6, 0.016);
  const hs = m.height * m.stageScale;
  t.camera.position.set(hs * 0.3, hs * 0.62, hs * 2.4 + 1.2);
  t.camera.lookAt(0, hs * 0.5, 0);
  t.renderer.render(t.scene, t.camera);
  let url = '';
  try {
    url = t.renderer.domElement.toDataURL('image/png');
  } catch (e) {
    url = '';
  }
  t.scene.remove(m.root);
  disposeObject(m.root);
  if (url) world.thumbCache.set(key, url);
  return url;
}

function ensurePreviewStage(species) {
  if (!webglSupported()) return;
  const canvas = document.getElementById('petPreviewCanvas');
  if (!canvas) return;
  if (!world.previewStage) world.previewStage = createPetStage(canvas);
  world.previewStage.setPet(species, 0, [], true);
}

function disposePreviewStage() {
  if (world.previewStage) {
    world.previewStage.dispose();
    world.previewStage = null;
  }
}

function syncPetView(pop) {
  const stage = world.viewStage;
  if (!stage || !appState || !appState.pet) return;
  const info = petStageInfo(appState.progress.totalXp);
  stage.setPet(appState.pet.species, info.stage, appState.achievements.cosmetics.equipped.slice(), pop);
}

function mountPetView() {
  if (!webglSupported() || !appState || !appState.pet) return false;
  const canvas = document.getElementById('petViewCanvas');
  if (!canvas) return false;
  if (!world.viewStage) world.viewStage = createPetStage(canvas);
  else world.viewStage.resize();
  syncPetView(true);
  return true;
}

function unmountPetView() {
  if (world.viewStage) {
    world.viewStage.dispose();
    world.viewStage = null;
  }
}

function removeWorldPet() {
  const p = world.pet;
  if (!p) return;
  if (p.group.parent) p.group.parent.remove(p.group);
  disposeObject(p.group);
  world.pet = null;
  refreshPickables();
}

function ensureWorldPet(popIn) {
  if (!world.ready || !world.hubIsl) return;
  if (world.mode !== 'game' || !appState || !appState.pet) {
    removeWorldPet();
    return;
  }
  const info = petStageInfo(appState.progress.totalXp);
  const equipped = appState.achievements.cosmetics.equipped.slice();
  const sig = appState.pet.species + ':' + info.stage + ':' + equipped.join(',') + ':' + appState.pet.name;
  if (world.pet && world.pet.sig === sig) return;
  const keep = world.pet ? { x: world.pet.x, z: world.pet.z, yaw: world.pet.yaw } : null;
  removeWorldPet();
  const model = buildPetModel(appState.pet.species, info.stage, equipped);
  const scale = model.stageScale * WORLD_PET_SCALE;
  const noPop = popIn === false;
  model.root.scale.setScalar(noPop ? scale : 0.01);
  const group = new THREE.Group();
  group.add(model.root);
  world.hubIsl.group.add(group);
  const tag = createLabelSprite({ title: appState.pet.name, subtitle: info.name, color: '#fbbf24', ratio: info.ratio, centerText: String(info.stage + 1) }, 1.25);
  tag.position.y = model.height * scale + 1.3;
  group.add(tag);
  const proxy = new THREE.Mesh(unitSphere(8), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  proxy.scale.set(1.8 * model.stageScale * 1.4, 2.4 * model.stageScale * 1.4, 1.8 * model.stageScale * 1.4);
  proxy.position.y = 1.5 * model.stageScale * 1.4;
  proxy.userData.pick = { type: 'pet' };
  group.add(proxy);
  world.pet = {
    sig,
    group,
    model,
    tag,
    proxy,
    scale,
    x: keep ? keep.x : 1.2,
    z: keep ? keep.z : 4.8,
    yaw: keep ? keep.yaw : 0,
    yawTarget: 0,
    tx: 0,
    tz: 0,
    state: 'idle',
    timer: 1 + Math.random() * 2,
    spawn: noPop ? 1 : 0,
    noPop,
    trailT: 0
  };
  refreshPickables();
}

function updateWorldPet(dt) {
  const p = world.pet;
  if (!p || !world.hubIsl) return;
  const m = p.model;
  const hub = world.hubIsl;
  if (p.spawn < 1) p.spawn = Math.min(1, p.spawn + dt / 0.8);
  m.root.scale.setScalar(Math.max(0.01, p.scale * (p.noPop ? 1 : easeOutBack(p.spawn))));
  const busy = m.anim.mode === 'jump' || m.anim.mode === 'cheer';
  let walking = false;
  if (!busy) {
    if (p.state === 'idle') {
      if (m.anim.mode === 'walk') m.anim.mode = 'idle';
      p.timer -= dt;
      if (p.timer <= 0 && !deviceSettings.reduceMotion) {
        let ang = Math.random() * Math.PI * 2;
        if (angularGap(ang, hub.waterAngle) < 0.35) ang += 0.8;
        const r = 3.9 + Math.random() * 2.0;
        p.tx = Math.sin(ang) * r;
        p.tz = Math.cos(ang) * r;
        p.state = 'walk';
      }
    } else {
      m.anim.mode = 'walk';
      walking = true;
      const dx = p.tx - p.x;
      const dz = p.tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.12) {
        p.state = 'idle';
        p.timer = 2.5 + Math.random() * 4;
        m.anim.mode = 'idle';
        walking = false;
      } else {
        const step = Math.min(d, 1.6 * dt);
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        p.yawTarget = Math.atan2(dx, dz);
      }
    }
  }
  if (!walking) {
    const cx = world.camera.position.x - hub.group.position.x - p.x;
    const cz = world.camera.position.z - hub.group.position.z - p.z;
    p.yawTarget = Math.atan2(cx, cz);
  }
  p.yaw = angleLerp(p.yaw, p.yawTarget, 1 - Math.exp(-dt * 5));
  p.group.rotation.y = p.yaw;
  p.group.position.set(p.x, hub.surfaceY(p.x, p.z), p.z);
  updatePetModel(m, world.time, dt);
  const tmp = world.tmp.v1;
  emitPetParticles(world.fx, m, dt, tmp);
  cuesToFx(world.fx, m, tmp);
  if (m.trailColor && walking) {
    p.trailT -= dt;
    if (p.trailT <= 0) {
      p.trailT = 0.07;
      p.group.getWorldPosition(tmp);
      if (m.trailKind === 'embers') world.fx.emit(tmp.x + (Math.random() - 0.5) * 0.6, tmp.y + 0.2, tmp.z + (Math.random() - 0.5) * 0.6, 0, 0.6, 0, m.trailColor, 0.22, 0.9, -0.3);
      else world.fx.emit(tmp.x + (Math.random() - 0.5) * 0.8, tmp.y + 0.3 + Math.random() * 0.6, tmp.z + (Math.random() - 0.5) * 0.8, 0, 0.3, 0, m.trailColor, 0.26, 1.2, 0);
    }
  }
}

function worldPetPlay(name) {
  const p = world.pet;
  if (!p) return;
  if (name === 'walk') {
    p.state = 'idle';
    p.timer = 0;
    return;
  }
  playPetAnim(p.model, name);
}

function petPlay(name) {
  if (world.viewStage) world.viewStage.play(name);
  else worldPetPlay(name);
}

function petReact() {
  const p = world.pet;
  if (!p) return;
  playPetAnim(p.model, Math.random() < 0.3 ? 'cheer' : 'jump');
  p.group.getWorldPosition(world.tmp.v1);
  world.fx.burst(world.tmp.v1.x, world.tmp.v1.y + p.model.height * p.scale * 0.8, world.tmp.v1.z, 0xfde68a, 10, 2, 0.4, 1, 1.5);
}

function initCamera() {
  cam.target = new THREE.Vector3(0, 2, 0);
  cam.goal = { target: new THREE.Vector3(0, 2, 0), theta: cam.theta, phi: cam.phi, dist: cam.dist, fov: cam.fov };
}

function applyCamera() {
  const sp = Math.sin(cam.phi);
  world.camera.position.set(cam.target.x + cam.dist * sp * Math.sin(cam.theta), cam.target.y + cam.dist * Math.cos(cam.phi), cam.target.z + cam.dist * sp * Math.cos(cam.theta));
  world.camera.lookAt(cam.target);
  if (Math.abs(world.camera.fov - cam.fov) > 0.01) {
    world.camera.fov = cam.fov;
    world.camera.updateProjectionMatrix();
  }
}

function cancelTween() {
  if (!cam.tween) return;
  cam.tween = null;
  cam.goal.target.copy(cam.target);
  cam.goal.theta = cam.theta;
  cam.goal.phi = cam.phi;
  cam.goal.dist = cam.dist;
  cam.goal.fov = cam.fov;
}

function flyTo(goal, opts) {
  const o = opts || {};
  const dur = deviceSettings.reduceMotion ? 0.45 : o.duration || 1.7;
  const to = { target: goal.target.clone(), theta: goal.theta, phi: goal.phi, dist: goal.dist, fov: goal.fov || cam.fovBase };
  cam.tween = {
    t: 0,
    dur,
    from: { target: cam.target.clone(), theta: cam.theta, phi: cam.phi, dist: cam.dist, fov: cam.fov },
    to,
    lift: o.lift === undefined ? 0.1 : o.lift
  };
  cam.goal.target.copy(to.target);
  cam.goal.theta = to.theta;
  cam.goal.phi = to.phi;
  cam.goal.dist = to.dist;
  cam.goal.fov = to.fov;
}

function updateCamera(dt) {
  const tw = cam.tween;
  if (tw) {
    tw.t += dt;
    const p = Math.min(1, tw.t / tw.dur);
    const e = easeInOutCubic(p);
    cam.target.lerpVectors(tw.from.target, tw.to.target, e);
    cam.theta = angleLerp(tw.from.theta, tw.to.theta, e);
    cam.phi = lerp(tw.from.phi, tw.to.phi, e);
    cam.dist = lerp(tw.from.dist, tw.to.dist, e) + Math.sin(Math.PI * p) * tw.lift * Math.max(tw.from.dist, tw.to.dist);
    cam.fov = lerp(tw.from.fov, tw.to.fov, e);
    if (p >= 1) cam.tween = null;
  } else {
    if (cam.mode === 'showcase' && !deviceSettings.reduceMotion) {
      cam.goal.theta += dt * 0.05;
      cam.goal.phi = 1.02 + Math.sin(world.time * 0.12) * 0.07;
      cam.goal.dist = 54 + Math.sin(world.time * 0.1) * 3;
    }
    const k = 1 - Math.exp(-dt * 7.5);
    cam.target.lerp(cam.goal.target, k);
    cam.theta = angleLerp(cam.theta, cam.goal.theta, k);
    cam.phi += (cam.goal.phi - cam.phi) * k;
    cam.dist += (cam.goal.dist - cam.dist) * k;
    cam.fov += (cam.goal.fov - cam.fov) * k;
  }
  applyCamera();
}

function setCamMode(mode) {
  if (cam.mode === mode) return;
  cam.mode = mode;
  bus.emit('camera:mode', mode);
}

function overviewDistance() {
  const aspect = world.camera ? world.camera.aspect : 1.6;
  const d = (world.extent * 2.1 + 8) * clamp(1.35 / aspect, 1, 2);
  return clamp(d, 36, 170);
}

function overviewGoal() {
  return { target: new THREE.Vector3(0, 1.5, 0), theta: cam.theta, phi: 1.0, dist: overviewDistance(), fov: cam.fovBase };
}

function showcaseGoal() {
  return { target: new THREE.Vector3(0, 2, 0), theta: cam.theta, phi: 1.05, dist: 54, fov: cam.fovBase };
}

function islandGoal(isl) {
  const p = isl.target;
  const aspect = world.camera.aspect;
  return { target: new THREE.Vector3(p.x, p.y + 1.6, p.z), theta: Math.atan2(p.x, p.z), phi: 0.95, dist: 15.5 * clamp(1.25 / aspect, 1, 1.8), fov: cam.fovBase - 4 };
}

function petGoal() {
  const aspect = world.camera.aspect;
  const target = new THREE.Vector3(0, 2, 0);
  if (world.pet) {
    world.pet.group.getWorldPosition(target);
    target.y += world.pet.model.height * world.pet.scale * 0.45;
  }
  return { target, theta: cam.theta, phi: 1.15, dist: 9.5 * clamp(1.2 / aspect, 1, 1.6), fov: cam.fovBase - 6 };
}

function resetCamera() {
  if (!world.ready) return;
  const prev = world.focusedId;
  world.focusedId = '';
  clearTimeout(world.returnTimer);
  if (world.mode === 'game') {
    setCamMode('overview');
    flyTo(overviewGoal(), { duration: 1.5 });
  } else {
    setCamMode('showcase');
    flyTo(showcaseGoal(), { duration: 1.5 });
  }
  if (prev) {
    bus.emit('world:transition', { type: 'exit', subjectId: prev });
    bus.emit('island:exit', { subjectId: prev });
  }
}

function focusIsland(id) {
  if (!world.ready || world.mode !== 'game') return false;
  const isl = world.islands.get(id);
  if (!isl) return false;
  if (world.focusedId === id) return true;
  clearTimeout(world.returnTimer);
  world.focusedId = id;
  setCamMode('island');
  flyTo(islandGoal(isl), { duration: 1.7 });
  isl.flash = 1;
  world.fx.burst(isl.target.x, isl.target.y + 2, isl.target.z, isl.accent.getHex(), 22, 3, 0.5, 1.2, 0.5);
  hideTooltip();
  bus.emit('world:transition', { type: 'enter', subjectId: id });
  bus.emit('island:enter', { subjectId: id });
  return true;
}

function exitIsland() {
  if (!world.focusedId) return false;
  resetCamera();
  return true;
}

function focusPet(returnAfter) {
  if (!world.ready || world.mode !== 'game' || !world.pet) return false;
  if (world.focusedId) resetCamera();
  clearTimeout(world.returnTimer);
  setCamMode('pet');
  flyTo(petGoal(), { duration: 1.4 });
  if (returnAfter) {
    world.returnTimer = setTimeout(() => {
      if (cam.mode === 'pet') resetCamera();
    }, returnAfter * 1000);
  }
  return true;
}

function getFocusedIslandId() {
  return world.focusedId;
}










































const ZOOM_PAN_LIMIT = 0.85;
const TAP_SLOP = 9;
const TAP_TIME = 650;
const HOVER_INTERVAL = 60;
const SOUND_NOTES = {
  tap: [[660, 0, 0.09]],
  success: [[523, 0, 0.14], [659, 0.1, 0.14], [784, 0.2, 0.24]],
  levelup: [[523, 0, 0.14], [659, 0.1, 0.14], [784, 0.2, 0.14], [1047, 0.32, 0.36]],
  gate: [[392, 0, 0.18], [523, 0.14, 0.18], [659, 0.28, 0.18], [784, 0.42, 0.38]],
  evolve: [[392, 0, 0.2], [494, 0.16, 0.2], [587, 0.32, 0.2], [784, 0.48, 0.2], [988, 0.64, 0.5]]
};

const audio = { ctx: null };

function getAudioContext() {
  if (!deviceSettings.sound) return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!audio.ctx) {
    try {
      audio.ctx = new Ctor();
    } catch (e) {
      return null;
    }
  }
  if (audio.ctx.state === 'suspended') {
    const pending = audio.ctx.resume();
    if (pending && typeof pending.catch === 'function') pending.catch(() => audio.ctx.state);
  }
  return audio.ctx;
}

function playTone(ctx, freq, start, dur, gain) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const t0 = ctx.currentTime + start;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function playSound(kind) {
  const notes = SOUND_NOTES[kind];
  if (!notes) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  notes.forEach((n) => playTone(ctx, n[0], n[1], n[2], 0.11));
}

function wrapAngle(a) {
  return ((((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
}

function createWorldTmp() {
  return { v1: new THREE.Vector3(), v2: new THREE.Vector3(), v3: new THREE.Vector3(), ray: new THREE.Raycaster(), ndc: new THREE.Vector2() };
}

function showWebglFallback() {
  const node = document.getElementById('webglFallback');
  if (node) node.hidden = false;
  document.body.classList.add('no-webgl');
}

function currentPixelRatio() {
  return clamp(Math.min(window.devicePixelRatio || 1, world.quality.dpr) * world.dprScale, 0.5, 3);
}

function applySize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  world.renderer.setPixelRatio(currentPixelRatio());
  world.renderer.setSize(w, h, false);
  world.camera.aspect = w / h;
  world.camera.updateProjectionMatrix();
  if (world.fx) world.fx.setScale(pointScale(world.renderer, world.camera.fov));
}

function markMaterialsDirty() {
  world.scene.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach((mat) => {
      mat.needsUpdate = true;
    });
  });
}

function configureQuality() {
  const q = world.quality;
  const renderer = world.renderer;
  const light = world.light;
  const wasShadows = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = q.shadows;
  light.castShadow = q.shadows;
  if (q.shadows && light.shadow.mapSize.x !== q.shadowSize) {
    light.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    if (light.shadow.map) {
      light.shadow.map.dispose();
      light.shadow.map = null;
    }
  }
  if (wasShadows !== q.shadows) markMaterialsDirty();
  world.starsA.geometry.setDrawRange(0, q.stars);
  world.starsB.geometry.setDrawRange(0, Math.round(q.stars * 0.25));
  applySize();
}

function applyQuality(name, rebuild) {
  const next = QUALITY_TABLE[name] ? name : 'medium';
  const changed = next !== world.qualityName;
  world.qualityName = next;
  world.quality = QUALITY_TABLE[next];
  configureQuality();
  if (changed && rebuild) rebuildWorldObjects();
}

function trackPerformance(raw) {
  world.frameCount += 1;
  if (world.frameCount < 90) return;
  if (raw > 0.034) world.slowCount += 1;
  else world.slowCount = Math.max(0, world.slowCount - 0.5);
  if (world.slowCount > 50 && world.dprScale > 0.55) {
    world.dprScale = Math.max(0.55, world.dprScale - 0.15);
    world.slowCount = 0;
    applySize();
  }
}

function placeIsland(isl, pos) {
  isl.group.position.copy(pos);
  isl.home.copy(pos);
  isl.target.copy(pos);
  isl.curY = pos.y;
}

function disposeIsland(isl) {
  if (isl.group.parent) isl.group.parent.remove(isl.group);
  disposeObject(isl.group);
}

function markRemoving(isl) {
  if (!isl || isl.removing) return;
  isl.removing = true;
  isl.spawnDelay = 0;
  world.dying.push(isl);
}

function islandWorldPoint(isl, local, out) {
  const s = isl.group.scale.x;
  return out.set(isl.group.position.x + local.x * s, isl.group.position.y + local.y * s, isl.group.position.z + local.z * s);
}

function addFlashRing(x, y, z, color, size) {
  const mat = glowMat(color, 0.9);
  const ring = torus(1, 0.05, mat, 48);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y, z);
  ring.scale.setScalar(0.3);
  world.scene.add(ring);
  world.flashes.push({ obj: ring, mat, t: 0, dur: 1.4, size });
}

function updateFlashes(dt) {
  for (let i = world.flashes.length - 1; i >= 0; i -= 1) {
    const f = world.flashes[i];
    f.t += dt;
    const p = Math.min(1, f.t / f.dur);
    f.obj.scale.setScalar(lerp(0.3, f.size, easeOutCubic(p)));
    f.mat.opacity = (1 - p) * 0.9;
    if (p >= 1) {
      world.scene.remove(f.obj);
      disposeObject(f.obj);
      world.flashes.splice(i, 1);
    }
  }
}

function updateIslandObject(isl, t, dt) {
  if (isl.spawnDelay > 0) {
    isl.spawnDelay -= dt;
    if (isl.spawnDelay > 0) {
      isl.group.visible = false;
      return;
    }
  }
  if (isl.removing) isl.spawn = Math.max(0, isl.spawn - dt / 0.7);
  else if (isl.spawn < 1) isl.spawn = Math.min(1, isl.spawn + dt / 1.2);
  const grow = isl.removing ? easeOutCubic(isl.spawn) : easeOutBack(isl.spawn);
  const hv = isl.id && world.hoverId === isl.id ? 1 : 0;
  isl.hover += (hv - isl.hover) * Math.min(1, dt * 10);
  isl.flash = Math.max(0, isl.flash - dt * 1.1);
  isl.group.visible = isl.spawn > 0.002;
  isl.group.scale.setScalar(Math.max(0.001, grow * (1 + isl.hover * 0.035)));
  const k = 1 - Math.exp(-dt * 3.5);
  const pos = isl.group.position;
  pos.x += (isl.target.x - pos.x) * k;
  pos.z += (isl.target.z - pos.z) * k;
  isl.curY += (isl.target.y - isl.curY) * k;
  pos.y = isl.curY + Math.sin(t * 0.7 + isl.phase) * isl.bobAmp - (1 - Math.min(1, grow)) * 8;
  isl.uniforms.forEach((u) => {
    u.value = t;
  });
  isl.anim.forEach((fn) => fn(t, dt));
  isl.pulses.forEach((p) => {
    p.target[p.key] = p.base + Math.sin(t * p.speed + p.phase) * p.amp;
  });
  if (isl.ring) {
    const focused = isl.id && world.focusedId === isl.id ? 0.45 : 0;
    const opacity = clamp(isl.hover * 0.75 + focused + isl.flash * 0.7, 0, 1);
    isl.ring.material.opacity = opacity;
    isl.ring.visible = opacity > 0.01;
  }
  if (isl.label && isl.kind === 'subject') isl.label.visible = world.focusedId !== isl.id;
}

function updateWorldFrame(dt) {
  const t = world.time;
  updateCamera(dt);
  const cp = world.camera.position;
  world.sky.position.copy(cp);
  world.sky.material.uniforms.uTime.value = t;
  world.starsA.position.copy(cp);
  world.starsB.position.copy(cp);
  world.starsA.rotation.y += dt * 0.002;
  world.starsB.rotation.y -= dt * 0.003;
  const cloudLimit = world.quality.clouds;
  world.clouds.forEach((c, i) => {
    if (i >= cloudLimit) {
      c.visible = false;
      return;
    }
    c.visible = true;
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 170) c.position.x = -170;
  });
  if (world.hubIsl) updateIslandObject(world.hubIsl, t, dt);
  world.decor.forEach((isl) => updateIslandObject(isl, t, dt));
  world.islands.forEach((isl) => updateIslandObject(isl, t, dt));
  world.showcase.forEach((isl) => updateIslandObject(isl, t, dt));
  for (let i = world.dying.length - 1; i >= 0; i -= 1) {
    const isl = world.dying[i];
    updateIslandObject(isl, t, dt);
    if (isl.spawn <= 0.001) {
      disposeIsland(isl);
      world.dying.splice(i, 1);
    }
  }
  updateBridgeMotes(t);
  updateWorldPet(dt);
  updateFlashes(dt);
  world.fx.update(dt);
  world.fx.setScale(pointScale(world.renderer, world.camera.fov));
  world.scene.fog.density = Math.min(0.0075, 0.4 / Math.max(10, cam.dist));
  const lt = world.light.target.position;
  lt.lerp(cam.target, 1 - Math.exp(-dt * 3));
  world.light.position.set(lt.x + 18, lt.y + 34, lt.z + 12);
  world.hubLight.intensity = 1.3 + Math.sin(t * 1.4) * 0.15;
}

function worldFrame(now) {
  world.rafId = requestAnimationFrame(worldFrame);
  if (!world.ready || world.paused || document.hidden) {
    world.last = now;
    return;
  }
  const viewClosed = viewPanelClosed();
  if (!viewClosed) {
    world.skipFrame = !world.skipFrame;
    if (world.skipFrame) return;
  } else {
    world.skipFrame = false;
  }
  const raw = (now - (world.last || now)) / 1000;
  world.last = now;
  const dt = Math.min(0.05, Math.max(0, raw));
  if (viewClosed) trackPerformance(raw);
  world.time += dt;
  updateWorldFrame(dt);
  world.renderer.render(world.scene, world.camera);
}

function snapCamera(goal) {
  cam.tween = null;
  cam.target.copy(goal.target);
  cam.theta = goal.theta;
  cam.phi = goal.phi;
  cam.dist = goal.dist;
  cam.fov = goal.fov;
  cam.goal.target.copy(goal.target);
  cam.goal.theta = goal.theta;
  cam.goal.phi = goal.phi;
  cam.goal.dist = goal.dist;
  cam.goal.fov = goal.fov;
  applyCamera();
}

function slotRing(index, total) {
  const rings = computeRings(total);
  let ring = 0;
  let rem = index;
  while (ring < rings.length - 1 && rem >= rings[ring]) {
    rem -= rings[ring];
    ring += 1;
  }
  return ring;
}

function showcasePosition(i) {
  const a = (i / SHOWCASE_ISLANDS.length) * Math.PI * 2 + 0.35;
  return new THREE.Vector3(Math.sin(a) * 24, Math.sin(i * 1.9) * 2.2, Math.cos(a) * 24);
}

function demoSnaps() {
  return SHOWCASE_ISLANDS.map((d, i) => {
    const total = 9;
    const done = 2 + i;
    const stages = [];
    for (let k = 0; k < total; k += 1) {
      const state = k < done ? 'done' : k === done ? 'current' : 'locked';
      stages.push({ index: k, lecture: null, state, locked: state === 'locked', backlog: false, progress: state === 'current' ? 40 : 0 });
    }
    const gates = [{ index: 1, afterStage: 4, key: 'demo-gate-' + i, open: done >= 5 }];
    return {
      id: '',
      name: '',
      color: d.color,
      motif: d.motif,
      progress: Math.round((done / total) * 100),
      backlog: 0,
      model: { stages, gates, doneCount: done, total, nextGate: null },
      sig: d.motif + '|' + d.color,
      stageSig: '',
      labelSig: ''
    };
  });
}

function subjectSnapshot(subject) {
  const stats = subjectStats(subject.id);
  const model = islandStageModel(subject.id);
  const stageSig = model.stages.map((s) => s.state.charAt(0) + (s.backlog ? 'b' : '') + (s.state === 'current' ? Math.round(s.progress / 25) : '')).join('') + '|' + model.gates.map((g) => (g.open ? 1 : 0)).join('');
  return {
    id: subject.id,
    name: subject.name,
    color: subject.color,
    motif: subject.motif,
    progress: stats.progress,
    backlog: stats.backlog,
    model,
    sig: subject.motif + '|' + subject.color,
    stageSig,
    labelSig: [subject.name, stats.progress, stats.backlog, model.doneCount, model.total].join('|')
  };
}

function applyStageUpdate(isl, snap) {
  const prevMarkers = isl.markerStates || {};
  const prevGates = isl.gateStates || {};
  rebuildIslandStages(isl, snap.model);
  const v = world.tmp.v2;
  const nextMarkers = {};
  const nextGates = {};
  isl.markers.forEach((m) => {
    nextMarkers[m.key] = m.state;
    if (world.syncedOnce && prevMarkers[m.key] && prevMarkers[m.key] !== 'done' && m.state === 'done') {
      islandWorldPoint(isl, m.pos, v);
      world.fx.burst(v.x, v.y + 0.3, v.z, WORLD_COLORS.gold, 16, 2.4, 0.4, 1.1, 1.4);
    }
  });
  isl.gates.forEach((g) => {
    nextGates[g.key] = g.open;
    if (world.syncedOnce && prevGates[g.key] === false && g.open) {
      islandWorldPoint(isl, g.pos, v);
      world.fx.burst(v.x, v.y, v.z, WORLD_COLORS.gold, 30, 3.2, 0.5, 1.4, 1.2);
      world.fx.burst(v.x, v.y, v.z, WORLD_COLORS.cyan, 20, 2.6, 0.42, 1.3, 0.8);
      addFlashRing(v.x, v.y - 0.6, v.z, WORLD_COLORS.gold, 5);
      isl.flash = 1;
      playSound('gate');
    }
  });
  isl.markerStates = nextMarkers;
  isl.gateStates = nextGates;
}

function syncSubjects() {
  const subjects = sortBy(appState.subjects, (s) => s.order);
  const snaps = subjects.map(subjectSnapshot);
  const n = snaps.length;
  const seen = new Set();
  const entries = [];
  const stagger = !world.syncedOnce || world.staggerNext;
  let maxR = 0;
  let focusMoved = false;
  snaps.forEach((snap, i) => {
    seen.add(snap.id);
    const pos = slotPosition(i, n);
    maxR = Math.max(maxR, Math.hypot(pos.x, pos.z));
    entries.push({ id: snap.id, pos, ring: slotRing(i, n) });
    let isl = world.islands.get(snap.id);
    if (isl && isl.sig !== snap.sig) {
      const old = isl;
      isl = createSubjectIsland(snap, false);
      placeIsland(isl, pos);
      isl.group.position.copy(old.group.position);
      isl.curY = old.curY;
      isl.spawn = 1;
      isl.flash = 1;
      isl.stageSig = snap.stageSig;
      isl.labelSig = snap.labelSig;
      world.scene.add(isl.group);
      disposeIsland(old);
      world.islands.set(snap.id, isl);
      return;
    }
    if (!isl) {
      isl = createSubjectIsland(snap, false);
      placeIsland(isl, pos);
      isl.spawn = 0;
      isl.spawnDelay = stagger ? 0.55 + i * 0.14 : 0.1;
      isl.stageSig = snap.stageSig;
      isl.labelSig = snap.labelSig;
      world.scene.add(isl.group);
      world.islands.set(snap.id, isl);
      return;
    }
    if (isl.target.distanceToSquared(pos) > 0.01 && snap.id === world.focusedId) focusMoved = true;
    isl.target.copy(pos);
    isl.home.copy(pos);
    if (isl.stageSig !== snap.stageSig) {
      applyStageUpdate(isl, snap);
      isl.stageSig = snap.stageSig;
    }
    if (isl.labelSig !== snap.labelSig) {
      redrawLabel(isl.label, islandLabelData(snap));
      isl.labelSig = snap.labelSig;
    }
    isl.snap = snap;
  });
  Array.from(world.islands.keys()).forEach((id) => {
    if (seen.has(id)) return;
    markRemoving(world.islands.get(id));
    world.islands.delete(id);
  });
  world.extent = n ? Math.max(27, maxR + ISLAND_RADIUS + 6) : 18;
  const sig = 'g:' + entries.map((e) => e.id + ':' + e.pos.x.toFixed(1) + ',' + e.pos.y.toFixed(1) + ',' + e.pos.z.toFixed(1)).join(';');
  if (sig !== world.bridges.sig) {
    rebuildBridges(entries);
    world.bridges.sig = sig;
  }
  if (world.focusedId) {
    const focused = world.islands.get(world.focusedId);
    if (!focused) resetCamera();
    else if (focusMoved) flyTo(islandGoal(focused), { duration: 1.1 });
  }
  if (world.layoutCount !== n) {
    world.layoutCount = n;
    if (world.syncedOnce && cam.mode === 'overview' && !world.focusedId) flyTo(overviewGoal(), { duration: 1.4 });
  }
}

function syncShowcase() {
  if (!world.showcase.length) {
    demoSnaps().forEach((snap, i) => {
      const isl = createSubjectIsland(snap, true);
      placeIsland(isl, showcasePosition(i));
      isl.spawn = 0;
      isl.spawnDelay = 0.2 + i * 0.18;
      world.scene.add(isl.group);
      world.showcase.push(isl);
    });
  }
  world.extent = 27;
  world.layoutCount = -1;
  if (world.bridges.sig !== 's:showcase') {
    const entries = world.showcase.map((isl, i) => ({ id: 'demo' + i, pos: isl.target.clone(), ring: 0 }));
    rebuildBridges(entries);
    world.bridges.sig = 's:showcase';
  }
}

function petTagData() {
  const info = petStageInfo(appState.progress.totalXp);
  return { title: appState.pet.name, subtitle: info.name, color: '#fbbf24', ratio: info.ratio, centerText: String(info.stage + 1) };
}

function updatePetTag() {
  const p = world.pet;
  if (!p || !appState || !appState.pet) return;
  const data = petTagData();
  const key = data.title + '|' + data.subtitle + '|' + Math.round(data.ratio * 100);
  if (p.tagKey === key) return;
  p.tagKey = key;
  redrawLabel(p.tag, data);
}

function refreshPickables() {
  const list = [];
  if (world.mode === 'game') {
    world.islands.forEach((isl) => {
      if (isl.proxy && !isl.removing) list.push(isl.proxy);
    });
    if (world.hubIsl && world.hubIsl.proxy) list.push(world.hubIsl.proxy);
    if (world.pet && world.pet.proxy) list.push(world.pet.proxy);
  }
  world.pickables = list;
}

function syncWorld() {
  if (!world.ready) return;
  const game = world.mode === 'game' && !!appState;
  if (game) {
    world.showcase.forEach((isl) => markRemoving(isl));
    world.showcase = [];
    syncSubjects();
  } else {
    world.islands.forEach((isl) => markRemoving(isl));
    world.islands.clear();
    syncShowcase();
  }
  ensureWorldPet();
  updatePetTag();
  refreshPickables();
  if (world.viewStage) syncPetView(false);
  world.syncedOnce = true;
  world.staggerNext = false;
}

function scheduleWorldSync() {
  if (!world.ready || world.mode !== 'game') return;
  clearTimeout(world.syncTimer);
  world.syncTimer = setTimeout(() => {
    world.syncTimer = null;
    syncWorld();
  }, 100);
}

function syncWorldNow() {
  clearTimeout(world.syncTimer);
  world.syncTimer = null;
  syncWorld();
}

function buildHubAndDecor() {
  const hub = createHubIsland();
  placeIsland(hub, new THREE.Vector3(0, 0, 0));
  hub.spawn = 1;
  world.scene.add(hub.group);
  world.hubIsl = hub;
  world.decor = [];
  for (let i = 0; i < world.quality.decor; i += 1) {
    const d = createDecorIsland(i);
    d.group.position.copy(d.home);
    d.curY = d.home.y;
    d.spawn = 0;
    d.spawnDelay = 0.3 + i * 0.12;
    world.scene.add(d.group);
    world.decor.push(d);
  }
}

function rebuildWorldObjects() {
  removeWorldPet();
  world.islands.forEach((isl) => disposeIsland(isl));
  world.islands.clear();
  world.showcase.forEach((isl) => disposeIsland(isl));
  world.showcase = [];
  world.dying.forEach((isl) => disposeIsland(isl));
  world.dying = [];
  world.decor.forEach((isl) => disposeIsland(isl));
  world.decor = [];
  if (world.hubIsl) {
    disposeIsland(world.hubIsl);
    world.hubIsl = null;
  }
  clearBridges();
  world.syncedOnce = false;
  world.layoutCount = undefined;
  hideTooltip();
  world.hoverId = '';
  const was = world.focusedId;
  world.focusedId = '';
  if (was) bus.emit('island:exit', { subjectId: was });
  buildHubAndDecor();
  syncWorld();
  if (cam.mode === 'island' || cam.mode === 'pet') {
    const game = world.mode === 'game';
    setCamMode(game ? 'overview' : 'showcase');
    flyTo(game ? overviewGoal() : showcaseGoal(), { duration: 1.2 });
  }
}

function redrawAllLabels() {
  world.islands.forEach((isl) => {
    if (isl.label && isl.snap) redrawLabel(isl.label, islandLabelData(isl.snap));
  });
  if (world.pet) {
    world.pet.tagKey = '';
    updatePetTag();
  }
}

function setWorldMode(mode) {
  if (!world.ready || world.mode === mode) return;
  world.mode = mode;
  world.focusedId = '';
  world.hoverId = '';
  clearTimeout(world.returnTimer);
  hideTooltip();
  world.staggerNext = mode === 'game';
  syncWorld();
  if (mode === 'game') {
    setCamMode('overview');
    flyTo(overviewGoal(), { duration: 2.6, lift: 0.18 });
  } else {
    setCamMode('showcase');
    flyTo(showcaseGoal(), { duration: 1.6 });
  }
}

function showTooltip(isl, x, y) {
  const tip = document.getElementById('islandTooltip');
  if (!tip || !isl || !isl.snap) return;
  const snap = isl.snap;
  const key = snap.name + '|' + snap.labelSig;
  if (world.tipKey !== key) {
    world.tipKey = key;
    const line = snap.model.total ? snap.model.doneCount + ' من ' + snap.model.total + ' محاضرة · ' + formatPercent(snap.progress) : 'أضف محاضراتك لتظهر المراحل';
    const backlog = snap.backlog > 0 ? '<span class="tip-backlog">متراكم ' + snap.backlog + '</span>' : '';
    tip.innerHTML = '<strong>' + escapeHtml(snap.name) + '</strong><small>' + escapeHtml(line) + '</small>' + backlog;
  }
  tip.hidden = false;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  tip.style.left = clamp(x + 16, 8, Math.max(8, window.innerWidth - w - 8)) + 'px';
  tip.style.top = clamp(y + 18, 8, Math.max(8, window.innerHeight - h - 8)) + 'px';
}

function hideTooltip() {
  const tip = document.getElementById('islandTooltip');
  if (tip && !tip.hidden) tip.hidden = true;
}

function pickAt(clientX, clientY) {
  if (!world.pickables.length) return null;
  const rect = world.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const tmp = world.tmp;
  tmp.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  tmp.ray.setFromCamera(tmp.ndc, world.camera);
  const hits = tmp.ray.intersectObjects(world.pickables, false);
  if (!hits.length) return null;
  const petHit = hits.find((h) => h.object.userData.pick && h.object.userData.pick.type === 'pet');
  const chosen = petHit || hits[0];
  return chosen.object.userData.pick || null;
}

function zoomLimits() {
  if (cam.mode === 'island') return [7.5, 40];
  if (cam.mode === 'pet') return [5, 24];
  return [16, Math.max(60, overviewDistance() * 1.5)];
}

function clampZoom(d) {
  const lim = zoomLimits();
  return clamp(d, lim[0], lim[1]);
}

function zoomBy(factor) {
  if (!world.ready || cam.mode === 'showcase') return;
  cancelTween();
  cam.goal.dist = clampZoom(cam.goal.dist * factor);
}

function orbitBy(dx, dy) {
  cam.goal.theta -= dx * 0.0065;
  cam.goal.phi = clamp(cam.goal.phi - dy * 0.0045, 0.4, 1.38);
}

function panBy(dx, dy) {
  const h = world.canvas.clientHeight || 600;
  const unit = (2 * cam.goal.dist * Math.tan((cam.fov * Math.PI) / 360)) / h;
  const fwd = unit / Math.max(0.3, Math.cos(cam.goal.phi));
  const th = cam.goal.theta;
  const g = cam.goal.target;
  g.x += -Math.cos(th) * dx * unit - Math.sin(th) * dy * fwd;
  g.z += Math.sin(th) * dx * unit - Math.cos(th) * dy * fwd;
  const limit = world.extent * ZOOM_PAN_LIMIT;
  const len = Math.hypot(g.x, g.z);
  if (len > limit) {
    g.x = (g.x / len) * limit;
    g.z = (g.z / len) * limit;
  }
}

function capturePointer(canvas, id) {
  try {
    canvas.setPointerCapture(id);
  } catch (e) {
    return false;
  }
  return true;
}

function releaseCapture(canvas, id) {
  try {
    canvas.releasePointerCapture(id);
  } catch (e) {
    return false;
  }
  return true;
}

function firstTwoPointers() {
  return Array.from(world.pointers.values()).slice(0, 2);
}

function beginPinch() {
  const list = firstTwoPointers();
  if (list.length < 2) return;
  list.forEach((p) => {
    p.moved = true;
  });
  cancelTween();
  world.hadMulti = true;
  const a = list[0];
  const b = list[1];
  world.pinch = {
    dist: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)),
    ang: Math.atan2(b.y - a.y, b.x - a.x),
    baseDist: cam.goal.dist,
    baseTheta: cam.goal.theta,
    mx: (a.x + b.x) / 2,
    my: (a.y + b.y) / 2
  };
}

function updatePinch() {
  const pin = world.pinch;
  const list = firstTwoPointers();
  if (!pin || list.length < 2) return;
  const a = list[0];
  const b = list[1];
  const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  if (cam.mode !== 'showcase') cam.goal.dist = clampZoom((pin.baseDist * pin.dist) / d);
  cam.goal.theta = pin.baseTheta - wrapAngle(ang - pin.ang);
  if (cam.mode === 'overview') panBy(mx - pin.mx, my - pin.my);
  pin.mx = mx;
  pin.my = my;
}

function handleWorldTap(x, y) {
  if (world.mode !== 'game') return;
  const pick = pickAt(x, y);
  if (!pick) return;
  if (pick.type === 'island') {
    if (world.focusedId !== pick.id) {
      playSound('tap');
      focusIsland(pick.id);
    }
    return;
  }
  if (pick.type === 'pet') {
    playSound('tap');
    petReact();
    if (cam.mode === 'overview') focusPet(5);
    return;
  }
  if (pick.type === 'hub') {
    if (world.focusedId || cam.mode === 'pet') resetCamera();
    else if (world.pet) focusPet(5);
  }
}

function hoverMove(e) {
  if (e.pointerType !== 'mouse') return;
  const now = performance.now();
  if (now - world.lastHover < HOVER_INTERVAL) return;
  world.lastHover = now;
  if (world.mode !== 'game') return;
  const pick = pickAt(e.clientX, e.clientY);
  const id = pick && pick.type === 'island' ? pick.id : '';
  world.hoverId = id;
  world.canvas.style.cursor = pick ? 'pointer' : 'grab';
  if (id) showTooltip(world.islands.get(id), e.clientX, e.clientY);
  else hideTooltip();
}

function onWorldPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
  capturePointer(world.canvas, e.pointerId);
  world.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, moved: false, t: performance.now() });
  hideTooltip();
  if (world.pointers.size === 2) beginPinch();
}

function onWorldPointerMove(e) {
  const p = world.pointers.get(e.pointerId);
  if (!p) {
    hoverMove(e);
    return;
  }
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (!p.moved && Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_SLOP) {
    p.moved = true;
    cancelTween();
    world.canvas.style.cursor = 'grabbing';
  }
  if (!p.moved) return;
  if (world.pointers.size >= 2) {
    updatePinch();
    return;
  }
  const orbit = cam.mode !== 'overview' || p.button === 2 || e.shiftKey || e.ctrlKey;
  if (orbit) orbitBy(dx, dy);
  else panBy(dx, dy);
}

function onWorldPointerUp(e) {
  const p = world.pointers.get(e.pointerId);
  if (!p) return;
  const wasSingle = world.pointers.size === 1 && !world.hadMulti;
  world.pointers.delete(e.pointerId);
  releaseCapture(world.canvas, e.pointerId);
  if (world.pointers.size < 2) world.pinch = null;
  if (!world.pointers.size) world.hadMulti = false;
  world.canvas.style.cursor = 'grab';
  if (wasSingle && !p.moved && performance.now() - p.t < TAP_TIME) handleWorldTap(e.clientX, e.clientY);
}

function onWorldPointerCancel(e) {
  world.pointers.delete(e.pointerId);
  releaseCapture(world.canvas, e.pointerId);
  if (world.pointers.size < 2) world.pinch = null;
  if (!world.pointers.size) world.hadMulti = false;
  world.canvas.style.cursor = 'grab';
}

function onWorldPointerLeave() {
  if (world.pointers.size) return;
  world.hoverId = '';
  hideTooltip();
}

function onWorldWheel(e) {
  e.preventDefault();
  if (cam.mode === 'showcase') return;
  cancelTween();
  const unit = e.deltaMode === 1 ? 16 : 1;
  const delta = clamp(e.deltaY * unit, -240, 240);
  cam.goal.dist = clampZoom(cam.goal.dist * Math.exp(delta * 0.0014));
}

function onWorldResize() {
  if (!world.ready) return;
  applySize();
  const aspect = world.camera.aspect;
  if (cam.mode === 'overview' && !cam.tween && Math.abs(aspect - world.fitAspect) / world.fitAspect > 0.12) {
    cam.goal.dist = overviewDistance();
    world.fitAspect = aspect;
  }
  if (cam.mode === 'island' && !cam.tween && world.focusedId) {
    const isl = world.islands.get(world.focusedId);
    if (isl) flyTo(islandGoal(isl), { duration: 0.6 });
  }
}

function onWorldKey(e) {
  if (e.key !== 'Escape' || !world.ready || modalStack.length) return;
  const tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (!viewPanelClosed()) return;
  if (world.focusedId || cam.mode === 'pet') resetCamera();
}

function bindWorldInput() {
  const canvas = world.canvas;
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', onWorldPointerDown);
  canvas.addEventListener('pointermove', onWorldPointerMove);
  canvas.addEventListener('pointerup', onWorldPointerUp);
  canvas.addEventListener('pointercancel', onWorldPointerCancel);
  canvas.addEventListener('pointerleave', onWorldPointerLeave);
  canvas.addEventListener('wheel', onWorldWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    world.paused = true;
    toast('انقطعت الرسوميات مؤقتًا وتجري استعادتها', 'warn');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    world.paused = false;
    world.last = 0;
    applySize();
  });
  window.addEventListener('resize', onWorldResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onWorldResize);
  document.addEventListener('keydown', onWorldKey);
  document.addEventListener('visibilitychange', () => {
    world.last = 0;
  });
}

function initWorld() {
  if (world.ready) return true;
  const canvas = document.getElementById('worldCanvas');
  if (!canvas || !webglSupported()) {
    showWebglFallback();
    return false;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: deviceSettings.quality !== 'low', alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    showWebglFallback();
    return false;
  }
  world.renderer = renderer;
  world.canvas = canvas;
  renderer.setClearColor(WORLD_COLORS.fog, 1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  world.qualityName = QUALITY_TABLE[deviceSettings.quality] ? deviceSettings.quality : 'medium';
  world.quality = QUALITY_TABLE[world.qualityName];
  world.camera = new THREE.PerspectiveCamera(cam.fovBase, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 1200);
  world.tmp = createWorldTmp();
  world.dying = [];
  world.layoutCount = undefined;
  world.staggerNext = false;
  world.hadMulti = false;
  world.tipKey = '';
  initCamera();
  buildSceneBase();
  configureQuality();
  buildHubAndDecor();
  world.ready = true;
  world.available = true;
  world.mode = currentScreen === 'game' && appState ? 'game' : 'showcase';
  syncWorld();
  world.fitAspect = world.camera.aspect;
  if (world.mode === 'game') {
    snapCamera(showcaseGoal());
    setCamMode('overview');
    flyTo(overviewGoal(), { duration: 2.8, lift: 0.15 });
  } else {
    snapCamera(showcaseGoal());
    setCamMode('showcase');
  }
  bindWorldInput();
  world.rafId = requestAnimationFrame(worldFrame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawAllLabels);
  return true;
}

function spawnFloatText(text, kind, delay) {
  const layer = document.getElementById('fxLayer');
  if (!layer) return;
  const node = document.createElement('div');
  node.className = 'float-text float-' + kind;
  node.textContent = text;
  node.style.setProperty('--fx-x', Math.round(Math.random() * 70 - 35) + 'px');
  node.style.animationDelay = (delay || 0) + 'ms';
  layer.appendChild(node);
  setTimeout(() => node.remove(), 2400 + (delay || 0));
}

function celebrateReward(c) {
  if (!c) return;
  if (c.xp > 0) spawnFloatText('+' + c.xp + ' XP', 'xp', 0);
  if (c.gems > 0) spawnFloatText('+' + c.gems, 'gem', 260);
  if (c.evolved) playSound('evolve');
  else if (c.levelUp) playSound('levelup');
  else if (c.lecture && c.lecture.done) playSound('success');
  else playSound('tap');
  if (!world.ready || world.mode !== 'game') return;
  syncWorldNow();
  const isl = c.lecture ? world.islands.get(c.lecture.subjectId) : null;
  if (isl) {
    isl.flash = 1;
    const top = isl.group.position;
    const done = !!(c.lecture && c.lecture.done);
    world.fx.burst(top.x, top.y + 3, top.z, isl.accent.getHex(), done ? 36 : 18, 3.4, 0.5, 1.3, 0.8);
    if (done) world.fx.burst(top.x, top.y + 3, top.z, WORLD_COLORS.gold, 24, 3, 0.45, 1.4, 1.2);
  }
  const p = world.pet;
  if (!p) return;
  const big = !!(c.evolved || c.levelUp || c.backlogCleared || (c.lecture && c.lecture.done));
  playPetAnim(p.model, big ? 'cheer' : 'jump');
  const v = world.tmp.v1;
  p.group.getWorldPosition(v);
  const h = p.model.height * p.scale;
  world.fx.burst(v.x, v.y + h * 0.7, v.z, WORLD_COLORS.gold, big ? 30 : 12, big ? 3.4 : 2, 0.45, 1.2, 1.6);
  if (c.evolved) {
    addFlashRing(v.x, v.y + 0.3, v.z, WORLD_COLORS.gold, 7);
    addFlashRing(v.x, v.y + 1.2, v.z, WORLD_COLORS.violet, 5);
    if (cam.mode === 'overview') focusPet(4.5);
  }
}

actions['map-zoom-in'] = () => zoomBy(0.7);
actions['map-zoom-out'] = () => zoomBy(1.4);
actions['map-reset'] = () => {
  if (!world.ready) return;
  if (world.focusedId || cam.mode !== 'overview') resetCamera();
  else flyTo(overviewGoal(), { duration: 1.1 });
};
actions['pet-jump'] = () => petPlay('jump');
actions['pet-cheer'] = () => petPlay('cheer');
actions['pet-walk'] = () => petPlay('walk');

bus.on('screen:changed', (name) => {
  if (name !== 'pet') disposePreviewStage();
  setWorldMode(name === 'game' ? 'game' : 'showcase');
});

bus.on('state:changed', scheduleWorldSync);

bus.on('state:replaced', () => {
  if (world.ready && world.mode === 'game') syncWorldNow();
});

bus.on('reward:summary', celebrateReward);

bus.on('cosmetics:changed', () => {
  if (world.ready && world.mode === 'game') ensureWorldPet(false);
  if (world.viewStage) syncPetView(false);
});

bus.on('pet:preview', (event) => {
  if (event && event.species) ensurePreviewStage(event.species);
});

bus.on('settings:device', () => {
  if (!world.ready) return;
  if (deviceSettings.quality !== world.qualityName) {
    world.dprScale = 1;
    applyQuality(deviceSettings.quality, true);
  }
});

bus.on('world:closed', () => {
  clearTimeout(world.syncTimer);
  world.syncTimer = null;
  hideTooltip();
  disposePreviewStage();
  unmountPetView();
});const VIEW_TITLES = {
  today: 'مهام اليوم',
  subjects: 'المواد',
  teachers: 'المدرسون',
  lectures: 'المحاضرات',
  backlog: 'مركز المتراكم',
  sessions: 'جلسات المذاكرة',
  review: 'المراجعة',
  pet: 'رفيقك',
  achievements: 'الإنجازات والمكافآت',
  reports: 'التقارير والإحصائيات',
  settings: 'الإعدادات والنسخ الاحتياطي'
};

const viewState = {
  current: '',
  date: '',
  lecture: { subjectId: 'all', teacherId: 'all', status: 'all' },
  session: { status: 'all', type: 'all' }
};

const hudCache = { avatarSig: '' };
const CHART_TEXT = '#b9c4ff';
const CHART_GRID = 'rgba(185, 196, 255, 0.14)';

function iconSvg(id, cls) {
  return '<svg class="icon' + (cls ? ' ' + cls : '') + '"><use href="#' + id + '"/></svg>';
}

function motifIcon(motif) {
  return iconSvg('m-' + (MOTIFS.includes(motif) ? motif : 'scroll'));
}

function teacherIcon(avatar) {
  return avatar === 'sage' || !TEACHER_AVATARS.includes(avatar) ? iconSvg('i-teacher') : iconSvg('m-' + avatar);
}

function dayLabelsOf(days) {
  return DAY_ORDER.filter((d) => days.includes(d)).map((d) => DAY_NAMES[d]);
}

function statCard(label, value, note, tone) {
  return (
    '<div class="stat-card' + (tone ? ' stat-' + tone : '') + '">' +
    '<span class="stat-label">' + escapeHtml(label) + '</span>' +
    '<strong class="stat-value">' + escapeHtml(value) + '</strong>' +
    (note ? '<small class="stat-note">' + escapeHtml(note) + '</small>' : '') +
    '</div>'
  );
}

function emptyState(title, text, extraHtml) {
  return '<div class="empty-state"><h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(text) + '</p>' + (extraHtml || '') + '</div>';
}

function progressBar(percent, color) {
  const value = clamp(Math.round(Number(percent) || 0), 0, 100);
  return '<div class="bar" role="presentation"><span style="width:' + value + '%' + (color ? ';background:' + escapeHtml(color) : '') + '"></span></div>';
}

function taskActionsHtml(task, interactive) {
  if (!interactive) return '';
  if (task.kind === 'review') {
    if (task.status === 'done') return '<span class="tag tag-done">تمت</span>';
    return (
      '<button class="btn btn-primary" type="button" data-action="review-complete" data-id="' + escapeHtml(task.id) + '">أنهيت المراجعة</button>' +
      '<button class="btn btn-ghost" type="button" data-action="review-postpone" data-id="' + escapeHtml(task.id) + '">تأجيل يوم</button>' +
      '<button class="btn btn-ghost" type="button" data-action="review-dismiss" data-id="' + escapeHtml(task.id) + '">تخطي</button>'
    );
  }
  const edit = '<button class="icon-btn" type="button" data-action="open-session-modal" data-id="' + escapeHtml(task.id) + '" aria-label="تعديل الجلسة">' + iconSvg('i-edit') + '</button>';
  if (task.status === 'done') return '<span class="tag tag-done">مكتملة</span>' + edit;
  const label = task.status === 'active' ? 'تابع الجلسة' : 'ابدأ الجلسة';
  return '<button class="btn btn-primary" type="button" data-action="start-session" data-id="' + escapeHtml(task.id) + '">' + iconSvg('i-play') + '<span>' + label + '</span></button>' + edit;
}

function taskCardHtml(task, interactive) {
  const tags = [];
  if (task.status === 'active') tags.push('<span class="tag tag-active">جارية</span>');
  if (task.status === 'missed') tags.push('<span class="tag tag-warn">لم تكتمل سابقًا</span>');
  if (task.kind === 'session' && task.status !== 'done') {
    if (task.backlog) tags.push('<span class="tag tag-backlog">متراكمة</span>');
    else if (task.category === 'new') tags.push('<span class="tag tag-new">جديدة</span>');
  }
  if (task.kind === 'review' && task.status !== 'done' && task.overdueDays > 0) tags.push('<span class="tag tag-warn">مستحقة منذ ' + daysGen(task.overdueDays) + '</span>');
  const meta = ['<span class="meta-item">' + iconSvg('i-session') + escapeHtml(formatMinutes(task.minutes)) + '</span>'];
  if (task.date) meta.push('<span class="meta-item">' + iconSvg('i-today') + escapeHtml(relativeDayLabel(task.date)) + '</span>');
  if (task.teacherName) meta.push('<span class="meta-item">' + iconSvg('i-teacher') + escapeHtml(task.teacherName) + '</span>');
  const bar = task.status !== 'done' && task.progress > 0 ? progressBar(task.progress) : '';
  return (
    '<article class="task-card" data-kind="' + task.kind + '" data-status="' + task.status + '" style="--c:' + escapeHtml(task.color) + '">' +
    '<div class="task-icon">' + motifIcon(task.motif) + '</div>' +
    '<div class="task-main">' +
    '<div class="task-top"><span class="task-type">' + escapeHtml(task.typeLabel) + '</span><span class="task-subject">' + escapeHtml(task.subjectName) + '</span>' + tags.join('') + '</div>' +
    '<h4 class="task-title">' + escapeHtml(task.title) + '</h4>' +
    (task.description ? '<p class="task-desc">' + escapeHtml(task.description) + '</p>' : '') +
    '<div class="task-meta">' + meta.join('') + '</div>' +
    bar +
    (task.reason ? '<p class="task-reason">' + iconSvg('i-sparkle') + '<span>' + escapeHtml(task.reason) + '</span></p>' : '') +
    '</div>' +
    '<div class="task-actions">' + taskActionsHtml(task, interactive) + '</div>' +
    '</article>'
  );
}

function sortTasksForDisplay(tasks) {
  const rank = { active: 0, pending: 1, missed: 1, done: 2 };
  return tasks.map((t, i) => ({ t, i })).sort((a, b) => {
    const ra = rank[a.t.status] === undefined ? 1 : rank[a.t.status];
    const rb = rank[b.t.status] === undefined ? 1 : rank[b.t.status];
    return ra !== rb ? ra - rb : a.i - b.i;
  }).map((x) => x.t);
}

function updateHud() {
  if (!appState) return;
  const progress = appState.progress;
  const info = levelInfo(progress.totalXp);
  $('#hudName').textContent = appState.profile.name || (currentAccount ? currentAccount.username : '');
  $('#hudLevel').textContent = String(info.level);
  const percent = Math.round(info.ratio * 100);
  $('#xpFill').style.width = percent + '%';
  $('#xpTrack').setAttribute('aria-valuenow', String(percent));
  $('#xpText').textContent = info.into + ' / ' + info.needed + ' XP · ' + info.title;
  $('#hudGems').textContent = String(progress.gems);
  const pet = appState.pet;
  const avatar = $('#hudAvatar');
  if (!pet) {
    $('#hudPetLine').textContent = 'اختر رفيقك';
    avatar.innerHTML = '';
    hudCache.avatarSig = '';
    return;
  }
  const stage = petStageInfo(progress.totalXp);
  $('#hudPetLine').textContent = pet.name + ' · ' + stage.name;
  const equipped = appState.achievements.cosmetics.equipped.slice();
  const sig = pet.species + ':' + stage.stage + ':' + equipped.join(',');
  if (sig === hudCache.avatarSig) return;
  hudCache.avatarSig = sig;
  const url = renderPetThumbnail(pet.species, stage.stage, equipped, 96);
  avatar.innerHTML = url ? '<img alt="" src="' + url + '">' : '<span>' + escapeHtml((appState.profile.name || '؟').charAt(0)) + '</span>';
}

function renderTodayPanel() {
  if (!appState) return;
  const summary = getTodaySummary();
  $('#todayDate').textContent = formatDateAr(todayStr());
  const cards = [
    statCard('أنجزت', summary.done + ' من ' + summary.total, summary.total ? formatMinutes(summary.minutesDone) + ' مذاكرة' : ''),
    statCard('المتبقي', formatMinutes(summary.minutesRemaining), summary.pending + ' مهمة'),
    statCard('جديدة', String(summary.newCount), 'محاضرات نزلت حديثًا'),
    statCard('مراجعات', String(summary.reviewCount), summary.backlogCount ? 'ومتراكم ' + summary.backlogCount : '')
  ];
  $('#todaySummary').innerHTML = cards.join('');
  $('#todayProgressFill').style.width = Math.round(summary.ratio * 100) + '%';
  $('#todayExplain').textContent = explainToday();
  const list = $('#todayList');
  list.innerHTML = summary.tasks.length
    ? sortTasksForDisplay(summary.tasks).map((t) => taskCardHtml(t, true)).join('')
    : emptyState(summary.isRest ? 'يوم راحة' : 'لا توجد مهام الآن', summary.isRest ? 'استرح اليوم، وسيكمل النظام ترتيب أيامك القادمة.' : 'عندما تضيف محاضرة جديدة سيبني النظام جدولك فورًا.', '');
  const badge = $('#todayBadge');
  badge.textContent = String(summary.pending);
  badge.hidden = summary.pending === 0;
}

function renderTodayView() {
  const today = todayStr();
  if (!viewState.date || viewState.date < today) viewState.date = today;
  const summary = getTodaySummary();
  $('#todayViewIntro').innerHTML = '<p>' + escapeHtml(explainToday()) + '</p>' + (appState.plan.notes.length ? '<ul class="plan-notes">' + appState.plan.notes.slice(0, 6).map((n) => '<li>' + escapeHtml(n) + '</li>').join('') + '</ul>' : '');
  const week = getWeekOverview(7);
  $('#weekStrip').innerHTML = week.map((d) => {
    const classes = 'week-day' + (d.date === viewState.date ? ' is-selected' : '') + (d.isToday ? ' is-today' : '') + (d.isRest ? ' is-rest' : '');
    const count = d.isRest ? 'راحة' : d.doneCount + ' / ' + d.count;
    return (
      '<button class="' + classes + '" type="button" data-action="select-day" data-date="' + d.date + '">' +
      '<span class="wd-name">' + escapeHtml(d.isToday ? 'اليوم' : d.label) + '</span>' +
      '<small class="wd-date">' + escapeHtml(formatDateAr(d.date, false)) + '</small>' +
      '<strong class="wd-count">' + escapeHtml(count) + '</strong>' +
      '<em class="wd-min">' + (d.isRest ? '' : escapeHtml(formatMinutes(d.minutes))) + '</em>' +
      (d.exams.length ? '<span class="wd-exam">امتحان</span>' : '') +
      '</button>'
    );
  }).join('');
  const tasks = sortTasksForDisplay(getTasksForDate(viewState.date));
  const isToday = viewState.date === today;
  const exams = appState.exams.filter((e) => e.date === viewState.date);
  const head = '<h3 class="section-title">' + escapeHtml(isToday ? 'مهام اليوم' : formatDateAr(viewState.date)) + '</h3>' +
    (exams.length ? '<p class="exam-note">' + exams.map((e) => 'امتحان ' + escapeHtml(e.title)).join(' · ') + '</p>' : '') +
    (isToday ? '' : '<p class="hint">هذا جدول مقترح لهذا اليوم، ويُعاد حسابه تلقائيًا كلما تغيّرت بياناتك.</p>');
  $('#todayViewList').innerHTML = head + (tasks.length ? tasks.map((t) => taskCardHtml(t, isToday)).join('') : emptyState('لا توجد مهام في هذا اليوم', summary.isRest && isToday ? 'اليوم يوم راحة.' : 'لم يضع النظام مهامًا هنا لأن وقتك المتاح لا يتسع أو لأنه يوم راحة.', ''));
}

function renderSubjectsView() {
  const holder = $('#subjectsList');
  const subjects = sortBy(appState.subjects, (s) => s.order);
  if (!subjects.length) {
    holder.innerHTML = emptyState('لا توجد مواد بعد', 'كل مادة تتحول إلى جزيرة في عالمك. أضف مادتك الأولى.', '');
    return;
  }
  holder.innerHTML = subjects.map((subject) => {
    const st = subjectStats(subject.id);
    const teachers = teachersOfSubject(subject.id).map((t) => t.name);
    const mastery = clamp(Math.round(subjectMastery(subject.id)), 1, 4);
    return (
      '<article class="entity-card" style="--c:' + escapeHtml(subject.color) + '">' +
      '<header class="entity-head"><span class="entity-icon">' + motifIcon(subject.motif) + '</span>' +
      '<div><h3>' + escapeHtml(subject.name) + '</h3><small>الصعوبة: ' + DIFFICULTY_LABELS[subject.difficulty] + ' · إتقانك: ' + MASTERY_LABELS[mastery] + '</small></div></header>' +
      '<p class="entity-line">' + (teachers.length ? 'المدرسون: ' + escapeHtml(teachers.join('، ')) : 'لم تضف مدرسًا لهذه المادة بعد') + '</p>' +
      '<div class="mini-stats">' +
      '<div><strong>' + st.published + '</strong><span>المنشورة</span></div>' +
      '<div><strong>' + (st.total > 0 ? st.total : '—') + '</strong><span>الإجمالي المتوقع</span></div>' +
      '<div><strong>' + st.studied + '</strong><span>ذاكرتها</span></div>' +
      '<div><strong>' + st.done + '</strong><span>المكتملة</span></div>' +
      '<div><strong>' + st.backlog + '</strong><span>المتراكمة</span></div>' +
      '<div><strong>' + st.sessionsRemaining + '</strong><span>جلسات متبقية</span></div>' +
      '</div>' +
      progressBar(st.progress, subject.color) +
      '<small class="entity-progress">' + formatPercent(st.progress) + ' من المحاضرات التي تتابعها</small>' +
      '<footer class="entity-actions">' +
      '<button class="btn btn-primary" type="button" data-action="quick-add-subject" data-id="' + escapeHtml(subject.id) + '">إضافة محاضرة جديدة</button>' +
      '<button class="btn btn-secondary" type="button" data-action="go-island" data-id="' + escapeHtml(subject.id) + '">زيارة الجزيرة</button>' +
      '<button class="btn btn-ghost" type="button" data-action="open-teacher-modal" data-subject-id="' + escapeHtml(subject.id) + '">إضافة مدرس</button>' +
      '<button class="icon-btn" type="button" data-action="open-subject-modal" data-id="' + escapeHtml(subject.id) + '" aria-label="تعديل المادة">' + iconSvg('i-edit') + '</button>' +
      '</footer></article>'
    );
  }).join('');
}

function renderTeachersView() {
  const holder = $('#teachersList');
  const teachers = sortBy(appState.teachers, (t) => {
    const subject = getSubject(t.subjectId);
    return (subject ? String(subject.order).padStart(4, '0') : '9999') + t.name;
  });
  if (!teachers.length) {
    holder.innerHTML = emptyState('لا يوجد مدرسون بعد', 'أضف مدرسًا وحدد مواعيد نشره ليبدأ عداد المحاضرات التلقائي.', '');
    return;
  }
  holder.innerHTML = teachers.map((teacher) => {
    const st = teacherStats(teacher.id);
    const subject = getSubject(teacher.subjectId);
    const color = subject ? subject.color : SUBJECT_COLORS[0];
    const pending = pendingPublishDates(teacher);
    const upcoming = expectedPublishDates(teacher, 1);
    let schedule = teacher.publishDays.length ? 'ينشر: ' + dayLabelsOf(teacher.publishDays).join('، ') + ' قرب ' + teacher.publishTime : 'لم تُحدد أيام النشر';
    let nextLine = '';
    if (pending.length) nextLine = 'حان موعد نشر ' + pending.length + (pending.length === 1 ? ' محاضرة متوقعة' : ' محاضرات متوقعة') + '، سجّلها عندما تصلك.';
    else if (upcoming.length) nextLine = 'الموعد المتوقع القادم: ' + formatDateAr(upcoming[0]);
    return (
      '<article class="entity-card" style="--c:' + escapeHtml(color) + '">' +
      '<header class="entity-head"><span class="entity-icon">' + teacherIcon(teacher.avatar) + '</span>' +
      '<div><h3>' + escapeHtml(teacher.name) + '</h3><small>' + escapeHtml(subject ? subject.name : '') + ' · متوسط المحاضرة ' + escapeHtml(formatMinutes(teacher.avgDuration)) + '</small></div></header>' +
      '<p class="entity-line">' + escapeHtml(schedule) + '</p>' +
      (nextLine ? '<p class="entity-line' + (pending.length ? ' is-alert' : '') + '">' + escapeHtml(nextLine) + '</p>' : '') +
      '<div class="mini-stats">' +
      '<div><strong>' + teacher.publishedCount + '</strong><span>المنشورة</span></div>' +
      '<div><strong>' + st.lastReceived + '</strong><span>آخر محاضرة وصلتك</span></div>' +
      '<div><strong>' + st.tracked + '</strong><span>المسجلة عندك</span></div>' +
      '<div><strong>' + st.done + '</strong><span>أنجزتها</span></div>' +
      '<div><strong>' + st.remainingPublished + '</strong><span>المتبقية عليك</span></div>' +
      '<div><strong>' + (teacher.expectedTotal > 0 ? st.remainingToCome : '—') + '</strong><span>لم تنزل بعد</span></div>' +
      '</div>' +
      progressBar(st.progress, color) +
      '<small class="entity-progress">' + formatPercent(st.progress) + (teacher.expectedTotal > 0 ? ' من إجمالي ' + teacher.expectedTotal + ' محاضرة متوقعة' : ' من المحاضرات المنشورة') + '</small>' +
      '<footer class="entity-actions">' +
      '<button class="btn btn-primary" type="button" data-action="add-lecture-quick" data-teacher-id="' + escapeHtml(teacher.id) + '">إضافة محاضرة جديدة</button>' +
      '<button class="btn btn-ghost" type="button" data-action="open-teacher-modal" data-id="' + escapeHtml(teacher.id) + '">تعديل المدرس ومواعيده</button>' +
      '</footer></article>'
    );
  }).join('');
}

function populateLectureFilters() {
  const f = viewState.lecture;
  const subjects = sortBy(appState.subjects, (s) => s.order);
  if (f.subjectId !== 'all' && !getSubject(f.subjectId)) f.subjectId = 'all';
  fillSelect($('#lectureFilterSubject'), [{ value: 'all', label: 'كل المواد' }].concat(subjects.map((s) => ({ value: s.id, label: s.name }))), f.subjectId);
  const teachers = appState.teachers.filter((t) => f.subjectId === 'all' || t.subjectId === f.subjectId);
  if (f.teacherId !== 'all' && !teachers.some((t) => t.id === f.teacherId)) f.teacherId = 'all';
  fillSelect($('#lectureFilterTeacher'), [{ value: 'all', label: 'كل المدرسين' }].concat(teachers.map((t) => ({ value: t.id, label: t.name }))), f.teacherId);
  $('#lectureFilterStatus').value = f.status;
}

function lectureCardHtml(card, extraReason) {
  const lecture = card.lecture;
  const color = card.subject ? card.subject.color : SUBJECT_COLORS[0];
  const stats = card.stats;
  const statusLabel = card.backlog ? 'متراكمة' : LECTURE_STATUS_LABELS[lecture.status];
  const tagClass = lecture.status === 'done' ? 'tag-done' : card.backlog ? 'tag-backlog' : lecture.status === 'progress' ? 'tag-active' : 'tag-new';
  const chips = stats.sessions.map((s) => (
    '<button class="session-chip" type="button" data-status="' + s.status + '" data-action="open-session-modal" data-id="' + escapeHtml(s.id) + '">' +
    escapeHtml(SESSION_TYPES[s.type]) + ' · ' + s.minutes + 'د' + (s.status === 'done' ? ' ✓' : '') +
    '</button>'
  )).join('');
  const understanding = lecture.understanding ? 'فهمك: ' + MASTERY_LABELS[lecture.understanding] : '';
  return (
    '<article class="lecture-card" data-status="' + lecture.status + '" style="--c:' + escapeHtml(color) + '">' +
    '<header class="lecture-head"><span class="entity-icon">' + (card.subject ? motifIcon(card.subject.motif) : iconSvg('i-lecture')) + '</span>' +
    '<div><h4>' + escapeHtml(lectureLabel(lecture)) + '</h4>' +
    '<small>' + escapeHtml((card.subject ? card.subject.name : '') + (card.teacher ? ' · ' + card.teacher.name : '')) + '</small></div>' +
    '<span class="tag ' + tagClass + '">' + escapeHtml(statusLabel) + '</span></header>' +
    '<p class="lecture-meta">' + escapeHtml(ageText(card.age) + ' · ' + formatDateAr(lecture.publishedAt, false) + ' · ' + formatMinutes(lecture.duration) + (understanding ? ' · ' + understanding : '')) + '</p>' +
    (extraReason ? '<p class="task-reason">' + iconSvg('i-sparkle') + '<span>' + escapeHtml(extraReason) + '</span></p>' : '') +
    progressBar(stats.progress, color) +
    '<small class="entity-progress">' + stats.done + ' من ' + stats.total + ' جلسات' + (stats.remaining ? ' · متبقي ' + escapeHtml(formatMinutes(stats.minutesRemaining)) : '') + '</small>' +
    (chips ? '<div class="session-chips">' + chips + '</div>' : '') +
    '<footer class="entity-actions">' +
    '<button class="btn btn-secondary" type="button" data-action="open-session-modal" data-lecture-id="' + escapeHtml(lecture.id) + '">إضافة جلسة</button>' +
    '<button class="btn btn-ghost" type="button" data-action="open-lecture-modal" data-id="' + escapeHtml(lecture.id) + '">تعديل المحاضرة</button>' +
    '</footer></article>'
  );
}

function renderLecturesView() {
  populateLectureFilters();
  const cards = listLectureCards(viewState.lecture);
  const holder = $('#lecturesList');
  if (!cards.length) {
    const any = appState.lectures.length > 0;
    holder.innerHTML = emptyState(any ? 'لا توجد محاضرات بهذا الفلتر' : 'لا توجد محاضرات بعد', any ? 'غيّر الفلتر لترى محاضرات أخرى.' : 'أضف مدرسًا ثم سجّل محاضراته لتظهر هنا.', '');
    return;
  }
  const shown = cards.slice(0, 150);
  holder.innerHTML = shown.map((c) => lectureCardHtml(c, '')).join('') + (cards.length > shown.length ? '<p class="hint">يظهر أحدث ' + shown.length + ' محاضرة من أصل ' + cards.length + '، استخدم الفلاتر للوصول لغيرها.</p>' : '');
}

function renderBacklogView() {
  const overview = getBacklogOverview();
  $('#backlogStats').innerHTML = [
    statCard('محاضرات متراكمة', String(overview.count), 'غير مكتملة ومضى على نزولها أكثر من ' + BACKLOG_GRACE_DAYS + ' أيام', overview.count ? 'warn' : 'good'),
    statCard('جلسات متبقية', String(overview.sessions), 'داخل المتراكم فقط'),
    statCard('الوقت المتوقع', formatMinutes(overview.minutes), 'لإنهاء كل المتراكم'),
    statCard('المدة التقريبية', overview.estimatedDays ? daysGen(overview.estimatedDays) : 'لا يوجد', overview.estimatedDays ? 'بوتيرة آمنة لا تضغط جدولك' : 'أنت متقدم على الجميع')
  ].join('');
  drawBars($('#chartBacklogBySubject'), overview.bySubject.map((r) => ({ label: r.subject.name, value: r.lectures, color: r.subject.color })), { color: '#fb923c' });
  const holder = $('#backlogList');
  if (!overview.top.length) {
    holder.innerHTML = emptyState('لا يوجد متراكم', 'كل محاضراتك إما جديدة أو مكتملة. استمر على هذا الإيقاع.', '');
    return;
  }
  holder.innerHTML = overview.top.map((entry) => lectureCardHtml({ lecture: entry.lecture, subject: entry.subject, teacher: getTeacher(entry.lecture.teacherId), stats: entry.stats, backlog: true, age: entry.age }, entry.reason)).join('');
}

function renderSessionsView() {
  const f = viewState.session;
  $('#sessionFilterStatus').value = f.status;
  $('#sessionFilterType').value = f.type;
  const tasks = listSessionTasks(f.status, f.type);
  const holder = $('#sessionsList');
  if (!tasks.length) {
    holder.innerHTML = emptyState('لا توجد جلسات', appState.sessions.length ? 'غيّر الفلتر لترى جلسات أخرى.' : 'تُنشأ الجلسات تلقائيًا عند إضافة المحاضرات.', '');
    return;
  }
  const shown = tasks.slice(0, 200);
  holder.innerHTML = shown.map((t) => taskCardHtml(t, true)).join('') + (tasks.length > shown.length ? '<p class="hint">يظهر ' + shown.length + ' من أصل ' + tasks.length + ' جلسة.</p>' : '');
}

function renderReviewView() {
  const due = getDueReviewTasks();
  const upcoming = getUpcomingReviewTasks(30);
  $('#reviewIntro').innerHTML = '<p>' + (due.length ? 'لديك ' + due.length + ' مراجعة مستحقة، وأدخلناها في جدول اليوم أيضًا.' : 'لا توجد مراجعات مستحقة الآن.') + ' بعد كل مراجعة تقيّم فهمك فيحدد النظام موعد المراجعة التالية.</p>';
  $('#reviewDueList').innerHTML = due.length ? due.map((t) => taskCardHtml(t, true)).join('') : emptyState('لا مراجعات مستحقة', 'ستظهر هنا المراجعات عندما يحين موعدها.', '');
  $('#reviewUpcomingList').innerHTML = upcoming.length ? upcoming.map((t) => taskCardHtml(t, false)).join('') : emptyState('لا مراجعات قادمة', 'تُجدول المراجعات بعد إنهاء المحاضرات.', '');
}

function prepareCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(280, canvas.clientWidth || 640);
  const h = Math.max(180, canvas.clientHeight || 260);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.direction = 'ltr';
  ctx.font = '600 12px Cairo, Tajawal, sans-serif';
  return { ctx, w, h };
}

function shortLabel(text, max) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function drawGrid(ctx, padL, padT, cw, ch, max) {
  ctx.strokeStyle = CHART_GRID;
  ctx.lineWidth = 1;
  ctx.fillStyle = CHART_TEXT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i += 1) {
    const y = padT + ch - (ch * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + cw, y);
    ctx.stroke();
    ctx.fillText(String(Math.round((max * i) / 4)), padL - 6, y);
  }
}

function drawEmptyChart(ctx, w, h) {
  ctx.fillStyle = CHART_TEXT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('لا توجد بيانات بعد', w / 2, h / 2);
}

function drawBars(canvas, items, opts) {
  if (!canvas) return;
  const o = opts || {};
  const { ctx, w, h } = prepareCanvas(canvas);
  if (!items.length) {
    drawEmptyChart(ctx, w, h);
    return;
  }
  const padL = 38;
  const padR = 12;
  const padT = 24;
  const padB = 44;
  const cw = w - padL - padR;
  const ch = h - padT - padB;
  const max = o.max || Math.max(1, Math.max.apply(null, items.map((i) => Math.max(i.value, i.marker || 0))));
  drawGrid(ctx, padL, padT, cw, ch, max);
  const slot = cw / items.length;
  const bw = Math.min(48, slot * 0.58);
  items.forEach((item, i) => {
    const x = padL + slot * i + slot / 2;
    const bh = clamp((item.value / max) * ch, 0, ch);
    const y = padT + ch - bh;
    if (bh > 0.5) {
      const grad = ctx.createLinearGradient(0, y, 0, padT + ch);
      grad.addColorStop(0, item.color || o.color || '#8b5cf6');
      grad.addColorStop(1, 'rgba(139, 92, 246, 0.35)');
      ctx.fillStyle = grad;
      roundedRect(ctx, x - bw / 2, y, bw, bh, Math.min(7, bh / 2));
      ctx.fill();
    }
    if (item.marker) {
      const my = padT + ch - clamp((item.marker / max) * ch, 0, ch);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - bw / 2 - 4, my);
      ctx.lineTo(x + bw / 2 + 4, my);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (item.value > 0) ctx.fillText(o.format ? o.format(item.value) : String(Math.round(item.value)), x, y - 6);
    ctx.fillStyle = CHART_TEXT;
    ctx.fillText(shortLabel(item.label, slot < 60 ? 5 : 9), x, padT + ch + 20);
  });
}

function drawLine(canvas, points, opts) {
  if (!canvas) return;
  const o = opts || {};
  const { ctx, w, h } = prepareCanvas(canvas);
  if (!points.length) {
    drawEmptyChart(ctx, w, h);
    return;
  }
  const padL = 38;
  const padR = 18;
  const padT = 24;
  const padB = 38;
  const cw = w - padL - padR;
  const ch = h - padT - padB;
  const max = Math.max(1, o.max || Math.max.apply(null, points.map((p) => p.value)));
  drawGrid(ctx, padL, padT, cw, ch, max);
  const step = points.length > 1 ? cw / (points.length - 1) : 0;
  const xy = points.map((p, i) => ({ x: points.length > 1 ? padL + step * i : padL + cw / 2, y: padT + ch - (p.value / max) * ch }));
  const color = o.color || '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(xy[0].x, padT + ch);
  xy.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(xy[xy.length - 1].x, padT + ch);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.38)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  xy.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  const every = Math.ceil(points.length / 7);
  xy.forEach((p, i) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    if (i % every === 0 || i === points.length - 1) {
      ctx.fillStyle = CHART_TEXT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(points[i].label, p.x, padT + ch + 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(points[i].value), p.x, p.y - 10);
    }
  });
}

function renderReportsView() {
  const data = getReportData();
  const t = data.totals;
  $('#reportStats').innerHTML = [
    statCard('محاضرات منجزة', String(t.lecturesDone), 'بكل جلساتها'),
    statCard('جلسات مكتملة', String(t.sessionsDone), t.reviewsDone + ' مراجعة'),
    statCard('وقت المذاكرة', formatMinutes(t.minutesStudied), 'منه ' + formatMinutes(data.weeklyMinutes) + ' آخر 7 أيام'),
    statCard('أيام نشطة', String(t.activeDays), 'ذاكرت فيها'),
    statCard('الالتزام الأسبوعي', formatPercent(data.commitment), 'مقارنة بوقتك المتاح'),
    statCard('المتراكم', String(t.backlogLectures), t.backlogLectures ? t.backlogSessions + ' جلسة · ' + formatMinutes(t.backlogMinutes) : 'لا يوجد متراكم', t.backlogLectures ? 'warn' : 'good'),
    statCard('معدل انخفاض المتراكم', (data.backlogDropPerDay > 0 ? '−' : '') + Math.abs(data.backlogDropPerDay) + ' يوميًا', data.backlogDropPerDay > 0 ? 'المتراكم يتناقص' : data.backlogDropPerDay < 0 ? 'المتراكم يزيد' : 'ثابت')
  ].join('');
  drawBars($('#chartWeekly'), data.weekly.map((d) => ({ label: d.label, value: d.minutes, marker: d.capacity, color: '#8b5cf6' })), { format: (v) => String(Math.round(v)) });
  drawBars($('#chartSubjects'), data.subjects.map((s) => ({ label: s.name, value: s.progress, color: s.color })), { max: 100, format: (v) => Math.round(v) + '%' });
  drawLine($('#chartBacklogTrend'), data.backlogTrend.map((p) => ({ label: p.date.slice(8) + '/' + p.date.slice(5, 7), value: p.count })), { color: '#fb923c' });
  drawBars($('#chartCommitment'), data.weekly.map((d) => ({ label: d.label, value: d.ratio === null ? 0 : d.ratio, color: '#34d399' })), { max: 100, format: (v) => Math.round(v) + '%' });
}

function renderAchievementsView() {
  const progress = appState.progress;
  const info = levelInfo(progress.totalXp);
  const unlocked = BADGES.filter((b) => appState.achievements.badges[b.id]).length;
  $('#achievementStats').innerHTML = [
    statCard('المستوى', String(info.level), info.title + ' · يتبقى ' + info.remaining + ' XP'),
    statCard('نقاط الخبرة', String(progress.totalXp), 'XP'),
    statCard('الجواهر', String(progress.gems), 'تشتري بها المقتنيات'),
    statCard('الشارات', unlocked + ' من ' + BADGES.length, 'فتحتها حتى الآن')
  ].join('');
  $('#badgeGrid').innerHTML = BADGES.map((b) => {
    const date = appState.achievements.badges[b.id];
    return (
      '<div class="badge-card ' + (date ? 'is-unlocked' : 'is-locked') + '">' +
      '<span class="badge-icon">' + iconSvg(b.icon) + '</span>' +
      '<strong>' + escapeHtml(b.title) + '</strong><small>' + escapeHtml(b.text) + '</small>' +
      (date ? '<em>' + escapeHtml(relativeDayLabel(date)) + '</em>' : '') +
      '</div>'
    );
  }).join('');
  $('#cosmeticGrid').innerHTML = COSMETICS.map((item) => {
    const owned = ownedCosmetic(item.id);
    const equipped = equippedCosmetic(item.id);
    let action;
    if (!owned) action = '<button class="btn btn-secondary" type="button" data-action="buy-cosmetic" data-id="' + item.id + '"' + (progress.gems < item.cost ? ' disabled' : '') + '>' + iconSvg('i-gem') + '<span>' + item.cost + '</span></button>';
    else action = '<button class="btn ' + (equipped ? 'btn-primary' : 'btn-ghost') + '" type="button" data-action="toggle-cosmetic" data-id="' + item.id + '">' + (equipped ? 'مُلبَّس' : 'ألبسه') + '</button>';
    return (
      '<div class="cosmetic-card' + (owned ? ' is-owned' : '') + (equipped ? ' is-equipped' : '') + '" style="--c:' + item.color + '">' +
      '<span class="cosmetic-swatch" aria-hidden="true"></span>' +
      '<strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(item.text) + '</small>' + action +
      '</div>'
    );
  }).join('');
  const log = appState.achievements.log.slice(-50).reverse();
  $('#achievementLog').innerHTML = log.length
    ? log.map((e) => '<li class="log-item log-' + escapeHtml(e.type) + '"><strong>' + escapeHtml(e.title) + '</strong>' + (e.text ? '<span>' + escapeHtml(e.text) + '</span>' : '') + '<small>' + escapeHtml(relativeDayLabel(e.date)) + (e.xp > 0 ? ' · +' + e.xp + ' XP' : '') + '</small></li>').join('')
    : '<li class="log-empty">ستظهر إنجازاتك هنا بعد أول جلسة.</li>';
}

function renderPetView(full) {
  const pet = appState.pet;
  if (!pet) {
    $('#petViewName').textContent = 'لا يوجد رفيق بعد';
    $('#petViewStage').textContent = '';
    $('#evolutionTrack').innerHTML = '';
    return;
  }
  const xp = appState.progress.totalXp;
  const info = petStageInfo(xp);
  $('#petViewName').textContent = pet.name;
  $('#petViewStage').textContent = 'المرحلة ' + (info.stage + 1) + ' من 5 — ' + info.name + '. ' + info.note + '.';
  $('#petXpFill').style.width = Math.round(info.ratio * 100) + '%';
  $('#petXpText').textContent = info.isMax ? 'وصل رفيقك إلى شكله الأخير. لا يخسر شيئًا أبدًا إذا غبت.' : info.into + ' / ' + info.needed + ' XP للمرحلة التالية. رفيقك لا يتأثر بغيابك.';
  if (full) $('#petRenameInput').value = pet.name;
  const equipped = appState.achievements.cosmetics.equipped.slice();
  $('#evolutionTrack').innerHTML = PET_STAGE_NAMES.map((name, i) => {
    const state = i === info.stage ? 'is-current' : i < info.stage ? 'is-reached' : 'is-locked';
    const url = renderPetThumbnail(pet.species, i, equipped, 112);
    return (
      '<div class="evo-stage ' + state + '">' +
      (url ? '<img alt="' + escapeHtml(name) + '" src="' + url + '">' : '<span class="evo-num">' + (i + 1) + '</span>') +
      '<strong>' + escapeHtml(name) + '</strong><small>' + (PET_STAGE_XP[i] === 0 ? 'البداية' : 'من ' + PET_STAGE_XP[i] + ' XP') + '</small></div>'
    );
  }).join('');
}const run = { id: '', startedAt: 0, accumulated: 0, running: false, timer: 0 };
const rewardQueue = [];
const pendingRatings = [];
const ratingState = { kind: '', id: '' };
const STAGE_STATE_LABELS = { done: 'مكتملة', current: 'الحالية', locked: 'قادمة' };
const ISLAND_WINDOW = 40;
let uiTimer = null;
let hintTimer = null;
let freshDayTimer = null;

function isViewOpen() {
  const panel = $('#viewPanel');
  return !!panel && !panel.hidden;
}

function isTodayOpen() {
  return $('#todayPanel').classList.contains('is-open');
}

function setTodayPanel(open) {
  $('#todayPanel').classList.toggle('is-open', open);
  document.body.classList.toggle('today-open', open);
  $$('[data-action="toggle-today"][aria-expanded]').forEach((button) => button.setAttribute('aria-expanded', String(open)));
  if (open && appState) renderTodayPanel();
}

function updateDock() {
  const current = viewState.current || 'world';
  $$('.dock-btn').forEach((button) => button.classList.toggle('is-active', button.dataset.viewTarget === current));
}

function updateEmptyWorld() {
  const node = $('#emptyWorld');
  if (!node) return;
  node.hidden = !(currentScreen === 'game' && appState && !appState.subjects.length);
}

function applyMotionClass() {
  document.body.classList.toggle('reduce-motion', !!deviceSettings.reduceMotion);
}

function timeText(ts) {
  try {
    return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
  } catch (e) {
    return '';
  }
}

function updateSaveText() {
  const node = $('#lastSaveText');
  if (!node) return;
  const ts = getLastSavedAt();
  const notice = storageNotice();
  node.textContent = (ts ? 'آخر حفظ على هذا الجهاز: ' + timeText(ts) + '. ' : '') + notice;
}

function renderExamSelectAndList() {
  const select = $('#examSubject');
  const previous = select.value;
  const subjects = sortBy(appState.subjects, (s) => s.order);
  fillSelect(select, [{ value: '', label: 'كل المواد' }].concat(subjects.map((s) => ({ value: s.id, label: s.name }))), previous);
  const today = todayStr();
  const list = $('#examList');
  list.innerHTML = appState.exams.length
    ? sortBy(appState.exams, (e) => e.date).map((exam) => {
      const subject = exam.subjectId ? getSubject(exam.subjectId) : null;
      const subjectName = subject ? subject.name : exam.subjectName;
      return (
        '<li class="exam-item' + (exam.date < today ? ' is-past' : '') + '"><span class="exam-title">' + escapeHtml(exam.title) + (subjectName ? ' · ' + escapeHtml(subjectName) : '') + '</span>' +
        '<span class="exam-date">' + escapeHtml(formatDateAr(exam.date)) + ' · ' + escapeHtml(relativeDayLabel(exam.date)) + '</span>' +
        '<button type="button" class="icon-btn" data-action="remove-exam" data-id="' + escapeHtml(exam.id) + '" aria-label="حذف الامتحان">' + iconSvg('i-trash') + '</button></li>'
      );
    }).join('')
    : '<li class="log-empty">لا توجد امتحانات مسجلة.</li>';
}

function fillSettingsForms() {
  const profile = appState.profile;
  $('#setName').value = profile.name;
  $('#setGrade').value = profile.grade;
  $('#setCountry').value = profile.country;
  $('#setGoal').value = profile.goalText;
  $('#setLevel').value = String(profile.level);
  const form = $('#availabilityForm');
  for (let d = 0; d <= 6; d += 1) $('input[name="min-' + d + '"]', form).value = appState.availability.minutes[d];
  setCheckedNumbers('busy', appState.availability.busy, form);
  setCheckedNumbers('rest', appState.availability.rest, form);
  const intervals = appState.settings.reviewIntervals;
  for (let i = 0; i < 4; i += 1) $('#intv' + (i + 1)).value = intervals[i];
  $('#setQuality').value = deviceSettings.quality;
  $('#setReduceMotion').checked = deviceSettings.reduceMotion;
  $('#setSound').checked = deviceSettings.sound;
  clearFieldErrors($('[data-view="settings"]'));
}

function renderSettingsView(full) {
  if (full) fillSettingsForms();
  renderExamSelectAndList();
  updateSaveText();
}

function renderCurrentView(full) {
  if (!appState) return;
  const name = viewState.current;
  if (name === 'today') renderTodayView();
  else if (name === 'subjects') renderSubjectsView();
  else if (name === 'teachers') renderTeachersView();
  else if (name === 'lectures') renderLecturesView();
  else if (name === 'backlog') renderBacklogView();
  else if (name === 'sessions') renderSessionsView();
  else if (name === 'review') renderReviewView();
  else if (name === 'pet') renderPetView(!!full);
  else if (name === 'achievements') renderAchievementsView();
  else if (name === 'reports') renderReportsView();
  else if (name === 'settings') renderSettingsView(!!full);
}

function openView(name) {
  if (!appState || !VIEW_TITLES[name]) {
    closeView();
    return;
  }
  const panel = $('#viewPanel');
  const changed = viewState.current !== name;
  viewState.current = name;
  if (name === 'today' && changed) viewState.date = todayStr();
  panel.hidden = false;
  document.body.classList.add('view-open');
  $$('.view', panel).forEach((section) => {
    section.hidden = section.dataset.view !== name;
  });
  $('#viewTitle').textContent = VIEW_TITLES[name];
  setTodayPanel(false);
  updateDock();
  if (name !== 'pet') unmountPetView();
  renderCurrentView(true);
  if (changed) $('.view-body', panel).scrollTop = 0;
  if (name === 'pet') requestAnimationFrame(() => mountPetView());
}

function closeView() {
  const panel = $('#viewPanel');
  if (panel) panel.hidden = true;
  document.body.classList.remove('view-open');
  viewState.current = '';
  unmountPetView();
  updateDock();
}

function renderIslandOverlay() {
  const overlay = $('#islandOverlay');
  const id = getFocusedIslandId();
  const subject = id && appState ? getSubject(id) : null;
  if (!subject) {
    overlay.hidden = true;
    return;
  }
  overlay.hidden = false;
  overlay.style.setProperty('--c', subject.color);
  const stats = subjectStats(subject.id);
  const model = islandStageModel(subject.id);
  const teachers = teachersOfSubject(subject.id).map((t) => t.name);
  $('#islandName').textContent = subject.name;
  let sub = teachers.length ? 'المدرسون: ' + teachers.join('، ') : 'لم تضف مدرسًا لهذه المادة بعد';
  if (model.nextGate) sub += ' · البوابة القادمة بعد ' + model.nextGate.index * GATE_SIZE + ' محاضرات منجزة';
  $('#islandSub').textContent = sub;
  $('#islandStats').innerHTML = [
    statCard('التقدم', formatPercent(stats.progress), stats.done + ' من ' + stats.studentTotal + ' محاضرة'),
    statCard('متراكم', String(stats.backlog), stats.backlog ? 'يحتاج إلى اهتمامك' : 'لا يوجد متراكم', stats.backlog ? 'warn' : 'good'),
    statCard('جلسات متبقية', String(stats.sessionsRemaining), formatMinutes(stats.minutesRemaining)),
    statCard('المنشورة', String(stats.published), stats.teachers + ' مدرس')
  ].join('');
  const holder = $('#islandStages');
  if (!model.total) {
    holder.innerHTML = teachers.length
      ? emptyState('لا توجد محاضرات بعد', 'اضغط على إضافة محاضرة جديدة لتظهر مراحل هذه الجزيرة.', '')
      : emptyState('أضف مدرسًا أولًا', 'بعد إضافة المدرس ومواعيده تظهر محاضراته كمراحل على الجزيرة.', '<button class="btn btn-primary" type="button" data-action="open-teacher-modal" data-subject-id="' + escapeHtml(subject.id) + '">إضافة مدرس</button>');
    return;
  }
  const currentIndex = model.stages.findIndex((s) => s.state === 'current');
  const start = clamp((currentIndex === -1 ? model.stages.length - ISLAND_WINDOW : currentIndex - 3), 0, Math.max(0, model.stages.length - ISLAND_WINDOW));
  const shown = model.stages.slice(start, start + ISLAND_WINDOW);
  const gatesAfter = new Map();
  model.gates.forEach((g) => gatesAfter.set(g.afterStage, g));
  const rows = [];
  shown.forEach((stage) => {
    const lecture = stage.lecture;
    const card = { lecture, subject, teacher: getTeacher(lecture.teacherId), stats: lectureStats(lecture), backlog: stage.backlog, age: lectureAgeDays(lecture) };
    rows.push(
      '<div class="stage-row is-' + stage.state + '"><span class="stage-pin" title="' + STAGE_STATE_LABELS[stage.state] + '">' + (stage.index + 1) + '</span>' +
      '<div class="stage-body">' + lectureCardHtml(card, '') + '</div></div>'
    );
    const gate = gatesAfter.get(stage.index);
    if (gate) {
      rows.push('<div class="gate-row ' + (gate.open ? 'is-open' : 'is-closed') + '">' + iconSvg('i-map') + '<span>البوابة ' + gate.index + (gate.open ? ' مفتوحة' : ' تفتح بعد إنهاء أول ' + gate.index * GATE_SIZE + ' محاضرات') + '</span></div>');
    }
  });
  const note = model.total > shown.length ? '<p class="hint">تظهر المراحل من ' + (start + 1) + ' إلى ' + (start + shown.length) + ' من أصل ' + model.total + '.</p>' : '';
  holder.innerHTML = note + rows.join('');
}

function refreshUi() {
  if (!appState || currentScreen !== 'game') return;
  updateHud();
  renderTodayPanel();
  if (isViewOpen()) renderCurrentView(false);
  if (getFocusedIslandId()) renderIslandOverlay();
  updateEmptyWorld();
}

function scheduleUi() {
  if (uiTimer) return;
  uiTimer = setTimeout(() => {
    uiTimer = null;
    refreshUi();
  }, 60);
}

function runElapsed() {
  return run.accumulated + (run.running ? (Date.now() - run.startedAt) / 1000 : 0);
}

function tickRun() {
  if (!run.id) return;
  const session = getSession(run.id);
  const elapsed = runElapsed();
  $('#runTimer').textContent = formatClock(elapsed);
  const total = session ? session.minutes * 60 : 0;
  $('#runProgressFill').style.width = total ? clamp(Math.round((elapsed / total) * 100), 0, 100) + '%' : '0%';
}

function stopRunTimer() {
  clearInterval(run.timer);
  run.timer = 0;
}

function endRun() {
  stopRunTimer();
  run.id = '';
  run.running = false;
  run.accumulated = 0;
}

function openRun(id) {
  const session = getSession(id);
  const lecture = session ? getLecture(session.lectureId) : null;
  if (!session || !lecture) return;
  stopRunTimer();
  run.id = id;
  run.accumulated = 0;
  run.startedAt = Date.now();
  run.running = true;
  $('#runTitle').textContent = SESSION_TYPES[session.type];
  $('#runContext').textContent = lectureFullLabel(lecture) + ' · المدة المقدرة ' + formatMinutes(session.minutes);
  $('#runDesc').textContent = session.description || 'ركّز على المطلوب في هذه الجلسة ثم اضغط إنهاء الجلسة.';
  $('#runPauseBtn').textContent = 'إيقاف مؤقت';
  tickRun();
  run.timer = setInterval(tickRun, 500);
  openModal('modalSessionRun');
}

function beginSession(id) {
  if (!startSession(id)) {
    toast('تعذر بدء هذه الجلسة', 'error');
    return;
  }
  openRun(id);
}

function pauseRun() {
  if (!run.id) return;
  if (run.running) {
    run.accumulated = runElapsed();
    run.running = false;
    $('#runPauseBtn').textContent = 'استئناف';
  } else {
    run.startedAt = Date.now();
    run.running = true;
    $('#runPauseBtn').textContent = 'إيقاف مؤقت';
  }
  tickRun();
}

function finishRun() {
  const id = run.id;
  const session = id ? getSession(id) : null;
  if (!session) {
    endRun();
    closeModal('modalSessionRun');
    return;
  }
  const elapsedMinutes = Math.round(runElapsed() / 60);
  const cap = Math.max(session.minutes * 2, 30);
  const options = elapsedMinutes >= 1 ? { actualMinutes: Math.min(elapsedMinutes, cap) } : {};
  endRun();
  closeModal('modalSessionRun');
  if (!completeSession(id, options)) toast('تعذر تسجيل إنهاء الجلسة', 'error');
}

function closeRun() {
  const id = run.id;
  const session = id ? getSession(id) : null;
  if (session) {
    const ratio = Math.min(95, Math.round((runElapsed() / (session.minutes * 60)) * 100));
    releaseSession(id, Math.max(session.progress, ratio));
    toast('حفظنا تقدمك ويمكنك المتابعة لاحقًا', 'info');
  }
  endRun();
  closeModal('modalSessionRun');
}

function postponeRun() {
  const id = run.id;
  endRun();
  closeModal('modalSessionRun');
  if (id && missSession(id)) toast('نقلنا الجلسة إلى موعد مناسب دون أن نضغط بقية مهامك', 'info');
}

function openRating(kind, id) {
  let lecture = null;
  if (kind === 'review') {
    const review = findById(appState.reviews, id);
    lecture = review ? getLecture(review.lectureId) : null;
  } else {
    lecture = getLecture(id);
  }
  if (!lecture) return;
  ratingState.kind = kind;
  ratingState.id = id;
  $('#modalRatingTitle').textContent = kind === 'review' ? 'كيف كانت المراجعة؟' : 'كيف كان فهمك للمحاضرة؟';
  $('#ratingContext').textContent = (kind === 'review' ? 'راجعت ' : 'أنهيت ') + lectureFullLabel(lecture) + '. قيّم فهمك ليحدد النظام موعد المراجعة التالية.';
  openModal('modalRating');
}

function handleRatingChoice(button) {
  const rating = toInt(button.dataset.rating, 1, 4, 0);
  if (!rating || !ratingState.id) return;
  const kind = ratingState.kind;
  const id = ratingState.id;
  ratingState.kind = '';
  ratingState.id = '';
  closeModal('modalRating');
  if (kind === 'review') {
    if (!completeReview(id, rating)) toast('تعذر تسجيل المراجعة', 'error');
    return;
  }
  if (setLectureUnderstanding(id, rating)) toast('سجلنا فهمك وضبطنا موعد المراجعة الأولى', 'success');
  if (pendingRatings.length) {
    const next = pendingRatings.shift();
    setTimeout(() => openRating(next.kind, next.id), 250);
  }
}

function isNotableReward(c) {
  return !!(c.levelUp || c.evolved || c.badges.length || c.gates.length || c.backlogCleared || c.mastered || (c.lecture && c.lecture.done));
}

function showReward(c) {
  let title = 'جلسة مكتملة';
  let text = 'أحسنت، أنهيت الجلسة وسُجّل إنجازك.';
  if (c.evolved) {
    title = 'تطور رفيقك';
    text = (appState.pet ? appState.pet.name : 'رفيقك') + ' وصل إلى مرحلة «' + c.evolved.name + '».';
  } else if (c.levelUp) {
    title = 'مستوى جديد';
    text = 'وصلت إلى المستوى ' + c.levelUp.to + ' وصرت «' + c.levelUp.title + '».';
  } else if (c.lecture && c.lecture.done) {
    title = 'محاضرة مكتملة';
    text = 'أنهيت المحاضرة ' + c.lecture.number + (c.lecture.subjectName ? ' في ' + c.lecture.subjectName : '') + ' بكل جلساتها.';
  } else if (c.mastered) {
    title = 'محاضرة مثبّتة';
    text = 'ثبّتّ المحاضرة ' + (c.lecture ? c.lecture.number : '') + ' بعد سلسلة المراجعات كاملة.';
  } else if (c.backlogCleared) {
    title = 'نهاية المتراكم';
    text = 'أنهيت كل المحاضرات المتراكمة.';
  } else if (c.gates.length) {
    title = 'بوابة مفتوحة';
    text = 'فتحت بوابة جديدة على جزيرتك.';
  } else if (c.badges.length) {
    title = 'شارة جديدة';
    text = 'حصلت على شارة جديدة.';
  }
  const stats = [];
  if (c.xp > 0) stats.push('<div class="reward-stat"><strong>+' + c.xp + '</strong><span>XP</span></div>');
  if (c.gems > 0) stats.push('<div class="reward-stat">' + iconSvg('i-gem') + '<strong>+' + c.gems + '</strong><span>جواهر</span></div>');
  if (c.minutes > 0) stats.push('<div class="reward-stat"><strong>' + c.minutes + '</strong><span>دقيقة</span></div>');
  const extras = [];
  if (c.levelUp && !c.evolved) extras.push('المستوى ' + c.levelUp.to + ' · ' + c.levelUp.title);
  if (c.levelUp && c.evolved) extras.push('وصلت أيضًا إلى المستوى ' + c.levelUp.to);
  c.badges.forEach((b) => extras.push('شارة: ' + b.title + ' — ' + b.text));
  c.gates.forEach((g) => extras.push('فتحت البوابة ' + g.index + (g.name ? ' في ' + g.name : '')));
  if (c.backlogCleared) extras.push('إنجاز مميز: لا يوجد متراكم الآن');
  if (c.nextReview) extras.push('المراجعة التالية ' + relativeDayLabel(c.nextReview.dueDate));
  $('#rewardTitle').textContent = title;
  $('#rewardText').textContent = text;
  $('#rewardStats').innerHTML = stats.join('') + (extras.length ? '<ul class="reward-extras">' + extras.map((e) => '<li>' + escapeHtml(e) + '</li>').join('') + '</ul>' : '');
  openModal('modalReward');
}

function handleReward(c) {
  if (!c || !appState) return;
  if (c.kind === 'session' && c.lecture && c.lecture.done && !pendingRatings.some((r) => r.id === c.lecture.id)) pendingRatings.push({ kind: 'lecture', id: c.lecture.id });
  if (!isNotableReward(c)) {
    let message = (c.kind === 'review' ? 'تمت المراجعة' : 'اكتملت الجلسة') + ' · +' + c.xp + ' XP';
    if (c.nextReview) message += ' · المراجعة القادمة ' + relativeDayLabel(c.nextReview.dueDate);
    toast(message, 'success');
    return;
  }
  if (isModalOpen('modalReward')) rewardQueue.push(c);
  else showReward(c);
}

function closeReward() {
  closeModal('modalReward');
  setTimeout(() => {
    if (!appState) return;
    if (rewardQueue.length) {
      showReward(rewardQueue.shift());
      return;
    }
    if (pendingRatings.length && !isModalOpen('modalRating')) {
      const next = pendingRatings.shift();
      openRating(next.kind, next.id);
    }
  }, 220);
}

function handleProfileSubmit(event) {
  event.preventDefault();
  const form = $('#profileForm');
  clearFieldErrors(form);
  const name = toText($('#setName').value, 40);
  const grade = toText($('#setGrade').value, 40);
  let valid = true;
  if (name.length < 2) {
    setFieldError('setName', 'اكتب اسمك (حرفان على الأقل)');
    valid = false;
  }
  if (grade.length < 2) {
    setFieldError('setGrade', 'اكتب صفك أو سنتك الدراسية');
    valid = false;
  }
  if (!valid) return;
  mutate('profile', (s) => {
    s.profile.name = name;
    s.profile.grade = grade;
    s.profile.country = toText($('#setCountry').value, 40);
    s.profile.goalText = toText($('#setGoal').value, 120);
    s.profile.level = toInt($('#setLevel').value, 1, 4, 2);
  });
  toast('تم حفظ ملفك الشخصي', 'success');
  requestReplan('profile');
}

function handleAvailabilitySubmit(event) {
  event.preventDefault();
  const form = $('#availabilityForm');
  clearFieldErrors(form);
  const minutes = {};
  let total = 0;
  for (let d = 0; d <= 6; d += 1) {
    const input = $('input[name="min-' + d + '"]', form);
    const raw = String(input.value).trim();
    const n = Number(raw);
    if (raw === '' || !Number.isInteger(n) || n < 0 || n > 720) {
      setFieldError('availability', 'اكتب لكل يوم رقمًا بين 0 و720 دقيقة');
      input.focus();
      return;
    }
    minutes[d] = n;
    total += n;
  }
  const rest = getCheckedNumbers('rest', form);
  if (total <= 0) {
    setFieldError('availability', 'أضف وقتًا للمذاكرة في يوم واحد على الأقل');
    return;
  }
  if (rest.length >= 7) {
    setFieldError('availability', 'لا يمكن أن تكون كل الأيام أيام راحة');
    return;
  }
  const busy = getCheckedNumbers('busy', form);
  mutate('availability', (s) => {
    s.availability = { minutes, busy: toDayList(busy), rest: toDayList(rest) };
  });
  toast('حفظنا أوقاتك وأعدنا بناء جدولك', 'success');
  requestReplan('availability');
}

function handleExamSubmit(event) {
  event.preventDefault();
  const form = $('#examForm');
  clearFieldErrors(form);
  const result = addExam({ title: $('#examTitle').value, subjectId: $('#examSubject').value, subjectName: '', date: $('#examDate').value });
  if (!result.ok) {
    if (result.errors.title) setFieldError('examTitle', result.errors.title);
    if (result.errors.date) setFieldError('examDate', result.errors.date);
    return;
  }
  form.reset();
  renderExamSelectAndList();
  toast('أضفنا الامتحان ورفعنا أهمية مادته في جدولك', 'success');
}

function handleIntervalsSubmit(event) {
  event.preventDefault();
  clearFieldErrors($('#reviewIntervalsForm'));
  const limits = [60, 90, 120, 180];
  const values = [];
  for (let i = 0; i < 4; i += 1) {
    const n = readIntField('intv' + (i + 1), 1, limits[i]);
    if (Number.isNaN(n)) {
      setFieldError('intervals', 'اكتب أرقامًا صحيحة ضمن الحدود المسموحة لكل فاصل');
      return;
    }
    values.push(n);
  }
  for (let i = 1; i < 4; i += 1) {
    if (values[i] < values[i - 1]) {
      setFieldError('intervals', 'يجب أن تتزايد الفواصل أو تتساوى من الأولى إلى الرابعة');
      return;
    }
  }
  mutate('intervals', (s) => {
    s.settings.reviewIntervals = values;
  });
  toast('حفظنا فواصل المراجعة للمراجعات القادمة', 'success');
}

function handlePetRename(event) {
  event.preventDefault();
  clearFieldErrors($('#petRenameForm'));
  if (!appState.pet) return;
  const name = toText($('#petRenameInput').value, 20);
  if (name.length < 2) {
    setFieldError('petRenameInput', 'اختر اسمًا من حرفين على الأقل');
    return;
  }
  mutate('pet:rename', (s) => {
    s.pet.name = name;
  });
  toast('صار اسم رفيقك ' + name, 'success');
}

async function handleImportFile(file) {
  setFieldError('importFile', '');
  const result = await inspectBackupFile(file);
  if (!result.ok) {
    setFieldError('importFile', result.errors[0]);
    toast(result.errors[0], 'error');
    return;
  }
  const s = result.summary;
  let text = 'ستحل هذه النسخة محل كل بيانات حسابك الحالي. تحتوي النسخة على: المواد ' + s.subjects + '، المدرسون ' + s.teachers + '، المحاضرات ' + s.lectures + '، الجلسات ' + s.sessions + '، نقاط الخبرة ' + s.totalXp + '.';
  if (result.droppedTotal > 0) text += ' سيتم تجاهل ' + result.droppedTotal + ' عنصرًا غير صالح.';
  const confirmed = await confirmDialog({ title: 'استيراد نسخة احتياطية', text, okLabel: 'استيراد واستبدال' });
  if (!confirmed) return;
  const ok = await applyImportedState(result.state);
  if (!ok) {
    toast('تم الاستيراد لكن تعذر الحفظ على الجهاز', 'error');
    return;
  }
  resetStaleActive();
  ensureFreshDay();
  toast('تم استيراد النسخة الاحتياطية', 'success');
  closeView();
  if (!appState.profile.onboarded || !appState.pet) {
    enterAfterAuth();
    return;
  }
  refreshUi();
}

function onGameEnter() {
  closeView();
  rewardQueue.length = 0;
  setTodayPanel(window.innerWidth >= 1100);
  refreshUi();
  const hint = $('#mapHint');
  hint.classList.add('is-visible');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hint.classList.remove('is-visible'), 9000);
}

function onWorldClosedUi() {
  endRun();
  rewardQueue.length = 0;
  pendingRatings.length = 0;
  ratingState.kind = '';
  ratingState.id = '';
  closeView();
  setTodayPanel(false);
  $('#islandOverlay').hidden = true;
  $('#emptyWorld').hidden = true;
  $('#mapHint').classList.remove('is-visible');
  hudCache.avatarSig = '';
}

actions['open-view'] = (target) => {
  const name = target.dataset.viewTarget;
  if (!name || name === 'world') {
    closeView();
    if (getFocusedIslandId()) exitIsland();
    return;
  }
  openView(name);
};
actions['close-view'] = () => closeView();
actions['toggle-today'] = () => setTodayPanel(!isTodayOpen());
actions['replan'] = () => {
  replan('manual');
  scheduleUi();
  toast('أعدنا بناء جدولك من بياناتك الحالية', 'success');
};
actions['island-exit'] = () => {
  exitIsland();
};
actions['island-add-lecture'] = () => {
  const id = getFocusedIslandId();
  if (id) quickAddForSubject(id);
};
actions['start-session'] = (target) => beginSession(target.dataset.id);
actions['review-complete'] = (target) => openRating('review', target.dataset.id);
actions['review-postpone'] = (target) => {
  if (postponeReview(target.dataset.id, 1)) toast('أجّلنا المراجعة يومًا واحدًا', 'info');
};
actions['review-dismiss'] = async (target) => {
  const confirmed = await confirmDialog({ title: 'تخطي المراجعة', text: 'لن تُجدول هذه المراجعة مرة أخرى. هل تريد تخطيها؟', okLabel: 'تخطي' });
  if (confirmed && dismissReview(target.dataset.id)) toast('تم تخطي المراجعة', 'info');
};
actions['select-day'] = (target) => {
  viewState.date = target.dataset.date || todayStr();
  renderTodayView();
};
actions['quick-add-subject'] = (target) => quickAddForSubject(target.dataset.id);
actions['go-island'] = (target) => {
  closeView();
  if (!world.ready || world.mode !== 'game' || !focusIsland(target.dataset.id)) toast('تعذر الانتقال إلى الجزيرة الآن', 'warn');
};
actions['buy-cosmetic'] = (target) => {
  const result = buyCosmetic(target.dataset.id);
  toast(result.ok ? 'حصلت على ' + result.item.name + ' وألبسناه لرفيقك' : result.message, result.ok ? 'success' : 'warn');
  if (result.ok) playSound('success');
  renderAchievementsView();
  updateHud();
};
actions['toggle-cosmetic'] = (target) => {
  toggleCosmetic(target.dataset.id);
  renderAchievementsView();
};
actions['remove-exam'] = (target) => {
  removeExam(target.dataset.id);
  renderExamSelectAndList();
};
actions['run-pause'] = () => pauseRun();
actions['run-finish'] = () => finishRun();
actions['run-close'] = () => closeRun();
actions['run-postpone'] = () => postponeRun();
actions['close-reward'] = () => closeReward();
actions['export-backup'] = async () => {
  const ok = await exportBackup();
  toast(ok ? 'تم تجهيز النسخة الاحتياطية للتنزيل' : 'تعذر تصدير النسخة الاحتياطية', ok ? 'success' : 'error');
};
actions['import-backup'] = () => $('#importFile').click();
actions['logout'] = async () => {
  const confirmed = await confirmDialog({ title: 'تسجيل الخروج', text: 'سنحفظ بياناتك على هذا الجهاز ثم تخرج من حسابك.', okLabel: 'تسجيل الخروج', danger: false });
  if (confirmed) await logoutAccount();
};
actions['wipe-all'] = async () => {
  const confirmed = await confirmDialog({
    title: 'حذف كل البيانات',
    text: 'سيتم حذف كل الحسابات وبياناتها من هذا الجهاز نهائيًا. صدّر نسخة احتياطية أولًا إن أردت الاحتفاظ بشيء.',
    okLabel: 'حذف كل شيء',
    typeToConfirm: 'حذف'
  });
  if (!confirmed) return;
  await wipeAllData();
  toast('تم حذف كل البيانات من هذا الجهاز', 'info');
};

function bindAppEvents() {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || modalStack.length) return;
    if (isViewOpen()) closeView();
    else if (isTodayOpen()) setTodayPanel(false);
  });

  $('#profileForm').addEventListener('submit', handleProfileSubmit);
  $('#availabilityForm').addEventListener('submit', handleAvailabilitySubmit);
  $('#examForm').addEventListener('submit', handleExamSubmit);
  $('#reviewIntervalsForm').addEventListener('submit', handleIntervalsSubmit);
  $('#petRenameForm').addEventListener('submit', handlePetRename);

  $('#lectureFilterSubject').addEventListener('change', (event) => {
    viewState.lecture.subjectId = event.target.value;
    viewState.lecture.teacherId = 'all';
    renderLecturesView();
  });
  $('#lectureFilterTeacher').addEventListener('change', (event) => {
    viewState.lecture.teacherId = event.target.value;
    renderLecturesView();
  });
  $('#lectureFilterStatus').addEventListener('change', (event) => {
    viewState.lecture.status = event.target.value;
    renderLecturesView();
  });
  $('#sessionFilterStatus').addEventListener('change', (event) => {
    viewState.session.status = event.target.value;
    renderSessionsView();
  });
  $('#sessionFilterType').addEventListener('change', (event) => {
    viewState.session.type = event.target.value;
    renderSessionsView();
  });

  $('#setQuality').addEventListener('change', (event) => {
    deviceSettings.quality = pick(event.target.value, ['low', 'medium', 'high'], 'medium');
    saveDeviceSettings();
  });
  $('#setReduceMotion').addEventListener('change', (event) => {
    deviceSettings.reduceMotion = event.target.checked;
    saveDeviceSettings();
  });
  $('#setSound').addEventListener('change', (event) => {
    deviceSettings.sound = event.target.checked;
    saveDeviceSettings();
    if (deviceSettings.sound) playSound('success');
  });

  $$('.rating-btn').forEach((button) => {
    button.addEventListener('click', () => handleRatingChoice(button));
  });

  $('#importFile').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (file) await handleImportFile(file);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && appState && currentScreen === 'game') ensureFreshDay();
  });

  bus.on('state:changed', scheduleUi);
  bus.on('plan:updated', scheduleUi);
  bus.on('state:saved', updateSaveText);
  bus.on('state:saveError', () => toast('تعذر حفظ بياناتك على الجهاز، صدّر نسخة احتياطية الآن', 'error', 6000));
  bus.on('state:replaced', scheduleUi);
  bus.on('game:enter', onGameEnter);
  bus.on('world:closed', onWorldClosedUi);
  bus.on('island:enter', renderIslandOverlay);
  bus.on('island:exit', () => {
    $('#islandOverlay').hidden = true;
  });
  bus.on('reward:summary', handleReward);
    bus.on('modal:closed', (id) => {
    if (id === 'modalRating') {
      ratingState.kind = '';
      ratingState.id = '';
    }
  });
  bus.on('settings:device', applyMotionClass);
  bus.on('screen:changed', (name) => {
    if (name !== 'game') {
      closeView();
      setTodayPanel(false);
      $('#islandOverlay').hidden = true;
    }
  });
}

async function boot() {
  const loader = $('#loader');
  const loaderBar = $('#loaderBar');
  const loaderText = $('#loaderText');
  const step = (percent, text) => {
    loaderBar.style.width = percent + '%';
    loaderText.textContent = text;
    return nextFrame();
  };
  try {
    loadDeviceSettings();
    applyMotionClass();
    await step(15, 'تجهيز التخزين');
    await initStorage();
    const notice = storageNotice();
    if (notice) toast(notice, 'warn', 8000);
    bindFlowEvents();
    bindAppEvents();
    await step(40, 'فتح حسابك');
    let restored = { ok: false };
    try {
      restored = await restoreSession();
      if (!restored.ok && restored.error) toast(restored.error, 'error', 6000);
    } catch (e) {
      restored = { ok: false };
    }
    if (restored.ok) enterAfterAuth();
    else showScreen('splash');
    await step(70, 'بناء العالم');
    initWorld();
    await step(100, 'جاهز');
  } catch (e) {
    console.error(e);
    toast('حدث خطأ أثناء التشغيل، أعد تحميل الصفحة', 'error', 8000);
  }
  loader.classList.add('is-hidden');
  setTimeout(() => {
    loader.hidden = true;
  }, 700);
  requestPersistentStorage();
  clearInterval(freshDayTimer);
  freshDayTimer = setInterval(() => {
    if (appState && currentScreen === 'game') ensureFreshDay();
  }, 60000);
}

boot();