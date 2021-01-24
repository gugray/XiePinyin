"use strict";

var CS = require('../editor/changeset');

describe("A changeset", function () {
  it("knows when it is valid", function () {
    var cs1 = {
      lengthBefore: 0,
      lengthAfter: 0,
      items: [{ hanzi: 'A' }]
    };
    expect(CS.isValid(cs1)).toBe(false, "items.length must equal lengthAfter");
    cs1.lengthAfter = 1;
    expect(CS.isValid(cs1)).toBe(true);
    var cs2 = {
      lengthBefore: 3,
      lengthAfter: 3,
      items: [-1, 1, 2]
    };
    expect(CS.isValid(cs2)).toBe(false, "Cannot retain negative index");
    cs2.items[0] = 0;
    expect(CS.isValid(cs2)).toBe(true);
    cs2.items = [1, 1, 2];
    expect(CS.isValid(cs2)).toBe(false, "Cannot repeat retained index");
    cs2.items = [0, 2, 1];
    expect(CS.isValid(cs2)).toBe(false, "Retained indexes must grow strictly");
    cs2.items = [1, 2, 3];
    expect(CS.isValid(cs2)).toBe(false, "Cannot index beyond original length");
  });

  it("can compare complex characters", function () {
    expect(CS.chrCmp({ hanzi: "A" }, { hanzi: "A" })).toBe(0);
    expect(CS.chrCmp({ hanzi: "A" }, { hanzi: "B" })).toBe(-1);
    expect(CS.chrCmp({ hanzi: "B" }, { hanzi: "A" })).toBe(1);
    expect(CS.chrCmp({ hanzi: "A", pinyin: "x" }, { hanzi: "A", pinyin: "x" })).toBe(0);
    expect(CS.chrCmp({ hanzi: "A", pinyin: "x" }, { hanzi: "B", pinyin: "a" })).toBe(-1);
    expect(CS.chrCmp({ hanzi: "B", pinyin: "a" }, { hanzi: "A", pinyin: "x" })).toBe(1);
    expect(CS.chrCmp({ hanzi: "A", pinyin: "x" }, { hanzi: "A" })).toBe(-1);
    expect(CS.chrCmp({ hanzi: "A" }, { hanzi: "A", pinyin: "x" })).toBe(1);
  });

  it("can be made from a diagnostic string", function () {
    let cs1 = CS.makeDiag("42>");
    expect(cs1.lengthBefore).toBe(42);
    expect(cs1.lengthAfter).toBe(0);
    let cs2 = CS.makeDiag("1>0,A");
    expect(cs2.lengthBefore).toBe(1);
    expect(cs2.lengthAfter).toBe(2);
    expect(cs2.items).toEqual([0, { hanzi: "A" }]);
  });

  it("can be written into a diagnostic string", function () {
    let cs = {
      lengthBefore: 42,
      lengthAfter: 3,
      items: [0, { hanzi: "X" }, 7],
    };
    expect(CS.writeDiag(cs)).toBe("42>0,X,7");
  });

  it("can be composed", function () {
    let csa = CS.makeDiag("0>");
    let csb = CS.makeDiag("1>X");
    expect(() => CS.compose(csa, csb)).toThrow();

    let data = [
      { a: "0>X,Y", b: "2>1,A", res: "0>Y,A" },
      { a: "0>X", b: "1>A", res: "0>A" },
      { a: "0>X", b: "1>Y,0", res: "0>Y,X" },
      { a: "0>X", b: "1>0,Y", res: "0>X,Y" },
      { a: "0>X", b: "1>0", res: "0>X" },
      { a: "0>", b: "0>X", res: "0>X" },
    ];

    for (let i = 0; i < data.length; ++i) {
      let csa = CS.makeDiag(data[i].a);
      let csb = CS.makeDiag(data[i].b);
      expect(CS.writeDiag(CS.compose(csa, csb))).toBe(data[i].res);
    }
  });

  it("can be extended with a text replace operation", function () {

    let data = [
      { a: "0>A,B,C,D", start: 1, end: 3, text: "0>X,Y,Z", res: "0>A,X,Y,Z,D" },
      { a: "0>", start: 0, end: 0, text: "0>X", res: "0>X" },
      { a: "0>A", start: 0, end: 1, text: "0>X", res: "0>X" },
      { a: "0>A,B,C,D", start: 0, end: 4, text: "0>", res: "0>" },
    ];

    for (let i = 0; i < data.length; ++i) {
      let cs = CS.makeDiag(data[i].a);
      let start = data[i].start;
      let end = data[i].end;
      let text = CS.makeDiag(data[i].text).items;
      expect(CS.writeDiag(CS.addReplace(cs, start, end, text))).toBe(data[i].res);
    }
  });

  it("can be merged", function () {
    let csa = CS.makeDiag("0>");
    let csb = CS.makeDiag("1>X");
    expect(() => CS.merge(csa, csb)).toThrow();

    let data = [
      { a: "8>1,s,i,7", b: "8>1,a,x,2", res: "8>1,a,s,i,x" },
      { a: "8>0,1,s,i,7", b: "8>0,e,i,x,6,7", res: "8>0,e,i,x,s,i,7" },
      { a: "8>0,1,s,i,7", b: "8>0,e,6,o,w", res: "8>0,e,s,i,o,w" },
    ];

    for (let i = 0; i < data.length; ++i) {
      let csa = CS.makeDiag(data[i].a);
      let csb = CS.makeDiag(data[i].b);
      let csm1 = CS.merge(csa, csb);
      let csm2 = CS.merge(csb, csa);
      expect(CS.writeDiag(csm1)).toBe(data[i].res);
      expect(CS.writeDiag(csm2)).toBe(data[i].res);
    }
  });

  it("can be followed", function () {
    let csa = CS.makeDiag("0>");
    let csb = CS.makeDiag("1>X");
    expect(() => CS.merge(csa, csb)).toThrow();

    let data = [
      { a: "8>0,e,6,o,w", b: "8>0,1,s,i,7", res: "5>0,1,s,i,3,4" },
      { a: "8>0,1,s,i,7", b: "8>0,e,6,o,w", res: "5>0,e,2,3,o,w" },
    ];

    for (let i = 0; i < data.length; ++i) {
      let csa = CS.makeDiag(data[i].a);
      let csb = CS.makeDiag(data[i].b);
      let csf = CS.follow(csa, csb);
      expect(CS.writeDiag(csf)).toBe(data[i].res);
    }
  });

});