"""抓 6 檔收盤（Yahoo Finance 公開圖表資料），輸出 JSON 給早報用。用法：python3 briefs/tools/market.py"""
import json, urllib.request, urllib.parse, datetime
SYMS = [("台股加權", "^TWII"), ("S&P 500", "^GSPC"), ("那斯達克", "^IXIC"), ("道瓊", "^DJI"), ("費城半導體", "^SOX"), ("美元/台幣", "TWD=X")]
out = []
for name, s in SYMS:
    try:
        u = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(s)}?range=5d&interval=1d"
        j = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=20))
        r = j["chart"]["result"][0]; q = r["indicators"]["quote"][0]["close"]; ts = r["timestamp"]
        pts = [(t, c) for t, c in zip(ts, q) if c is not None]
        (t1, c1), (t0, c0) = pts[-1], pts[-2]
        tz = datetime.timezone(datetime.timedelta(seconds=r["meta"].get("gmtoffset", 0)))
        out.append({"name": name, "close": round(c1, 2), "chg": round(c1 - c0, 2), "pct": round((c1 - c0) / c0 * 100, 2),
                    "date": datetime.datetime.fromtimestamp(t1, tz).strftime("%m/%d")})
    except Exception as e:
        out.append({"name": name, "close": None, "chg": None, "pct": None, "error": str(e)[:80]})
print(json.dumps(out, ensure_ascii=False, indent=1))
