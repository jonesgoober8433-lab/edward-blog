// 首頁「市場行情」小卡：6 檔、可左右滑動翻頁、1D／1W／1M 切換
// 台股加權指數：用證交所官方公開資料自己畫（TradingView 免費版不提供台股）
// 美股：2026-11-19 起不用 TradingView（Edward：全部做成台股這種只能看、不能點的樣子）
//       改讀 briefs/market/us.json（GitHub Actions 每天早上從 Yahoo Finance 抓），用同一套小圖自己畫
import { esc } from "./ui.js?v=20261118165907";

const CARDS = [
  { key: "twii", name: "台股加權指數", note: "證交所官方資料" },
  { key: "spx", name: "S&P 500", note: "美股收盤" },
  { key: "ndx", name: "那斯達克 100", note: "美股收盤" },
  { key: "dji", name: "道瓊工業", note: "美股收盤" },
  { key: "sox", name: "費城半導體", note: "美股收盤" },
  { key: "tsm", name: "台積電 ADR", note: "美股掛牌" },
];
const RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"];

export function mountMarket(el) {
  let range = "1D";
  try { range = localStorage.getItem("eb-mkt-range") || "1D"; } catch (e) { }
  if (!RANGES.includes(range)) range = "1D";
  el.innerHTML = `
    <div class="mkt-head">
      <b>市場行情</b>
      <span class="seg mkt-range">${RANGES.map(r => `<button type="button" data-r="${r}">${r}</button>`).join("")}</span>
    </div>
    <div class="mkt-wrap">
      <button type="button" class="mkt-arrow prev" aria-label="上一頁">‹</button>
      <div class="mkt-track" tabindex="0" aria-label="市場行情，可左右滑動">${CARDS.map(c => `
        <div class="mkt-card" data-key="${esc(c.key)}"><div class="mkt-title"><span>${esc(c.name)}</span><small>${esc(c.note)}</small></div><div class="mkt-body"></div></div>`).join("")}
      </div>
      <button type="button" class="mkt-arrow next" aria-label="下一頁">›</button>
    </div>
    <div class="mkt-foot"><span class="mkt-dots"></span><span class="mkt-hint">← 左右滑動看更多 →</span></div>
    <p class="mkt-fine">行情可能延遲，僅供參考，不構成投資建議。</p>`;
  const track = el.querySelector(".mkt-track");
  const dots = el.querySelector(".mkt-dots");

  function pages() { const per = Math.max(1, Math.round(track.clientWidth / (track.querySelector(".mkt-card").offsetWidth + 12))); return { per, n: Math.ceil(CARDS.length / per) }; }
  function drawDots() {
    const { per, n } = pages(), cur = Math.round(track.scrollLeft / (track.scrollWidth - track.clientWidth || 1) * (n - 1));
    dots.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i === cur ? "on" : ""}"></i>`).join("");
    el.querySelector(".prev").disabled = track.scrollLeft < 4;
    el.querySelector(".next").disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 4;
    el.querySelector(".mkt-hint").hidden = n < 2;
  }
  el.querySelector(".prev").onclick = () => track.scrollBy({ left: -track.clientWidth, behavior: "smooth" });
  el.querySelector(".next").onclick = () => track.scrollBy({ left: track.clientWidth, behavior: "smooth" });
  track.addEventListener("scroll", () => requestAnimationFrame(drawDots), { passive: true });
  addEventListener("resize", drawDots);

  function render() {
    el.querySelectorAll(".mkt-range button").forEach(b => b.classList.toggle("on", b.dataset.r === range));
    el.querySelectorAll(".mkt-card").forEach(card => {
      const body = card.querySelector(".mkt-body"), key = card.dataset.key;
      if (key === "twii") return twii(body, range);
      usCard(body, key, range);
    });
    setTimeout(drawDots, 50);
  }
  el.querySelector(".mkt-range").addEventListener("click", e => {
    const b = e.target.closest("[data-r]"); if (!b || b.dataset.r === range) return;
    range = b.dataset.r; try { localStorage.setItem("eb-mkt-range", range); } catch (e) { } render();
  });
  render();
  // 台股：開盤時間每分鐘更新一次
  setInterval(() => { if (range === "1D" && !document.hidden) twii(el.querySelector('[data-key="twii"] .mkt-body'), "1D", true); }, 60000);
}

