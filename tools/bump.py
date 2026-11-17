"""更新網站後跑一次：幫 CSS／JS 加上新的版本號，讀者瀏覽器就不會一直用舊檔（GitHub Pages 會快取約 10 分鐘）。
用法：python3 tools/bump.py
"""
import re, time, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
v = time.strftime("%Y%m%d%H%M%S")
n = 0
for f in list(root.glob("*.html")) + list((root / "assets").glob("*.js")):
    s = f.read_text(encoding="utf-8"); o = s
    # HTML 裡的 style.css、config.js、./assets/xxx.js；JS 裡的 from "./xxx.js"
    s = re.sub(r'((?:assets/style\.css|config\.js|\./assets/[\w-]+\.js|"\./[\w-]+\.js))(\?v=\d+)?', lambda m: m.group(1) + "?v=" + v, s)
    s = re.sub(r'(from "\./[\w-]+\.js)(\?v=\d+)?"', lambda m: m.group(1) + "?v=" + v + '"', s)
    if s != o: f.write_text(s, encoding="utf-8"); n += 1
print(f"版本號 {v}，更新 {n} 個檔案")
