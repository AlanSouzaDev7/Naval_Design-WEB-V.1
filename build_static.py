"""
Gera a versão ESTÁTICA do site em ./docs para publicar no GitHub Pages.

O site não tem lógica de servidor (o template não usa Jinja), então o Flask só
entrega arquivos. Para hospedar em qualquer lugar basta copiar esses arquivos,
ajustando os caminhos de "../static/..." (que só funcionam servidos pelo Flask)
para caminhos relativos comuns ("static/...").

Uso:
    python build_static.py

Rode de novo sempre que editar templates/ ou static/, e faça commit da pasta docs/.
"""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DOCS = ROOT / "docs"


def main() -> None:
    html = (ROOT / "templates" / "index.html").read_text(encoding="utf-8")
    if "../static/" not in html:
        raise SystemExit("Nenhuma referência '../static/' encontrada no template — nada a converter.")
    html = html.replace("../static/", "static/")

    if DOCS.exists():
        shutil.rmtree(DOCS)
    DOCS.mkdir()

    (DOCS / "index.html").write_text(html, encoding="utf-8", newline="\n")
    shutil.copytree(ROOT / "static", DOCS / "static")
    (DOCS / ".nojekyll").write_text("", encoding="utf-8")   # desliga o processamento Jekyll do Pages

    # Domínio personalizado (criado por enable_custom_domain.py, com checagem de DNS)
    cname = ROOT / "CNAME"
    if cname.exists():
        shutil.copy(cname, DOCS / "CNAME")

    total = sum(p.stat().st_size for p in DOCS.rglob("*") if p.is_file())
    print(f"docs/ gerado: {sum(1 for p in DOCS.rglob('*') if p.is_file())} arquivos, {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
