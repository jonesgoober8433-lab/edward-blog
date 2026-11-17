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
    return [(datetime.datetime.fromtimestamp(t, tz), c) for t, c in zip(r["timestamp"], r["indicators"]["quote"][0]["close"]) if c is not None]

latest = []
for name, s in SYMS:
    try:
        pts = chart(s, "5d", "1d"); (d1, c1), (_, c0) = pts[-1], pts[-2]
        latest.append({"name": name, "close": round(c1, 2), "chg": round(c1 - c0, 2), "pct": round((c1 - c0) / c0 * 100, 2), "date": d1.strftime("%m/%d")})
    except Exception as e:
        latest.append({"name": name, "close": None, "chg": None, "pct": None, "error": str(e)[:80]})
tw = {}
try:
    tw["daily"] = [[d.strftime("%Y-%m-%d"), round(c, 2)] for d, c in chart("^TWII", "1y", "1d")]
    tw["monthly"] = [[d.strftime("%Y-%m"), round(c, 2)] for d, c in chart("^TWII", "max", "1mo")]
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
