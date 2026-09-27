r"""
Prepara o banco PostgreSQL para a consulta de navios do site (v3.0).

O que faz (nada aqui apaga ou altera os dados existentes):
  1. executa 01_busca.sql   -> extensoes, funcoes de busca, indices e a VIEW v_navios
  2. executa 02_papel_leitura.sql -> papel 'navios_leitura' com privilegios minimos
  3. define a senha desse papel (gerada ao acaso) e a grava no arquivo de segredos (ver config_env.py;
     por padrao %LOCALAPPDATA%\RoyalNavy\consulta.env, fora do Git e fora do OneDrive)
  4. VERIFICA de dentro do papel que ele so consegue LER a view
  5. opcional: --fechar-rede  => listen_addresses = 'localhost' (vale apos reiniciar o servico)

Uso (na pasta do projeto):
    python db/aplicar.py
    python db/aplicar.py --rotacionar-senha      # gera uma senha nova para o papel de leitura
    python db/aplicar.py --fechar-rede           # PostgreSQL passa a escutar so em localhost

A senha do administrador NUNCA e gravada: e pedida no terminal (getpass) ou lida da variavel de
ambiente PGPASSWORD apenas durante a execucao.
"""

import argparse
import getpass
import os
import re
import secrets
import sys
from pathlib import Path

import psycopg
from psycopg import sql

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
sys.path.insert(0, str(RAIZ))
import config_env  # noqa: E402

ENV_ARQ = config_env.caminho_padrao()      # fora do projeto e da nuvem, por padrao
ENV_LEGADO = RAIZ / ".env"                # local antigo (dentro do projeto): e removido se existir

PAPEL = "navios_leitura"


def admin_conn():
    host = os.environ.get("PGHOST", "localhost")
    port = int(os.environ.get("PGPORT", "5432"))
    dbname = os.environ.get("PGDATABASE", "postgres")
    user = os.environ.get("PGUSER", "postgres")
    senha = os.environ.get("PGPASSWORD") or getpass.getpass(f"Senha do administrador ({user}@{host}): ")
    conn = psycopg.connect(host=host, port=port, dbname=dbname, user=user, password=senha,
                           connect_timeout=5, autocommit=True)
    return conn, dict(host=host, port=port, dbname=dbname)


def ler_env():
    dados = {}
    fonte = ENV_ARQ if ENV_ARQ.exists() else ENV_LEGADO
    if fonte.exists():
        for linha in fonte.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$", linha)
            if m and not linha.lstrip().startswith("#"):
                dados[m.group(1)] = m.group(2)
    return dados


def senha_funciona(alvo, senha):
    try:
        with psycopg.connect(host=alvo["host"], port=alvo["port"], dbname=alvo["dbname"], user=PAPEL,
                             password=senha, connect_timeout=5):
            return True
    except psycopg.Error:
        return False


def gravar_env(alvo, senha):
    """Cria/atualiza o arquivo de segredos (fora do Git) mantendo as demais linhas."""
    novos = {
        "DB_HOST": alvo["host"], "DB_PORT": str(alvo["port"]), "DB_NAME": alvo["dbname"],
        "DB_USER": PAPEL, "DB_PASSWORD": senha, "DB_SSLMODE": "prefer",
    }
    fonte = ENV_ARQ if ENV_ARQ.exists() else ENV_LEGADO          # migra o conteudo do arquivo antigo, se houver
    linhas = fonte.read_text(encoding="utf-8").splitlines() if fonte.exists() else [
        "# Configuracao LOCAL do site (NAO vai para o Git). Gerado por db/aplicar.py.",
        "# Modelo sem segredos: .env.example",
    ]
    vistos = set()
    saida = []
    for linha in linhas:
        m = re.match(r"^\s*([A-Z_][A-Z0-9_]*)\s*=", linha)
        if m and m.group(1) in novos:
            saida.append(f"{m.group(1)}={novos[m.group(1)]}")
            vistos.add(m.group(1))
        else:
            saida.append(linha)
    for k, v in novos.items():
        if k not in vistos:
            saida.append(f"{k}={v}")
    ENV_ARQ.parent.mkdir(parents=True, exist_ok=True)
    ENV_ARQ.write_text("\n".join(saida) + "\n", encoding="utf-8")
    print(f"Segredos gravados em {ENV_ARQ} - {config_env.proteger(ENV_ARQ)}.")
    if ENV_LEGADO.exists():
        ENV_LEGADO.unlink()
        print(f"Removido o arquivo antigo {ENV_LEGADO} (ficava dentro da pasta sincronizada do projeto).")


