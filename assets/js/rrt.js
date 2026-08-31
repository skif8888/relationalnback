/* ==========================================================================
   rrt.js — relation algebra + premise-set generation
   Pure logic. No DOM. Also loadable in Node for the test suite.
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.RRT = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------- small helpers ------------------------------------------- */
  function randInt(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[randInt(a.length)]; }
  function coin(p) { return Math.random() < (p === undefined ? 0.5 : p); }
  function shuffle(a) {
    var out = a.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = randInt(i + 1); var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }
  function sgn(n) { return n > 0 ? 1 : n < 0 ? -1 : 0; }
  function vsgn(v) { return v.map(sgn); }
  function vadd(a, b) { return a.map(function (x, i) { return x + b[i]; }); }
  function vneg(v) { return v.map(function (x) { return -x; }); }
  function veq(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }

  /* ---------- compass vocabulary --------------------------------------- */
  /* x: east positive / west negative.  y: north positive / south negative. */
  var COMPASS = {
    '0,1': 'north', '0,-1': 'south', '1,0': 'east', '-1,0': 'west',
    '1,1': 'north-east', '-1,1': 'north-west', '1,-1': 'south-east', '-1,-1': 'south-west'
  };
  var DIRS_2D = Object.keys(COMPASS).map(function (k) {
    return k.split(',').map(Number);
  });

  function horizontalWord(x, y) { return COMPASS[[sgn(x), sgn(y)].join(',')] || ''; }

  /* every non-zero sign triple, 26 of them */
  var DIRS_3D = (function () {
    var out = [];
    [-1, 0, 1].forEach(function (x) {
      [-1, 0, 1].forEach(function (y) {
        [-1, 0, 1].forEach(function (z) {
          if (x || y || z) out.push([x, y, z]);
        });
      });
    });
    return out;
  }());

  function spatialBody(v) {
    var h = horizontalWord(v[0], v[1]);
    var z = sgn(v[2] === undefined ? 0 : v[2]);
    var vert = z === 1 ? 'above' : z === -1 ? 'below' : '';
    if (h && vert) return vert + ' and ' + h + ' of';
    if (h) return h + ' of';
    return vert; // "A is above B" — reads fine without "of"
  }

  var TENSE = {
    '1':  { verb: 'will be', notVerb: 'will not be' },
    '0':  { verb: 'is',      notVerb: 'is not' },
    '-1': { verb: 'was',     notVerb: 'was not' }
  };

  /* ---------- shared behaviour for ordered (linear) relations ---------- */
  function linearType(id, label, tagline, posWord, negWord, hint) {
    return {
      id: id, label: label, tagline: tagline, hint: hint,
      arity: 2,
      buildChain: function (p) {
        var d = coin() ? 1 : -1, out = [];
        for (var i = 0; i < p; i++) out.push(d);
        return out;
      },
      compose: function (a, b) { return a === b ? a : null; },
      invert: function (r) { return -r; },
      opposite: function (r) { return -r; },
      display: function (r) { return r; },
      valid: function (r) { return r === 1 || r === -1; },
      same: function (a, b) { return a === b; },
      phrase: function (r) {
        return { verb: 'is', notVerb: 'is not', body: r === 1 ? posWord : negWord };
      },
      falseAlternative: function (r) { return -r; }
    };
  }

  /* ---------- shared behaviour for vector (spatial) relations ---------- */
  function spatialType(id, label, tagline, dirs, hasTime, hint) {
    var dim = hasTime ? 4 : dirs[0].length;

    function randomLink() {
      var s = pick(dirs).slice();
      if (hasTime) s.push(pick([-1, 0, 1]));
      while (s.length < dim) s.push(0);
      return s;
    }
    function spatialZero(v) {
      for (var i = 0; i < 3 && i < v.length; i++) { if (sgn(v[i]) !== 0) return false; }
      return true;
    }
    return {
      id: id, label: label, tagline: tagline, hint: hint,
      arity: 2,
      buildChain: function (p) {
        var links = [], net = null, i, attempt;
        for (attempt = 0; attempt < 400; attempt++) {
          links = []; net = null;
          for (i = 0; i < p; i++) {
            var l = randomLink();
            links.push(l);
            net = net === null ? l.slice() : vadd(net, l);
          }
          if (!spatialZero(net)) return links;
        }
        // fallback: reroll only the last step until the sum lands somewhere nameable
        for (i = 0; i < 500; i++) {
          links[links.length - 1] = randomLink();
          net = links.reduce(function (a, b) { return vadd(a, b); });
          if (!spatialZero(net)) break;
        }
        return links;
      },
      compose: function (a, b) { return vadd(a, b); },
      invert: function (r) { return vneg(r); },
      opposite: function (r) { return vneg(r); },
      display: function (r) { return vsgn(r); },
      valid: function (r) { return !spatialZero(r); },
      same: function (a, b) { return veq(vsgn(a), vsgn(b)); },
      phrase: function (r) {
        var t = hasTime ? TENSE[String(sgn(r[3] || 0))] : TENSE['0'];
        return { verb: t.verb, notVerb: t.notVerb, body: spatialBody(r) };
      },
      falseAlternative: function (r) {
        var truth = vsgn(r);
        var all = [];
        dirs.forEach(function (d) {
          if (hasTime) {
            [-1, 0, 1].forEach(function (t) {
              var cand = d.slice(0, 3).concat([t]);
              if (!veq(cand, truth)) all.push(cand);
            });
          } else {
            var cand2 = d.slice();
            if (!veq(cand2, truth)) all.push(cand2);
          }
        });
        // prefer a near miss: differs from the truth in exactly one component
        var near = all.filter(function (c) {
          var diff = 0;
          for (var i = 0; i < c.length; i++) if (c[i] !== truth[i]) diff++;
          return diff === 1;
        });
        if (near.length && coin(0.65)) return pick(near);
        return all.length ? pick(all) : vneg(truth);
      }
    };
  }

  /* ---------- the relation catalogue ----------------------------------- */
  var TYPES = {};

  TYPES.distinction = {
    id: 'distinction', label: 'Distinction', tagline: 'same / opposite',
    hint: 'Two “same” links cancel out. One “opposite” flips the answer, two flip it back.',
    arity: 2,
    buildChain: function (p) {
      var out = [];
      for (var i = 0; i < p; i++) out.push(coin() ? 0 : 1);
      return out;
    },
    compose: function (a, b) { return (a + b) % 2; },
    invert: function (r) { return r; },           // symmetric relation
    opposite: function (r) { return 1 - r; },
    display: function (r) { return r; },
    valid: function (r) { return r === 0 || r === 1; },
    same: function (a, b) { return a === b; },
    phrase: function (r) {
      return { verb: 'is', notVerb: 'is not', body: r === 0 ? 'the same as' : 'the opposite of' };
    },
    falseAlternative: function (r) { return 1 - r; }
  };

  TYPES.comparison = linearType(
    'comparison', 'Comparison', 'more / less',
    'more than', 'less than',
    'Every link points the same way, so the ends of the chain keep that order.'
  );

  TYPES.temporal = linearType(
    'temporal', 'Temporal', 'before / after',
    'after', 'before',
    'A timeline. Follow the links to the two ends and read off the order.'
  );

  TYPES.space2d = spatialType(
    'space2d', 'Space 2D', 'compass plane', DIRS_2D, false,
    '“north-east of” means north AND east. Add the steps up like moves on a map.'
  );

  TYPES.space3d = spatialType(
    'space3d', 'Space 3D', 'compass + height', DIRS_3D, false,
    'Same as 2D with a height axis. Track east/west, north/south and above/below separately.'
  );

  TYPES.space4d = spatialType(
    'space4d', 'Space 4D', 'space + time', DIRS_3D, true,
    'The verb carries time: “was” is earlier, “will be” is later, “is” is the same moment.'
  );

  var TYPE_ORDER = ['distinction', 'comparison', 'temporal', 'space2d', 'space3d', 'space4d'];

  /* ---------- statement construction ----------------------------------- */
  function makeStatement(type, subject, object, rel, negated) {
    var shown = negated ? type.opposite(rel) : rel;
    var ph = type.phrase(type.display(shown));
    return {
      subject: subject,
      object: object,
      verb: negated ? ph.notVerb : ph.verb,
      body: ph.body,
      negated: !!negated,
      asserts: rel,   // what the sentence actually claims, subject -> object
      text: subject + ' ' + (negated ? ph.notVerb : ph.verb) + ' ' + ph.body + ' ' + object
    };
  }

  /* ---------- the generator -------------------------------------------- */
  /*
     opts = {
       typeId:     'space2d',
       premises:   2,                       // links in the chain
       entities:   ['A','B','C'],           // at least premises + 1 symbols
       scramble:   { order: true, converse: true, negation: false },
       negationRate: 0.4
     }
  */
  function generate(opts) {
    var type = TYPES[opts.typeId];
    if (!type) throw new Error('unknown relation type: ' + opts.typeId);

    var p = Math.max(1, opts.premises | 0);
    var ents = shuffle(opts.entities).slice(0, p + 1);
    if (ents.length < p + 1) throw new Error('not enough symbols for ' + p + ' premises');

    var sc = opts.scramble || {};
    var negRate = opts.negationRate === undefined ? 0.4 : opts.negationRate;

    var links = type.buildChain(p);
    var net = links[0];
    for (var i = 1; i < links.length; i++) {
      net = type.compose(net, links[i]);
      if (net === null) throw new Error('non-composable chain');
    }
    var truth = type.display(net);

    /* premises, in chain order, plain and affirmative — used by the review */
    var canonical = links.map(function (rel, i) {
      return makeStatement(type, ents[i], ents[i + 1], rel, false);
    });

    /* premises as the player sees them */
    var shown = links.map(function (rel, i) {
      var s = ents[i], o = ents[i + 1], r = rel;
      if (sc.converse && coin()) { s = ents[i + 1]; o = ents[i]; r = type.invert(rel); }
      var neg = !!sc.negation && coin(negRate);
      return makeStatement(type, s, o, r, neg);
    });
    if (sc.order) shown = shuffle(shown);

    /* the conclusion */
    var isTrue = coin();
    var cRel = isTrue ? truth : type.falseAlternative(truth);
    var cs = ents[0], co = ents[p];
    if (coin()) { cs = ents[p]; co = ents[0]; cRel = type.invert(cRel); }
    var cNeg = !!sc.negation && coin(negRate * 0.8);
    var conclusion = makeStatement(type, cs, co, cRel, cNeg);
    conclusion.isTrue = isTrue;

    /* what the chain actually entails, stated plainly */
    var derived = makeStatement(type, ents[0], ents[p], truth, false);

    /* the conclusion with the negation unwound — what it is really claiming */
    var conclusionPlain = makeStatement(type, cs, co, cRel, false);

    /* the truth, phrased with the same subject and object the question used,
       so the two can be read side by side */
    var truthAsAsked = (cs === ents[0]) ? truth : type.invert(truth);
    var derivedAsAsked = makeStatement(type, cs, co, truthAsAsked, false);

    return {
      conclusionPlain: conclusionPlain,
      derivedAsAsked: derivedAsAsked,
      typeId: type.id,
      typeLabel: type.label,
      entities: ents,
      premises: shown,
      canonical: canonical,
      derived: derived,
      conclusion: conclusion,
      answer: isTrue
    };
  }

  /* ---------- symbol pools --------------------------------------------- */
  var LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
  var CONS = 'BDFGHJKLMNPRSTVZ'.split('');
  var VOWS = 'AEIOU'.split('');
  var WORDS = [
    'anchor', 'basket', 'candle', 'dolphin', 'ember', 'fossil', 'granite', 'harbour',
    'ivory', 'jigsaw', 'kettle', 'lantern', 'marble', 'nutmeg', 'orchid', 'pebble',
    'quiver', 'ribbon', 'saddle', 'thistle', 'umbrella', 'velvet', 'walnut', 'yarrow',
    'almond', 'bellows', 'copper', 'driftwood', 'engine', 'feather', 'glacier', 'hazel'
  ];
  var EMOJI = [
    '🍒', '🌵', '🔔', '🪁', '🧊', '🍄', '🪶', '🛶', '🧭', '🕯️', '🪗', '🐚',
    '🌙', '🪵', '🍯', '🧲', '🎈', '🪴', '🔦', '🪐', '🧅', '🥁', '🪀', '🌶️'
  ];

  function nonsenseWord() {
    return pick(CONS) + pick(VOWS) + pick(CONS);
  }

  function makePool(style, size) {
    var out = [], seen = {}, guard = 0;
    if (style === 'letters') return shuffle(LETTERS).slice(0, size);
    if (style === 'words') return shuffle(WORDS).slice(0, size).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
    if (style === 'emoji') return shuffle(EMOJI).slice(0, size);
    while (out.length < size && guard++ < 4000) {   // nonsense syllables
      var w = nonsenseWord();
      if (!seen[w]) { seen[w] = 1; out.push(w); }
    }
    return out;
  }

  return {
    TYPES: TYPES,
    TYPE_ORDER: TYPE_ORDER,
    generate: generate,
    makePool: makePool,
    makeStatement: makeStatement,
    util: { pick: pick, coin: coin, shuffle: shuffle, randInt: randInt, sgn: sgn }
  };
}));
