// 首頁用的「公開文章清單」快取。
// 只放大家看得到的已上線文章（標題、摘要、分類…），讓回訪者不用等 Firebase 下載完。
// 安全界線：
//   - 不帶登入憑證去抓，Firestore 規則會擋掉草稿
//   - 寫進 localStorage 前再濾一次：草稿、排程中、內文都不會留下
//   - 就算有人把管理員清單塞進這個 key，讀出來時也只剩公開已上線的欄位
// 會員限定文章的「標題卡片」本來就公開，所以會留著；全文在 bodies，這裡不碰。

const KEY = "eb-public-posts-v1";

function num(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}
function clip(v, max) {
  if (typeof v !== "string") return undefined;
  return v.length > max ? v.slice(0, max) : v;
}
function okId(id) {
  return typeof id === "string" && id.length >= 1 && id.length <= 120 && !/[\s/#?&]/.test(id);
}

// 與 store.isLive 同一套：已發布、而且發布時間已到（publishedAt 在未來＝排程中，不給訪客看）
export function isPublicLive(p, now = Date.now()) {
  return !!p && p.status === "published" && (!p.publishedAt || p.publishedAt <= now);
}

// 只留下首頁卡片需要的欄位。不合資格（草稿、排程、壞掉的 id）回傳 null。
export function publicPost(raw, now = Date.now()) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !okId(raw.id)) return null;
  const o = { id: raw.id };
  const title = clip(raw.title, 200);
  const summary = clip(raw.summary, 1000);
  const cover = clip(raw.cover, 1000);
  const category = clip(raw.category, 40);
  if (title !== undefined) o.title = title;
  if (summary !== undefined) o.summary = summary;
  if (cover !== undefined) o.cover = cover;
  if (category !== undefined) o.category = category;
  if (raw.visibility === "public" || raw.visibility === "members") o.visibility = raw.visibility;
  if (raw.status === "published") o.status = "published";
  if (typeof raw.pinned === "boolean") o.pinned = raw.pinned;
  for (const k of ["order", "createdAt", "updatedAt", "publishedAt"]) {
    const n = num(raw[k]);
    if (n !== undefined) o[k] = n;
  }
  if (Array.isArray(raw.tags)) {
    o.tags = raw.tags.filter(t => typeof t === "string" && t.length <= 40).slice(0, 20);
  }
  if (!isPublicLive(o, now)) return null;
  return o;
}

function sortPublic(list) {
  return [...list].sort((a, b) =>
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
    (a.order ?? 1e9) - (b.order ?? 1e9) ||
    (b.publishedAt || b.createdAt || 0) - (a.publishedAt || a.createdAt || 0));
}

export function publicPostsFrom(list, now = Date.now()) {
  const map = new Map();
  for (const raw of list || []) {
    const p = publicPost(raw, now);
    if (p) map.set(p.id, p); // 同一篇以後寫入的為準，避免快取裡出現兩筆
  }
  return sortPublic([...map.values()]).slice(0, 500);
}

// 沒有快取回傳 null（第一次來的人走正常載入）；有快取回傳陣列（可能是空的）。
export function readPublicCache(now = Date.now()) {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || raw.v !== 1 || !Array.isArray(raw.posts)) return null;
    return publicPostsFrom(raw.posts.slice(0, 500), now);
  } catch (e) { return null; }
}

// 呼叫端可以丟進管理員清單或帶 body 的文章，寫進去的仍只有公開已上線欄位。
export function writePublicCache(list, now = Date.now()) {
  const posts = publicPostsFrom(list, now);
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), posts })); } catch (e) { }
  return posts;
}

function fsValue(v) {
  if (!v || typeof v !== "object") return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return num(v.integerValue);
  if ("doubleValue" in v) return num(v.doubleValue);
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) { const t = Date.parse(v.timestampValue); return Number.isFinite(t) ? t : undefined; }
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fsValue);
  if ("mapValue" in v) {
    const o = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) o[k] = fsValue(val);
    return o;
  }
  return undefined;
}
function docId(name) {
  const s = String(name || "");
  const i = s.lastIndexOf("/");
  try { return decodeURIComponent(i >= 0 ? s.slice(i + 1) : s); } catch (e) { return ""; }
}

// 不帶 Authorization，所以即使用戶在這台裝置登入管理員，也只會拿到規則允許公開讀的已發布文章。
export async function fetchPublicPosts(cfg = (typeof window !== "undefined" && window.BLOG_CONFIG) || {}) {
  const fb = cfg.firebase;
  if (!fb?.projectId || !fb?.apiKey) throw new Error("沒有 Firebase 設定");
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fb.projectId)}/databases/(default)/documents:runQuery?key=${encodeURIComponent(fb.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    credentials: "omit", // 不帶任何 cookie／登入憑證，草稿不會因為這台裝置登著管理員而混進來
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "posts" }],
        where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "published" } } },
      },
    }),
    signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
  });
  if (!res.ok) throw new Error("文章清單讀取失敗");
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.some(r => r && r.error)) throw new Error("文章清單讀取被拒絕");
  const list = [];
  for (const row of rows) {
    const doc = row && row.document;
    if (!doc) continue;
    const fields = { id: docId(doc.name) };
    for (const [k, v] of Object.entries(doc.fields || {})) fields[k] = fsValue(v);
    list.push(fields);
  }
  return publicPostsFrom(list);
}

