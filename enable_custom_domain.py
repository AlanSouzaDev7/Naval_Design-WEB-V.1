"""
Ativa (ou remove) um domínio personalizado no site publicado pelo GitHub Pages.

    python enable_custom_domain.py royalnavy.com.br          # ativa
    python enable_custom_domain.py --remove                   # volta para o endereço github.io

POR QUE EXISTE UMA TRAVA DE SEGURANÇA
Publicar o arquivo CNAME quando o domínio ainda não aponta para o GitHub faz o
endereço github.io redirecionar para um domínio que não abre (o site "cai") e,
se o domínio ainda não for seu, entrega o tráfego a quem o registrar primeiro.
Por isso o script só grava o CNAME depois de conferir que o DNS do domínio já
aponta para os servidores do GitHub Pages. Use --force apenas se souber o motivo.
"""

import argparse
import socket
import sys
from pathlib import Path

import build_static

ROOT = Path(__file__).resolve().parent
CNAME = ROOT / "CNAME"

# Endereços IPv4 oficiais do GitHub Pages (https://api.github.com/meta -> "pages")
GITHUB_PAGES_IPV4 = {"185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"}


def normalize(domain: str) -> str:
    d = domain.strip().lower()
    for prefix in ("https://", "http://"):
        if d.startswith(prefix):
            d = d[len(prefix):]
    return d.strip("/").split("/")[0]


def resolve_ipv4(host: str) -> set:
    try:
        return {info[4][0] for info in socket.getaddrinfo(host, 443, socket.AF_INET)}
    except socket.gaierror:
        return set()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("domain", nargs="?", help="ex.: royalnavy.com.br")
    ap.add_argument("--remove", action="store_true", help="remove o domínio personalizado")
    ap.add_argument("--force", action="store_true", help="ignora a checagem de DNS (não recomendado)")
    args = ap.parse_args()

    if args.remove:
        CNAME.unlink(missing_ok=True)
        build_static.main()
        print("Domínio personalizado removido. Faça commit e push; no GitHub, apague o domínio em Settings > Pages.")
        return 0

    if not args.domain:
        ap.error("informe o domínio (ex.: royalnavy.com.br) ou use --remove")

    domain = normalize(args.domain)
    ips = resolve_ipv4(domain)

    if not args.force:
        if not ips:
            print(f"[BLOQUEADO] {domain} ainda não resolve no DNS.\n"
                  "  Registre o domínio e crie os registros DNS (veja o README) antes de ativar.\n"
                  "  Sem isso, o site do github.io passaria a redirecionar para um endereço que não abre.")
            return 1
        if not ips & GITHUB_PAGES_IPV4:
            print(f"[BLOQUEADO] {domain} resolve para {sorted(ips)}, que NÃO são servidores do GitHub Pages.\n"
                  f"  Esperado: {sorted(GITHUB_PAGES_IPV4)}. Corrija os registros A no seu provedor de DNS.")
            return 1

    CNAME.write_text(domain + "\n", encoding="utf-8", newline="\n")
    build_static.main()
    print(f"Domínio '{domain}' gravado em CNAME e em docs/CNAME.\n"
          "Próximos passos: git add -A && git commit && git push; depois, em Settings > Pages,\n"
          "confirme o domínio e marque 'Enforce HTTPS' quando o certificado ficar disponível.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
