/* ==========================================================================
   settings.js — the setup model, its presets, and where it is stored
   ========================================================================== */
(function (root) {
  'use strict';

  var KEY_SET = 'delayline.v1.setup';
  var KEY_RUN = 'delayline.v1.runs';

  var DEFAULTS = {
    n: 2,
    types: ['space2d'],
    preset: 'standard',
    premises: 2,
    rounds: 12,
    order: true,
    converse: false,
    negation: false,
    symbols: 'letters',      /* letters | nonsense | words | emoji */
    symbolMode: 'varied',    /* varied | fixed */
    timer: 0,                /* seconds per screen, 0 = off */
    feedback: true,
    autoAdvance: false
  };

  /* the knobs a preset owns — everything except delay and relation choice */
  var PRESET_KEYS = ['premises', 'rounds', 'order', 'converse', 'negation', 'symbols', 'symbolMode', 'timer'];

  var PRESETS = {
    warmup: {
      label: 'Warm-up', blurb: 'one premise per set, plain wording, no clock',
      premises: 1, rounds: 10, order: false, converse: false, negation: false,
      symbols: 'letters', symbolMode: 'varied', timer: 0
    },
    standard: {
      label: 'Standard', blurb: 'two premises, shuffled order, no clock',
      premises: 2, rounds: 12, order: true, converse: false, negation: false,
      symbols: 'letters', symbolMode: 'varied', timer: 0
    },
    brutal: {
      label: 'Brutal', blurb: 'three premises, mirrored and negated, one symbol set, 45 s a screen',
      premises: 3, rounds: 16, order: true, converse: true, negation: true,
      symbols: 'nonsense', symbolMode: 'fixed', timer: 45
    },
    custom: { label: 'Custom', blurb: 'your own dials' }
  };

  var SYMBOL_LABEL = {
    letters: 'Letters', nonsense: 'Nonsense', words: 'Words', emoji: 'Emoji'
  };
  var SYMBOL_NOTE = {
    letters: 'single letters — easiest to hold',
    nonsense: 'made-up syllables — nothing to lean on',
    words: 'real words — vivid, but they invite stories',
    emoji: 'pictures — strong visual hooks'
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function sane(s) {
    var out = Object.assign(clone(DEFAULTS), s || {});
    out.n = clamp(out.n | 0, 1, 4);
    out.premises = clamp(out.premises | 0, 1, 4);
    out.rounds = clamp(out.rounds | 0, Math.max(4, out.n + 1), 40);
    out.timer = clamp(out.timer | 0, 0, 120);
    if (!Array.isArray(out.types)) out.types = clone(DEFAULTS.types);
    out.types = out.types.filter(function (t) { return !!RRT.TYPES[t]; });
    if (!out.types.length) out.types = clone(DEFAULTS.types);
    if (!SYMBOL_LABEL[out.symbols]) out.symbols = 'letters';
    if (out.symbolMode !== 'fixed') out.symbolMode = 'varied';
    return out;
  }

  function load() {
    try {
      return sane(JSON.parse(root.localStorage.getItem(KEY_SET)));
    } catch (e) { return sane(null); }
  }

  function save(s) {
    try { root.localStorage.setItem(KEY_SET, JSON.stringify(s)); } catch (e) {}
  }

  function loadRuns() {
    try { return JSON.parse(root.localStorage.getItem(KEY_RUN)) || []; }
    catch (e) { return []; }
  }

  function saveRun(run) {
    var all = loadRuns();
    all.unshift(run);
    all = all.slice(0, 25);
    try { root.localStorage.setItem(KEY_RUN, JSON.stringify(all)); } catch (e) {}
    return all;
  }

  function wipe() {
    try {
      root.localStorage.removeItem(KEY_SET);
      root.localStorage.removeItem(KEY_RUN);
    } catch (e) {}
  }

  function applyPreset(s, name) {
    var p = PRESETS[name];
    if (!p || name === 'custom') { s.preset = 'custom'; return s; }
    PRESET_KEYS.forEach(function (k) { s[k] = p[k]; });
    s.preset = name;
    return sane(s);
  }

  /* which preset, if any, the current dials still match */
  function detectPreset(s) {
    var hit = null;
    Object.keys(PRESETS).forEach(function (name) {
      if (name === 'custom' || hit) return;
      var p = PRESETS[name];
      var same = PRESET_KEYS.every(function (k) { return s[k] === p[k]; });
      if (same) hit = name;
    });
    return hit || 'custom';
  }

  function scramble(s) {
    return { order: !!s.order, converse: !!s.converse, negation: !!s.negation };
  }

  /* how many statements are in the air at once */
  function memoryLoad(s) { return s.n * s.premises; }

  function typeLabels(s) {
    return s.types.map(function (t) { return RRT.TYPES[t].label; });
  }

  function joinList(a) {
    if (a.length <= 1) return a[0] || '';
    if (a.length === 2) return a[0] + ' and ' + a[1];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }

  root.Setup = {
    DEFAULTS: DEFAULTS,
    PRESETS: PRESETS,
    PRESET_KEYS: PRESET_KEYS,
    SYMBOL_LABEL: SYMBOL_LABEL,
    SYMBOL_NOTE: SYMBOL_NOTE,
    load: load, save: save, sane: sane, clone: clone,
    loadRuns: loadRuns, saveRun: saveRun, wipe: wipe,
    applyPreset: applyPreset, detectPreset: detectPreset,
    scramble: scramble, memoryLoad: memoryLoad,
    typeLabels: typeLabels, joinList: joinList
  };
}(window));
