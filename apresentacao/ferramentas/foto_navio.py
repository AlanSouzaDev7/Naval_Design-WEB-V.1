"""
Tira fotos (PNG 1920x1080) do navio 3D da capa em vários ângulos, com o Edge headless, para conferência.
Uso: python ferramentas/foto_navio.py   -> previa/navio_<angulo>.png
"""
import json
import pathlib
import re
import subprocess

RAIZ = pathlib.Path(__file__).resolve().parent.parent
OUT = RAIZ / "previa"
OUT.mkdir(exist_ok=True)
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
js = (RAIZ / "ferramentas" / "engines" / "ship.js").read_text(encoding="utf-8")
base = dict(fx=0.68, fy=0.64, F=1500, D=17, a0=0.7, spd=0.0, dim=0, sx=0.84)
for nome, a0 in [("a00", 0.0), ("a07", 0.7), ("a16", 1.6), ("a26", 2.6), ("a35", 3.5), ("a47", 4.7)]:
    cfg = dict(base, a0=a0)
    page = ("<!doctype html><html><head><meta charset='utf-8'><style>html,body{margin:0;overflow:hidden;background:#000}"
            "canvas{display:block}</style></head><body><canvas id='c'></canvas><script>"
            + js.replace("__DATA__", json.dumps(cfg)) + "</script></body></html>")
    f = OUT / f"navio_{nome}.html"
    f.write_text(page, encoding="utf-8")
    png = OUT / f"navio_{nome}.png"
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1920,1080",
                    "--virtual-time-budget=1500", f"--screenshot={png}", f.as_uri()], capture_output=True, timeout=60)
    print(nome, png.exists())
