"""抓收盤數字給網站用（由 GitHub Actions 每天 06:00 台灣時間執行，雲端早報排程的網路連不到 Yahoo）。
輸出：
  briefs/market/latest.json  6 檔最新收盤與漲跌（早報用）
  briefs/market/twii.json    台股加權：近一年每日收盤＋長期每月收盤（首頁 3M／6M／1Y／MAX 用）
用法：python3 briefs/tools/market.py          （只印出來）
      python3 briefs/tools/market.py --write  （寫檔）
"""
import json, sys, os, datetime, urllib.request, urllib.parse
SYMS = [("台股加權", "^TWII"), ("S&P 500", "^GSPC"), ("那斯達克", "^IXIC"), ("道瓊", "^DJI"), ("費城半導體", "^SOX"), ("美元/台幣", "TWD=X")]
UA = {"User-Agent": "Mozilla/5.0"}

def chart(sym, rng, interval):
    u = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range={rng}&interval={interval}"
    j = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30))
    r = j["chart"]["result"][0]
    tz = datetime.timezone(datetime.timedelta(seconds=r["meta"].get("gmtoffset", 0)))
    q = r["indicators"]["quote"][0]
    return [(datetime.datetime.fromtimestamp(t, tz), c, o, h, lo) for t, c, o, h, lo in zip(r["timestamp"], q["close"], q["open"], q["high"], q["low"]) if c is not None]

def twse_taiex():
    """台股加權指數：證交所官方「每日開高低收」（MI_5MINS_HIST），回傳最近兩個交易日 (日期, 開, 高, 低, 收)"""
    rows = []
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    for d in (today.replace(day=1) - datetime.timedelta(days=1), today):
        u = f"https://www.twse.com.tw/rwd/zh/TAIEX/MI_5MINS_HIST?date={d.strftime('%Y%m%d')}&response=json"
        j = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30))
        if j.get("stat") != "OK": continue
        for r in j["data"]:
            y, m, dd = map(int, r[0].split("/"))
            rows.append((datetime.date(y + 1911, m, dd), *[float(x.replace(",", "")) for x in r[1:5]]))
    rows.sort()
    return rows[-2:]

def roc(d):  # 日期格式（Edward 2026-11-18 指定西元）：2026.11.17
    return f"{d.year}.{d.month:02d}.{d.day:02d}"

latest = []
try:
    (d0, o0, h0, l0, c0), (d1, o1, h1, l1, c1) = twse_taiex()
    latest.append({"name": "台股加權", "open": round(o1, 2), "openChg": round(o1 - c0, 2), "high": round(h1, 2), "low": round(l1, 2),
                   "close": round(c1, 2), "prevClose": round(c0, 2), "chg": round(c1 - c0, 2), "pct": round((c1 - c0) / c0 * 100, 2),
                   "date": d1.strftime("%m/%d"), "roc": roc(d1), "src": "證交所"})
except Exception as e:
    latest.append(None)   # 證交所抓不到就用 Yahoo 備援
for name, s in SYMS:
    if name == "台股加權" and latest and latest[0]: continue
    try:
        pts = chart(s, "5d", "1d"); (d1, c1, o1, h1, l1), (_, c0, *_r) = pts[-1], pts[-2]
        item = {"name": name, "open": round(o1, 2) if o1 else None, "openChg": round(o1 - c0, 2) if o1 else None, "high": round(h1, 2) if h1 else None, "low": round(l1, 2) if l1 else None,
                "close": round(c1, 2), "prevClose": round(c0, 2), "chg": round(c1 - c0, 2), "pct": round((c1 - c0) / c0 * 100, 2),
                "date": d1.strftime("%m/%d"), "roc": roc(d1.date())}
        if name == "台股加權": latest[0] = item
        else: latest.append(item)
    except Exception as e:
        item = {"name": name, "close": None, "chg": None, "pct": None, "error": str(e)[:80]}
        if name == "台股加權": latest[0] = item
        else: latest.append(item)
tw = {}
try:
    tw["daily"] = [[d.strftime("%Y-%m-%d"), round(c, 2)] for d, c, *_ in chart("^TWII", "1y", "1d")]
    tw["monthly"] = [[d.strftime("%Y-%m"), round(c, 2)] for d, c, *_ in chart("^TWII", "max", "1mo")]
except Exception as e:
    tw["error"] = str(e)[:80]
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(timespec="minutes")
if "--write" in sys.argv:
    os.makedirs("briefs/market", exist_ok=True)
    json.dump({"updatedAt": now, "items": latest}, open("briefs/market/latest.json", "w"), ensure_ascii=False, indent=1)
    if "daily" in tw: json.dump({"updatedAt": now, **tw}, open("briefs/market/twii.json", "w"), ensure_ascii=False)
    print("written", len(latest), "items;", len(tw.get("daily", [])), "daily;", len(tw.get("monthly", [])), "monthly")
else:
    print(json.dumps(latest, ensure_ascii=False, indent=1))
