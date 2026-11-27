// 每日財經早報（給客戶看）：資料＝雲端排程產生的 briefs/data/日期.json ＋ Edward 在後台的勾選與微調（Firestore briefs/日期）
import { store, MODE } from "./store.js?v=20261127171806";
import { fetchPublicBriefs } from "./postcache.js?v=20261127171806";
import { esc } from "./ui.js?v=20261127171806";

const CFG = window.BLOG_CONFIG || {};
export const CAT_STYLE = {
  台股: ["📈", "#B23B3B"], 美股: ["🇺🇸", "#1F3A68"], 總經: ["🌐", "#2E5A4C"], 利率: ["🏦", "#7A5530"],
  匯率: ["💱", "#3E6E8E"], 產業: ["🏭", "#5B4A8A"], 政策: ["📜", "#6E2836"], 國際: ["🌏", "#2A7F7A"], 原物料: ["🛢️", "#8A6A1F"], 加密貨幣: ["🪙", "#A9773F"],
  貴金屬: ["🥇", "#B08D2E"], 科技產業: ["💻", "#34557A"], AI產業: ["🤖", "#4B3F8F"], AI新功能: ["✨", "#7A3F8F"],
};
// 有行情小表格（index）時，facts 裡「指數 YYYY.MM.DD，開盤…收在…點。」那句已經畫成表格，就不再重複顯示（Edward 11/18）
const IDX_LINE = /[^。\n]*?\d{4}\.\d{2}\.\d{2}，?開盤[^。]*?收在[\d,.]+\s*點。?\s*/g;
export function factsText(c) { return ((c.index || []).length || c.category === "台股" || c.category === "美股") ? (c.facts || "").replace(IDX_LINE, "").trim() : (c.facts || ""); }

export async function loadIndex() {
  try { return (await (await fetch("briefs/index.json", { cache: "no-store" })).json()).dates || []; } catch (e) { return []; }
}
export async function loadRaw(date) {
  try { const r = await fetch(`briefs/data/${date}.json`, { cache: "no-store" }); return r.ok ? await r.json() : null; } catch (e) { return null; }
}
// 合併：自動版 ＋ Edward 的勾選／微調
export function merge(raw, ov) {
  if (!raw) return null;
  const picks = ov?.picks || raw.picks || raw.candidates.filter(c => c.recommend).map(c => c.id);
  const items = picks.map(id => raw.candidates.find(c => c.id === id)).filter(Boolean).map(c => ({ ...c, ...(ov?.edits?.[c.id] || {}) }));
  return { ...raw, headline: ov?.headline ?? raw.headline, knowledge: { ...raw.knowledge, ...(ov?.knowledge || {}) }, items, ov };
}
// 這一天的早報讀者看得到嗎？
export function visible(raw, ov, now = new Date()) {
  if (!raw) return false;
  if (ov?.status === "published") return true;
  if (ov?.status === "scheduled") return now.getTime() >= (ov.publishAt || 0);   // Edward 按「存檔並 10:00 發布」
  if (ov?.status === "draft" || ov?.status === "hidden") return false;
  if (raw.date <= (CFG.briefDraftUntil || "")) return false;            // 前 5 天是草稿
  const at = Date.parse(`${raw.date}T${CFG.briefPublishTime || "10:00"}:00+08:00`);   // 以台灣時間為準
  return now.getTime() >= at;
}
// 早報覆寫大家都能讀，不必等登入。正式模式一次把這幾天讀回來；失敗才退回 SDK。
async function overridesFor(dates) {
  if (MODE !== "firebase") return Promise.all(dates.map(d => store.getDoc("briefs", d)));
  try { return await fetchPublicBriefs(dates); }
  catch (e) { return Promise.all(dates.map(d => store.getDoc("briefs", d))); }
}
export async function loadBriefRows(dates) {
  const days = [...dates];
  const [raws, ovs] = await Promise.all([Promise.all(days.map(loadRaw)), overridesFor(days)]);
  return days.map((d, i) => ({ d, raw: raws[i], ov: ovs[i], ok: visible(raws[i], ovs[i]) }));
}
export async function latestVisible(dates) {
  const days = [...dates].sort().reverse().slice(0, 10);
  // 首頁卡片只要最新的一份。通常第一天就上線了，不必把舊早報全部抓下來。
  for (const d of days) {
    const [raw, ov] = await Promise.all([loadRaw(d), overridesFor([d]).then(a => a[0])]);
    if (visible(raw, ov)) return merge(raw, ov);
  }
  return null;
}

