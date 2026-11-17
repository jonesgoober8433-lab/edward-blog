// 資料層：同一套功能，兩種存法
//   示範模式（config.firebase 為 null）→ 存在瀏覽器 localStorage
//   正式模式（有填 Firebase 設定）     → Firebase 登入＋Firestore 資料庫
// 頁面只呼叫這裡的函式，不用管資料實際放哪。

const CFG = window.BLOG_CONFIG || {};
export const MODE = CFG.firebase ? "firebase" : "demo";

export function sortPosts(list) {
  return [...list].sort((a, b) =>
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
    (a.order ?? 1e9) - (b.order ?? 1e9) ||
    (b.publishedAt || b.createdAt || 0) - (a.publishedAt || a.createdAt || 0));
}

// 已發布、而且發布時間已到（publishedAt 在未來＝排程中）
export const isLive = (p, now = Date.now()) => p.status === "published" && (!p.publishedAt || p.publishedAt <= now);

export function newId(title = "") {
  const base = title.trim().toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return (base || "post") + "-" + Date.now().toString(36);
}

const META_KEYS = ["title", "summary", "cover", "category", "tags", "visibility", "status", "pinned", "order", "createdAt", "updatedAt", "publishedAt"];
function pick(o, keys) { const r = {}; keys.forEach(k => { if (o[k] !== undefined) r[k] = o[k]; }); return r; }

