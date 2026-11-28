// 理財地圖（理財新手村）：文章裡寫一行「🗺️ 理財地圖」，這裡就自動畫出三階段地圖，所有已發布文章自動排進去（Edward 2026-11-27）
// 新文章：照「分類」自動分到對應的關卡；要放到別的關卡，在 PLACE 加一行。排序：ORDER 裡的先排，其餘照發布日期。
import { store } from "./store.js?v=20261128173407";
import { esc } from "./ui.js?v=20261128173407";

export const MAP_POST_ID = "n-ec9e7cff9014";
const STAGES = [
  { key: "start", no: "起點", title: "還不確定從哪裡開始？", en: "Start Here", goal: "先讀這幾篇，看懂財務規劃在做什麼", groups: [{ key: "start", title: "" }] },
  { key: "defense", no: "第一階段", title: "【防禦】建構財務護城河", en: "Protection", goal: "確保生活不被意外擊垮，優化現金流", lead: "先搞懂錢怎麼流，再把保障盤點清楚",
    groups: [{ key: "cash", title: "💸 現金流與生活財商" }, { key: "insure", title: "🛡️ 保險保障" }, { key: "social", title: "🏛️ 社會保險：勞保、勞退、國保" }] },
  { key: "system", no: "第二階段", title: "【系統】穩定成長的 Beta 策略", en: "System & Beta", goal: "利用市場規律，打造自動化獲利系統", lead: "用紀律和時間，讓錢自己長大",
    groups: [{ key: "invest", title: "📈 投資基本功" }, { key: "numbers", title: "🧮 看懂商品的數字" }, { key: "retire", title: "🏖️ 退休與傳承" }] },
  { key: "attack", no: "第三階段", title: "【進攻】追求卓越的 Alpha 策略", en: "Attack & Alpha", goal: "透過洞察力，看懂大環境的變化", lead: "先看懂世界在發生什麼，再決定怎麼調整",
    groups: [{ key: "macro", title: "🌏 看懂大環境" }] },
];
// 分類 → 預設關卡
const BY_CATEGORY = { 新手入門: "start", 生活財商: "cash", 保險規劃: "insure", 社會保險: "social", 投資理財: "invest", 退休傳承: "retire", 時事觀點: "macro", 時事觀察: "macro" };
// 例外：文章 id → 關卡（分類跟地圖位置不同時才寫）
const PLACE = {
  "n-ec7cd08d0089": "start",            // 財務規劃，不是有錢人才需要
  "q4-2026-12-29-pub-mwlxdjr5": "start", // 我為什麼做財務教練
  "n-f96aa59472a0": "cash",             // 告別赤字
  "n-f042c44cfa69": "cash",             // 你的隱形名片
  "n-ed25b21dc79d": "cash",             // 富爸爸，窮爸爸
  "q4-2026-12-11-pub-mwlxdjir": "numbers", // 保證月領 3%
  "q4-2026-12-15-pub-mwlxdjjp": "numbers", // 儲蓄險報酬率
  "q4-draft-pub-stabilization-fund": "macro", // 國安基金進場
  "q4-2026-12-18-pub-mwlxdjmi": "macro", // 景氣四季：讀景氣燈號、看大環境，屬【進攻】（分類是投資理財，預設會掉到系統）
  "q4-2026-12-22-pub-mwlxdjnq": "retire", // 勞退自提6%：自己決定扣多少、長期自動累積，屬【系統】（分類是社會保險，預設會掉到防禦）
};
// 建議閱讀順序（沒列到的接在後面，照發布日期）
const ORDER = [
  "n-ec7cd08d0089", "q4-2026-12-29-pub-mwlxdjr5",
  "n-f96aa59472a0", "n-f042c44cfa69", "n-ed25b21dc79d", "notify-cleanup-mwlt4w58",
  "n-d2949ecaf61e", "q4-draft-pub-medical6", "q4-draft-pub-travel", "q4-draft-pub-travel-flu", "q4-draft-pub-travel-sports",
  "q4-2026-11-20-pub-mwlxdj5j", "q4-2026-11-25-vip-mwlxdja3", "q4-draft-pub-national-pension",
  "n-ebbc12a6e34b", "q4-2026-11-24-pub-mwlxdj8a", "n-da45a8525d5c", "q4-2026-12-04-pub-mwlxdjeu", "q4-2026-11-27-pub-mwlxdjbf", "n-f73d0e49d0f4", "q4-2026-12-08-pub-mwlxdjga", "q4-2026-12-16-vip-mwlxdjl4",
  "q4-2026-12-11-pub-mwlxdjir", "q4-2026-12-15-pub-mwlxdjjp",
  "q4-2026-12-22-pub-mwlxdjnq", "q4-2026-12-01-pub-mwlxdjd4", "q4-2026-12-09-vip-mwlxdjhj",
  "q4-2026-12-18-pub-mwlxdjmi", "q4-draft-pub-stabilization-fund", "n-f16212282114", "n-d061314876d7", "n-cf2ad1ad8308",
];
const MARK = /^\s*🗺️?\s*理財地圖\s*$/;
const READ_KEY = "eb-read";
export function markRead(id) { try { const s = new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); s.add(id); localStorage.setItem(READ_KEY, JSON.stringify([...s])); } catch (e) { } }
function readSet() { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); } catch (e) { return new Set(); } }

