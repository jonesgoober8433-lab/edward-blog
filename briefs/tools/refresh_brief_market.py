"""防呆：把今天（台灣時間）早報的 market 換成 latest.json 的最新收盤。
GitHub 免費排程常延遲或跳過，雲端早報 09:00 可能讀到舊數字；
早報一推上來就會觸發收盤工作流程，抓完新數字後由這支程式補進今天的早報。"""
import json, os, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
tw = datetime.datetime.utcnow() + datetime.timedelta(hours=8)
day = tw.strftime("%Y-%m-%d")
p = os.path.join(ROOT, "briefs", "data", f"{day}.json")
L = json.load(open(os.path.join(ROOT, "briefs", "market", "latest.json"), encoding="utf8"))
if not os.path.exists(p):
    print("今天的早報還沒產生，略過", day); raise SystemExit
d = json.load(open(p, encoding="utf8"))
def key(x): return (x.get("name"), x.get("date"), x.get("close"))
items = [x for x in L.get("items", []) if x.get("close") is not None]
if not items:
    print("latest.json 沒有資料，略過"); raise SystemExit
twd = next((x["date"] for x in items if x["name"] == "台股加權"), "")
usd = next((x["date"] for x in items if x["name"] == "S&P 500"), "")
new = [dict(x, asOf=f"台股 {twd}、美股 {usd}") for x in items]
if [key(x) for x in d.get("market", [])] == [key(x) for x in new]:
    print("今天早報的收盤數字已是最新"); raise SystemExit
d["market"] = new
json.dump(d, open(p, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print("已更新今天早報的收盤數字：台股", twd, "美股", usd)