// ------------------------------------------------------------------
// 示範模式
// ------------------------------------------------------------------
function demoStore() {
  const KEY = "edward-blog-demo-v1";
  const listeners = new Set();
  let db;
  const load = () => { try { db = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { db = null; } if (!db) db = seed(); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alert("瀏覽器無法儲存（可能是無痕模式）"); } };
  load();

  async function hash(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("edward-blog:" + s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  const me = () => { const u = db.users.find(u => u.uid === db.session); return u ? { uid: u.uid, email: u.email, name: u.name, isAdmin: u.role === "admin", joinedAt: u.joinedAt } : null; };
  const emit = () => listeners.forEach(fn => fn(me()));

  return {
    onAuth(fn) { listeners.add(fn); setTimeout(() => fn(me()), 0); return () => listeners.delete(fn); },
    current: me,
    async signUp(email, password, name) {
      email = email.trim().toLowerCase();
      if (password.length < 6) throw new Error("密碼至少 6 個字");
      if (db.users.some(u => u.email === email)) throw new Error("這個 Email 已經註冊過了");
      const role = db.users.some(u => u.role === "admin") ? "member" : "admin"; // 示範模式：第一個註冊的人是管理員
      db.users.push({ uid: "u" + Date.now().toString(36), email, name: name || email.split("@")[0], role, pw: await hash(password), joinedAt: Date.now() });
      db.session = db.users.at(-1).uid; save(); emit(); return me();
    },
    async signIn(email, password) {
      const u = db.users.find(u => u.email === email.trim().toLowerCase());
      if (!u || u.pw !== await hash(password)) throw new Error("Email 或密碼不對");
      db.session = u.uid; save(); emit(); return me();
    },
    async signOut() { db.session = null; save(); emit(); },
    async resetPassword() { throw new Error("示範模式沒有寄信功能；正式模式會寄重設密碼信"); },
    async listPosts({ all = false } = {}) {
      const u = me();
      const now = Date.now();
      return sortPosts(db.posts.filter(p => all && u?.isAdmin ? true : isLive(p, now)).map(p => pick(p, ["id", ...META_KEYS])));
    },
    async getPost(id) {
      const p = db.posts.find(p => p.id === id); if (!p) return null;
      const u = me();
      if (!isLive(p) && !u?.isAdmin) return null;
      const locked = p.visibility === "members" && !u;
      return { ...p, body: locked ? null : p.body, locked };
    },
    async searchText(id) { const p = db.posts.find(p => p.id === id); return p && (p.visibility === "public" || me()) ? p.body : ""; },
    async savePost(post) {
      if (!me()?.isAdmin) throw new Error("只有管理員可以發文");
      const i = db.posts.findIndex(p => p.id === post.id);
      if (i >= 0) db.posts[i] = post; else db.posts.push(post);
      save(); return post;
    },
    async deletePost(id) { db.posts = db.posts.filter(p => p.id !== id); save(); },
    async reorder(ids) { ids.forEach((id, i) => { const p = db.posts.find(p => p.id === id); if (p) p.order = i; }); save(); },
    async listTemplates() { return [...db.templates].sort((a, b) => b.updatedAt - a.updatedAt); },
    async saveTemplate(t) { const i = db.templates.findIndex(x => x.id === t.id); if (i >= 0) db.templates[i] = t; else db.templates.push(t); save(); return t; },
    async deleteTemplate(id) { db.templates = db.templates.filter(t => t.id !== id); save(); },
    async exists(id) { return db.posts.some(p => p.id === id); },
    async listMembers() { return db.users.map(u => ({ uid: u.uid, email: u.email, name: u.name, role: u.role, joinedAt: u.joinedAt })); },
    async resetDemo() { localStorage.removeItem(KEY); load(); emit(); },
  };
}

function seed() {
  const now = Date.now(), day = 864e5;
  return {
    session: null, users: [],
    posts: [
      { id: "welcome", title: "歡迎來到 Edward 的 Blog", summary: "這裡會用白話整理投資理財、退休傳承和社會保險的觀念。這是一篇示範文章，登入後台就能修改或刪除。", cover: "", category: "生活財商", tags: ["公告"], visibility: "public", status: "published", pinned: true, order: 0, createdAt: now - 3 * day, updatedAt: now - day, publishedAt: now - 3 * day,
        body: "## 為什麼要寫這個 Blog？\n\n錢的事情，常常不是不懂，是**沒人用白話講**。\n\n這裡會分三區：\n\n1. **防禦區**：保險、現金流，先把底盤穩住\n2. **系統區**：指數化投資、資產配置，讓錢自己長大\n3. **攻擊區**：進階策略，給想再往前一步的人\n\n> 有問題，歡迎預約諮詢。" },
      { id: "labor-insurance-101", title: "勞保年金到底領不領得到？三個數字先看懂", summary: "勞保會不會倒？其實先看懂投保薪資、年資、請領年齡這三個數字，就知道自己大概能領多少。（示範文章）", cover: "", category: "社會保險", tags: ["勞保", "退休"], visibility: "public", status: "published", pinned: false, order: 1, createdAt: now - 2 * day, updatedAt: now - 2 * day, publishedAt: now - 2 * day,
        body: "## 先講結論\n\n勞保年金看三件事：**平均投保薪資 × 年資 × 1.55%**。\n\n（示範內容，數字以勞保局最新公告為準）" },
      { id: "members-only-demo", title: "【會員限定】一張表檢查你家的保單有沒有漏洞", summary: "會員專屬的保單健檢表。登入會員就能看到全文。（示範文章）", cover: "", category: "保險規劃", tags: ["保單健檢", "會員限定"], visibility: "members", status: "published", pinned: false, order: 2, createdAt: now - day, updatedAt: now - day, publishedAt: now - day,
        body: "## 保單健檢三步驟\n\n1. 列出全家所有保單\n2. 對照「死亡、失能、醫療、長照」四格\n3. 空格就是漏洞\n\n（示範內容）" },
    ],
    templates: [
      { id: "tpl-blog", name: "標準長文（Hook→翻轉金句→三點拆解→行動呼籲）", category: "投資理財", tags: [], visibility: "public", updatedAt: now,
        body: "（情境開場：用一個讀者會遇到的場景或問題開頭？）\n\n**一句翻轉觀念的話！**\n\n## 一、\n\n白話比喻：\n\n## 二、\n\n白話比喻：\n\n## 三、\n\n白話比喻：\n\n## 結論\n\n（點出風險或急迫性）\n\n---\n\n### Edward 提供 2 種服務\n\n- **「醫生式」財務諮詢**：全方位健檢\n- **「藥局式」單點諮詢**：精準對策\n" },
      { id: "tpl-social-insurance", name: "社會保險系列（白話＋數字＋提醒）", category: "社會保險", tags: ["社會保險"], visibility: "public", updatedAt: now - 1,
        body: "## 先講結論\n\n## 你可能遇到的情況\n\n## 三個數字先看懂\n\n| 項目 | 數字 | 白話解釋 |\n|---|---|---|\n|  |  |  |\n\n## 常見誤會\n\n## 你現在可以做的一件事\n\n> 數字以主管機關最新公告為準。\n" },
    ],
  };
}

// ------------------------------------------------------------------
// 正式模式（Firebase）
// ------------------------------------------------------------------
async function firebaseStore() {
  const V = "10.12.2";
  const appM = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const authM = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const fs = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const app = appM.initializeApp(CFG.firebase);
  const auth = authM.getAuth(app);
  const db = fs.getFirestore(app);
  let user = null;
  const listeners = new Set();
  let ready;
  const readyP = new Promise(r => (ready = r));

  async function toUser(u) {
    if (!u) return null;
    let isAdmin = false;
    try { const r = await fs.getDoc(fs.doc(db, "roles", u.uid)); isAdmin = !!(r.exists() && r.data().admin); } catch (e) { }
    return { uid: u.uid, email: u.email, name: u.displayName || (u.email || "").split("@")[0], isAdmin };
  }
  authM.onAuthStateChanged(auth, async u => { user = await toUser(u); ready(); listeners.forEach(fn => fn(user)); });

  const err = e => {
    const m = { "auth/invalid-credential": "Email 或密碼不對", "auth/wrong-password": "Email 或密碼不對", "auth/user-not-found": "Email 或密碼不對", "auth/email-already-in-use": "這個 Email 已經註冊過了", "auth/weak-password": "密碼至少 6 個字", "auth/invalid-email": "Email 格式不對", "auth/too-many-requests": "嘗試太多次，請稍後再試", "permission-denied": "沒有權限" };
    return new Error(m[e.code] || e.message);
  };

  return {
    onAuth(fn) { listeners.add(fn); readyP.then(() => fn(user)); return () => listeners.delete(fn); },
    current: () => user,
    async signUp(email, password, name) {
      try {
        const c = await authM.createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name) await authM.updateProfile(c.user, { displayName: name });
        await fs.setDoc(fs.doc(db, "members", c.user.uid), { email: c.user.email, name: name || "", joinedAt: Date.now() });
        user = await toUser(c.user); listeners.forEach(fn => fn(user)); return user;
      } catch (e) { throw err(e); }
    },
    async signIn(email, password) {
      try { const c = await authM.signInWithEmailAndPassword(auth, email.trim(), password); user = await toUser(c.user); return user; } catch (e) { throw err(e); }
    },
    async signOut() { await authM.signOut(auth); },
    async resetPassword(email) { try { await authM.sendPasswordResetEmail(auth, email.trim()); } catch (e) { throw err(e); } },
    async listPosts({ all = false } = {}) {
      await readyP;
      const col = fs.collection(db, "posts");
      const q = all && user?.isAdmin ? col : fs.query(col, fs.where("status", "==", "published"));
      const snap = await fs.getDocs(q), now = Date.now();
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return sortPosts(all && user?.isAdmin ? list : list.filter(p => isLive(p, now)));
    },
    async getPost(id) {
      await readyP;
      let meta;
      try { const m = await fs.getDoc(fs.doc(db, "posts", id)); if (!m.exists()) return null; meta = { id, ...m.data() }; } catch (e) { return null; }
      if (!isLive(meta) && !user?.isAdmin) return null;
      try { const b = await fs.getDoc(fs.doc(db, "bodies", id)); return { ...meta, body: b.exists() ? b.data().body : "", locked: false }; }
      catch (e) { return { ...meta, body: null, locked: true }; }
    },
    async searchText() { return ""; }, // 正式模式只搜標題、摘要、分類、標籤（省流量）
    async savePost(post) {
      try {
        const batch = fs.writeBatch(db);
        batch.set(fs.doc(db, "posts", post.id), pick(post, META_KEYS));
        batch.set(fs.doc(db, "bodies", post.id), { body: post.body || "", visibility: post.visibility, status: post.status, publishedAt: post.publishedAt || 0 });
        await batch.commit(); return post;
      } catch (e) { throw err(e); }
    },
    async deletePost(id) { const b = fs.writeBatch(db); b.delete(fs.doc(db, "posts", id)); b.delete(fs.doc(db, "bodies", id)); await b.commit(); },
    async reorder(ids) { const b = fs.writeBatch(db); ids.forEach((id, i) => b.update(fs.doc(db, "posts", id), { order: i })); await b.commit(); },
    async listTemplates() { const s = await fs.getDocs(fs.collection(db, "templates")); return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.updatedAt - a.updatedAt); },
    async saveTemplate(t) { const { id, ...rest } = t; await fs.setDoc(fs.doc(db, "templates", id), rest); return t; },
    async deleteTemplate(id) { await fs.deleteDoc(fs.doc(db, "templates", id)); },
    async exists(id) { try { return (await fs.getDoc(fs.doc(db, "posts", id))).exists(); } catch (e) { return false; } },
    async listMembers() { const s = await fs.getDocs(fs.collection(db, "members")); return s.docs.map(d => ({ uid: d.id, role: "member", ...d.data() })); },
    async resetDemo() { },
  };
}

export const store = MODE === "firebase" ? await firebaseStore() : demoStore();
