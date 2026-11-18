// 文章頁畫面（正式文章頁 post.html 與後台裝置預覽 preview.html 共用）
import { esc, fmtDate, fmtTime, md, readMins, hydrateMedia } from "./ui.js?v=20261118164543";

const ICON_TOC = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>`;
const ICON_ARROW = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

// 大標題：有「：」或「｜」就拆成主標＋副標（Edward 2026-11-18：標題斷行很醜）
export function titleHtml(t) {
  t = t || "（還沒有標題）";
  const m = t.match(/^(.{2,22}?)\s*[：｜]\s*(.{4,})$/);
  return m ? `<span class="t-main">${esc(m[1])}</span><span class="t-sub">${esc(m[2])}</span>` : esc(t);
}

export function renderArticle(art, p, { CFG, next = null, loginNext = "", user = null } = {}) {
  art.innerHTML = `
    <a href="index.html" class="stamp">← 回文章列表</a>
    <div style="margin-top:14px"><span class="tag">${esc(p.category || "")}</span>
      ${p.status && p.status !== "published" ? `<span class="badge draft">草稿（只有你看得到）</span>` : ""}
      ${p.visibility === "members" ? `<span class="badge lock">VIP</span>` : ""}</div>
    <h1>${titleHtml(p.title)}</h1>
    <div class="dates">
      <span>✍️ ${esc(CFG.author)}</span>
      <span>發布：${fmtDate(p.publishedAt || p.createdAt || Date.now())}</span>
      <span title="${fmtTime(p.updatedAt)}">最後更新：${fmtDate(p.updatedAt || Date.now())}</span>
      ${p.body ? `<span>約 ${readMins(p.body)} 分鐘讀完</span>` : ""}
    </div>
    ${p.cover ? `<img src="${esc(p.cover)}" alt="" style="width:100%;border-radius:14px;margin-bottom:20px">` : ""}
    ${p.locked
      ? `<p class="prose">${esc(p.summary || "")}</p>
         <div class="paywall">${user && !user.approved
           ? `<h3>⏳ 正在取得授權</h3><p>你的會員申請已送出，Edward 確認後就能看這篇 VIP 文章。</p>`
           : `<h3>🔒 這篇是 VIP 文章</h3><p>VIP 文章只開放給會員，申請後由 Edward 審核開通。</p>
         <a class="btn" href="login.html?next=${encodeURIComponent(loginNext)}&apply=1">申請會員</a>　<a class="btn ghost" href="login.html?next=${encodeURIComponent(loginNext)}">會員登入</a>`}</div>`
      : `<div class="prose" id="prose">${md(p.body)}</div>`}
    ${(p.tags || []).length ? `<p class="stamp" style="margin-top:28px">標籤：${p.tags.map(t => `<a href="index.html?q=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("　")}</p>` : ""}
    ${CFG.bookingUrl ? `<div class="cta"><div><b>想知道自己的情況怎麼規劃？</b><br><span style="opacity:.85">跟錢有關的問題，都可以找我！${esc(CFG.bookingNote || "")}。</span></div><a class="btn" href="${esc(CFG.bookingUrl)}" target="_blank" rel="noopener">預約諮詢</a></div>` : ""}
    ${next ? `<a class="nextpost" href="post.html?id=${encodeURIComponent(next.id)}">
        <span class="np-txt"><small>下一篇文章</small><b>${esc(next.title)}</b></span>
        <span class="np-ico">${ICON_ARROW}</span></a>` : ""}`;
  hydrateMedia(art);
  // 文章裡連到別的網站的連結一律另開分頁（Edward 2026-11-18：點連結不要直接導走）
  art.querySelectorAll(".prose a[href]").forEach(a => {
    try { const u = new URL(a.getAttribute("href"), location.href); if (u.origin !== location.origin) { a.target = "_blank"; a.rel = "noopener"; } } catch (e) { }
  });
  // 程式碼框（例如給 AI 的指令）右上角加「複製」按鈕
  art.querySelectorAll(".prose pre").forEach(pre => {
    const b = document.createElement("button"); b.type = "button"; b.className = "btn sm pre-copy"; b.textContent = "📋 複製";
    b.onclick = async () => {
      const t = pre.innerText.replace(/📋 複製|✓ 已複製$/, "").trim();
      try { await navigator.clipboard.writeText(t); } catch (e) { const r = document.createRange(); r.selectNodeContents(pre.querySelector("code") || pre); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand("copy"); }
      b.textContent = "✓ 已複製"; setTimeout(() => b.textContent = "📋 複製", 1600);
    };
    pre.classList.add("has-copy"); pre.append(b);
  });
  art.querySelectorAll(".prose img").forEach(img => !img.closest(".bookmark") && img.addEventListener("click", () => {
    const box = document.createElement("div"); box.className = "lightbox";
    box.innerHTML = `<img src="${img.src}" alt=""><p>${esc(img.alt || "")}　點一下關閉</p>`;
    box.onclick = () => box.remove(); document.body.append(box);
  }));
  buildToc(art);
}

// 右下角「大綱」按鈕：列出文章的大標、小標，點了直接跳過去
function buildToc(art) {
  document.querySelectorAll(".toc-fab, .toc-panel").forEach(e => e.remove());
  const hs = [...art.querySelectorAll(".prose h2, .prose h3")].filter(h => h.textContent.trim());
  if (hs.length < 2) return;
  hs.forEach((h, i) => { h.id = h.id || "sec-" + (i + 1); });
  const fab = document.createElement("button");
  fab.className = "toc-fab"; fab.type = "button"; fab.setAttribute("aria-label", "文章大綱"); fab.setAttribute("aria-expanded", "false");
  fab.innerHTML = `${ICON_TOC}<span class="toc-tip">文章大綱</span>`; fab.title = "文章大綱";
  const panel = document.createElement("nav");
  panel.className = "toc-panel"; panel.hidden = true; panel.setAttribute("aria-label", "文章大綱");
  panel.innerHTML = `<div class="toc-head"><b>文章大綱</b><button type="button" class="toc-x" aria-label="關閉">✕</button></div>
    <ol>${hs.map(h => `<li class="${h.tagName === "H3" ? "lv3" : ""}"><a href="#${h.id}">${esc(h.textContent.trim())}</a></li>`).join("")}</ol>`;
  document.body.append(panel, fab);
  const toggle = show => { panel.hidden = !show; fab.setAttribute("aria-expanded", String(show)); fab.classList.toggle("on", show); };
  fab.onclick = () => toggle(panel.hidden);
  panel.querySelector(".toc-x").onclick = () => toggle(false);
  panel.addEventListener("click", e => {
    const a = e.target.closest("a"); if (!a) return;
    e.preventDefault(); toggle(false);
    const t = document.getElementById(a.getAttribute("href").slice(1));
    window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 84, behavior: "smooth" });
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") toggle(false); });
  // 目前讀到哪一段，大綱裡就標亮
  const links = [...panel.querySelectorAll("a")];
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) links.forEach(l => l.classList.toggle("cur", l.getAttribute("href") === "#" + en.target.id));
  }), { rootMargin: "-80px 0px -70% 0px" });
  hs.forEach(h => io.observe(h));
  // 讀到最上面時先不顯示按鈕，往下捲才出現
  const vis = () => fab.classList.toggle("show", scrollY > 240);
  addEventListener("scroll", vis, { passive: true }); vis();
}
