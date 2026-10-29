# -*- coding: utf-8 -*-
r"""
Baixa a foto de cada navio da Consulta (a imagem principal do artigo na Wikipedia em inglês, só com licença livre)
e grava em static/img/navios/ duas larguras em WebP (1200 e 600 px), com autor e licença em static/data/fotos-navios.json.

A chave é o nome do navio exatamente como está no banco (coluna nome); o casco entra quando o nome se repete.
A página da Consulta procura a foto por nome e, sem foto, mostra a ficha como antes.

Uso (Python do .venv, que tem Pillow):
    .venv\Scripts\python.exe ferramentas\fotos_navios.py            # baixa só o que falta
    .venv\Scripts\python.exe ferramentas\fotos_navios.py --refazer  # baixa tudo de novo
"""

import html
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
PASTA = RAIZ / "static" / "img" / "navios"
INDICE = RAIZ / "static" / "data" / "fotos-navios.json"
UA = "RoyalNavyDigital/4.7 (site educativo; github.com/AlanSouzaDev7/Naval_Design-WEB-V.1)"
LARGURAS = (1200, 600)                             # gravadas a partir da miniatura padrão de 1280 px

# Sem foto de propósito: as imagens livres achadas no Commons são de outro navio com o mesmo nome (o Mariz e Barros D26,
# ex-USS Brinkley Bass); a ficha aparece sem foto em vez de mostrar o navio errado.
SEM_FOTO = {"Mariz e Barros"}

# nome no banco -> artigo da Wikipedia em inglês (a foto é a imagem principal do artigo) ou, quando essa imagem não tem
# licença livre, o arquivo do Commons escolhido à mão ("File:...")
ARTIGOS = {
    "USS Texas": "USS Texas (BB-35)",
    "USS Arizona": "USS Arizona",
    "USS Missouri": "USS Missouri (BB-63)",
    "USS Iowa": "USS Iowa (BB-61)",
    "USS North Carolina": "USS North Carolina (BB-55)",
    "USS Alabama": "USS Alabama (BB-60)",
    "USS Massachusetts": "USS Massachusetts (BB-59)",
    "USS Wisconsin": "File:USS Wisconsin (BB-64) at anchor on 30 May 1944 (80-G-453313).jpg",
    "USS Enterprise": "USS Enterprise (CV-6)",
    "USS Yorktown": "USS Yorktown (CV-5)",
    "USS Hornet": "USS Hornet (CV-8)",
    "USS Lexington": "USS Lexington (CV-2)",
    "USS Indianapolis": "USS Indianapolis (CA-35)",
    "USS Nevada": "USS Nevada (BB-36)",
    "USS Juneau": "USS Juneau (CL-52)",
    "HMS Dreadnought": "HMS Dreadnought (1906)",
    "HMS Iron Duke": "HMS Iron Duke (1912)",
    "HMS Hood": "HMS Hood",
    "HMS Prince of Wales": "HMS Prince of Wales (53)",
    "HMS Repulse": "HMS Repulse (1916)",
    "HMS Warspite": "HMS Warspite (03)",
    "HMS Queen Elizabeth": "HMS Queen Elizabeth (1913)",
    "HMS Nelson": "HMS Nelson (28)",
    "HMS Rodney": "HMS Rodney (29)",
    "HMS King George V": "HMS King George V (41)",
    "HMS Ark Royal": "HMS Ark Royal (91)",
    "HMS Illustrious": "HMS Illustrious (87)",
    "HMS Victorious": "HMS Victorious (R38)",
    "HMS Belfast": "HMS Belfast",
    "HMS Invincible": "HMS Invincible (1907)",
    "HMS Edinburgh": "HMS Edinburgh (16)",
    "HMS Exeter": "HMS Exeter (68)",
    "SMS Von der Tann": "SMS Von der Tann",
    "SMS Seydlitz": "File:German battlecruiser SMS Seydlitz in port c1913.jpg",
    "SMS Emden": "SMS Emden (1908)",
    "SMS Blücher": "SMS Blücher",
    "Bismarck": "German battleship Bismarck",
    "Tirpitz": "German battleship Tirpitz",
    "Scharnhorst": "German battleship Scharnhorst",
    "Gneisenau": "German battleship Gneisenau",
    "Admiral Graf Spee": "German cruiser Admiral Graf Spee",
    "Prinz Eugen": "German cruiser Prinz Eugen",
    "Kongō": "Japanese battleship Kongō",
    "Yamato": "Japanese battleship Yamato",
    "Musashi": "Japanese battleship Musashi",
    "Akagi": "Japanese aircraft carrier Akagi",
    "Kaga": "Japanese aircraft carrier Kaga",
    "Shōkaku": "Japanese aircraft carrier Shōkaku",
    "Nagato": "Japanese battleship Nagato",
    "IJN Fusō": "Japanese battleship Fusō",
    "Giulio Cesare": "Italian battleship Giulio Cesare",
    "Vittorio Veneto": "File:Vittorio Veneto (battleship).jpg",
    "Roma": "Italian battleship Roma (1940)",
    "Andrea Doria": "Italian battleship Andrea Doria",
    "Minas Geraes": "Brazilian battleship Minas Geraes",
    "São Paulo": "Brazilian battleship São Paulo",
    "Bahia": "Brazilian cruiser Bahia",
    "Mariz e Barros": "Brazilian destroyer Mariz e Barros (D28)",
    "Courbet": "French battleship Courbet (1911)",
    "France": "File:Cuirassé France en 1914.jpg",
    "Bretagne": "File:Bretagne October 1916 Q58294.jpg",
    "Dunkerque": "French battleship Dunkerque",
    "Strasbourg": "French battleship Strasbourg",
    "Richelieu": "French battleship Richelieu",
    "Jean Bart": "French battleship Jean Bart (1940)",
    "Surcouf": "French submarine Surcouf",
    "Aurora": "Russian cruiser Aurora",
    "Sevastopol / Parizhskaya Kommuna": "Russian battleship Sevastopol (1911)",
    "Marat (ex-Petropavlovsk)": "Russian battleship Petropavlovsk (1911)",
    "Kirov": "Soviet cruiser Kirov",
}


