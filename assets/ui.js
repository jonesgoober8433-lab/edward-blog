// 共用畫面零件：頁首、頁尾、日期、Markdown 轉換
import { store, MODE } from "./store.js";
const CFG = window.BLOG_CONFIG || {};
export const PALETTES = [
  ["navy", "1｜海軍藍＋穩重金", "#14284B", "#D2B07A"],
  ["burgundy", "3｜酒紅＋象牙金", "#4A1822", "#E3C38E"],
  ["slate", "4｜石板灰＋湖水綠", "#1E2A35", "#6CC5BC"],
  ["coffee", "5｜咖啡棕＋米色", "#3E2B1F", "#E2C08D"],
];
export function applyPalette(p, remember = true) {
  if (!p) return;
  let preview = null; try { preview = new URLSearchParams(location.search).get("palette"); } catch (e) { }
  if (!preview) document.documentElement.dataset.palette = p;
  if (remember) try { localStorage.setItem("eb-site-palette", p); } catch (e) { }
}
store.getSettings().then(s => applyPalette(s.palette)).catch(() => { });
export const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmtDate = ms => ms ? new Date(ms).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";
export const fmtTime = ms => ms ? new Date(ms).toLocaleString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
// Markdown → 安全的 HTML。照片庫的圖寫成 ![說明](media/ID)；YouTube 網址單獨一行會變成內嵌影片
export function md(text, { embed = true } = {}) {
  let html = window.marked ? window.marked.parse(text || "", { breaks: true }) : esc(text);
  html = html.replace(/<img([^>]*?)src="media\/([A-Za-z0-9_-]+)"/g, `<img$1src="${PIXEL}" data-media="$2" class="media-loading"`);
  html = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
  // 圖片大小：說明文字最後加 |小 |中 |大（例：![填表範例|小](...)）
  html = html.replace(/<img([^>]*?)alt="([^"]*?)\|(小|中|大)"/g, (m, a, alt, s) => `<img${a}alt="${alt}" class="img-${{ 小: "s", 中: "m", 大: "l" }[s]}"`)
             .replace(/class="media-loading"([^>]*?)class="(img-[sml])"/g, 'class="media-loading $2"$1');
  // 連續兩張以上的圖片自動並排
  html = html.replace(/<p>((?:\s*<img[^>]*>\s*(?:<br>)?\s*){2,})<\/p>/g, (m, inner) => `<div class="gallery">${inner.replace(/<br>/g, "").replace(/<img[^>]*>/g, t => { const a = (t.match(/alt="([^"]*)"/) || [])[1]; return a ? `<figure>${t}<figcaption>${a}</figcaption></figure>` : t; })}</div>`);
  if (embed) html = html.replace(/<p>(?:🔗|🎬)?\s*(?:<a [^>]*href="([^"]+)"[^>]*>[^<]*<\/a>|(https?:\/\/[^\s<]+))\s*<\/p>/g, (m, a, b) => {
    const id = ytId(a || b); if (!id) return m;
    return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube 影片" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
  });
  return html;
}
export function ytId(u) {
  try {
    const x = new URL(String(u).replace(/&amp;/g, "&"));
    if (/(^|\.)youtu\.be$/.test(x.hostname)) return x.pathname.slice(1).match(/^[\w-]{11}/)?.[0] || null;
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(x.hostname)) return (x.searchParams.get("v") || x.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] || "").match(/^[\w-]{11}$/)?.[0] || null;
  } catch (e) { }
  return null;
}
// 把畫面上 data-media 的圖片換成照片庫裡的真圖
const mediaCache = new Map();
export function mediaUrl(id) {
  if (!mediaCache.has(id)) mediaCache.set(id, store.getMediaData(id));
  return mediaCache.get(id);
}
export function rememberMedia(id, dataUrl) { mediaCache.set(id, Promise.resolve(dataUrl)); }
export async function hydrateMedia(root = document) {
  await Promise.all([...root.querySelectorAll("img[data-media]")].map(async img => {
    const d = await mediaUrl(img.dataset.media);
    if (d) img.src = d; else img.alt = (img.alt || "") + "（圖片已刪除）";
    img.classList.remove("media-loading");
  }));
}
export const readMins = text => Math.max(1, Math.round((text || "").replace(/\s/g, "").length / 450));

export function header(active = "") {
  const el = document.createElement("header");
  el.className = "site-header";
  el.innerHTML = `
    <div class="wrap bar">
      <a class="brand" href="index.html"><span class="mark">E</span><span><b>${esc(CFG.siteName)}</b><small>${esc(CFG.authorTitle || "")}</small></span></a>
      <nav id="nav"></nav>
    </div>
    ${MODE === "demo" ? `<div class="demo-bar">${LOCAL ? "示範模式：資料只存在這台電腦的瀏覽器，別人看不到。接上 Firebase 後才是正式網站。" : "網站建置中：目前是示範文章，正式內容即將上線。"}</div>` : ""}`;
  document.body.prepend(el);
  store.onAuth(u => {
    const links = [["index.html", "文章", "home"], ["about.html", "關於我", "about"]];
    if (CFG.membersEnabled) links.push(["member.html", "會員專區", "member"]);
    if (u?.isAdmin) links.push(["admin.html", "後台", "admin"]);
    el.querySelector("#nav").innerHTML = links.map(([h, t, k]) => `<a href="${h}" class="${k === active ? "on" : ""}">${t}</a>`).join("") +
      (u ? `<span class="who" title="${esc(u.email)}">${esc(u.name)}</span><button class="btn ghost sm" id="logout">登出</button>`
         : (MODE === "demo" && !LOCAL ? "" : `<a class="btn sm" href="login.html">登入</a>`));
    el.querySelector("#logout")?.addEventListener("click", async () => { await store.signOut(); location.href = "index.html"; });
  });
}

export function footer() {
  const f = document.createElement("footer");
  f.className = "site-footer";
  f.innerHTML = `<div class="wrap"><div><b>${esc(CFG.siteName)}</b><p>${esc(CFG.tagline || "")}</p></div>
    ${CFG.bookingUrl ? `<div style="text-align:right"><a class="btn gold" href="${esc(CFG.bookingUrl)}" target="_blank" rel="noopener">預約諮詢</a><br><small>${esc(CFG.bookingNote || "")}</small></div>` : ""}
    <p class="fine">文章內容為一般性資訊分享，不構成個別投資或保險建議；數字與法規以主管機關最新公告為準。</p></div>`;
  document.body.append(f);
}

export function toast(msg, bad = false) {
  const t = document.createElement("div");
  t.className = "toast" + (bad ? " bad" : "");
  t.textContent = msg; document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}
