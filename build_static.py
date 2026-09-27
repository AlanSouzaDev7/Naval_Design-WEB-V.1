"""
Gera a versão ESTÁTICA do site em ./docs para publicar no GitHub Pages.

A página inicial não tem lógica de servidor (o template não usa Jinja), então o Flask só
entrega arquivos. Para hospedar em qualquer lugar basta copiar esses arquivos,
ajustando os caminhos de "../static/..." (que só funcionam servidos pelo Flask)
para caminhos relativos comuns ("static/...").

A página de CONSULTA (consulta.html) precisa da API (Flask + PostgreSQL), que o GitHub Pages
não executa. Por isso, na versão estática ela avisa que a consulta só existe com o servidor.
Se um dia a API for publicada em outro endereço, informe a origem dela ao gerar o site:

    RN_API_ORIGIN=https://api.seudominio.com python build_static.py

(somente https; a origem entra no meta rn-api-base e na diretiva connect-src da CSP; no servidor
 da API, autorize o site em CORS_ORIGINS).

Uso:
    python build_static.py

Rode de novo sempre que editar templates/ ou static/, e faça commit da pasta docs/.
"""

import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DOCS = ROOT / "docs"

CSP_CONNECT = "connect-src 'self'"


def origem_api():
    origem = os.environ.get("RN_API_ORIGIN", "").strip().rstrip("/")
    if not origem:
        return ""
    if not re.fullmatch(r"https://[a-z0-9.-]+(:\d{1,5})?", origem):
        raise SystemExit("RN_API_ORIGIN invalida: use somente https://host[:porta] (minusculas, sem caminho).")
    return origem


def main() -> None:
    api = origem_api()

    index = (ROOT / "templates" / "index.html").read_text(encoding="utf-8")
    consulta = (ROOT / "templates" / "consulta.html").read_text(encoding="utf-8")
    for nome, html in (("index.html", index), ("consulta.html", consulta)):
        if "../static/" not in html:
            raise SystemExit(f"Nenhuma referência '../static/' encontrada em {nome} — nada a converter.")

    # caminhos: ../static/ -> static/ ; a rota /consulta vira o arquivo consulta.html
    index = index.replace("../static/", "static/").replace('href="consulta"', 'href="consulta.html"')
    consulta = consulta.replace("../static/", "static/").replace('href="consulta"', 'href="consulta.html"')

    # modo da página de consulta: sem servidor (padrão) ou apontando para uma API publicada
    if api:
        consulta = consulta.replace('<meta name="rn-api-base" content="" />', f'<meta name="rn-api-base" content="{api}" />')
        consulta = consulta.replace(CSP_CONNECT, f"{CSP_CONNECT} {api}", 1)
    else:
        consulta = consulta.replace('<meta name="rn-mode" content="server" />', '<meta name="rn-mode" content="static" />')

    if DOCS.exists():
        shutil.rmtree(DOCS)
    DOCS.mkdir()

    (DOCS / "index.html").write_text(index, encoding="utf-8", newline="\n")
    (DOCS / "consulta.html").write_text(consulta, encoding="utf-8", newline="\n")
    shutil.copytree(ROOT / "static", DOCS / "static")
    (DOCS / ".nojekyll").write_text("", encoding="utf-8")   # desliga o processamento Jekyll do Pages

    # Domínio personalizado (criado por enable_custom_domain.py, com checagem de DNS)
    cname = ROOT / "CNAME"
    if cname.exists():
        shutil.copy(cname, DOCS / "CNAME")

    total = sum(p.stat().st_size for p in DOCS.rglob("*") if p.is_file())
    modo = f"consulta -> API {api}" if api else "consulta em modo estático (sem API)"
    print(f"docs/ gerado: {sum(1 for p in DOCS.rglob('*') if p.is_file())} arquivos, {total / 1024:.0f} KB; {modo}")


if __name__ == "__main__":
    main()
