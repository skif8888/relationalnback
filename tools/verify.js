/* Model-based verification of rrt.js.
   Builds an independent world model from the chain, then checks that every
   sentence the player is shown is true in that world and that the stated
   answer matches. Run: node tools/verify.js                                */
const RRT = require('../assets/js/rrt.js');

const sgn = n => (n > 0 ? 1 : n < 0 ? -1 : 0);
const vsgn = v => v.map(sgn);
const veq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function buildModel(typeId, ents, links) {
  const m = new Map();
  if (typeId === 'distinction') {
    m.set(ents[0], 0);
    links.forEach((l, i) => m.set(ents[i + 1], (m.get(ents[i]) + l) % 2));
    return (a, b) => (m.get(a) + m.get(b)) % 2;
  }
  if (typeId === 'comparison' || typeId === 'temporal') {
    m.set(ents[0], 0);
    // link = +1 means "subject is greater/later", so the next entity sits lower
    links.forEach((l, i) => m.set(ents[i + 1], m.get(ents[i]) - l));
    return (a, b) => sgn(m.get(a) - m.get(b));
  }
  const dim = links[0].length;
  m.set(ents[0], new Array(dim).fill(0));
  links.forEach((l, i) => {
    // "e_i is <l> of e_{i+1}"  =>  pos(e_i) = pos(e_{i+1}) + l
    m.set(ents[i + 1], m.get(ents[i]).map((x, k) => x - l[k]));
  });
  return (a, b) => vsgn(m.get(a).map((x, k) => x - m.get(b)[k]));
}

function eq(typeId, a, b) {
  return Array.isArray(a) ? veq(vsgn(a), vsgn(b)) : a === b;
}

const scrambles = [
  { order: false, converse: false, negation: false },
  { order: true, converse: false, negation: false },
  { order: true, converse: true, negation: false },
  { order: true, converse: true, negation: true },
  { order: false, converse: true, negation: true }
];

let checked = 0, fails = 0, trueCount = 0;
const samples = {};

for (const typeId of RRT.TYPE_ORDER) {
  for (const sc of scrambles) {
    for (let p = 1; p <= 4; p++) {
      const pool = RRT.makePool('letters', p + 1);
      for (let n = 0; n < 900; n++) {
        const q = RRT.generate({ typeId, premises: p, entities: pool, scramble: sc, negationRate: 0.5 });
        const rel = buildModel(typeId, q.entities, q.canonical.map(c => c.asserts));

        // 1. every displayed premise must be true in the model
        q.premises.forEach(st => {
          if (!eq(typeId, rel(st.subject, st.object), st.asserts)) {
            fails++; console.log('PREMISE MISMATCH', typeId, JSON.stringify(st));
          }
        });
        // 2. the derived relation must be the real one
        if (!eq(typeId, rel(q.derived.subject, q.derived.object), q.derived.asserts)) {
          fails++; console.log('DERIVED MISMATCH', typeId);
        }
        // 3. the conclusion's truth in the model must match the stated answer
        const holds = eq(typeId, rel(q.conclusion.subject, q.conclusion.object), q.conclusion.asserts);
        if (holds !== q.answer) {
          fails++; console.log('ANSWER MISMATCH', typeId, q.conclusion.text, q.answer);
        }
        // 4. no empty or malformed sentence
        q.premises.concat([q.conclusion]).forEach(st => {
          if (!st.body || /\s{2,}|undefined/.test(st.text)) {
            fails++; console.log('TEXT PROBLEM', typeId, JSON.stringify(st.text));
          }
        });
        if (q.answer) trueCount++;
        checked++;
        if (p === 3 && sc.negation && sc.order && !samples[typeId]) samples[typeId] = q;
      }
    }
  }
}

console.log(`\nchecked ${checked} problems — ${fails} failures`);
console.log(`TRUE answers: ${(100 * trueCount / checked).toFixed(1)}% (want ~50%)\n`);
for (const t of RRT.TYPE_ORDER) {
  const q = samples[t];
  console.log('── ' + q.typeLabel + ' ' + '─'.repeat(40 - q.typeLabel.length));
  q.premises.forEach(s => console.log('   ' + s.text));
  console.log('   ? ' + q.conclusion.text + '   => ' + (q.answer ? 'TRUE' : 'FALSE'));
  console.log('   chain: ' + q.canonical.map(s => s.text).join(' | '));
  console.log('   entails: ' + q.derived.text + '\n');
}
process.exit(fails ? 1 : 0);
