# 每日財經早報（給客戶看）— 雲端排程規則

> 這份是雲端排程每天 06:30（台灣時間）要照做的完整規則。要改早報的做法，就改這份。
> 讀者是 Edward 的客戶和潛在客戶，包括上班族、小資族和高資產家庭。這份早報會**公開**在網站上。

## 絕對不可以
1. 不寫任何客戶資訊，包括姓名、保單、金額、對話內容，以及任何能認出是誰的線索。
2. 不寫 Edward 的工作內容、行程、業績、公司內部資料，也不推銷任何商品。
3. 只寫**事實與時事**，不給買賣建議（不能寫「建議買進／賣出」「可以布局」），也不把預測寫成事實。
4. 不照抄新聞原文：一律用自己的話重寫。真的需要引用，一則最多引用一句，而且不超過 15 個字。
5. 不使用新聞網站的照片。圖片由網站自動產生，你只要提供數字和分類。
6. 只改 `briefs/` 底下的檔案，其他檔案一律不碰。

## 步驟

### 0. 準備
- 執行 `git pull --ff-only origin main`。
- 今天日期以**台灣時間**為準：`TZ=Asia/Taipei date +%F`，以下稱 DATE。
- 如果 `briefs/data/DATE.json` 已經存在，代表今天跑過了，直接結束。

### 1. 讀 Edward 的方向建議
執行：
`curl -s "https://firestore.googleapis.com/v1/projects/edward-blog-a6317/databases/(default)/documents/settings/brief"`

取出 `fields.direction.stringValue`。有內容就照著調整選題方向；讀不到就當作沒有建議。

### 2. 抓收盤數字
執行 `python3 briefs/tools/market.py`，把輸出放進 `market`。
- 每一筆加上 `asOf`，格式是「台股 MM/DD、美股 MM/DD」，日期取各自的 `date`。
- 有 `error` 的那一筆照原樣保留，網站會顯示「—」。

### 3. 找新聞，寫 6～8 則候選
用 WebSearch 找**過去 24 小時**的重要財經時事。優先順序：
1. 台股、美股大盤的大波動和原因
2. 央行和利率（聯準會、台灣央行）
3. 匯率
4. 重要經濟數據（CPI、就業、GDP）
5. 和台灣關係大的產業，例如半導體、AI
6. 政策和法規，例如稅、勞保健保、退休制度
7. 國際大事

**零容忍查證**（違反一條就刪掉那一則）：
- 從搜尋結果的「標題」或「網址」確認發布日期在 24 小時內。不能只看 WebSearch 自動產生的摘要，摘要常常會把日期弄錯。
- 每個數字至少要有 **2 個不同網站**互相印證，才可以寫進去。
- 查不到日期、兩個來源的數字對不上，就不寫這一則。寧可少寫，也不要寫錯。

**每一則的寫法**（白話，國中生也看得懂）：
- `title`：15～28 字，講清楚發生什麼。
- `facts`：2～3 句，只寫事實，要有數字或日期。
- `why`：用**第一性原理**說明為什麼重要，2～3 句。從最基本的因果推起：錢從哪裡流到哪裡、誰的成本或收入會變、這件事會怎麼影響一般人的房貸、薪水、物價、存款或投資。不寫空話。
- `category`：從這些選一個：台股、美股、總經、利率、匯率、產業、政策、國際、原物料、加密貨幣。
- `number`：這則最關鍵的一個數字，例如 `{"value":"-2.49%","label":"那斯達克單日"}`。沒有就填 `null`。
- `sources`：至少 2 個，格式 `{"name":"網站名","url":"…","date":"MM/DD"}`。
- `pros`：放這則的好處，一句話。例如「跟讀者的房貸直接相關」。
- `cons`：放這則的壞處，一句話。例如「太專業」「跟昨天重複」「還在發展中，數字可能改」「有政治爭議」。
- `score`：重要度 1～5。
- `recommend`：最值得放的 3～4 則填 `true`，其他填 `false`。

### 4. 今日一句話和財經小知識
- `headline`：一句話講今天最重要的事，不超過 40 字。
- `knowledge`：挑一個跟今天新聞有關的財經名詞，格式 `{"term":"…","explain":"白話 2～3 句","example":"生活化的例子"}`。
  - 先看 `briefs/index.json` 最近 30 天用過哪些名詞，不要重複。

### 5. 寫檔
`briefs/data/DATE.json` 的格式如下，`id` 用 c1、c2…：
```json
{
  "date": "DATE",
  "generatedAt": "ISO 時間",
  "headline": "...",
  "market": [ ... ],
  "candidates": [ { "id": "c1", "title": "...", "facts": "...", "why": "...", "category": "...", "number": {...}, "sources": [...], "pros": "...", "cons": "...", "score": 4, "recommend": true } ],
  "picks": ["c1", "c3", "c4"],
  "knowledge": { "term": "...", "explain": "...", "example": "..." }
}
```
- `picks` 就是 `recommend` 為 `true` 的那幾則的 id。
- `briefs/index.json` 的格式是 `{"dates":[...]}`：把 DATE 加進去，排好序。
- 用最近 30 天的 `knowledge.term` 維護 `"terms"` 清單。

### 6. 只保留一年
- 刪除 `briefs/data/` 裡日期早於「今天往前 365 天」的檔案，`index.json` 也要一起移除這些日期。

### 7. 驗證、上傳
- 執行 `python3 -c "import json;json.load(open('briefs/data/DATE.json'));json.load(open('briefs/index.json'))"`，確認 JSON 格式正確。
- 只 `git add` 這次動到的 `briefs/` 檔案，不能用 `git add -A`。
- commit 訊息：`早報 DATE`。
- 執行 `git push`。如果被拒，先 `git pull --rebase` 再推一次。

### 遇到問題
- 找不到任何通過查證的新聞：仍然寫檔，`candidates` 給空陣列，`headline` 寫「今日市場數字整理」。網站會只顯示行情和小知識。
- 不要用任何連接器，例如 Gmail、Notion。這份工作只需要網路搜尋和這個 repo。
