/* ==========================================================================
   app.js — setup screen, the run loop, and the result sheet
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var S = Setup.load();
  var run = null;
  var view = 'menu';
  var heroTimer = null, heroPos = 0;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ORD = ['', 'one screen', 'two screens', 'three screens', 'four screens'];
  function pl(n, one, many) { return n === 1 ? one : (many || one + 's'); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ====================================================================
     screens
     ==================================================================== */
  function show(name) {
    view = name;
    ['menu', 'play', 'done'].forEach(function (k) {
      $('screen-' + k).classList.toggle('is-on', k === name);
    });
    window.scrollTo(0, 0);
    if (name === 'menu') { drawHero(); startHero(); } else { stopHero(); }
    if (name === 'play') drawPlayRail();
    if (name === 'done') drawDoneRail();
  }

  /* ====================================================================
     setup screen
     ==================================================================== */
  function buildN() {
    var box = $('seg-n');
    box.className = 'seg seg-n';
    box.innerHTML = '';
    [1, 2, 3, 4].forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = v;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', v + ' back');
      b.addEventListener('click', function () {
        S.n = v;
        if (S.rounds < S.n + 1) S.rounds = S.n + 1;
        commit();
      });
      box.appendChild(b);
    });
  }

  function buildTypes() {
    var box = $('chips-types');
    box.innerHTML = '';
    RRT.TYPE_ORDER.forEach(function (id) {
      var t = RRT.TYPES[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.type = id;
      b.innerHTML = Fmt.esc(t.label) + '<i>' + Fmt.esc(t.tagline) + '</i>';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        var at = S.types.indexOf(id);
        if (at >= 0) {
          if (S.types.length === 1) return;   /* one has to stay on */
          S.types.splice(at, 1);
        } else {
          S.types.push(id);
        }
        S.types = RRT.TYPE_ORDER.filter(function (x) { return S.types.indexOf(x) >= 0; });
        commit();
      });
      box.appendChild(b);
    });
  }

  function buildPresets() {
    var box = $('seg-preset');
    box.innerHTML = '';
    ['warmup', 'standard', 'brutal', 'custom'].forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = Setup.PRESETS[name].label;
      b.dataset.preset = name;
      b.setAttribute('role', 'radio');
      b.addEventListener('click', function () {
        if (name === 'custom') {
          $('drawer-adv').open = true;
          $('drawer-adv').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
          return;
        }
        S = Setup.applyPreset(S, name);
        commit();
      });
      box.appendChild(b);
    });
  }

  /* ---- fine tuning ---- */
  function slider(id, label, note, min, max, stepv, get, set, fmt) {
    var wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML =
      '<div class="field-head"><label for="' + id + '">' + label + '</label>' +
      '<span class="val" id="' + id + '-v"></span></div>' +
      '<p>' + note + '</p>' +
      '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + stepv + '">';
    var input = wrap.querySelector('input');
    input.addEventListener('input', function () {
      set(parseInt(input.value, 10));
      commit();
    });
    wrap._sync = function () {
      input.value = get();
      wrap.querySelector('#' + id + '-v').textContent = fmt(get());
    };
    return wrap;
  }

  function toggle(label, note, get, set) {
    var wrap = document.createElement('label');
    wrap.className = 'switch';
    wrap.innerHTML = '<input type="checkbox"><span class="track"></span>' +
      '<span class="switch-txt"><strong>' + label + '</strong><span>' + note + '</span></span>';
    var input = wrap.querySelector('input');
    input.addEventListener('change', function () { set(input.checked); commit(); });
    wrap._sync = function () { input.checked = !!get(); };
    var field = document.createElement('div');
    field.className = 'field field-switch';
    field.appendChild(wrap);
    field._sync = wrap._sync;
    return field;
  }

  function segField(label, note, options, get, set) {
    var txt = function () { return typeof note === 'function' ? note() : note; };
    var field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = '<div class="field-head"><label>' + label + '</label></div><p>' + txt() + '</p>';
    var seg = document.createElement('div');
    seg.className = 'seg';
    options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.label;
      b.dataset.v = o.value;
      b.addEventListener('click', function () { set(o.value); commit(); });
      seg.appendChild(b);
    });
    field.appendChild(seg);
    field._sync = function () {
      Array.prototype.forEach.call(seg.children, function (b) {
        b.classList.toggle('is-on', b.dataset.v === String(get()));
      });
      field.querySelector('p').textContent = txt();
    };
    return field;
  }

  var advFields = [];

  function buildAdvanced() {
    var box = $('adv-body');
    box.innerHTML = '';
    advFields = [];

    advFields.push(slider('f-prem', 'Premises per set',
      'Each extra premise adds another link to the chain you have to follow.',
      1, 4, 1,
      function () { return S.premises; },
      function (v) { S.premises = v; },
      function (v) { return v + ' ' + pl(v, 'premise'); }));

    advFields.push(slider('f-rounds', 'Sets in a run',
      'Also the number of conclusions you will be asked.',
      4, 40, 1,
      function () { return S.rounds; },
      function (v) { S.rounds = Math.max(v, S.n + 1); },
      function (v) { return v + ' sets'; }));

    advFields.push(slider('f-timer', 'Seconds per screen',
      'Reading time counts. Slide to zero to play without a clock.',
      0, 90, 5,
      function () { return S.timer; },
      function (v) { S.timer = v; },
      function (v) { return v ? v + ' s' : 'no clock'; }));

    advFields.push(toggle('Shuffle the premises',
      'Sets arrive out of order, so you have to find the chain.',
      function () { return S.order; }, function (v) { S.order = v; }));

    advFields.push(toggle('Mirror some premises',
      '“B is south of A” instead of “A is north of B”.',
      function () { return S.converse; }, function (v) { S.converse = v; }));

    advFields.push(toggle('Negate some premises',
      'Denials, meaning the exact opposite relation. Marked in colour.',
      function () { return S.negation; }, function (v) { S.negation = v; }));

    advFields.push(segField('Symbols', function () { return Setup.SYMBOL_NOTE[S.symbols]; },
      [{ value: 'letters', label: 'Letters' }, { value: 'nonsense', label: 'Nonsense' },
       { value: 'words', label: 'Words' }, { value: 'emoji', label: 'Emoji' }],
      function () { return S.symbols; }, function (v) { S.symbols = v; }));

    advFields.push(segField('Symbol pool',
      'A fixed pool removes every cue except when you saw the set.',
      [{ value: 'varied', label: 'Fresh each set' }, { value: 'fixed', label: 'One fixed set' }],
      function () { return S.symbolMode; }, function (v) { S.symbolMode = v; }));

    advFields.push(toggle('Show the answer after each conclusion',
      'Turn off for a blind run and read everything at the end.',
      function () { return S.feedback; }, function (v) { S.feedback = v; }));

    advFields.push(toggle('Move on by itself after answering',
      'Off means you decide when to leave the new set behind.',
      function () { return S.autoAdvance; }, function (v) { S.autoAdvance = v; }));

    advFields.forEach(function (f) { box.appendChild(f); });

    var reset = document.createElement('div');
    reset.className = 'reset-line';
    var btn = document.createElement('button');
    btn.className = 'ghost';
    btn.type = 'button';
    btn.textContent = 'Reset everything';
    btn.addEventListener('click', function () {
      if (!confirm('Reset the setup and delete your past runs?')) return;
      Setup.wipe();
      S = Setup.sane(null);
      buildAdvanced();
      commit();
    });
    reset.appendChild(btn);
    box.appendChild(reset);
  }

  /* ---- keep the setup screen in step with S ---- */
  function sync() {
    S = Setup.sane(S);
    S.preset = Setup.detectPreset(S);

    Array.prototype.forEach.call($('seg-n').children, function (b, i) {
      b.setAttribute('aria-checked', String(i + 1 === S.n));
    });
    Array.prototype.forEach.call($('chips-types').children, function (b) {
      var on = S.types.indexOf(b.dataset.type) >= 0;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    Array.prototype.forEach.call($('seg-preset').children, function (b) {
      b.setAttribute('aria-checked', String(b.dataset.preset === S.preset));
      b.classList.toggle('is-on', b.dataset.preset === S.preset);
    });

    $('hero-line').innerHTML = 'Read the premises now.<br>Judge them <em>' +
      ORD[S.n] + '</em> later.';

    $('hero-sub').innerHTML = '<b>' + Fmt.esc(Setup.joinList(Setup.typeLabels(S))) + '</b> — ' +
      S.premises + ' ' + pl(S.premises, 'premise') + ' a set, ' +
      Fmt.esc(Setup.SYMBOL_LABEL[S.symbols].toLowerCase()) + ' as symbols.';

    var twists = [];
    if (S.order) twists.push('shuffled');
    if (S.converse) twists.push('mirrored');
    if (S.negation) twists.push('negated');
    if (S.symbolMode === 'fixed') twists.push('one fixed symbol set');
    twists.push(S.timer ? S.timer + ' s a screen' : 'no clock');

    var load = Setup.memoryLoad(S);
    $('load-line').innerHTML =
      '<b>' + S.n + ' ' + pl(S.n, 'set') + '</b> in the air × <b>' + S.premises + ' ' +
      pl(S.premises, 'premise') + '</b> = <b>' + load + ' ' + pl(load, 'statement') + '</b> to hold' +
      '<br><b>' + S.rounds + '</b> conclusions over <b>' + (S.rounds + S.n) + '</b> screens · ' +
      Fmt.esc(twists.join(' · '));

    advFields.forEach(function (f) { if (f._sync) f._sync(); });

    if ($('drawer-how').open) HowItWorks.render($('how-body'), S);
    drawHero();
  }

  function commit() { sync(); Setup.save(S); }

  /* ---- hero rail ---- */
  function drawHero() {
    var total = 9;
    if (heroPos < S.n) heroPos = S.n;
    if (heroPos > total - 1) heroPos = S.n;
    var states = [];
    for (var i = 0; i < total; i++) states.push(i < heroPos ? 'loaded' : 'pending');
    Rail.draw($('hero-rail'), {
      total: total, current: heroPos, n: S.n,
      states: states, caption: S.n + ' back', live: !reduced
    });
  }

  function startHero() {
    stopHero();
    if (reduced) return;
    heroTimer = setInterval(function () {
      heroPos = heroPos + 1 > 8 ? S.n : heroPos + 1;
      drawHero();
    }, 1500);
  }
  function stopHero() { if (heroTimer) clearInterval(heroTimer); heroTimer = null; }

  /* ---- past runs ---- */
  function ago(ms) {
    var s = Math.round((Date.now() - ms) / 1000);
    if (s < 90) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60);
    if (h < 36) return h + ' h ago';
    return Math.round(h / 24) + ' d ago';
  }

  function renderStats() {
    var runs = Setup.loadRuns();
    $('stats-count').textContent = runs.length ? runs.length + ' saved' : 'nothing yet';
    var box = $('stats-body');
    if (!runs.length) {
      box.innerHTML = '<p class="empty">Finish a run and it will be listed here, on this device only.</p>';
      return;
    }
    var html = '<ul class="runs">';
    runs.forEach(function (r) {
      html += '<li><span class="pc">' + r.acc + '%</span>' +
        '<span>' + r.n + '-back · ' + Fmt.esc(r.typeLabels) + '</span>' +
        '<span class="meta">' + r.right + '/' + r.asked + ' · ' + ago(r.at) + '</span></li>';
    });
    html += '</ul>';
    box.innerHTML = html;
  }

  /* ====================================================================
     the run
     ==================================================================== */
  function startRun() {
    var need = S.premises + 1;
    var poolSize = S.symbolMode === 'fixed' ? need : Math.max(need + 5, 10);
    var pool = RRT.makePool(S.symbols, poolSize);
    var sets = [];
    for (var i = 0; i < S.rounds; i++) {
      sets.push(RRT.generate({
        typeId: RRT.util.pick(S.types),
        premises: S.premises,
        entities: pool,
        scramble: Setup.scramble(S)
      }));
    }
    var total = S.rounds + S.n;
    run = {
      setup: Setup.clone(S),
      sets: sets,
      total: total,
      i: 0,
      answers: new Array(S.rounds).fill(null),
      states: new Array(total).fill('pending'),
      answered: false,
      shownAt: 0,
      raf: 0,
      startedAt: Date.now()
    };
    show('play');
    renderScreen();
  }

  function probeIndex() { return run.i >= run.setup.n ? run.i - run.setup.n : -1; }
  function loadIndex() { return run.i < run.setup.rounds ? run.i : -1; }

  function renderScreen() {
    var n = run.setup.n, li = loadIndex(), pi = probeIndex();

    $('phase-label').textContent = 'Screen ' + (run.i + 1) + ' of ' + run.total;
    var right = run.answers.filter(function (a) { return a && a.ok; }).length;
    var wrong = run.answers.filter(function (a) { return a && !a.ok; }).length;
    $('score-label').innerHTML = right || wrong
      ? '<b>' + right + ' right</b> · <s>' + wrong + ' off</s>' : '';

    /* premise card */
    var loadCard = $('card-premises');
    if (li >= 0) {
      loadCard.classList.remove('is-hidden');
      var set = run.sets[li];
      $('load-label').textContent = 'Set ' + pad2(li + 1);
      $('load-type').textContent = set.typeLabel;
      $('premise-list').innerHTML = set.premises.map(function (p) {
        return '<li>' + Fmt.statement(p) + '</li>';
      }).join('');
      $('load-note').textContent = pi >= 0
        ? 'Hold this one too. The question below is about set ' + pad2(pi + 1) + '.'
        : (n - run.i > 1
            ? 'Nothing to answer yet. ' + (n - run.i) + ' more sets before the questions start.'
            : 'Nothing to answer yet. Questions start on the next screen.');
      run.states[run.i] = 'loaded';
    } else {
      loadCard.classList.add('is-hidden');
    }

    /* probe card */
    var probeCard = $('card-probe');
    if (pi >= 0) {
      probeCard.classList.remove('is-hidden');
      var pset = run.sets[pi];
      $('probe-label').innerHTML = 'Conclusion about <b>set ' + pad2(pi + 1) + '</b> — ' +
        run.setup.n + ' back';
      $('probe-type').textContent = pset.typeLabel;
      $('conclusion-text').innerHTML = Fmt.statement(pset.conclusion);
      $('btn-true').disabled = false;
      $('btn-false').disabled = false;
      $('btn-true').classList.remove('is-picked');
      $('btn-false').classList.remove('is-picked');
      $('verdict').className = 'verdict';
      $('verdict').innerHTML = '';
    } else {
      probeCard.classList.add('is-hidden');
    }

    /* next button */
    var last = run.i >= run.total - 1;
    $('next-label').textContent = last ? 'See the results'
      : li >= 0 ? 'Next set' : 'Next conclusion';
    $('btn-next').classList.toggle('is-final', last);
    $('btn-next').classList.toggle('is-on', pi < 0);

    run.answered = false;
    run.shownAt = Date.now();
    drawPlayRail();
    startTimer();
  }

  function drawPlayRail() {
    if (!run) return;
    Rail.draw($('play-rail'), {
      total: run.total, current: run.i, n: run.setup.n,
      states: run.states, caption: run.setup.n + ' back', live: !reduced
    });
  }

  function flash(ok) {
    if (reduced) return;
    var d = document.createElement('div');
    d.className = 'flash go-' + (ok ? 'ok' : 'bad');
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 520);
  }

  function answer(given) {
    var pi = probeIndex();
    if (!run || run.answered || pi < 0) return;
    run.answered = true;
    stopTimer();

    var set = run.sets[pi];
    var ok = given === set.answer;
    run.answers[pi] = { given: given, ok: ok, ms: Date.now() - run.shownAt, timedOut: false };
    run.states[run.i] = ok ? 'right' : 'wrong';

    $('btn-true').disabled = true;
    $('btn-false').disabled = true;
    $(given ? 'btn-true' : 'btn-false').classList.add('is-picked');
    flash(ok);

    if (run.setup.feedback) {
      var v = $('verdict');
      v.className = 'verdict is-on ' + (ok ? 'ok' : 'bad');
      v.innerHTML = ok
        ? '<b>Right.</b> <span>Set ' + pad2(pi + 1) + ' had ' + Fmt.esc(set.derivedAsAsked.text) + '.</span>'
        : '<b>No — it was ' + (set.answer ? 'True' : 'False') + '.</b> <span>Set ' + pad2(pi + 1) +
          ' had ' + Fmt.esc(set.derivedAsAsked.text) + '.</span>';
    }

    var right = run.answers.filter(function (a) { return a && a.ok; }).length;
    var wrong = run.answers.filter(function (a) { return a && !a.ok; }).length;
    $('score-label').innerHTML = '<b>' + right + ' right</b> · <s>' + wrong + ' off</s>';
    drawPlayRail();

    if (run.setup.autoAdvance) {
      setTimeout(next, run.setup.feedback ? 900 : 240);
    } else {
      $('btn-next').classList.add('is-on');
    }
  }

  function next() {
    if (!run) return;
    if (run.i >= run.total - 1) { finish(false); return; }
    run.i++;
    renderScreen();
  }

  /* ---- clock ---- */
  function stopTimer() {
    if (run && run.raf) cancelAnimationFrame(run.raf);
    if (run) run.raf = 0;
  }

  function startTimer() {
    stopTimer();
    var bar = $('timerbar');
    if (!run.setup.timer) { bar.classList.remove('is-on'); return; }
    bar.classList.add('is-on');
    var dur = run.setup.timer * 1000, t0 = performance.now();
    var fill = $('timerfill');
    (function tick(now) {
      if (!run) return;
      var k = Math.max(0, 1 - ((now || performance.now()) - t0) / dur);
      fill.style.transform = 'scaleX(' + k.toFixed(4) + ')';
      fill.classList.toggle('is-low', k < 0.25);
      if (k <= 0) { onTimeout(); return; }
      run.raf = requestAnimationFrame(tick);
    }(performance.now()));
  }

  function onTimeout() {
    var pi = probeIndex();
    stopTimer();
    if (pi >= 0 && !run.answered) {
      run.answered = true;
      run.answers[pi] = { given: null, ok: false, ms: run.setup.timer * 1000, timedOut: true };
      run.states[run.i] = 'miss';
      $('btn-true').disabled = true;
      $('btn-false').disabled = true;
      if (run.setup.feedback) {
        var v = $('verdict');
        v.className = 'verdict is-on bad';
        v.innerHTML = '<b>Out of time.</b> <span>Set ' + pad2(pi + 1) + ' had ' +
          Fmt.esc(run.sets[pi].derived.text) + '.</span>';
      }
      flash(false);
      drawPlayRail();
      setTimeout(next, run.setup.feedback ? 1100 : 300);
    } else {
      next();
    }
  }

  /* ====================================================================
     results
     ==================================================================== */
  function median(a) {
    if (!a.length) return 0;
    var b = a.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(b.length / 2);
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  }

  function finish(early) {
    stopTimer();
    var asked = run.answers.filter(Boolean);
    var right = asked.filter(function (a) { return a.ok; }).length;
    var acc = asked.length ? Math.round(100 * right / asked.length) : 0;
    var streak = 0, best = 0;
    run.answers.forEach(function (a) {
      if (a && a.ok) { streak++; best = Math.max(best, streak); } else if (a) { streak = 0; }
    });
    var times = asked.filter(function (a) { return !a.timedOut; }).map(function (a) { return a.ms; });
    var misses = asked.filter(function (a) { return a.timedOut; }).length;

    run.result = {
      acc: acc, right: right, asked: asked.length, best: best,
      median: median(times), misses: misses, early: !!early
    };

    if (asked.length) {
      Setup.saveRun({
        at: Date.now(), acc: acc, right: right, asked: asked.length,
        n: run.setup.n, premises: run.setup.premises, rounds: run.setup.rounds,
        typeLabels: Setup.typeLabels(run.setup).join(' + ')
      });
    }
    renderDone();
    show('done');
    renderStats();
  }

  function renderDone() {
    var r = run.result, s = run.setup;
    $('done-setup').textContent = s.n + '-back · ' + Setup.typeLabels(s).join(' + ') +
      ' · ' + s.premises + ' ' + pl(s.premises, 'premise') + ' a set' + (r.early ? ' · ended early' : '');
    $('score-acc').innerHTML = r.acc + '<i>%</i>';

    var side = '<li><b>' + r.right + '/' + r.asked + '</b> conclusions right</li>';
    side += '<li><b>' + (r.median / 1000).toFixed(1) + ' s</b> median answer</li>';
    side += '<li><b>' + r.best + '</b> longest streak</li>';
    if (r.misses) side += '<li><b>' + r.misses + '</b> ' + pl(r.misses, 'timeout') + '</li>';
    $('score-side').innerHTML = side;

    var html = '';
    run.answers.forEach(function (a, k) {
      if (!a) return;
      var set = run.sets[k];
      html += '<li><details>' +
        '<summary><span class="idx">' + pad2(k + 1) + '</span>' +
        '<span class="mark ' + (a.ok ? 'ok' : 'bad') + '">' + (a.ok ? '✓' : '✗') + '</span>' +
        '<span class="txt">' + Fmt.esc(set.conclusion.text) + '</span>' +
        '<span class="rt">' + (a.timedOut ? 'timeout' : (a.ms / 1000).toFixed(1) + ' s') + '</span>' +
        '</summary><div class="review-open">' +
        '<h5>the set as it appeared · ' + Fmt.esc(set.typeLabel) + '</h5><ul>' +
        set.premises.map(function (p) { return '<li>' + Fmt.statement(p) + '</li>'; }).join('') +
        '</ul>' +
        '<h5>straightened out</h5><ul>' +
        set.canonical.map(function (c) { return '<li>' + Fmt.statement(c) + '</li>'; }).join('') +
        '</ul>' +
        '<h5>so the set settles</h5><p>' + Fmt.statement(set.derived) + '</p>' +
        '<h5>the conclusion</h5><p>' + Fmt.statement(set.conclusion) + '</p>' +
        '<p class="why">' + (set.conclusion.negated
          ? 'It claims ' + Fmt.esc(set.conclusionPlain.text) + '. ' : '') +
        'Read the other way round, the set gives ' + Fmt.esc(set.derivedAsAsked.text) + '. ' +
        'The true answer was <b>' + (set.answer ? 'True' : 'False') + '</b>; you said <b>' +
        (a.timedOut ? 'nothing — the clock ran out' : (a.given ? 'True' : 'False')) + '</b>.</p>' +
        '</div></details></li>';
    });
    $('review-list').innerHTML = html || '<p class="empty">No conclusions were answered.</p>';
  }

  function drawDoneRail() {
    if (!run) return;
    Rail.draw($('done-rail'), {
      total: run.total, current: -1, n: run.setup.n,
      states: run.states, arc: false
    });
  }

  /* ====================================================================
     wiring
     ==================================================================== */
  function typing(e) {
    var t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
  }

  document.addEventListener('keydown', function (e) {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase();

    if (view === 'play') {
      if (k === 'f' || k === '1' || k === 'arrowleft') { e.preventDefault(); answer(true); return; }
      if (k === 'j' || k === '2' || k === 'arrowright') { e.preventDefault(); answer(false); return; }
      if ((k === 'enter' || k === ' ') && $('btn-next').classList.contains('is-on')) {
        var a = document.activeElement;
        if (a && (a.tagName === 'BUTTON' || a.tagName === 'SUMMARY' || a.tagName === 'A')) return;
        e.preventDefault(); next();
      }
      return;
    }
    if (k === 'enter') {
      var el = document.activeElement;
      if (el && (el.tagName === 'BUTTON' || el.tagName === 'SUMMARY' || el.tagName === 'A')) return;
      e.preventDefault();
      if (view === 'menu') startRun();
      else if (view === 'done') startRun();
    }
  });

  $('btn-start').addEventListener('click', startRun);
  $('btn-again').addEventListener('click', startRun);
  $('btn-menu').addEventListener('click', function () { show('menu'); });
  $('btn-true').addEventListener('click', function () { answer(true); });
  $('btn-false').addEventListener('click', function () { answer(false); });
  $('btn-next').addEventListener('click', next);
  $('btn-quit').addEventListener('click', function () {
    if (confirm('End the run here? Everything answered so far is kept.')) finish(true);
  });

  $('drawer-how').addEventListener('toggle', function () {
    if ($('drawer-how').open) HowItWorks.render($('how-body'), S);
  });
  $('drawer-stats').addEventListener('toggle', function () {
    if ($('drawer-stats').open) renderStats();
  });

  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      if (view === 'menu') drawHero();
      if (view === 'play') drawPlayRail();
      if (view === 'done') drawDoneRail();
      var hr = document.querySelector('#hiw-rail');
      if (hr && $('drawer-how').open) HowItWorks.render($('how-body'), S);
    }, 150);
  });

  /* go */
  buildN();
  buildTypes();
  buildPresets();
  buildAdvanced();
  sync();
  renderStats();
  show('menu');
}());
