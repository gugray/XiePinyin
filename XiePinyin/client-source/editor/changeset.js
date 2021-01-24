"use strict";

module.exports = (function () {

  function makeEmpty() {
    return {
      lengthBefore: 0,
      lengthAfter: 0,
      items: [],
    };
  }

  function makeIdent(length) {
    let res = {
      lengthBefore: length,
      lengthAfter: length,
      items: [],
    }
    for (let i = 0; i < length; ++i)
      res.items.push(i);
    return res;
  }

  function chrCmp(a, b) {
    if (a.hanzi.localeCompare(b.hanzi) != 0) return a.hanzi.localeCompare(b.hanzi);
    if (a.pinyin == b.pinyin) return 0;
    if (a.pinyin && !b.pinyin) return -1;
    if (!a.pinyin && b.pinyin) return 1;
    return a.pinyin.localeCompare(b.pinyin);
  }

  function isValid(cs) {
    if (cs.lengthAfter != cs.items.length) return false;
    let last = -1;
    for (let i = 0; i < cs.items.length; ++i)
    {
      const itm = cs.items[i];
      if (typeof itm === "object") continue;
      if (itm < 0) return false;
      if (itm > cs.lengthBefore - 1) return false;
      if (itm <= last) return false;
      last = itm;
    }
    return true;
  }

  function makeDiag(str) {
    let lengthBefore = str.substr(0, str.indexOf(">"));
    let res = {
      lengthBefore: Number(lengthBefore),
      items: [],
    };
    let rest = str.substr(str.indexOf(">") + 1);
    if (rest.length > 0) {
      let parts = rest.split(",");
      for (let i = 0; i < parts.length; ++i) {
        let part = parts[i];
        let val = parseInt(part, 10);
        if (isNaN(val)) res.items.push({ hanzi: part });
        else res.items.push(val);
      }
    }
    res.lengthAfter = res.items.length;
    return res;
  }

  function writeDiag(cs) {
    let res = "";
    res += cs.lengthBefore + ">";
    for (let i = 0; i < cs.items.length; ++i) {
      if (i > 0) res += ",";
      if (typeof cs.items[i] === "object") res += cs.items[i].hanzi;
      else res += cs.items[i];
    }
    return res;
  }

  function apply(text, cs) {
    if (text.length != cs.lengthBefore)
      throw "Change set's lengthBefore must match text length";
    let items = [];
    for (let ix = 0; ix < cs.items.length; ++ix) {
      if (typeof cs.items[ix] === "object") items.push(cs.items[ix]);
      else items.push(text[cs.items[ix]]);
    }
    return items;
  }

  function addReplace(cs, start, end, newText) {
    if (start < 0 || end < start)
      throw "bad values; expected: start >= 0 and end >= start";
    if (start > cs.lengthAfter || end > cs.lengthAfter)
      throw "start or end beyond lengthAfter of changeset";
    let csRepl = {
      lengthBefore: cs.lengthAfter,
      items: [],
    };
    for (let ix = 0; ix < start; ++ix) csRepl.items.push(ix);
    for (let i = 0; i < newText.length; ++i) csRepl.items.push(newText[i]);
    for (let ix = end; ix < cs.lengthAfter; ++ix) csRepl.items.push(ix);
    csRepl.lengthAfter = csRepl.items.length;
    return compose(cs, csRepl);
  }

  function compose(a, b) {
    if (a.lengthAfter != b.lengthBefore)
      throw "lengthAfter of LHS must equal lengthBefore of RHS";
    let res = {
      lengthBefore: a.lengthBefore,
      lengthAfter: b.lengthAfter,
      items: [],
    };
    for (let i = 0; i < b.lengthAfter; ++i)
    {
      if (typeof b.items[i] === "object") res.items.push(b.items[i]);
      else {
        let ix = Number(b.items[i]);
        res.items.push(a.items[ix]);
      }
    }
    return res;
  }

  function merge(a, b) {
    if (a.lengthBefore != b.lengthBefore)
      throw "The two change sets must have same lengthBefore";
    let res = {
      lengthBefore: a.lengthBefore,
      items: [],
    };
    let ixa = 0, ixb = 0;
    while (ixa < a.items.length || ixb < b.items.length) {
      if (ixa == a.items.length) {
        if (typeof b.items[ixb] === "object") res.items.push(b.items[ixb]);
        ++ixb;
        continue;
      }
      if (ixb == b.items.length) {
        if (typeof a.items[ixa] === "object") res.items.push(a.items[ixa]);
        ++ixa;
        continue;
      }
      // We got stuff in both
      let ca = null;
      if (typeof a.items[ixa] === "object") ca = a.items[ixa];
      let cb = null;
      if (typeof b.items[ixb] === "object") cb = b.items[ixb];
      // Both are kept characters: sync up position, and keep what's kept in both
      if (ca == null && cb == null) {
        let vala = a.items[ixa];
        let valb = b.items[ixb];
        if (vala == valb) {
          res.items.push(vala);
          ++ixa; ++ixb;
          continue;
        }
        else if (vala < valb) ++ixa;
        else ++ixb;
        continue;
      }
      // Both are insertions: insert both, in lexicographical order (so merge is commutative)
      if (ca != null && cb != null) {
        if (chrCmp(ca, cb) < 0) {
          res.items.push(ca);
          res.items.push(cb);
        }
        else {
          res.items.push(cb);
          res.items.push(ca);
        }
        ++ixa; ++ixb;
        continue;
      }
      // If only one is an insertion, keep that, and advance in that changeset
      if (ca != null) {
        res.items.push(ca);
        ++ixa;
      }
      else {
        res.items.push(cb);
        ++ixb;
      }
    }
    res.lengthAfter = res.items.length;
    return res;
  }

  function follow(a, b) {
    if (a.lengthBefore != b.lengthBefore)
      throw "The two change sets must have same lengthBefore";
    let res = {
      lengthBefore: a.lengthAfter,
      items: [],
    };
    let ixa = 0, ixb = 0;
    while (ixa < a.items.length || ixb < b.items.length) {
      if (ixa == a.items.length) {
        // Insertions in B become insertions
        if (typeof b.items[ixb] === "object") res.items.push(b.items[ixb]);
        ++ixb;
        continue;
      }
      if (ixb == b.items.length) {
        // Insertions in A become retained characters
        if (typeof a.items[ixa] === "object") res.items.push(ixa);
        ++ixa;
        continue;
      }
      // We got stuff in both
      let ca = null;
      if (typeof a.items[ixa] === "object") ca = a.items[ixa];
      let cb = null;
      if (typeof b.items[ixb] === "object") cb = b.items[ixb];
      // Both are kept characters: sync up position, and keep what's kept in both
      if (ca == null && cb == null) {
        let vala = a.items[ixa];
        let valb = b.items[ixb];
        if (vala == valb) {
          res.items.push(vala);
          ++ixa; ++ixb;
          continue;
        }
        else if (vala < valb) ++ixa;
        else ++ixb;
        continue;
      }
      // Insertions in A become retained characters
      // We consume A first
      if (ca != null) {
        res.items.push(ixa);
        ++ixa;
        continue;
      }
      // Insertions in B become insertions
      else {
        res.items.push(b.items[ixb]);
        ++ixb;
        continue;
      }
    }
    res.lengthAfter = res.items.length;
    return res;
  }

  return {
    makeEmpty,
    makeIdent,
    makeDiag,
    writeDiag,
    addReplace,
    apply,
    chrCmp,
    isValid,
    compose,
    merge,
    follow,
  };
})();
