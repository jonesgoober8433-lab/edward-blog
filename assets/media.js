// 照片庫：上傳（剪貼簿／照片 App 拖曳／選檔）→ 壓縮 → 檢查重複 → 插入文章
// 重複判斷兩層：①檔案完全一樣（SHA-256）②看起來一樣（縮圖指紋 dHash，抓得到「同一張照片另存、縮放過」）
import { esc, fmtTime, toast, rememberMedia, mediaUrl } from "./ui.js?v=20261127171806";

const MAX_SIDE = 1600, MAX_B64 = 700000, THUMB = 360;

async function sha256(buf) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function loadImg(src) {
  return new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("這個圖片格式瀏覽器打不開（iPhone 的 HEIC 請先在照片 App 匯出成 JPEG）")); i.src = src; });
}
function dhash(img) {
  const c = document.createElement("canvas"); c.width = 9; c.height = 8;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, 9, 8);
  const d = x.getImageData(0, 0, 9, 8).data; let bits = "";
  for (let y = 0; y < 8; y++) for (let k = 0; k < 8; k++) {
    const p = (y * 9 + k) * 4, q = p + 4;
    bits += (d[p] * .3 + d[p + 1] * .59 + d[p + 2] * .11) > (d[q] * .3 + d[q + 1] * .59 + d[q + 2] * .11) ? "1" : "0";
  }
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}
function hamming(a, b) {
  if (!a || !b) return 99;
  let x = BigInt("0x" + a) ^ BigInt("0x" + b), n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}
function render(img, side, q) {
  const s = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  return { url: c.toDataURL("image/jpeg", q), w: c.width, h: c.height };
}
function compress(img) {
  for (const [side, q] of [[MAX_SIDE, .85], [MAX_SIDE, .75], [1400, .72], [1200, .68], [1000, .62], [800, .6]]) {
    const r = render(img, side, q); if (r.url.length <= MAX_B64) return r;
  }
  throw new Error("這張圖壓縮後還是太大");
}

