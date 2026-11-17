// ============================================================
// Edward 的 Blog：網站設定（只要改這個檔）
// ------------------------------------------------------------
// firebase 留空（null）＝「示範模式」：資料只存在你這台電腦的瀏覽器，
//   適合先試用、看畫面。別人看不到你寫的文章。
// 填入 Firebase 設定＝「正式模式」：文章存在雲端，登入是真的帳號密碼，
//   會員專區由 Firebase 安全規則保護。設定步驟見 README.md。
// 注意：Firebase 網頁設定（apiKey 那串）本來就是公開的，可以放進 GitHub；
//   真正的保護靠 firestore.rules，不靠藏這串字。
// ============================================================
window.BLOG_CONFIG = {
  siteName: "Edward 的 Blog",
  // 預設配色（後台「網站配色」按鈕切換後，以後台設定為準）：navy 海軍藍＋金／burgundy 酒紅＋象牙金／slate 石板灰＋湖水綠／coffee 咖啡棕＋米色
  palette: "coffee",
  tagline: "投資理財・退休傳承・社會保險，用白話把錢的事講清楚",
  author: "Edward",
  authorTitle: "保經事業部負責人｜RFC・CFC",
  // 預約諮詢按鈕要連到哪裡（LINE、Google 表單等），留空就不顯示
  bookingUrl: "https://docs.google.com/forms/d/e/1FAIpQLSehdMad5-KkAoZYLd29rQkWDhNoBJK2A7HniB-DaaABEtqLjg/viewform",
  bookingNote: "免費 15-20 分鐘財務現況評估",
  // 每日財經早報：這天（含）以前是「草稿」，要你在後台按發布才上線；之後每天 08:00 自動上線
  briefDraftUntil: "2026-11-22",
  briefPublishTime: "08:00",
  // 會員功能開關：false＝先隱藏「會員專區」與註冊（Edward 2026-11-17：之後再想怎麼用）
  membersEnabled: false,
  categories: ["投資理財", "保險規劃", "退休傳承", "社會保險", "時事觀點", "讀書心得", "新手入門", "生活財商"],

  firebase: {
    apiKey: "AIzaSyBlJfQlwau4m4kWpMzPiNYG2KYwQyGsUVU",
    authDomain: "edward-blog-a6317.firebaseapp.com",
    projectId: "edward-blog-a6317",
    appId: "1:256094084216:web:272e1c2a340f85398d218d",
  },
  // 正式模式範例（到 Firebase 主控台 → 專案設定 → 你的應用程式 複製）：
  // firebase: {
  //   apiKey: "....",
  //   authDomain: "xxx.firebaseapp.com",
  //   projectId: "xxx",
  //   appId: "...."
  // },
};

// 套用配色（網址加 ?palette=forest 可以臨時預覽別套）
(() => {
  let p = window.BLOG_CONFIG.palette || "navy";
  try { p = localStorage.getItem("eb-site-palette") || p; } catch (e) { }   // 後台切換過的配色（先用快取，避免閃一下）
  try { p = new URLSearchParams(location.search).get("palette") || p; } catch (e) { }
  document.documentElement.dataset.palette = p;
  // 黑暗／日光模式：只影響這個網站，瀏覽器會記住（預設日光）
  let t = "light"; try { t = localStorage.getItem("eb-theme") || "light"; } catch (e) { }
  document.documentElement.dataset.theme = t;
})();
