"""
Fotografa cada slide (1920x1080) com o Edge headless e monta folhas de contato em previa/folha_NN.png.
Uso: <venv>\\Scripts\\python.exe ferramentas/fotos_slides.py [id ...]
É uma APROXIMAÇÃO do runtime do Slides (ícones viram círculos; animações de entrada não aparecem).
"""
import json
import pathlib
import subprocess
import sys

sys.argv, args = sys.argv[:1], sys.argv[1:]
import previa  # noqa: E402  (reaproveita converter, links e deck)
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
OUT = previa.OUT / "fotos"
OUT.mkdir(parents=True, exist_ok=True)
ids = args or previa.deck["order"]
css = """<style>body{margin:0;background:#000}*{box-sizing:border-box;margin:0}
.s{width:1920px;height:1080px;position:absolute;left:0;top:0;overflow:hidden}
.s > :not(iframe):not([style*="position:absolute"]){position:relative}
h1,h2,h3{font-weight:600} ul{padding-left:1.2em} table{border-collapse:collapse}
td,th{padding:.35em .6em;border:1px solid rgba(128,128,128,.4)}</style>"""
fotos = []
for sid in ids:
    sec = previa.converter((previa.SLIDES / f"{sid}.html").read_text(encoding="utf-8"))
    sec = sec.replace("../codigo-img/", "../../codigo-img/")
    f = OUT / f"{sid}.html"
    f.write_text(f"<!doctype html><html><head><meta charset='utf-8'>{previa.links}{css}</head><body>{sec}</body></html>", encoding="utf-8")
    png = OUT / f"{sid}.png"
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1920,1080",
                    "--timeout=5000", f"--screenshot={png}", f.as_uri()], capture_output=True, timeout=60)
    fotos.append((sid, png))
    print(sid, png.exists())

fonte = ImageFont.truetype(r"C:\Windows\Fonts\seguisb.ttf", 22)
por = 6
for n in range(0, len(fotos), por):
    folha = Image.new("RGB", (2 * 960 + 30, 3 * (540 + 34) + 10), "#222")
    d = ImageDraw.Draw(folha)
    for k, (sid, png) in enumerate(fotos[n:n + por]):
        x, y = 10 + (k % 2) * 970, 10 + (k // 2) * 574
        if png.exists():
            folha.paste(Image.open(png).convert("RGB").resize((960, 540)), (x, y + 30))
        d.text((x, y), f"{previa.deck['order'].index(sid) + 1} · {sid}", font=fonte, fill="#ddd")
    folha.save(previa.OUT / f"folha_{n // por + 1:02d}.png")
print("folhas:", (len(fotos) + por - 1) // por)