export function initMedia({ store, $, getMode, insertMd, insertVisual, getPostsWithBody, onChange, onVideoFile }) {
  let lib = [];            // 照片庫（含 Notion 搬家的內建圖片）
  let repoFp = {};         // 內建圖片的指紋快取
  try { repoFp = JSON.parse(localStorage.getItem("eb-repo-fp") || "{}"); } catch (e) { }

  async function usage() {
    const posts = await getPostsWithBody();
    const map = {};
    for (const p of posts) {
      const body = p.body || "";
      for (const m of body.matchAll(/\]\(media\/([A-Za-z0-9_-]+)\)|data-media="([A-Za-z0-9_-]+)"/g)) (map["m:" + (m[1] || m[2])] ||= new Set()).add(p.id);
      for (const m of body.matchAll(/\]\((images\/posts\/[^)\s]+)\)/g)) (map["r:" + m[1]] ||= new Set()).add(p.id);
    }
    return { map, posts };
  }

  async function loadLib() {
    const [items, { map, posts }] = await Promise.all([store.listMedia(), usage()]);
    const title = id => posts.find(p => p.id === id)?.title || id;
    lib = items.map(m => ({ ...m, key: "m:" + m.id, src: m.thumb, used: [...(map["m:" + m.id] || [])].map(id => ({ id, title: title(id) })) }));
    // Notion 搬過來的內建圖片（存在網站資料夾裡）
    const repoPaths = Object.keys(map).filter(k => k.startsWith("r:")).map(k => k.slice(2));
    for (const path of repoPaths) lib.push({ id: path, key: "r:" + path, src: path, name: path.split("/").slice(-2).join("/"), builtin: true, used: [...map["r:" + path]].map(id => ({ id, title: title(id) })), dhash: repoFp[path] });
    return lib;
  }

  async function ensureRepoFingerprints() {
    let changed = false;
    await Promise.all(lib.filter(m => m.builtin && !m.dhash).map(async m => {
      try { const img = await loadImg(m.src); m.dhash = repoFp[m.src] = dhash(img); changed = true; } catch (e) { }
    }));
    if (changed) try { localStorage.setItem("eb-repo-fp", JSON.stringify(repoFp)); } catch (e) { }
  }

  function findDup(hash, dh) {
    return lib.find(m => m.hash && m.hash === hash) || lib.find(m => hamming(m.dhash, dh) <= 5) || null;
  }

  function insert(item, dataUrl) {
    const alt = (item.alt || item.name || "").replace(/\.[a-z0-9]+$/i, "").replace(/[\[\]]/g, "");
    if (getMode() === "visual") {
      if (item.builtin) insertVisual(`<img src="${esc(item.src)}" alt="${esc(alt)}">`);
      else insertVisual(`<img src="${dataUrl}" data-media="${esc(item.id)}" alt="${esc(alt)}">`);
    } else insertMd(item.builtin ? `\n![${alt}](${item.src})\n` : `\n![${alt}](media/${item.id})\n`);
    onChange?.();
  }

  // 上傳一批檔案：不重複就直接插入；重複就打開照片庫並標出那張用在哪
  async function upload(files) {
    files = [...files];
    const vids = files.filter(f => f.type.startsWith("video/"));
    if (vids.length) { if (onVideoFile) onVideoFile(vids); else toast("影片檔太大放不進免費方案：請先上傳到 YouTube，再按「🎬 影片」貼連結", true); }
    const imgs = files.filter(f => f.type.startsWith("image/") || /\.(heic|jpe?g|png|gif|webp)$/i.test(f.name));
    if (!imgs.length) return;
    await loadLib(); await ensureRepoFingerprints();
    const dups = [];
    for (const f of imgs) {
      try {
        toast(`處理中：${f.name || "貼上的圖片"}…`);
        const buf = await f.arrayBuffer();
        const hash = await sha256(buf);
        const url = URL.createObjectURL(new Blob([buf], { type: f.type || "image/jpeg" }));
        const img = await loadImg(url); URL.revokeObjectURL(url);
        const dh = dhash(img);
        const dup = findDup(hash, dh);
        if (dup) { dups.push(dup); continue; }
        const full = compress(img), th = render(img, THUMB, .7);
        const meta = { id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: f.name && f.name !== "image.png" ? f.name : `貼上的圖片 ${fmtTime(Date.now())}`,
          hash, dhash: dh, w: full.w, h: full.h, bytes: Math.round(full.url.length * .75), thumb: th.url, createdAt: Date.now(),
          origW: img.naturalWidth, origH: img.naturalHeight, origBytes: f.size };
        await store.saveMedia(meta, full.url);
        rememberMedia(meta.id, full.url);
        lib.unshift({ ...meta, key: "m:" + meta.id, src: meta.thumb, used: [] });
        insert(meta, full.url);
        const kb = b => b >= 1048576 ? (b / 1048576).toFixed(1) + "MB" : Math.round(b / 1024) + "KB";
        const shrunk = meta.w !== meta.origW || meta.bytes < f.size * .9;
        toast(shrunk ? `已插入 ✓ 原圖 ${meta.origW}×${meta.origH}（${kb(f.size)}）超過容量，已等比例壓成 ${meta.w}×${meta.h}（${kb(meta.bytes)}），比例不變、不會變形`
                     : `已上傳並插入：${meta.name} ✓（${meta.w}×${meta.h}，${kb(meta.bytes)}）`);
      } catch (e) { toast(`${f.name || "圖片"}：${e.message}`, true); }
    }
    if (dups.length) openLib({ highlight: dups.map(d => d.key), note: `有 ${dups.length} 張照片已經在照片庫裡了，沒有重複上傳。下面標黃色的就是，看「用在哪」決定要不要直接插入舊的那張。` });
  }

  // ---------- 照片庫畫面 ----------
  let filter = "all";
  async function openLib({ highlight = [], note = "" } = {}) {
    $("dlgMedia").showModal();
    $("mediaNote").textContent = note; $("mediaNote").hidden = !note;
    $("mediaGrid").innerHTML = `<p class="stamp">載入中…</p>`;
    await loadLib();
    draw(highlight);
    if (highlight.length) setTimeout(() => document.querySelector(".mcard.hl")?.scrollIntoView({ block: "center" }), 50);
  }
  function draw(highlight = []) {
    const list = lib.filter(m => filter === "all" || (filter === "unused" ? !m.used.length : m.used.length));
    $("mediaCount").textContent = `共 ${lib.length} 張（沒用到 ${lib.filter(m => !m.used.length).length} 張）`;
    $("mediaGrid").innerHTML = list.map(m => `
      <figure class="mcard ${highlight.includes(m.key) ? "hl" : ""}" data-key="${esc(m.key)}">
        <img src="${esc(m.src)}" alt="" loading="lazy">
        <figcaption>
          <b title="${esc(m.name)}">${esc(m.name)}</b>
          <span class="stamp">${m.builtin ? "Notion 搬家" : `${m.w}×${m.h}・${Math.round((m.bytes || 0) / 1024)}KB・${fmtTime(m.createdAt)}`}</span>
          ${m.origW && m.origW !== m.w ? `<span class="stamp">已等比例壓縮（原圖 ${m.origW}×${m.origH}），不變形</span>` : ""}
          <div class="used">${m.used.length ? "用在：" + m.used.map(u => u.id === "__cur" ? `<b>${esc(u.title)}</b>` : `<a href="admin.html?id=${encodeURIComponent(u.id)}" data-edit="${esc(u.id)}">${esc(u.title)}</a>`).join("、") : `<span class="unused">還沒有文章用到</span>`}</div>
          <span class="mact"><button class="btn sm" data-ins="${esc(m.key)}">插入</button>${!m.builtin && !m.used.length ? `<button class="btn danger sm" data-del="${esc(m.key)}">刪除</button>` : ""}</span>
        </figcaption>
      </figure>`).join("") || `<p class="stamp">照片庫是空的。按上面「上傳照片」，或在文章裡直接貼上圖片。</p>`;
  }
  $("mediaGrid").addEventListener("click", async e => {
    const ins = e.target.closest("[data-ins]"), del = e.target.closest("[data-del]"), ed = e.target.closest("[data-edit]");
    if (ins) {
      const m = lib.find(x => x.key === ins.dataset.ins);
      const data = m.builtin ? null : await mediaUrl(m.id);
      $("dlgMedia").close(); insert(m, data); toast("已插入 ✓");
    }
    if (del) {
      const m = lib.find(x => x.key === del.dataset.del);
      if (!confirm(`從照片庫刪除「${m.name}」？\n（沒有文章用到它，刪了不影響文章）`)) return;
      await store.deleteMedia(m.id); lib = lib.filter(x => x !== m); draw(); toast("已刪除");
    }
    if (ed && !confirm("要離開目前的編輯，去改那篇文章嗎？（沒存的內容會不見）")) e.preventDefault();
  });
  document.querySelector("#dlgMedia .mfilter").addEventListener("click", e => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    filter = b.dataset.f; document.querySelectorAll("#dlgMedia .mfilter button").forEach(x => x.classList.toggle("on", x === b)); draw();
  });
  $("mediaUpload").addEventListener("change", e => { const f = e.target.files; $("dlgMedia").close(); upload(f); e.target.value = ""; });
  $("pickImg").addEventListener("change", e => { upload(e.target.files); e.target.value = ""; });

  // 剪貼簿貼上、拖曳（從照片 App 或 Finder 拖進編輯區）
  function grabFiles(dt) { return [...(dt?.files || [])].filter(f => /^(image|video)\//.test(f.type) || /\.(heic|jpe?g|png|gif|webp)$/i.test(f.name)); }
  for (const el of [$("body"), $("visual")]) {
    el.addEventListener("paste", e => { const fs = grabFiles(e.clipboardData); if (fs.length) { e.preventDefault(); e.stopImmediatePropagation(); upload(fs); } }, true);
    el.addEventListener("dragover", e => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); el.classList.add("dropping"); } });
    el.addEventListener("dragleave", () => el.classList.remove("dropping"));
    el.addEventListener("drop", e => { el.classList.remove("dropping"); const fs = grabFiles(e.dataTransfer); if (fs.length) { e.preventDefault(); upload(fs); } });
  }
  return { openLib, upload };
}
