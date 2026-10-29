"""
Monta apresentacao/previa/index.html: todos os slides do deck numa página só, em escala, para conferência visual local.
<x-embed> vira <iframe srcdoc>, /_blob/<id> vira a imagem local de codigo-img/, <x-icon> vira um marcador.
Uso: python ferramentas/previa.py [id1 id2 ...]   (sem ids = todos; ?escala na URL não é necessário)
"""
import html
import json
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SLIDES = RAIZ / "project" / "slides"
OUT = RAIZ / "previa"
deck = json.loads((RAIZ / "project" / "deck.json").read_text(encoding="utf-8"))
urls = {}
u = RAIZ / "codigo-img" / "urls.json"
if u.exists():
    urls = {v: k for k, v in json.loads(u.read_text(encoding="utf-8")).items()}

ids = sys.argv[1:] or deck["order"]
links = "".join(f'<link rel="stylesheet" href="{f["href"]}">' for f in deck["faces"].values() if "href" in f)


def converter(sec):
    def emb(m):
        estilo, corpo = m.group(1), m.group(2)
        doc = "<!doctype html><html><head><meta charset='utf-8'></head><body>" + corpo + "</body></html>"
        return f'<iframe style="{estilo};border:0" srcdoc="{html.escape(doc, quote=True)}"></iframe>'
    sec = re.sub(r'<x-embed style="([^"]*)">(.*?)</x-embed>', emb, sec, flags=re.S)
    sec = re.sub(r'/_blob/([0-9a-f]{32})', lambda m: f"../codigo-img/{urls.get(m.group(0), m.group(1))}.png", sec)
    sec = re.sub(r'<x-icon name="([^"]*)" style="([^"]*)"></x-icon>',
                 r'<span style="\2;display:inline-block;border:2px solid currentColor;border-radius:50%;flex:none"></span>', sec)
    sec = re.sub(r"<aside>.*?</aside>", "", sec, flags=re.S)
    sec = sec.replace("<section ", '<section class="s" ', 1)
    return sec


partes = []
for i, sid in enumerate(ids):
    sec = converter((SLIDES / f"{sid}.html").read_text(encoding="utf-8"))
    partes.append(f'<div class="w" id="w-{sid}"><div class="t">{deck["order"].index(sid) + 1} · {sid}</div><div class="f">{sec}</div></div>')

OUT.mkdir(exist_ok=True)
(OUT / "index.html").write_text(f"""<!doctype html><html><head><meta charset="utf-8">{links}
<style>
body{{margin:0;background:#222;font-family:sans-serif}}
*{{box-sizing:border-box;margin:0}}
.w{{width:960px;margin:16px auto}} .t{{color:#ccc;font:14px monospace;padding:4px}}
.f{{width:960px;height:540px;overflow:hidden;position:relative;outline:1px solid #555}}
.s{{width:1920px;height:1080px;position:absolute;left:0;top:0;transform:scale(0.5);transform-origin:0 0;overflow:hidden}}
.s > :not(iframe):not([style*="position:absolute"]){{position:relative}}
h1,h2,h3{{font-weight:600}} ul{{padding-left:1.2em}} table{{border-collapse:collapse}} td,th{{padding:.35em .6em;border:1px solid rgba(128,128,128,.4)}}
</style></head><body>{''.join(partes)}</body></html>""", encoding="utf-8")
print("previa:", OUT / "index.html", len(ids), "slides")
