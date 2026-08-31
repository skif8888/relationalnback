/* A deliberately small DOM, just enough to run this app under Node.
   Supports the subset the app uses: tags, attributes, classes, dataset,
   innerHTML parsing, id / tag / attribute selectors, events.            */
'use strict';

const VOID = new Set(['input', 'br', 'img', 'meta', 'link', 'hr', 'source', 'rect', 'circle', 'path', 'use']);

class TextNode {
  constructor(t) { this.nodeType = 3; this.data = t; this.parentNode = null; }
  get textContent() { return this.data; }
  get outerHTML() { return this.data; }
}

class El {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.localName = String(tag).toLowerCase();
    this.childNodes = [];
    this.attrs = {};
    this.dataset = {};
    this.style = {};
    this.parentNode = null;
    this.listeners = {};
    this._classes = new Set();
    this.disabled = false;
    this.value = '';
    this.open = false;
    this.type = '';
    this.checked = false;
  }
  get children() { return this.childNodes.filter(n => n.nodeType === 1); }
  get clientWidth() { return 620; }
  get id() { return this.attrs.id || ''; }
  set id(v) { this.attrs.id = v; }
  get className() { return [...this._classes].join(' '); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); this.attrs.class = v; }
  get classList() {
    const c = this._classes, self = this;
    return {
      add: (...n) => { n.forEach(x => c.add(x)); self.attrs.class = self.className; },
      remove: (...n) => { n.forEach(x => c.delete(x)); self.attrs.class = self.className; },
      contains: n => c.has(n),
      toggle: (n, force) => {
        const on = force === undefined ? !c.has(n) : !!force;
        on ? c.add(n) : c.delete(n);
        self.attrs.class = self.className;
        return on;
      }
    };
  }
  setAttribute(k, v) {
    if (k === 'class') { this.className = v; return; }
    this.attrs[k] = String(v);
    if (k.startsWith('data-')) {
      const key = k.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase());
      this.dataset[key] = String(v);
    }
  }
  getAttribute(k) { return k === 'class' ? this.className : (k in this.attrs ? this.attrs[k] : null); }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(n) { n.parentNode = this; this.childNodes.push(n); return n; }
  remove() {
    if (!this.parentNode) return;
    const i = this.parentNode.childNodes.indexOf(this);
    if (i >= 0) this.parentNode.childNodes.splice(i, 1);
    this.parentNode = null;
  }
  set textContent(t) { this.childNodes = [Object.assign(new TextNode(String(t)), { parentNode: this })]; }
  get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
  set innerHTML(html) {
    this.childNodes = parse(String(html)).map(n => { n.parentNode = this; return n; });
  }
  get innerHTML() { return this.childNodes.map(n => n.outerHTML).join(''); }
  get outerHTML() {
    const a = Object.keys(this.attrs).map(k => ` ${k}="${this.attrs[k]}"`).join('');
    if (VOID.has(this.localName)) return `<${this.localName}${a}>`;
    return `<${this.localName}${a}>${this.innerHTML}</${this.localName}>`;
  }
  walk(fn) {
    for (const c of this.childNodes) {
      if (c.nodeType !== 1) continue;
      if (fn(c) === false) return false;
      if (c.walk(fn) === false) return false;
    }
    return true;
  }
  matches(sel) {
    sel = sel.trim();
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    if (sel.startsWith('.')) return this._classes.has(sel.slice(1));
    if (sel.startsWith('[')) {
      const m = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(sel);
      if (!m) return false;
      const v = this.getAttribute(m[1]);
      return m[2] === undefined ? v !== null : v === m[2];
    }
    return this.localName === sel.toLowerCase();
  }
  querySelector(sel) {
    let hit = null;
    this.walk(n => { if (n.matches(sel)) { hit = n; return false; } });
    return hit;
  }
  querySelectorAll(sel) {
    const out = [];
    this.walk(n => { if (n.matches(sel)) out.push(n); });
    return out;
  }
  closest(sel) {
    let n = this;
    while (n) { if (n.nodeType === 1 && n.matches(sel)) return n; n = n.parentNode; }
    return null;
  }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener(t, fn) {
    if (!this.listeners[t]) return;
    this.listeners[t] = this.listeners[t].filter(f => f !== fn);
  }
  dispatch(t, ev) {
    (this.listeners[t] || []).forEach(fn => fn(Object.assign({
      target: this, preventDefault() {}, stopPropagation() {}
    }, ev || {})));
    // very small bubbling: let ancestors see it too
    let p = this.parentNode;
    const src = this;
    while (p) {
      (p.listeners[t] || []).forEach(fn => fn(Object.assign({
        target: src, preventDefault() {}, stopPropagation() {}
      }, ev || {})));
      p = p.parentNode;
    }
  }
  click() { this.dispatch('click'); }
  scrollIntoView() {}
  focus() {}
}

/* --- tiny html parser --------------------------------------------------- */
function parse(html) {
  const out = [];
  const stack = [];
  const push = n => (stack.length ? stack[stack.length - 1].appendChild(n) : out.push(n));
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { push(new TextNode(html.slice(i))); break; }
    if (lt > i) push(new TextNode(html.slice(i, lt)));
    if (html.startsWith('<!--', lt)) { i = html.indexOf('-->', lt) + 3; continue; }
    if (html.startsWith('<!', lt)) { i = html.indexOf('>', lt) + 1; continue; }
    const gt = findGt(html, lt);
    const raw = html.slice(lt + 1, gt).trim();
    if (raw.startsWith('/')) { stack.pop(); i = gt + 1; continue; }
    const selfClose = raw.endsWith('/');
    const body = selfClose ? raw.slice(0, -1) : raw;
    const sp = body.search(/\s/);
    const tag = (sp < 0 ? body : body.slice(0, sp)).toLowerCase();
    const el = new El(tag);
    if (sp > 0) {
      const attrRe = /([\w:-]+)(?:\s*=\s*"([^"]*)")?/g;
      let m;
      const attrStr = body.slice(sp);
      while ((m = attrRe.exec(attrStr))) el.setAttribute(m[1], m[2] === undefined ? '' : m[2]);
    }
    push(el);
    if (!selfClose && !VOID.has(tag)) stack.push(el);
    i = gt + 1;
  }
  return out;
}
function findGt(s, from) {
  let q = false;
  for (let i = from + 1; i < s.length; i++) {
    if (s[i] === '"') q = !q;
    else if (s[i] === '>' && !q) return i;
  }
  return s.length;
}

/* --- document ----------------------------------------------------------- */
function build(html) {
  const nodes = parse(html);
  const doc = new El('document');
  nodes.forEach(n => doc.appendChild(n));
  doc.body = doc.querySelector('body') || doc;
  doc.getElementById = id => doc.querySelector('#' + id);
  doc.createElement = t => new El(t);
  doc.createElementNS = (ns, t) => new El(t);
  doc.activeElement = null;
  doc.documentElement = doc.querySelector('html') || doc;
  return doc;
}

module.exports = { build, El, TextNode, parse };
