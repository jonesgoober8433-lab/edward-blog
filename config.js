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
  tagline: "投資理財・退休傳承・社會保險，用白話把錢的事講清楚",
  author: "Edward",
  authorTitle: "保經事業部負責人｜RFC・CFC",
  // 預約諮詢按鈕要連到哪裡（LINE、Google 表單等），留空就不顯示
  bookingUrl: "https://docs.google.com/forms/d/e/1FAIpQLSehdMad5-KkAoZYLd29rQkWDhNoBJK2A7HniB-DaaABEtqLjg/viewform",
  bookingNote: "免費 15-20 分鐘財務現況評估",
  // 會員功能開關：false＝先隱藏「會員專區」與註冊（Edward 2026-11-17：之後再想怎麼用）
  membersEnabled: false,
  categories: ["投資理財", "退休傳承", "社會保險", "保險規劃", "生活財商"],

  firebase: null,
  // 正式模式範例（到 Firebase 主控台 → 專案設定 → 你的應用程式 複製）：
  // firebase: {
  //   apiKey: "....",
  //   authDomain: "xxx.firebaseapp.com",
  //   projectId: "xxx",
  //   appId: "...."
  // },
};
