// 共用畫面零件：頁首、頁尾、日期、Markdown 轉換
import { store, MODE } from "./store.js";
const CFG = window.BLOG_CONFIG || {};
export const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmtDate = ms => ms ? new Date(ms).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";
export const fmtTime = ms => ms ? new Date(ms).toLocaleString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
export function md(text) {
  const html = window.marked ? window.marked.parse(text || "", { breaks: true }) : esc(text);
  return window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
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
