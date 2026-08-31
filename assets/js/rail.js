/* ==========================================================================
   rail.js — the delay rail
   One slot per screen. The dashed arc shows which slot the current
   conclusion reaches back to. This is the whole game in one picture.
   ========================================================================== */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  /*  opts = {
        total:   number of slots
        current: index of the live slot, or -1
        n:       delay, used for the arc
        states:  array of 'pending' | 'loaded' | 'right' | 'wrong' | 'miss'
        arc:     draw the arc (default true when current >= n)
        caption: text near the arc apex
        live:    animate the arc dashes
      }                                                                    */
  function draw(box, opts) {
    if (!box) return;
    var o = opts || {};
    var total = Math.max(1, o.total | 0);
    var states = o.states || [];
    var cur = o.current === undefined ? -1 : o.current;
    var n = o.n | 0;

    var W = box.clientWidth || box.parentNode && box.parentNode.clientWidth || 620;
    var H = 58;
    var gap = total > 26 ? 2.5 : total > 16 ? 4 : 6;
    var w = Math.max(3, (W - gap * (total - 1)) / total);
    var base = 44;          /* top edge of a resting slot */
    var h = 12;
    var r = Math.min(4, w / 2);

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'presentation' });

    function cx(i) { return i * (w + gap) + w / 2; }

    for (var i = 0; i < total; i++) {
      var st = states[i] || 'pending';
      var isCur = i === cur;
      var hh = isCur ? h + 8 : h;
      var y = base + h - hh;
      var rect = el('rect', {
        x: (i * (w + gap)).toFixed(2), y: y.toFixed(2),
        width: w.toFixed(2), height: hh.toFixed(2),
        rx: r.toFixed(2),
        'class': 'rail-slot' + (isCur ? ' is-current' : st === 'pending' ? '' : ' is-' + st)
      });
      svg.appendChild(rect);
    }

    var wantArc = o.arc !== undefined ? o.arc : (cur >= n && n > 0);
    if (wantArc && cur - n >= 0 && cur < total) {
      var x1 = cx(cur - n), x2 = cx(cur);
      var apex = Math.max(8, base - 26);
      var d = 'M ' + x1.toFixed(1) + ' ' + (base - 2) +
              ' Q ' + ((x1 + x2) / 2).toFixed(1) + ' ' + apex.toFixed(1) +
              ' ' + x2.toFixed(1) + ' ' + (base - 2);
      svg.appendChild(el('path', { d: d, 'class': 'rail-arc' + (o.live ? ' is-live' : '') }));
      svg.appendChild(el('circle', { cx: x1.toFixed(1), cy: base - 2, r: 2.6, 'class': 'rail-head' }));
      svg.appendChild(el('path', {
        d: 'M ' + (x2 - 3.6).toFixed(1) + ' ' + (base - 7) + ' L ' + (x2 + 3.6).toFixed(1) +
           ' ' + (base - 7) + ' L ' + x2.toFixed(1) + ' ' + (base - 1) + ' Z',
        'class': 'rail-head'
      }));
      if (o.caption && Math.abs(x2 - x1) > 54) {
        var t = el('text', {
          x: ((x1 + x2) / 2).toFixed(1), y: (apex + 8).toFixed(1),
          'text-anchor': 'middle', 'class': 'rail-cap'
        });
        t.textContent = o.caption;
        svg.appendChild(t);
      }
    }

    box.innerHTML = '';
    box.appendChild(svg);
  }

  root.Rail = { draw: draw };
}(window));
