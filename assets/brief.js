// 每日財經早報（給客戶看）：資料＝雲端排程產生的 briefs/data/日期.json ＋ Edward 在後台的勾選與微調（Firestore briefs/日期）
import { store } from "./store.js?v=202611171645";
import { esc } from "./ui.js?v=202611171645";

const CFG = window.BLOG_CONFIG || {};
export const CAT_STYLE = {
  台股: ["📈", "#B23B3B"], 美股: ["🇺🇸", "#1F3A68"], 總經: ["🌐", "#2E5A4C"], 利率: ["🏦", "#7A5530"],
  匯率: ["💱", "#3E6E8E"], 產業: ["🏭", "#5B4A8A"], 政策: ["📜", "#6E2836"], 國際: ["🌏", "#2A7F7A"], 原物料: ["🛢️", "#8A6A1F"], 加密貨幣: ["🪙", "#A9773F"],
};

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
  if (ov?.status === "draft" || ov?.status === "hidden") return false;
  if (raw.date <= (CFG.briefDraftUntil || "")) return false;            // 前 5 天是草稿
  const at = Date.parse(`${raw.date}T${CFG.briefPublishTime || "08:00"}:00+08:00`);   // 以台灣時間為準
  return now.getTime() >= at;
}
export async function latestVisible(dates) {
  for (const d of [...dates].sort().reverse().slice(0, 10)) {
    const [raw, ov] = await Promise.all([loadRaw(d), store.getDoc("briefs", d)]);
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
export function marketStrip(m = []) {
  if (!m.length) return "";
  return `<div class="bf-market">${m.map(x => {
    const up = (x.chg ?? 0) >= 0;
    return `<div><small>${esc(x.name)}</small><b>${esc(x.close != null ? Number(x.close).toLocaleString("zh-TW", { maximumFractionDigits: 2 }) : "—")}</b>
      <span class="${up ? "up" : "down"}">${up ? "▲" : "▼"} ${x.pct != null ? Math.abs(x.pct).toFixed(2) + "%" : ""}</span></div>`;
  }).join("")}</div>${m[0]?.asOf ? `<p class="bf-asof">收盤資料：${esc(m[0].asOf)}・來源 Yahoo Finance／臺灣證券交易所</p>` : ""}`;
}
export function renderBrief(el, b) {
  el.innerHTML = `
    <div class="bf-head"><span class="tag">每日財經早報</span><h1>${fmtDay(b.date)}</h1>
      ${b.headline ? `<p class="bf-lead">${esc(b.headline)}</p>` : ""}</div>
    ${marketStrip(b.market)}
    <div class="bf-items">${b.items.map((c, i) => `
      <article class="bf-item">
        ${cover(c)}
        <div class="bf-txt">
          <span class="bf-no">${i + 1}</span><h2>${esc(c.title)}</h2>
          <p class="bf-facts">${esc(c.facts)}</p>
          <div class="bf-why"><b>為什麼重要？</b><p>${esc(c.why)}</p></div>
          ${(c.sources || []).length ? `<p class="bf-src">資料來源：${c.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join("、")}</p>` : ""}
        </div>
      </article>`).join("")}</div>
    ${b.knowledge?.term ? `<div class="bf-know"><span>📚 今日財經小知識</span><h3>${esc(b.knowledge.term)}</h3><p>${esc(b.knowledge.explain || "")}</p>${b.knowledge.example ? `<p class="bf-ex">例子：${esc(b.knowledge.example)}</p>` : ""}</div>` : ""}
    <p class="bf-fine">本早報整理自公開新聞與官方資料，只陳述事實與背景，不構成任何投資建議。數字以各來源最新公告為準。</p>`;
}
