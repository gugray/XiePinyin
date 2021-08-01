﻿class ParaIndexItem {

  constructor(startPos, text) {

    /** Position of this paragraph's first character in full text
     * @type{Number} */
    this.startPos = startPos;

    /** DOM element of this paragraph (class="para") */
    this.elm = null;

    /** Text of this paragraph, excluding trailing newline.
     * @type{Array<BiChar>} */
    this.text = text;
  }
}

class ParaIndex {
  constructor() {
    /** Paragraphs of the current document.
     *  @type{Array<ParaIndexItem>} */
    this.paras = [];
  }

  /**
   * Get range from text position to dom position
   * @param {Number} start Start position in plain text
   * @param {Number} end End position in plain text
   * @returns Paragraph index and in-paragraph position for both start and end
   */
  text2DomRange(start, end) {
    if (end < start) throw "end must not be smaller than start";
    let startParaIx, endParaIx = -1, startCharIx, endCharIx;
    for (let i = this.paras.length - 1; i >= 0; --i) {
      const para = this.paras[i];
      if (para.startPos <= end && endParaIx == -1) {
        endParaIx = i;
        endCharIx = end - para.startPos;
      }
      if (para.startPos <= start) {
        startParaIx = i;
        startCharIx = start - para.startPos;
        break;
      }
    }
    return {
      start: { paraIx: startParaIx, charIx: startCharIx },
      end: { paraIx: endParaIx, charIx: endCharIx },
    };
  }
};

module.exports = { ParaIndex, ParaIndexItem };