// ---------- 台股加權指數（證交所公開資料）----------
const ymd = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
const num = s => +String(s).replace(/,/g, "");
const twCache = {};
async function twJson(url) {
  if (twCache[url] && Date.now() - twCache[url].t < 55000) return twCache[url].d;
  const d = await (await fetch(url)).json(); twCache[url] = { t: Date.now(), d }; return d;
}
async function monthly(date) {   // 某個月每天的收盤
  const j = await twJson(`https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK?date=${ymd(date)}&response=json`);
  if (j.stat !== "OK") return [];
  const iT = j.fields.indexOf("發行量加權股價指數");
  return j.data.map(r => { const [y, m, d] = r[0].split("/").map(Number); return { t: new Date(y + 1911, m - 1, d).getTime(), v: num(r[iT]) }; });
}
async function intraday() {      // 今天（或最近一個交易日）每 5 秒的指數
  let d = new Date();
  for (let i = 0; i < 7; i++) {
    const j = await twJson(`https://www.twse.com.tw/rwd/zh/TAIEX/MI_5MINS_INDEX?date=${ymd(d)}&response=json`);
    if (j.stat === "OK" && j.data?.length) {
      const pts = j.data.map(r => ({ label: r[0], v: num(r[1]) }));
      const step = Math.max(1, Math.floor(pts.length / 120));
      return { day: d, pts: pts.filter((_, k) => k % step === 0 || k === pts.length - 1) };
    }
    d = new Date(d.getTime() - 864e5);
  }
  return null;
}
async function twii(body, range, quiet = false) {
  if (!quiet) body.innerHTML = `<div class="mkt-loading">載入中…</div>`;
  try {
    let pts, prevClose, sub;
    const now = new Date(), lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const daily = [...await monthly(lastMonth), ...await monthly(now)].sort((a, b) => a.t - b.t);
    if (range === "1D") {
      const id = await intraday(); if (!id) throw new Error();
      pts = id.pts.map(p => p.v);
      const before = daily.filter(x => x.t < new Date(id.day.getFullYear(), id.day.getMonth(), id.day.getDate()).getTime());
      prevClose = before.length ? before.at(-1).v : pts[0];
      sub = `${id.day.getMonth() + 1}/${id.day.getDate()} ${id.pts.at(-1).label.slice(0, 5)}`;
    } else if (range === "1W" || range === "1M") {
      const n = range === "1W" ? 6 : 23;
      const s = daily.slice(-n); pts = s.map(x => x.v); prevClose = pts[0];
      const a = new Date(s[0].t), b = new Date(s.at(-1).t);
      sub = `${a.getMonth() + 1}/${a.getDate()}～${b.getMonth() + 1}/${b.getDate()}`;
    } else {
      // 3M／6M／1Y／ALL：用每天 06:00 存好的長期資料（briefs/market/twii.json），再接上證交所最新收盤
      const h = await twJson("briefs/market/twii.json");
      if (range === "ALL") {
        const m = h.monthly; pts = m.map(x => x[1]); prevClose = pts[0];
        if (daily.length) pts.push(daily.at(-1).v);
        sub = `${m[0][0].slice(0, 4)} 年至今（每月收盤）`;
      } else {
        const n = { "3M": 63, "6M": 126, "1Y": 250 }[range];
        let s = h.daily.map(x => ({ t: Date.parse(x[0] + "T13:30:00+08:00"), v: x[1] }));
        for (const x of daily) if (x.t > s.at(-1).t + 36e5) s.push(x);
        s = s.slice(-n); pts = s.map(x => x.v); prevClose = pts[0];
        const a = new Date(s[0].t), b = new Date(s.at(-1).t);
        sub = `${a.getFullYear()}/${a.getMonth() + 1}/${a.getDate()}～${b.getMonth() + 1}/${b.getDate()}`;
      }
    }
    body.innerHTML = view(pts, prevClose, `${sub}・資料：${["1D", "1W", "1M"].includes(range) ? "臺灣證券交易所" : "Yahoo Finance＋證交所"}`);
  } catch (e) {
    if (!quiet) body.innerHTML = `<div class="mkt-loading">暫時抓不到證交所資料，稍後再試<br><a href="https://www.twse.com.tw/zh/indices/taiex/mi-5min-hist.html" target="_blank" rel="noopener">到證交所看</a></div>`;
  }
}
function view(pts, prevClose, sub) {
  const last = pts.at(-1), chg = last - prevClose, pct = chg / prevClose * 100, up = chg >= 0;
  return `<div class="tw-num"><b>${last.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}</b>
      <span class="${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(chg).toFixed(2)}（${up ? "+" : "−"}${Math.abs(pct).toFixed(2)}%）</span></div>
      ${spark(pts, up, prevClose)}<div class="tw-sub">${sub}</div>`;
}

// ---------- 美股（briefs/market/us.json，每天早上更新）----------
const md = s => { const [, m, d] = s.split("-"); return `${+m}/${+d}`; };
async function usCard(body, key, range) {
  body.innerHTML = `<div class="mkt-loading">載入中…</div>`;
  try {
    const x = (await twJson("briefs/market/us.json"))[key];
    if (!x?.daily?.length) throw new Error();
    let pts, prevClose, sub;
    if (range === "1D" && x.intraday?.length) {
      pts = x.intraday.map(p => p[1]); prevClose = x.prevClose ?? pts[0];
      sub = `美東 ${x.intraday.at(-1)[0]} 收盤`;
    } else if (range === "ALL") {
      pts = x.monthly.map(p => p[1]); prevClose = pts[0];
      sub = `${x.monthly[0][0].slice(0, 4)} 年至今（每月收盤）`;
    } else {
      const n = { "1D": 2, "1W": 6, "1M": 23, "3M": 63, "6M": 126, "1Y": 250 }[range];
      const s = x.daily.slice(-n); pts = s.map(p => p[1]); prevClose = pts[0];
      sub = `${["3M", "6M", "1Y"].includes(range) ? s[0][0].slice(0, 4) + "/" : ""}${md(s[0][0])}～${md(s.at(-1)[0])}`;
    }
    body.innerHTML = view(pts, prevClose, `${sub}・資料：Yahoo Finance`);
  } catch (e) {
    body.innerHTML = `<div class="mkt-loading">暫時抓不到資料，稍後再試</div>`;
  }
}
function spark(pts, up, base) {
  const w = 260, h = 78, min = Math.min(...pts, base), max = Math.max(...pts, base), r = (max - min) || 1;
  const X = i => (i / Math.max(1, pts.length - 1)) * w, Y = v => h - 4 - (v - min) / r * (h - 8);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  // 台灣習慣：漲紅跌綠
  const c = up ? "#D0312D" : "#1E8E5A";
  return `<svg class="tw-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <line x1="0" x2="${w}" y1="${Y(base).toFixed(1)}" y2="${Y(base).toFixed(1)}" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="3 3"/>
    <path d="${line}L${w},${h}L0,${h}Z" fill="${c}" fill-opacity=".10"/><path d="${line}" fill="none" stroke="${c}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
}