// 單篇公開文章、早報覆寫：同樣不帶登入、不寫進 localStorage。
// 會員內文就算回應裡帶了也不採用（規則本來就會擋，這裡再擋一次）。
async function fetchDoc(collection, id, cfg = (typeof window !== "undefined" && window.BLOG_CONFIG) || {}) {
  if (collection !== "posts" && collection !== "bodies" && collection !== "briefs") throw new Error("這個集合不走公開路徑");
  if (collection === "briefs") { if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null; }
  else if (!okId(id)) return null;
  const fb = cfg.firebase;
  if (!fb?.projectId || !fb?.apiKey) throw new Error("沒有 Firebase 設定");
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fb.projectId)}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}?key=${encodeURIComponent(fb.apiKey)}`;
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error("讀取失敗");
  const doc = await res.json();
  const fields = {};
  for (const [k, v] of Object.entries(doc.fields || {})) fields[k] = fsValue(v);
  delete fields.body; // 預設拿掉；公開文章由 fetchPublicPost 在確認過後才放回
  if (collection === "bodies") fields.__body = typeof (doc.fields?.body && fsValue(doc.fields.body)) === "string" ? fsValue(doc.fields.body) : "";
  return fields;
}

export async function fetchPublicPost(id, cfg) {
  if (!okId(id)) return null;
  // 先看標題文件。會員文、草稿就不去讀內文，避免多一次被拒絕的請求。
  const meta = await fetchDoc("posts", id, cfg);
  if (!meta || !isPublicLive(meta)) return null;
  const post = {
    id,
    title: typeof meta.title === "string" ? meta.title : "",
    summary: typeof meta.summary === "string" ? meta.summary : "",
    cover: typeof meta.cover === "string" ? meta.cover : "",
    category: typeof meta.category === "string" ? meta.category : "",
    tags: Array.isArray(meta.tags) ? meta.tags.filter(t => typeof t === "string") : [],
    visibility: meta.visibility === "members" ? "members" : "public",
    status: "published",
    pinned: meta.pinned === true,
  };
  for (const k of ["createdAt", "updatedAt", "publishedAt"]) {
    const n = num(meta[k]);
    if (n !== undefined) post[k] = n;
  }
  // 會員文章只回標題卡片。內文欄位保持 null，呼叫端畫上鎖畫面。
  if (post.visibility === "members") return { ...post, body: null, locked: true };
  const bodyDoc = await fetchDoc("bodies", id, cfg);
  if (bodyDoc && bodyDoc.visibility === "members") return { ...post, visibility: "members", body: null, locked: true };
  if (!bodyDoc || bodyDoc.visibility !== "public" || !isPublicLive({ status: bodyDoc.status, publishedAt: bodyDoc.publishedAt })) {
    return { ...post, body: "", locked: false };
  }
  return { ...post, body: bodyDoc.__body || "", locked: false };
}

// 早報的勾選／微調大家都能讀（規則 allow read）。沒有這天的文件回 null，不當成錯誤。
export async function fetchPublicBrief(date, cfg) {
  const all = await fetchPublicBriefs([date], cfg);
  return all[0] || null;
}

// 一次把多天的覆寫讀回來。用 batchGet，缺的日子是 missing 而不是 404，主控台不會噴錯誤。
export async function fetchPublicBriefs(dates, cfg = (typeof window !== "undefined" && window.BLOG_CONFIG) || {}) {
  const days = [...new Set((dates || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
  if (!days.length) return (dates || []).map(() => null);
  const fb = cfg.firebase;
  if (!fb?.projectId || !fb?.apiKey) throw new Error("沒有 Firebase 設定");
  const names = days.map(d => `projects/${fb.projectId}/databases/(default)/documents/briefs/${d}`);
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fb.projectId)}/databases/(default)/documents:batchGet?key=${encodeURIComponent(fb.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents: names }),
    signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
  });
  if (!res.ok) throw new Error("早報讀取失敗");
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error("早報讀取失敗");
  const byId = new Map();
  for (const item of rows) {
    const found = item && item.found;
    if (!found) continue;
    const fields = {};
    for (const [k, v] of Object.entries(found.fields || {})) {
      if (k === "body") continue;
      fields[k] = fsValue(v);
    }
    byId.set(docId(found.name), fields);
  }
  return (dates || []).map(d => byId.get(d) || null);
}

export { KEY as PUBLIC_CACHE_KEY };
