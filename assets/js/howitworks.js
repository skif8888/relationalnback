/* ==========================================================================
   howitworks.js — the explainer, rebuilt from whatever is currently switched on
   Nothing here is static copy about features the player is not using.
   ========================================================================== */
(function (root) {
  'use strict';

  var WORDS = {
    distinction: 'the same as · the opposite of',
    comparison: 'more than · less than',
    temporal: 'before · after',
    space2d: 'north · south · east · west · north-east · north-west · south-east · south-west',
    space3d: 'the eight compass words, each on its own or joined to above / below — 26 in all',
    space4d: 'the 26 directions of Space 3D, with was / is / will be carrying the time axis'
  };

  var ORDINAL = ['', 'one', 'two', 'three', 'four', 'five'];

  function nScreens(n) { return n === 1 ? 'one screen' : ORDINAL[n] + ' screens'; }
  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }

  function step(num, html) {
    return '<div class="hiw-step"><span>' + num + '</span><span>' + html + '</span></div>';
  }

  function block(title, tag, body) {
    return '<div class="hiw-block"><h4>' + Fmt.esc(title) +
      (tag ? '<em>' + Fmt.esc(tag) + '</em>' : '') + '</h4>' + body + '</div>';
  }

  /* ---- a real problem, generated with the player's own settings ---- */
  function demo(s) {
    var typeId = RRT.util.pick(s.types);
    var pool = RRT.makePool(s.symbols, s.premises + 1);
    var q = RRT.generate({
      typeId: typeId,
      premises: s.premises,
      entities: pool,
      scramble: Setup.scramble(s)
    });

    var lis = q.premises.map(function (p) { return '<li>' + Fmt.statement(p) + '</li>'; }).join('');
    var why = 'Put the premises back in order and the set says ' +
      q.canonical.map(function (c) { return '<b>' + Fmt.esc(c.text) + '</b>'; }).join(', then ') +
      '. That settles it: <b>' + Fmt.esc(q.derivedAsAsked.text) + '</b>. The conclusion claims <b>' +
      Fmt.esc(q.conclusionPlain.text) + '</b>, so the answer is <b>' +
      (q.answer ? 'True' : 'False') + '</b>.';

    return '<div class="hiw-demo">' +
      '<h5 class="hiw-h" style="margin-top:0">set on screen 1 · ' + Fmt.esc(q.typeLabel) + '</h5>' +
      '<ul>' + lis + '</ul>' +
      '<p class="demo-q">On screen ' + (s.n + 1) + ' you are asked: ' + Fmt.statement(q.conclusion) + '</p>' +
      '<p class="demo-a">' + why + '</p>' +
      '</div>' +
      '<button class="ghost hiw-refresh" data-hiw="again">Another example</button>';
  }

  /* ---- the whole panel ---- */
  function html(s) {
    var out = '';
    var load = Setup.memoryLoad(s);

    /* the rule */
    out += '<div class="rail-frame" id="hiw-rail"></div>';
    out += step('01', 'Each screen loads one set of <b>' + s.premises + ' ' +
      plural(s.premises, 'premise') + '</b>. Read it and hold on to it.');
    out += step('02', 'From screen <b>' + (s.n + 1) + '</b> on, a conclusion appears under the new set. ' +
      'It is not about the premises in front of you — it is about the set from <b>' +
      nScreens(s.n) + ' ago</b>.');
    out += step('03', 'Answer <b>True</b> or <b>False</b> for that older set, then load the next one. ' +
      'A set never comes back.');
    out += step('04', 'The last <b>' + nScreens(s.n) + '</b> bring no new premises — they clear out the ' +
      'conclusions still owing, so every set gets asked about exactly once.');
    out += '<p class="load-line">You are holding <b>' + s.n + ' ' + plural(s.n, 'set') +
      ' × ' + s.premises + ' ' + plural(s.premises, 'premise') + ' = ' + load + ' ' +
      plural(load, 'statement') + '</b> at any moment.</p>';

    /* relations */
    out += '<h4 class="hiw-h">Relations you switched on</h4>';
    s.types.forEach(function (id) {
      var t = RRT.TYPES[id];
      out += block(t.label, t.tagline,
        '<p>' + Fmt.esc(t.hint) + '</p><p class="hiw-words">' + Fmt.esc(WORDS[id]) + '</p>');
    });
    if (s.types.length > 1) {
      out += '<p class="load-line">Sets are drawn from these at random, so check the tag on the card ' +
        'before you start reading.</p>';
    }

    /* twists */
    var twists = '';
    if (s.order) {
      twists += block('Shuffled premises', 'on',
        '<p>Premises arrive in random order. The chain is there, but you have to find the ends yourself.</p>');
    }
    if (s.converse) {
      twists += block('Mirrored premises', 'on',
        '<p>Some premises are stated from the other side. “B is south of A” carries exactly the same ' +
        'information as “A is north of B” — flip it in your head before you link it up.</p>');
    }
    if (s.negation) {
      twists += block('Negations', 'on',
        '<p>Some sentences are phrased as a denial, shown <span class="neg">in this colour</span>. ' +
        'In this game a denial names the exact opposite: “is not north of” means “is south of”, ' +
        '“is not more than” means “is less than”. Conclusions can be phrased that way too.</p>');
    }
    if (s.timer) {
      twists += block('Clock', s.timer + ' s',
        '<p>Every screen is capped at ' + s.timer + ' seconds — reading time included. ' +
        'Letting it run out scores as a wrong answer.</p>');
    }
    if (s.symbolMode === 'fixed') {
      twists += block('One fixed symbol set', 'on',
        '<p>Every set is about the same ' + (s.premises + 1) + ' symbols. Nothing distinguishes ' +
        'one set from another except when you saw it, which is the hardest way to play.</p>');
    }
    twists += block('Symbols', Setup.SYMBOL_LABEL[s.symbols].toLowerCase(),
      '<p>' + Fmt.esc(Setup.SYMBOL_NOTE[s.symbols]) +
      (s.symbolMode === 'varied' ? ', redrawn for each set.' : '.') + '</p>');
    out += '<h4 class="hiw-h">How the wording is tampered with</h4>' + twists;

    /* worked example */
    out += '<h4 class="hiw-h">A worked example</h4>';
    out += '<div id="hiw-demo">' + demo(s) + '</div>';

    /* scoring */
    out += '<h4 class="hiw-h">Scoring</h4>';
    out += '<p class="load-line">A run is <b>' + s.rounds + ' sets</b>, so <b>' + s.rounds +
      ' conclusions</b> across <b>' + (s.rounds + s.n) + ' screens</b>. Score is the share you get right' +
      (s.timer ? ', with timeouts counted as wrong' : '') +
      '. Guessing blind lands around 50%.</p>';

    return out;
  }

  function render(box, s) {
    if (!box) return;
    box._s = s;
    box.innerHTML = html(s);
    Rail.draw(box.querySelector('#hiw-rail'), {
      total: Math.min(s.rounds + s.n, 9),
      current: Math.min(s.n + 2, s.rounds + s.n - 1),
      n: s.n,
      states: (function () {
        var a = [];
        for (var i = 0; i < 9; i++) a.push(i < s.n + 2 ? 'loaded' : 'pending');
        return a;
      }()),
      caption: s.n + ' back',
      live: true
    });
    if (!box._wired) {
      box._wired = true;
      box.addEventListener('click', function (e) {
        var b = e.target && e.target.closest && e.target.closest('[data-hiw="again"]');
        if (!b) return;
        var d = box.querySelector('#hiw-demo');
        if (d) d.innerHTML = demo(box._s);
      });
    }
  }

  root.HowItWorks = { render: render, demo: demo };
}(window));