def abrir(url, timeout):
    """GET educado: respeita o limite da Wikimedia (HTTP 429) esperando o Retry-After antes de tentar de novo."""
    for tentativa in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or tentativa == 5:
                raise
            time.sleep(min(90, int(exc.headers.get("Retry-After") or 0) or 10 * (tentativa + 1)))


def get_json(url, params):
    q = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    return json.loads(abrir(url + "?" + q, 30))


def baixar(url):
    return abrir(url, 60)


def texto_limpo(valor):
    """extmetadata vem em HTML: tira as tags e normaliza espaços."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", valor or ""))).strip()


def credito(autor, licenca):
    """Crédito curto em português: tira rótulos e retoques do campo Artist e traduz "Public domain"."""
    a = re.sub(r"(?i)\b(photographer|author|fotógrafo)\s*:\s*", "", autor or "")
    a = re.split(r"(?i)\s*\b(retouched|restored|edited|cropped)\b", a)[0].strip(" .;,-")
    if not a or re.fullmatch(r"(?i)(unknown|desconhecido|anonymous|unknown author|unknown photographer)", a):
        a = "autor desconhecido"
    lic = "domínio público" if re.match(r"(?i)(public domain|pd\b)", licenca or "") else (licenca or "")
    return a[:90], lic


def slug(nome):
    import unicodedata
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def foto_do_artigo(titulo):
    if titulo.startswith("File:"):
        return dados_do_arquivo(titulo, titulo[5:].rsplit(".", 1)[0]), titulo
    d = get_json("https://en.wikipedia.org/w/api.php", {
        "action": "query", "titles": titulo, "redirects": 1, "prop": "pageimages",
        "piprop": "name", "pilicense": "free"})
    pag = d["query"]["pages"][0]
    if pag.get("missing") or not pag.get("pageimage"):
        return None, pag.get("title", titulo)
    return dados_do_arquivo("File:" + pag["pageimage"], pag["title"]), pag["title"]


def dados_do_arquivo(arquivo, artigo):
    info = get_json("https://commons.wikimedia.org/w/api.php", {
        "action": "query", "titles": arquivo, "prop": "imageinfo",
        "iiprop": "url|extmetadata|size", "iiurlwidth": 1280})          # 1280: tamanho de miniatura padrão da Wikimedia (outros são limitados)
    ii = info["query"]["pages"][0].get("imageinfo")
    if not ii:                                     # arquivo hospedado só na Wikipedia (sem licença livre no Commons)
        return None
    ii, meta = ii[0], ii[0].get("extmetadata", {})
    return {
        "artigo": artigo,
        "arquivo": arquivo,
        "url": ii.get("thumburl") or ii["url"],
        "pagina": ii["descriptionurl"],
        "autor": texto_limpo(meta.get("Artist", {}).get("value")) or "autor desconhecido",
        "licenca": texto_limpo(meta.get("LicenseShortName", {}).get("value")),
        "licenca_url": (meta.get("LicenseUrl", {}).get("value") or ""),
    }


def grava(indice):
    for v in indice.values():
        v["autor"], v["licenca"] = credito(v.get("autor_original") or v["autor"], v.get("licenca_original") or v["licenca"])
    INDICE.write_text(json.dumps(dict(sorted(indice.items())), ensure_ascii=False, indent=1) + "\n", "utf-8")


def main():
    refazer = "--refazer" in sys.argv
    PASTA.mkdir(parents=True, exist_ok=True)
    indice = json.loads(INDICE.read_text("utf-8")) if INDICE.exists() and not refazer else {}
    faltou = []
    for nome, titulo in ARTIGOS.items():
        if nome in SEM_FOTO:
            indice.pop(nome, None)
            continue
        base = slug(nome)
        grande, pequena = PASTA / f"{base}-{LARGURAS[0]}.webp", PASTA / f"{base}-{LARGURAS[1]}.webp"
        if nome in indice and grande.exists() and not refazer:
            continue
        try:
            dados, artigo = foto_do_artigo(titulo)
            if not dados:
                faltou.append(f"{nome}: sem imagem livre em '{artigo}'")
                continue
            if grande.exists() and pequena.exists() and not refazer:    # já baixada numa execução anterior: só os dados
                with Image.open(grande) as im:
                    largura, altura = im.size
            else:
                img = Image.open(io.BytesIO(baixar(dados["url"]))).convert("RGB")
                for w, destino in zip(LARGURAS, (grande, pequena)):
                    im = img if img.width <= w else img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)
                    im.save(destino, "WEBP", quality=74, method=6)
                largura, altura = min(img.width, LARGURAS[0]), round(img.height * min(1, LARGURAS[0] / img.width))
                time.sleep(4)
        except Exception as exc:                   # rede ou limite: tenta de novo na próxima execução
            faltou.append(f"{nome}: {exc}")
            continue
        indice[nome] = {
            "arquivo": grande.name, "arquivo_pequeno": pequena.name, "largura": largura, "altura": altura,
            "autor": dados["autor"][:160], "licenca": dados["licenca"], "licenca_url": dados["licenca_url"],
            "autor_original": dados["autor"][:160], "licenca_original": dados["licenca"],
            "fonte": dados["pagina"], "artigo": dados["artigo"],
        }
        grava(indice)                              # a cada navio: uma interrupção não perde o que já veio
        print(f"ok  {nome}  ({dados['licenca']})", flush=True)
    grava(indice)
    print(f"\n{len(indice)} fotos no índice")
    if faltou:
        print("Sem foto:\n  " + "\n  ".join(faltou))


if __name__ == "__main__":
    main()
