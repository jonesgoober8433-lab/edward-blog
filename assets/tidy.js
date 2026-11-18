// 一鍵斷句（Edward 2026-11-18：像他的 FB 貼文一樣，短句、一行一個意思、段落之間空一行）
// 規則：
//  1. 句號、驚嘆號、問號、分號後面換行；行尾的「。」「；」拿掉，「！」「？」保留。
//  2. 逗號分開的短句：合起來不超過 MAX 個字就留在同一行（保留逗號），太長就換行（行尾逗號拿掉）。
//  3. 冒號後面還有一長串時，冒號後換行（冒號保留）。
//  4. 引號（「」『』）、括號、連結裡面不切；粗體 **…** 被切開時，每行各自補上 **。
//  5. 只動一般段落和標示框（>）；標題、清單、表格、圖片、影片、程式碼都不動。原本的空行（段落分隔）保留。
const MAX = 16;          // 一行大約幾個中文字（手機一行約 20 字，留點空間）
const OPEN = "「『（《〈【([", CLOSE = "」』）》〉】)]";

// 中文字算 1，英文、數字算 0.55，空白算 0.3
function width(s) {
  let w = 0;
  for (const ch of s.replace(/\*\*/g, "").replace(/\]\([^)]*\)/g, "]")) w += /[⺀-￿]/.test(ch) ? 1 : ch === " " ? 0.3 : 0.55;
  return w;
}

// 依標點切成小片段，每片記住結尾標點
function pieces(line) {
  const out = []; let buf = "", depth = 0, inLinkUrl = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "]" && line[i + 1] === "(") { inLinkUrl = true; }
    if (inLinkUrl && ch === ")") { inLinkUrl = false; buf += ch; continue; }
    if (inLinkUrl) { buf += ch; continue; }
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && "，。！？；：".includes(ch)) {
      // 連續的「！？」或「……」一起帶走
      let p = ch; while ("！？".includes(ch) && i + 1 < line.length && "！？".includes(line[i + 1])) { p += line[++i]; }
      // 標點後面緊接的 ** 或 」 屬於這一片
      let tail = ""; while (line.slice(i + 1, i + 3) === "**") { tail += "**"; i += 2; }
      out.push({ text: buf.trim(), punct: p, tail }); buf = ""; continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push({ text: buf.trim(), punct: "", tail: "" });
  return out.filter(p => p.text || p.tail);
}

function splitLine(line) {
  const ps = pieces(line);
  if (ps.length <= 1) return [line.replace(/[。；](\**)\s*$/, "$1")];
  const lines = []; let cur = "";
  const flush = () => { if (cur.trim()) lines.push(cur.trim()); cur = ""; };
  ps.forEach((p, k) => {
    const last = k === ps.length - 1;
    const seg = p.text;
    if (!cur) cur = seg;
    else cur += seg;
    const hard = "。！？；".includes(p.punct[0] || "");
    const next = ps[k + 1];
    if (hard || last) { cur += (p.punct.replace(/[。；]/g, "")) + p.tail; flush(); return; }
    if (p.punct === "：") {
      // 冒號後面還很長就換行
      if (next && width(next.text) > 6) { cur += "：" + p.tail; flush(); } else cur += "：" + p.tail;
      return;
    }
    // 逗號：跟下一片合起來不長就留在同一行
    if (next && width(cur) + 1 + width(next.text) <= MAX) { cur += p.punct + p.tail; }
    else { cur += p.tail; flush(); }
  });
  flush();
  return fixBold(lines);
}

// 粗體被切成好幾行時，每行各自補上 **
function fixBold(lines) {
  let open = false;
  return lines.map(l => {
    let s = l;
    if (open) s = "**" + s;
    const n = (s.match(/\*\*/g) || []).length;
    open = n % 2 === 1;
    if (open) s = s + "**";
    return s.replace(/^\*\*\*\*/, "").replace(/\*\*\*\*$/, "");
  });
}

const SKIP = /^\s*(#|[-*+]\s|\d+[.)]\s|\||!\[|<|```|🎬|🔖|🔗|https?:\/\/|---|\*\*\*$)/;

export function tidyLines(md) {
  if (!md) return md;
  let code = false;
  return md.split("\n").map(raw => {
    if (/^\s*```/.test(raw)) { code = !code; return raw; }
    if (code || !raw.trim()) return raw;
    const q = raw.match(/^(\s*>\s?)(.*)$/);
    const prefix = q ? q[1] : "", body = q ? q[2] : raw;
    if (!body.trim() || SKIP.test(body)) return raw;
    return splitLine(body).map(l => prefix + l).join("\n");
  }).join("\n");
}
