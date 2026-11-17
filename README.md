# Edward 的 Blog（第一版）

跟「阿泰爾工具箱」一樣，是放在 GitHub Pages 的靜態網站；登入、會員、文章資料庫交給免費的 Firebase。

```
訪客 ──看文章/搜尋──▶ GitHub Pages（網頁本身，免費）
                         │
你/會員 ──登入──▶ Firebase Authentication（帳號密碼）
                         │
            Firestore 資料庫（文章、模板、會員）＋ 安全規則把關
```

## 頁面

| 頁面 | 給誰 | 功能 |
| :-- | :-- | :-- |
| `index.html` | 所有人 | 文章列表、搜尋、分類篩選、置頂大卡片 |
| `post.html?id=…` | 所有人 | 文章內容、發布日／最後更新日、會員限定文章鎖住 |
| `login.html` | 會員、管理員 | 登入、註冊、忘記密碼 |
| `member.html` | 會員 | 會員專區、會員限定文章清單 |
| `admin.html` | 只有你 | 寫文章（Markdown＋即時預覽）、草稿/發布、置頂、拖曳排序、模板 |

## 兩種模式

- **示範模式**（`config.js` 的 `firebase: null`）：資料只存在你這台電腦的瀏覽器，給你先試用。第一個註冊的帳號自動是管理員。
- **正式模式**：填入 Firebase 設定後，文章存雲端，大家都看得到。

## 換成正式模式（約 15 分鐘，要你自己在 Firebase 網站點）

1. 到 https://console.firebase.google.com 建一個新專案（建議另開，不要用 Discord 機器人那個）。Google Analytics 可以關掉。
2. 左邊「Authentication」→ 開始使用 →「登入方式」啟用「電子郵件/密碼」。
   再到「設定 → 授權網域」加上 `jonesgoober8433-lab.github.io`。
3. 左邊「Firestore Database」→ 建立資料庫（位置選 `asia-east1` 台灣）→ 正式版模式。
   到「規則」分頁，把本資料夾 `firestore.rules` 整份貼上 → 發布。
4. 讓自己變管理員：在 Firebase「Authentication → 使用者 → 新增使用者」用你的 Email 建帳號（密碼你自己設，不要給任何人）；複製這個帳號的「使用者 UID」；
   到 Firestore 新增集合 `roles`，文件 ID 貼上 UID，欄位 `admin`（布林值）= `true`。
5. 「專案設定 → 一般 → 你的應用程式」新增「網頁應用程式」，複製 `firebaseConfig` 的 apiKey、authDomain、projectId、appId，貼進 `config.js`。

> Firebase 網頁設定那串本來就是公開的，放 GitHub 沒關係；真正擋人的是第 3 步的安全規則。
> 免費額度（Spark 方案）：每天 5 萬次讀取、2 萬次寫入，個人 Blog 很夠用。

## 會員功能開關

`config.js` 的 `membersEnabled`：`false`＝隱藏「會員專區」與註冊（目前設定），`true`＝開放。

## 改外觀

- 顏色：`assets/style.css` 最上面 `:root`
- 網站名稱、分類、預約連結：`config.js`