// 有標記才畫：先同步放好關卡標題（讓文章大綱抓得到），文章清單再非同步補上
export function mountMap(art) {
  const p = [...art.querySelectorAll(".prose p")].find(x => MARK.test(x.textContent));
  if (!p) return false;
  const box = document.createElement("div"); box.className = "fmap";
  box.innerHTML = `<p class="fmap-meta" id="fmapMeta">地圖載入中…</p>` + STAGES.map(s => `
    <section class="fmap-stage fmap-${s.key}">
      <h2 id="map-${s.key}">${s.no}：${esc(s.title)}</h2>
      <div class="fmap-head"><span class="fmap-en">${esc(s.en)}</span><span class="fmap-goal"><b>核心目標</b>${esc(s.goal)}</span><span class="fmap-prog" data-prog="${s.key}"></span></div>
      ${s.lead ? `<p class="fmap-lead">${esc(s.lead)}</p>` : ""}
      ${s.groups.map(g => `<div class="fmap-group">${g.title ? `<h3>${esc(g.title)}</h3>` : ""}<ol class="fmap-list" data-g="${g.key}"></ol></div>`).join("")}
    </section>`).join("");
  p.replaceWith(box);
  fill(box);
  // 從別篇的「看完整理財地圖」點過來（#map-defense 這種），畫好後捲到那一關
  if (/^#map-/.test(location.hash)) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 300);
  return true;
}
// 把文章排進地圖：回傳 [{stage, groups:[{g, items:[post]}], items:[post]}]
function arrange(posts) {
  const now = Date.now(), rank = id => { const i = ORDER.indexOf(id); return i < 0 ? 1e6 : i; };
  posts = posts.filter(x => x.id !== MAP_POST_ID && (x.status || "published") === "published" && !(x.publishedAt > now));
  posts.sort((a, b) => rank(a.id) - rank(b.id) || (a.publishedAt || 0) - (b.publishedAt || 0));
  const keys = new Set(); STAGES.forEach(s => s.groups.forEach(g => keys.add(g.key)));
  const groupOf = x => keys.has(PLACE[x.id]) ? PLACE[x.id] : (keys.has(BY_CATEGORY[x.category]) ? BY_CATEGORY[x.category] : "invest");
  return STAGES.map(s => {
    const groups = s.groups.map(g => ({ g, items: posts.filter(x => groupOf(x) === g.key) }));
    return { stage: s, groups, items: groups.flatMap(x => x.items) };
  });
}
const SHOW = 3;          // 每關先顯示幾篇
const NEW_DAYS = 7;      // NEW 標籤留幾天
async function fill(box) {
  let posts = [];
  try { posts = await store.listPosts(); } catch (e) { }
  const now = Date.now(), read = readSet(), map = arrange(posts);
  let count = 0, newest = 0;
  for (const m of map) {
    const sec = box.querySelector(`.fmap-${m.stage.key}`), total = m.items.length, fold = total > SHOW + 1;
    // 先讀的 3 篇：每個小分類輪流拿第 1 篇、再拿第 2 篇…，讓預覽涵蓋整關
    const showIds = new Set();
    for (let r = 0; showIds.size < SHOW && m.groups.some(x => x.items[r]); r++) m.groups.forEach(x => { if (x.items[r] && showIds.size < SHOW) showIds.add(x.items[r].id); });
    let done = 0;
    for (const { g, items } of m.groups) {
      const ol = sec.querySelector(`.fmap-list[data-g="${g.key}"]`);
      items.forEach((x, k) => {
        const isRead = read.has(x.id), isNew = now - (x.publishedAt || 0) < NEW_DAYS * 864e5, hide = fold && !showIds.has(x.id);
        if (isRead) done++; count++; newest = Math.max(newest, x.publishedAt || 0);
        ol.insertAdjacentHTML("beforeend", `<li value="${k + 1}" class="${isRead ? "read" : ""}${hide ? " more" : ""}"><a href="post.html?id=${encodeURIComponent(x.id)}">${esc(x.title)}</a>${x.visibility === "members" ? `<span class="fmap-b vip">🔒 VIP</span>` : ""}${isNew ? `<span class="fmap-b new">NEW</span>` : ""}${isRead ? `<span class="fmap-b ok">✓ 讀過</span>` : ""}</li>`);
      });
      const gp = ol.closest(".fmap-group");
      if (!items.length) gp.remove(); else if (fold && !ol.querySelector("li:not(.more)")) gp.classList.add("more");
    }
    if (fold) {
      sec.insertAdjacentHTML("beforeend", `<button type="button" class="fmap-more">看這關全部 ${total} 篇 ▾</button>`);
      const btn = sec.querySelector(".fmap-more");
      btn.onclick = () => { const open = sec.classList.toggle("open"); btn.textContent = open ? "收起來 ▴" : `看這關全部 ${total} 篇 ▾`; };
    }
    const pg = sec.querySelector("[data-prog]"); pg.textContent = total ? `已讀 ${done}／${total} 篇${done === total ? "　🎉 通關" : ""}` : "";
  }
  box.querySelector("#fmapMeta").textContent = count ? `🗺️ 地圖會自動更新：目前收錄 ${count} 篇${newest ? `，最新一篇上架於 ${new Date(newest).toLocaleDateString("zh-TW")}` : ""}` : "地圖暫時載入不了，請稍後重新整理。";
}
// 每篇文章底下：你在地圖的哪裡＋這關的下一篇
export async function mountWhere(art, id) {
  if (id === MAP_POST_ID) return;
  let posts = [];
  try { posts = await store.listPosts(); } catch (e) { return; }
  const map = arrange(posts);
  const si = map.findIndex(m => m.items.some(x => x.id === id)); if (si < 0) return;
  const m = map[si], gi = m.groups.find(x => x.items.some(y => y.id === id)), k = gi.items.findIndex(y => y.id === id);
  const pos = m.items.findIndex(y => y.id === id);
  let next = m.items[pos + 1], nextLabel = "這關的下一篇";
  if (!next) { const nm = map.slice(si + 1).find(x => x.items.length); if (nm) { next = nm.items[0]; nextLabel = `下一關（${nm.stage.no}）第一篇`; } }
  const box = document.createElement("div"); box.className = "fmap-where";
  box.innerHTML = `<p class="fw-pos">📍 你在理財地圖的：<b>${esc(m.stage.no)}・${esc(gi.g.title.replace(/^\S+\s/, "") || m.stage.title)}</b>（第 ${k + 1}／${gi.items.length} 篇）</p>
    ${next ? "" : `<p class="fw-pos">🎉 你已經走到地圖的最後一篇了！</p>`}
    <a class="fw-map" href="post.html?id=${MAP_POST_ID}#map-${m.stage.key}">🗺️ 看完整理財地圖</a>`;
  // 文末「下一篇文章」改成照理財地圖的順序（只留一個「下一篇」，不讓讀者混淆）
  const np = art.querySelector(".nextpost");
  if (np && next) { np.href = `post.html?id=${encodeURIComponent(next.id)}`; np.querySelector("small").textContent = `下一篇（理財地圖・${nextLabel}）`; np.querySelector("b").textContent = next.title; }
  else if (np && !next) np.remove();
  const cta = art.querySelector(".cta");
  cta ? cta.before(box) : art.append(box);
}
