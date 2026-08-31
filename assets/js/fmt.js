/* ==========================================================================
   fmt.js — turning a statement object into markup
   Symbols become chips; a negated phrase is coloured and marked, so the
   colour is never the only signal.
   ========================================================================== */
(function (root) {
  'use strict';

  var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return MAP[c]; });
  }

  function tok(s) { return '<span class="tok">' + esc(s) + '</span>'; }

  function statement(st) {
    var mid = esc(st.verb) + ' ' + esc(st.body);
    if (st.negated) mid = '<span class="neg" title="negated: read it as the exact opposite">' + mid + '</span>';
    return tok(st.subject) + ' ' + mid + ' ' + tok(st.object);
  }

  function plainText(st) { return st.text; }

  root.Fmt = { esc: esc, tok: tok, statement: statement, plainText: plainText };
}(window));
