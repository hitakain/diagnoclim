/* ============================================================================
   pdfgen.js — écriture PDF sans aucune dépendance externe.

   Principe : le CERFA d'origine (sans champs de formulaire) est embarqué tel
   quel. On lui ajoute une « mise à jour incrémentale » PDF : quelques objets
   supplémentaires en fin de fichier (calque de texte, signatures) + une table
   de références croisées à jour. Le résultat est un PDF aplati, non modifiable,
   qui s'ouvre partout.
   ========================================================================== */

const KezPdf = (() => {
  const A = KEZ_ASSETS;
  const FIELDS = A.fields;
  const PAGE_H = A.pdf.mediaBox[3];

  /* ---------- encodage WinAnsi -------------------------------------------- */
  const WIN_EXTRA = {
    '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84,
    '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88,
    '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c,
    'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93,
    '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
    '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
    'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
  };
  // Caractères remplacés par un équivalent toujours lisible.
  // µ, ² et ³ existent dans WinAnsi mais restent invisibles dans certaines
  // visionneuses PDF qui substituent l'Helvetica : on les translittère.
  const FALLBACK = {
    'µ': 'u', 'μ': 'u', '²': '2', '³': '3', '¹': '1', '±': '+/-',
    '₂': '2', '₁': '1', '₃': '3', '≤': '<=', '≥': '>=',
    '≠': '!=', ' ': ' ', ' ': ' ', ' ': ' ', '−': '-',
    '̀': '', '́': '', '→': '->',
  };

  function winAnsiCodes(str) {
    const out = [];
    for (const ch of String(str == null ? '' : str)) {
      if (FALLBACK[ch] !== undefined) {
        for (const c of FALLBACK[ch]) out.push(c.charCodeAt(0));
        continue;
      }
      const code = ch.codePointAt(0);
      if (code === 0x0a || code === 0x0d) { out.push(code); continue; }
      if (code >= 0x20 && code <= 0x7e) { out.push(code); continue; }
      if (WIN_EXTRA[ch] !== undefined) { out.push(WIN_EXTRA[ch]); continue; }
      if (code >= 0xa0 && code <= 0xff) { out.push(code); continue; }
      out.push(0x3f); // ?
    }
    return out;
  }

  const sanitize = (str) => winAnsiCodes(str).map((c) => String.fromCharCode(c)).join('');

  function pdfString(str) {
    let out = '';
    for (const code of winAnsiCodes(str)) {
      const ch = String.fromCharCode(code);
      if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
      else if (code < 32 || code > 126) out += '\\' + ('000' + code.toString(8)).slice(-3);
      else out += ch;
    }
    return '(' + out + ')';
  }

  /* ---------- métriques --------------------------------------------------- */
  function textWidth(str, size, bold) {
    const table = bold ? A.helvBold : A.helv;
    let total = 0;
    for (const code of winAnsiCodes(str)) total += table[code] || 0;
    return (total * size) / 1000;
  }

  function wrap(str, maxWidth, size, bold) {
    const lines = [];
    for (const paragraph of String(str == null ? '' : str).split(/\r?\n/)) {
      if (!paragraph.trim()) { lines.push(''); continue; }
      let current = '';
      for (const word of paragraph.split(/\s+/)) {
        const candidate = current ? current + ' ' + word : word;
        if (textWidth(candidate, size, bold) <= maxWidth || !current) {
          // coupe les mots plus larges que la ligne entière
          if (!current && textWidth(word, size, bold) > maxWidth) {
            let chunk = '';
            for (const ch of word) {
              if (textWidth(chunk + ch, size, bold) > maxWidth && chunk) {
                lines.push(chunk); chunk = ch;
              } else chunk += ch;
            }
            current = chunk;
          } else current = candidate;
        } else { lines.push(current); current = word; }
      }
      lines.push(current);
    }
    return lines;
  }

  /* ---------- flux de contenu --------------------------------------------- */
  class Ops {
    constructor() { this.buf = []; }
    raw(s) { this.buf.push(s); return this; }

    line(str, x, y, size, bold, color) {
      if (str === '' || str == null) return this;
      const rgb = color || [0.03, 0.10, 0.17];
      this.buf.push(
        'BT ' + rgb.map((v) => v.toFixed(3)).join(' ') + ' rg /' +
        (bold ? 'KEZHB' : 'KEZH') + ' ' + size.toFixed(2) + ' Tf ' +
        x.toFixed(2) + ' ' + y.toFixed(2) + ' Td ' + pdfString(str) + ' Tj ET'
      );
      return this;
    }

    /** Écrit une valeur à l'intérieur du rectangle d'un champ du CERFA. */
    field(name, value, opt) {
      const rect = FIELDS[name];
      if (!rect) throw new Error('champ inconnu : ' + name);
      const text = String(value == null ? '' : value).trim();
      if (!text) return this;
      const o = opt || {};
      const padX = o.padX == null ? 2 : o.padX;
      const x0 = rect[0] + padX, y0 = rect[1], x1 = rect[2] - padX, y1 = rect[3];
      const boxW = x1 - x0, boxH = y1 - y0;
      const bold = !!o.bold;
      const maxSize = o.size || 8;
      const minSize = o.minSize || 5;
      const multiline = o.multiline !== false && (boxH > 13 || /\n/.test(text));

      if (!multiline) {
        let size = maxSize;
        while (size > minSize && textWidth(text, size, bold) > boxW) size -= 0.25;
        let out = text;
        if (textWidth(out, size, bold) > boxW) {
          while (out.length > 1 && textWidth(out + '.', size, bold) > boxW) out = out.slice(0, -1);
          out += '.';
        }
        const w = textWidth(out, size, bold);
        let x = x0;
        if (o.align === 'center') x = x0 + (boxW - w) / 2;
        else if (o.align === 'right') x = x1 - w;
        const y = y0 + (boxH - size * 0.72) / 2 + size * 0.06;
        return this.line(out, x, Math.max(y, y0 + 1), size, bold, o.color);
      }

      let size = maxSize, lines = wrap(text, boxW, size, bold);
      let leading = size * 1.18;
      while (size > minSize && lines.length * leading > boxH) {
        size -= 0.25;
        lines = wrap(text, boxW, size, bold);
        leading = size * 1.18;
      }
      const maxLines = Math.max(1, Math.floor(boxH / leading));
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + ' ...';
      }
      let y = y1 - size * 0.92;
      for (const l of lines) {
        let x = x0;
        if (o.align === 'center') x = x0 + (boxW - textWidth(l, size, bold)) / 2;
        else if (o.align === 'right') x = x1 - textWidth(l, size, bold);
        this.line(l, x, y, size, bold, o.color);
        y -= leading;
      }
      return this;
    }

    /** Croix dans une case à cocher. */
    check(name) {
      const rect = FIELDS[name];
      if (!rect) throw new Error('case inconnue : ' + name);
      const i = 1.6;
      const x0 = rect[0] + i, y0 = rect[1] + i, x1 = rect[2] - i, y1 = rect[3] - i;
      this.buf.push(
        'q 1.3 w 1 J 1 j 0.03 0.10 0.17 RG ' +
        x0.toFixed(2) + ' ' + y0.toFixed(2) + ' m ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' l S ' +
        x0.toFixed(2) + ' ' + y1.toFixed(2) + ' m ' + x1.toFixed(2) + ' ' + y0.toFixed(2) + ' l S Q'
      );
      return this;
    }

    /** Pastille pleine dans un bouton radio. */
    dot(name) {
      const rect = FIELDS[name];
      if (!rect) throw new Error('bouton inconnu : ' + name);
      const cx = (rect[0] + rect[2]) / 2, cy = (rect[1] + rect[3]) / 2;
      const r = Math.min(rect[2] - rect[0], rect[3] - rect[1]) / 2 - 1.4;
      const k = r * 0.5523;
      const f = (n) => n.toFixed(2);
      this.buf.push(
        'q 0.03 0.10 0.17 rg ' +
        f(cx + r) + ' ' + f(cy) + ' m ' +
        f(cx + r) + ' ' + f(cy + k) + ' ' + f(cx + k) + ' ' + f(cy + r) + ' ' + f(cx) + ' ' + f(cy + r) + ' c ' +
        f(cx - k) + ' ' + f(cy + r) + ' ' + f(cx - r) + ' ' + f(cy + k) + ' ' + f(cx - r) + ' ' + f(cy) + ' c ' +
        f(cx - r) + ' ' + f(cy - k) + ' ' + f(cx - k) + ' ' + f(cy - r) + ' ' + f(cx) + ' ' + f(cy - r) + ' c ' +
        f(cx + k) + ' ' + f(cy - r) + ' ' + f(cx + r) + ' ' + f(cy - k) + ' ' + f(cx + r) + ' ' + f(cy) + ' c f Q'
      );
      return this;
    }

    image(resName, x, y, w, h) {
      this.buf.push('q ' + w.toFixed(2) + ' 0 0 ' + h.toFixed(2) + ' ' +
        x.toFixed(2) + ' ' + y.toFixed(2) + ' cm /' + resName + ' Do Q');
      return this;
    }

    toString() { return this.buf.join('\n'); }
  }

  /* ---------- octets ------------------------------------------------------- */
  function b64ToBytes(b64) {
    if (typeof atob === 'function') {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }

  function strToBytes(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
    return out;
  }

  /** Dimensions d'un JPEG (marqueur SOFn). */
  function jpegSize(bytes) {
    let i = 2;
    while (i < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
      }
      i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    }
    return { w: 0, h: 0 };
  }

  /* ---------- assemblage du PDF ------------------------------------------- */
  /**
   * @param {Ops} ops  calque à dessiner
   * @param {Array} images  [{ name, bytes }] images JPEG référencées par le calque
   */
  function assemble(ops, images) {
    const base = b64ToBytes(A.skeleton);
    const parts = [base];
    let offset = base.length;
    const xref = [];           // { num, offset }
    let next = A.pdf.size;

    const push = (str) => {
      const bytes = typeof str === 'string' ? strToBytes(str) : str;
      parts.push(bytes);
      offset += bytes.length;
    };
    const addObject = (num, body, streamBytes) => {
      xref.push({ num, offset });
      push(num + ' 0 obj\n' + body);
      if (streamBytes) { push('\nstream\n'); push(streamBytes); push('\nendstream'); }
      push('\nendobj\n');
    };

    const fontRegular = next++;
    const fontBold = next++;
    const imageNums = images.map(() => next++);
    const layerNum = next++;
    const contentNum = next++;

    addObject(fontRegular, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    addObject(fontBold, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    images.forEach((img, i) => {
      const dim = jpegSize(img.bytes);
      addObject(imageNums[i],
        '<< /Type /XObject /Subtype /Image /Width ' + dim.w + ' /Height ' + dim.h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.bytes.length + ' >>',
        img.bytes);
    });

    const layerXObjects = images.map((img, i) => '/' + img.name + ' ' + imageNums[i] + ' 0 R').join(' ');
    const layerStream = strToBytes(ops.toString());
    addObject(layerNum,
      '<< /Type /XObject /Subtype /Form /FormType 1 /BBox [ ' + A.pdf.mediaBox.join(' ') + ' ]' +
      ' /Resources << /ProcSet [ /PDF /Text /ImageC ] /Font << /KEZH ' + fontRegular + ' 0 R /KEZHB ' + fontBold + ' 0 R >>' +
      (layerXObjects ? ' /XObject << ' + layerXObjects + ' >>' : '') + ' >>' +
      ' /Length ' + layerStream.length + ' >>',
      layerStream);

    const invoke = strToBytes('q /KEZLAYER Do Q');
    addObject(contentNum, '<< /Length ' + invoke.length + ' >>', invoke);

    const pageBody = A.pdf.pageTemplate
      .replace('%CONTENT%', contentNum + ' 0 R')
      .replace('%XOBJ%', '/KEZLAYER ' + layerNum + ' 0 R');
    addObject(A.pdf.pageObj, pageBody);

    // table de références croisées (sections triées par numéro d'objet)
    xref.sort((a, b) => a.num - b.num);
    const sections = [];
    for (const entry of xref) {
      const last = sections[sections.length - 1];
      if (last && entry.num === last.start + last.entries.length) last.entries.push(entry);
      else sections.push({ start: entry.num, entries: [entry] });
    }
    const xrefOffset = offset;
    let table = 'xref\n';
    for (const section of sections) {
      table += section.start + ' ' + section.entries.length + '\n';
      for (const entry of section.entries) {
        table += ('0000000000' + entry.offset).slice(-10) + ' 00000 n \n';
      }
    }
    table += 'trailer\n<< /Size ' + next + ' /Root ' + A.pdf.root +
      (A.pdf.info ? ' /Info ' + A.pdf.info : '') +
      (A.pdf.id ? ' /ID [ ' + A.pdf.id + ' ]' : '') +
      ' /Prev ' + A.pdf.startxref + ' >>\nstartxref\n' + xrefOffset + '\n%%EOF\n';
    push(table);

    const out = new Uint8Array(offset);
    let at = 0;
    for (const part of parts) { out.set(part, at); at += part.length; }
    return out;
  }

  return { Ops, assemble, textWidth, wrap, sanitize, b64ToBytes, jpegSize, FIELDS, PAGE_H };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { KezPdf };