def verificar(alvo, senha, total_esperado):
    """Confere, de dentro do papel de leitura, que ele le a view e NAO faz mais nada."""
    falhas = 0

    def ok(cond, texto):
        nonlocal falhas
        print(("  [OK]    " if cond else "  [FALHA] ") + texto)
        falhas += 0 if cond else 1

    with psycopg.connect(host=alvo["host"], port=alvo["port"], dbname=alvo["dbname"], user=PAPEL,
                         password=senha, connect_timeout=5, autocommit=True) as c:
        n = c.execute("SELECT count(*) FROM public.v_navios").fetchone()[0]
        ok(n == total_esperado, f"le a view v_navios ({n} navios)")
        ok(c.execute("SHOW default_transaction_read_only").fetchone()[0] == "on", "sessao nasce somente-leitura")
        ok(c.execute("SHOW statement_timeout").fetchone()[0] == "3s", "statement_timeout = 3s")

        for rotulo, comando in [
            ("NAO le a tabela original", "SELECT * FROM public.navios_historicos LIMIT 1"),
            ("NAO consegue INSERT", "INSERT INTO public.navios_historicos (nome, marinha, tipo, guerra) VALUES ('x','Brasil','x','Ambas')"),
            ("NAO consegue UPDATE", "UPDATE public.navios_historicos SET nome = 'x'"),
            ("NAO consegue DELETE", "DELETE FROM public.navios_historicos"),
            ("NAO consegue criar tabela", "CREATE TABLE public.invasor (x int)"),
            ("NAO consegue DROP da view", "DROP VIEW public.v_navios"),
            ("NAO consegue ler arquivos do servidor", "SELECT pg_read_file('postgresql.conf')"),
            ("NAO consegue virar superusuario", "ALTER ROLE navios_leitura SUPERUSER"),
        ]:
            try:
                c.execute(comando)
                ok(False, rotulo)
            except psycopg.Error:
                ok(True, rotulo)
    return falhas


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rotacionar-senha", action="store_true", help="gera senha nova para o papel de leitura")
    ap.add_argument("--fechar-rede", action="store_true", help="listen_addresses = 'localhost' (vale apos reiniciar)")
    args = ap.parse_args()

    conn, alvo = admin_conn()
    with conn:
        total = conn.execute("SELECT count(*) FROM public.navios_historicos").fetchone()[0]
        print(f"Conectado a {alvo['host']}:{alvo['port']}/{alvo['dbname']} ({total} navios na tabela).")

        for arq in ("01_busca.sql", "02_papel_leitura.sql"):
            print(f"Executando {arq} ...")
            conn.execute((AQUI / arq).read_text(encoding="utf-8"))

        atual = ler_env().get("DB_PASSWORD", "")
        if not args.rotacionar_senha and atual and senha_funciona(alvo, atual):
            senha = atual
            print(f"Senha do papel {PAPEL}: mantida (a do arquivo de segredos continua valida).")
        else:
            senha = secrets.token_urlsafe(32)
            conn.execute(sql.SQL("ALTER ROLE {} PASSWORD {}").format(sql.Identifier(PAPEL), sql.Literal(senha)))
            print(f"Senha do papel {PAPEL}: nova.")
        gravar_env(alvo, senha)

        if args.fechar_rede:
            conn.execute("ALTER SYSTEM SET listen_addresses = 'localhost'")
            conn.execute("SELECT pg_reload_conf()")
            em_uso = conn.execute("SELECT setting FROM pg_settings WHERE name = 'listen_addresses'").fetchone()[0]
            print("listen_addresses = 'localhost' gravado no servidor (postgresql.auto.conf)."
                  + (f" Em uso agora: '{em_uso}' - REINICIE o servico PostgreSQL para valer." if em_uso != "localhost" else ""))

    print("Verificando o papel de leitura por dentro:")
    falhas = verificar(alvo, senha, total)
    if falhas:
        print(f"\n{falhas} verificacao(oes) FALHARAM - nao use o site com este banco ate corrigir.")
        sys.exit(1)
    print("\nTudo certo: o site le o banco somente pela view, com um papel sem poder de escrita.")


if __name__ == "__main__":
    main()
