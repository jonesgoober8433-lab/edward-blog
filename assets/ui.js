// 共用畫面零件：頁首、頁尾、日期、Markdown 轉換
import { store, MODE } from "./store.js?v=20261127144333";
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
export const DARKS = [
  ["oled", "2｜純黑", "#000000", "#E2C08D"],
  ["charcoal", "3｜石墨灰", "#1B1C1F", "#D9D9DE"],
  ["midnight", "4｜深夜藍", "#0B1322", "#E2C08D"],
];
export function applyDark(d, remember = true) {
  if (!d) return;
  let preview = null; try { preview = new URLSearchParams(location.search).get("dark"); } catch (e) { }
  if (!preview) document.documentElement.dataset.dark = d;
  if (remember) try { localStorage.setItem("eb-site-dark", d); } catch (e) { }
}
const applyRemoteSettings = () => store.getSettings().then(s => { applyPalette(s.palette); applyDark(s.dark); }).catch(() => { });
// 文章頁、早報頁會先把頻寬留給公開內容，配色等 Firebase 啟動再補（config.js?v=20261127144333 已套過本機配色）
if (window.__ebDeferFirebase && store.afterFirebase) store.afterFirebase(applyRemoteSettings);
else applyRemoteSettings();
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
  // 次要資訊的標示框（例：「本文寫於…」、開頭寫【備註】）＝小字備註；其他標示框是重要內文，維持原本大小
  html = html.replace(/<blockquote>(\s*<p>\s*)(本文寫於|【備註】|ℹ️)/g, (m, sp, k) => `<blockquote class="note">${sp}${k === "【備註】" ? "" : k}`);
  // 圖片大小：說明文字最後加 |小 |中 |大（例：![填表範例|小](...)）
  html = html.replace(/<img([^>]*?)alt="([^"]*?)\|(小|中|大)"/g, (m, a, alt, s) => `<img${a}alt="${alt}" class="img-${{ 小: "s", 中: "m", 大: "l" }[s]}"`)
             .replace(/class="media-loading"([^>]*?)class="(img-[sml])"/g, 'class="media-loading $2"$1');
  // 連續兩張以上的圖片自動並排
  html = html.replace(/<p>((?:\s*<img[^>]*>\s*(?:<br>)?\s*){2,})<\/p>/g, (m, inner) => `<div class="gallery">${inner.replace(/<br>/g, "").replace(/<img[^>]*>/g, t => { const a = (t.match(/alt="([^"]*)"/) || [])[1]; return a ? `<figure><figcaption>${a}</figcaption>${t}</figure>` : `<figure>${t}</figure>`; })}</div>`);
  // 單獨一行的連結：🎬 或純網址＝內嵌影片；🔖 或 🔗＝書籤卡片；一般文字連結＝超連結（不轉換）
  if (embed) html = html.replace(/<p>(🎬|🔖|🔗)?\s*(?:<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>|(https?:\/\/[^\s<]+))\s*<\/p>/g, (m, mark, href, text, bare) => {
    const url = (href || bare || "").replace(/&amp;/g, "&"), id = ytId(url);
    if ((mark === "🎬" || (!mark && bare)) && id)
      return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube 影片" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    if (mark === "🔖" || mark === "🔗") {
      let host = ""; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return m; }
      const title = text && text !== url ? text : (id ? "YouTube 影片" : host);
      return `<a class="bookmark" href="${esc(url)}" target="_blank" rel="noopener">
        ${id ? `<span class="bm-thumb"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><span class="bm-play">▶</span></span>` : bmThumb(url) ? `<span class="bm-thumb"><img src="${bmThumb(url)}" alt="" loading="lazy"></span>` : `<span class="bm-thumb bm-icon">🔗</span>`}
        <span class="bm-txt"><b>${esc(title)}</b></span></a>`;
    }
    return m;
  });
  // 文章內文裡連結文字含「預約諮詢」的，一律發亮
  html = html.replace(/<a ([^>]*)>([^<]*預約諮詢[^<]*)<\/a>/g, (m, at, t) => `<a ${at} class="book-link">${t}</a>`);
  // 文章圖片晚一點再抓、解碼不擋主執行緒。寬高不硬填：版面用 max-height，填了數字會把比例擠歪。
  html = html.replace(/<img\b([^>]*?)\/?>/g, (m, attrs) => {
    attrs = attrs.replace(/\s*\/\s*$/, "");
    if (!/\bloading=/.test(attrs)) attrs += ' loading="lazy"';
    if (!/\bdecoding=/.test(attrs)) attrs += ' decoding="async"';
    return `<img${attrs}>`;
  });
  return html;
}
// 自己網站的頁面，書籤卡片用專屬封面圖（不用 🔗）
const BM_THUMBS = { "intro.html": "images/intro-3d-thumb.jpg" };
function bmThumb(u) {
  try { const x = new URL(u, location.href); if (!/jonesgoober8433-lab\.github\.io$/.test(x.hostname) && x.hostname !== location.hostname) return "";
    const f = x.pathname.split("/").pop(); return BM_THUMBS[f] || ""; } catch (e) { return ""; }
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
      <a class="brand" href="index.html"><span class="mark"><img src="assets/brand/mark-64.png" alt=""></span><span><b>${esc(CFG.siteName)}</b><small>${esc(CFG.authorTitle || "")}</small></span></a>
      <nav id="nav" aria-label="主選單"></nav>
      <div class="hdr-tools" id="hdrTools"></div>
    </div>
    ${active === "admin" || active === "badmin" ? `<div class="wrap admin-tabs"><a href="admin.html" class="${active === "admin" ? "on" : ""}">📝 文章後台</a><a href="brief-admin.html" class="${active === "badmin" ? "on" : ""}">📰 早報後台</a></div>` : ""}
    ${MODE === "demo" ? `<div class="demo-bar">${LOCAL ? "示範模式：資料只存在這台電腦的瀏覽器，別人看不到。接上 Firebase 後才是正式網站。" : "網站建置中：目前是示範文章，正式內容即將上線。"}</div>` : ""}`;
  document.body.prepend(el);
  // 公開選單先畫。登入／登出、後台按鈕等 auth 與角色文件查完再補，不要擋文章。
  const draw = (u, authReady) => {
    // 順序：早報、文章、VIP、關於我、後台（後台裡再分文章後台／早報後台）
    const links = [["brief.html", "早報", "brief"], ["index.html", "文章", "home"]];
    if (CFG.membersEnabled) links.push(["member.html", "VIP", "member"]);
    links.push(["about.html", "關於我", "about"]);
    if (u?.isAdmin) links.push(["admin.html", "後台", active === "badmin" ? "badmin" : "admin"]);
    el.querySelector("#nav").innerHTML = links.map(([h, t, k]) => `<a href="${h}" class="${k === active || (k === "badmin" && active === "badmin") ? "on" : ""}">${t}</a>`).join("");
    const account = !authReady ? ""
      : u ? `<span class="who" title="${esc(u.email)}">${esc(u.name)}</span><button class="btn ghost sm" id="logout">登出</button>`
      : (MODE === "demo" && !LOCAL ? "" : `<a class="btn sm" href="login.html">登入</a>`);
    const book = CFG.bookingUrl ? `<a class="btn gold sm book-glow" href="${esc(CFG.bookingUrl)}">預約諮詢</a>` : "";
    el.querySelector("#hdrTools").innerHTML = book + themeBtn() + account;
    el.querySelector("#themeBtn").onclick = toggleTheme;
    el.querySelector("#logout")?.addEventListener("click", async () => { await store.signOut(); location.href = "index.html"; });
  };
  draw(null, false);
  if (!window.__ebThemeSync) { window.__ebThemeSync = 1; addEventListener("eb-theme", () => { const b = document.getElementById("themeBtn"); if (b) { b.outerHTML = themeBtn(); document.getElementById("themeBtn").onclick = toggleTheme; } }); }
  store.onAuth(u => draw(u, true));
}

// 黑暗／日光模式切換鈕（右上角）
function themeBtn() {
  const dark = document.documentElement.dataset.theme === "dark";
  return `<button type="button" class="theme-btn" id="themeBtn" aria-label="${dark ? "切換成日光模式" : "切換成黑暗模式"}" title="${dark ? "切換成日光模式" : "切換成黑暗模式"}">${dark
    ? `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g></svg>`
    : `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z" fill="currentColor"/></svg>`}</button>`;
}
export function toggleTheme() {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  // 切回跟系統一樣 → 恢復「自動跟隨系統」；跟系統不一樣 → 記住他的選擇
  const sys = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  try { if (t === sys) localStorage.removeItem("eb-theme"); else localStorage.setItem("eb-theme", t); } catch (e) { }
  const b = document.getElementById("themeBtn"); if (b) b.outerHTML = themeBtn();
  document.getElementById("themeBtn").onclick = toggleTheme;
  dispatchEvent(new CustomEvent("eb-theme", { detail: t }));
}

export function footer() {
  const f = document.createElement("footer");
  f.className = "site-footer";
  f.innerHTML = `<div class="wrap f-grid">
    <div class="f-left"><b>${esc(CFG.siteName)}</b><p>${esc(CFG.tagline || "")}</p>
      <p class="fine">文章內容為一般性資訊分享，不構成個別投資或保險建議；數字與法規以主管機關最新公告為準。</p></div>
    ${CFG.bookingUrl ? `<div class="booking"><a class="btn gold" href="${esc(CFG.bookingUrl)}" target="_blank" rel="noopener">預約諮詢</a><small>${esc(CFG.bookingNote || "")}</small></div>` : ""}
  </div>`;
  document.body.append(f);
}

export function toast(msg, bad = false) {
  const t = document.createElement("div");
  t.className = "toast" + (bad ? " bad" : "");
  t.textContent = msg; document.body.append(t);
  setTimeout(() => t.remove(), Math.max(2600, msg.length * 90));
}