const fmtDay = d => { const x = new Date(d + "T00:00:00+08:00"); return `${x.getFullYear()}/${x.getMonth() + 1}/${x.getDate()}（${"日一二三四五六"[x.getDay()]}）`; };
export { fmtDay };

function cover(c) {
  const [icon, color] = CAT_STYLE[c.category] || ["📰", "#4A3426"];
  return `<div class="bf-cover" style="--c:${color}"><span class="bf-ico">${icon}</span>
    ${c.number?.value ? `<b>${esc(c.number.value)}</b><small>${esc(c.number.label || "")}</small>` : `<b class="bf-cat">${esc(c.category || "財經")}</b>`}</div>`;
}
// 大盤固定格式：現價／開盤／漲跌／收盤（台灣習慣：漲紅跌綠）
const fmtN = v => v == null ? "—" : Number(v).toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const arrow = v => v == null ? "" : v >= 0 ? "▲" : "▼";
const cls = v => v == null ? "" : v >= 0 ? "up" : "down";
export function indexTable(x) {
  if (!x || x.close == null) return "";
  return `<div class="ix"><div class="ix-h"><b>${esc(x.name)}</b><small>${esc(x.roc || x.date || "")}${x.src ? "・" + esc(x.src) : ""}</small></div>
    <div class="ix-g">
      <div><small>現價</small><b>${fmtN(x.close)}</b><span class="ix-n">資料時間收盤</span></div>
      <div><small>開盤</small><b>${fmtN(x.open)}</b><span class="${cls(x.openChg)}">${arrow(x.openChg)} ${fmtN(Math.abs(x.openChg ?? 0))}</span></div>
      <div><small>漲跌</small><b class="${cls(x.chg)}">${arrow(x.chg)} ${fmtN(Math.abs(x.chg))}</b><span class="${cls(x.chg)}">${x.pct >= 0 ? "+" : "−"}${Math.abs(x.pct).toFixed(2)}%</span></div>
      <div><small>收盤</small><b>${fmtN(x.close)}</b><span class="ix-n">前收 ${fmtN(x.prevClose)}</span></div>
    </div></div>`;
}
export function marketStrip(m = []) {
  if (!m.length) return "";
  return `<div class="bf-market">${m.map(x => {
    const up = (x.chg ?? 0) >= 0;
    return `<div><small>${esc(x.name)}</small><b>${esc(x.close != null ? Number(x.close).toLocaleString("zh-TW", { maximumFractionDigits: 2 }) : "—")}</b>
      <span class="${up ? "up" : "down"}">${up ? "▲" : "▼"} ${x.pct != null ? Math.abs(x.pct).toFixed(2) + "%" : ""}</span></div>`;
  }).join("")}</div>${m[0]?.asOf ? `<p class="bf-asof">收盤資料：${esc(m[0].asOf)}・來源 Yahoo Finance／臺灣證券交易所</p>` : ""}`;
}
// 台股、美股（加上匯率）每天固定放在最上面，用完整表格（現價／開盤／漲跌／收盤）——Edward 2026-11-19 指定一定要有
export function marketTables(m = []) {
  const rows = (m || []).filter(x => x && x.close != null);
  if (!rows.length) return "";
  return `<section class="bf-ixs"><h2 class="bf-ixs-h">📊 今日大盤</h2><div class="bf-ixs-g">${rows.map(indexTable).join("")}</div></section>`;
}
// 台股、美股的新聞一定附「現價／開盤／漲跌／收盤」表格（Edward 2026-11-19：放在文章內，不要全部擠在最上面）
// 數字一律取 market（每天會被收盤防呆更新成最新），名稱以新聞的 index 為準；沒有 index 就依分類自動補
const AUTO_IDX = { 台股: ["台股加權"], 美股: ["S&P 500", "那斯達克", "道瓊"] };
export function itemTables(c, market = []) {
  const want = (c.index || []).length ? c.index.map(x => x.name) : (AUTO_IDX[c.category] || []);
  return want.map(n => (market || []).find(m => m.name === n) || (c.index || []).find(x => x.name === n)).filter(x => x && x.close != null);
}
// 今日財經小知識：一定連到今天某一則新聞（Edward 2026-11-27）
// knowledge = {term, explain, example, from: 新聞 id, quote: 新聞裡出現這個概念的那句, today: 套回今天, takeaway: 一句話記住}
function markQuote(html, k, c) {
  if (!k?.quote || k.from !== c.id) return html;
  const q = esc(k.quote);
  return html.includes(q) ? html.replace(q, `<a class="bf-kmark" href="#know" title="今日財經小知識：${esc(k.term)}">${q}</a>`) : html;
}
function knowCard(b) {
  const k = b.knowledge; if (!k?.term) return "";
  const n = (b.items || []).findIndex(c => c.id === k.from), src = n >= 0 ? b.items[n] : null;
  return `<section class="bf-know" id="know">
    <span class="bf-klab">📚 今日財經小知識</span>
    <h3>${esc(k.term)}</h3>
    ${src ? `<a class="bf-kfrom" href="#news-${esc(src.id)}">📰 出自今天第 ${n + 1} 則：${esc(src.title)}　↑ 回到新聞</a>` : ""}
    ${src && k.quote ? `<p class="bf-kquote">${esc(k.quote)}</p>` : ""}
    <div class="bf-kgrid">
      <div><b>🧠 白話解釋</b><p>${esc(k.explain || "")}</p></div>
      ${k.example ? `<div><b>🍜 生活比喻</b><p>${esc(k.example)}</p></div>` : ""}
    </div>
    ${k.today ? `<div class="bf-ktoday"><b>🔍 套回今天的新聞</b><p>${esc(k.today)}</p></div>` : ""}
    ${k.takeaway ? `<p class="bf-ktake"><b>✅ 一句話記住</b>${esc(k.takeaway)}</p>` : ""}
  </section>`;
}
export function renderBrief(el, b) {
  el.innerHTML = `
    <div class="bf-head"><span class="tag">每日財經早報</span><h1>${fmtDay(b.date)}</h1>
      ${b.headline ? `<p class="bf-lead">${esc(b.headline)}</p>` : ""}</div>
    ${marketStrip(b.market)}
    <div class="bf-items">${b.items.map((c, i) => `
      <article class="bf-item" id="news-${esc(c.id)}">
        ${cover(c)}
        <div class="bf-txt">
          <span class="bf-no">${i + 1}</span><h2>${esc(c.title)}</h2>
          ${factsText(c) ? `<p class="bf-facts">${markQuote(esc(factsText(c)), b.knowledge, c)}</p>` : ""}
          ${b.knowledge?.term && b.knowledge.from === c.id ? `<a class="bf-kchip" href="#know">📚 今日小知識：${esc(b.knowledge.term)}　往下看 ↓</a>` : ""}
          ${itemTables(c, b.market).map(indexTable).join("")}
          ${(c.sources || []).length ? `<div class="bf-sec bf-cross"><b>🔍 交叉比對（出處）</b><p>${(c.sources || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}${s.date ? "（" + esc(s.date) + "）" : ""}</a>`).join("、")}</p></div>` : ""}
          <div class="bf-why"><b>💡 簡單分析：為什麼重要？</b><p>${esc(c.why)}</p></div>
          ${c.outlook ? `<div class="bf-sec bf-out"><b>🔮 推估可能</b><span class="bf-tag">推估，非預測</span><p>${esc(c.outlook)}</p></div>` : ""}
        </div>
      </article>`).join("")}</div>
    ${knowCard(b)}
    <p class="bf-fine">本早報整理自公開新聞與官方資料。「推估可能」是依據公開資訊推論的情境，不是預測，也不構成任何投資建議。數字以各來源最新公告為準。</p>`;
}
