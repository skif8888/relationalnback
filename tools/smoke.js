/* Drives the real app in the shim DOM: sets up, opens the explainer,
   plays a complete run, checks the result sheet. node tools/smoke.js      */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { build } = require('./dom.js');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const document = build(html);

const store = {};
const g = globalThis;
g.document = document;
g.window = g;
g.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
g.matchMedia = () => ({ matches: false, addEventListener() {} });
g.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 8);
g.cancelAnimationFrame = id => clearTimeout(id);
g.performance = { now: () => Date.now() };
g.confirm = () => true;
g.scrollTo = () => {};
g.alert = () => {};
const winListeners = {};
g.addEventListener = (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); };
g.removeEventListener = () => {};
g.fireWindow = (t, ev) => (winListeners[t] || []).forEach(fn => fn(ev || {}));

let problems = 0;
function ok(cond, msg) { if (!cond) { problems++; console.log('  ✗ ' + msg); } else { console.log('  ✓ ' + msg); } }

['assets/js/rrt.js', 'assets/js/fmt.js', 'assets/js/settings.js',
 'assets/js/rail.js', 'assets/js/howitworks.js', 'assets/js/app.js']
  .forEach(f => {
    try { vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f }); }
    catch (e) { problems++; console.log('LOAD FAILED ' + f + ': ' + e.message + '\n' + e.stack); }
  });

const $ = id => document.getElementById(id);
const key = k => (document.listeners.keydown || []).forEach(fn =>
  fn({ key: k, target: document.body, preventDefault() {} }));

console.log('\n— setup screen —');
ok($('screen-menu').classList.contains('is-on'), 'menu is showing');
ok($('seg-n').children.length === 4, 'delay control has four steps');
ok($('chips-types').children.length === 6, 'six relation chips');
ok($('hero-rail').querySelector('svg') !== null, 'hero rail drew an svg');
ok($('load-line').innerHTML.includes('statements'), 'memory-load line is filled in');

console.log('\n— changing the setup —');
$('seg-n').children[2].click();                       // 3-back
ok($('hero-line').innerHTML.includes('three screens'), 'hero copy follows the delay');
$('chips-types').children[4].click();                 // + space 3d
ok($('hero-sub').innerHTML.includes('Space 3D'), 'hero copy follows the relation choice');
$('seg-preset').children[2].click();                  // brutal
ok($('seg-preset').children[2].classList.contains('is-on'), 'preset applies');
ok($('load-line').innerHTML.includes('45 s a screen'), 'summary line mentions the clock');
ok($('load-line').innerHTML.includes('one fixed symbol set'), 'summary line mentions the fixed pool');
$('seg-preset').children[1].click();                  // back to standard
ok($('load-line').innerHTML.includes('no clock'), 'and drops it again');

console.log('\n— explainer —');
$('drawer-how').open = true;
$('drawer-how').dispatch('toggle');
const how = $('how-body').innerHTML;
ok(how.includes('Space 2D') && how.includes('Space 3D'), 'explains both chosen relations');
ok(how.includes('worked example') || how.includes('Another example'), 'includes a worked example');
ok(!how.includes('Negations'), 'says nothing about negation while it is off');
$('drawer-adv').open = true;
$('adv-body').querySelectorAll('input').forEach(i => { if (i.type === 'checkbox') {} });

console.log('\n— explainer follows the switches —');
const negSwitch = $('adv-body').querySelectorAll('input')[5];
negSwitch.checked = true;
negSwitch.dispatch('change');
ok($('how-body').innerHTML.includes('Negations'), 'negation section appears once switched on');
negSwitch.checked = false;
negSwitch.dispatch('change');

console.log('\n— a complete run —');
$('btn-start').click();
ok($('screen-play').classList.contains('is-on'), 'run screen is showing');
ok($('play-rail').querySelector('svg') !== null, 'run rail drew');

let guard = 0, answered = 0, seenProbeOnly = false, seenLoadOnly = false, offsetOk = true;
while ($('screen-play').classList.contains('is-on') && guard++ < 400) {
  const probeShown = !$('card-probe').classList.contains('is-hidden');
  const loadShown = !$('card-premises').classList.contains('is-hidden');
  if (probeShown && !loadShown) seenProbeOnly = true;
  if (loadShown && !probeShown) seenLoadOnly = true;
  if (probeShown && loadShown) {
    const loaded = +$('load-label').textContent.replace(/\D/g, '');
    const probed = +$('probe-label').textContent.replace(/\D+/, '').slice(0, 2);
    if (loaded - probed !== 3) offsetOk = false;   // 3-back was chosen above
  }
  if (probeShown) {
    if (!$('conclusion-text').textContent.trim()) { problems++; console.log('  ✗ empty conclusion'); }
    key(guard % 2 ? 'f' : 'j');
    answered++;
    if (!$('btn-next').classList.contains('is-on')) { problems++; console.log('  ✗ next never appeared'); break; }
  }
  key('Enter');
}
ok(offsetOk, 'every question pointed exactly 3 sets back');
ok(seenLoadOnly, 'first screens load without a question');
ok(seenProbeOnly, 'last screens ask without loading');
ok(answered === 12, 'answered every one of the 12 conclusions (got ' + answered + ')');
ok($('screen-done').classList.contains('is-on'), 'lands on the result sheet');

console.log('\n— result sheet —');
ok(/\d+/.test($('score-acc').textContent), 'accuracy printed: ' + $('score-acc').textContent);
ok($('review-list').querySelectorAll('details').length === 12, 'every probe is reviewable');
ok($('score-side').textContent.includes('median'), 'timing summary present');
ok($('done-rail').querySelector('svg') !== null, 'result rail drew');
const rev = $('review-list').innerHTML;
ok(rev.includes('straightened out'), 'review shows the unscrambled chain');
ok(rev.includes('True') || rev.includes('False'), 'review states the real answer');

console.log('\n— saved runs —');
$('btn-menu').click();
$('drawer-stats').open = true;
$('drawer-stats').dispatch('toggle');
ok($('stats-body').innerHTML.includes('%'), 'run was recorded');

console.log('\n— every relation type survives a run —');
['distinction', 'comparison', 'temporal', 'space2d', 'space3d', 'space4d'].forEach(t => {
  const s = Setup.sane({ types: [t], n: 1, premises: 4, rounds: 5, order: true, converse: true, negation: true, symbols: 'emoji' });
  for (let i = 0; i < 40; i++) {
    const q = RRT.generate({ typeId: t, premises: s.premises, entities: RRT.makePool(s.symbols, 5), scramble: Setup.scramble(s) });
    if (!q.conclusion.body || !q.premises.length) { problems++; console.log('  ✗ bad problem for ' + t); return; }
  }
  console.log('  ✓ ' + t);
});

console.log(problems ? `\n${problems} problem(s)\n` : '\nall clear\n');
process.exit(problems ? 1 : 0);
