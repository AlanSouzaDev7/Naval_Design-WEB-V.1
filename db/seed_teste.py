r"""
Semeia um banco DESCARTAVEL de teste com a tabela public.navios_historicos (17 colunas) e dados SINTETICOS.

Serve para rodar a suite de testes (tests/) sem o banco real. Os nomes e as designacoes de casco sao de navios
historicos, mas datas, comandantes, armamento e observacoes sao PLACEHOLDERS de teste - nao sao fonte historica.

Seguranca:
  * so executa em localhost/127.0.0.1/::1 (recusa qualquer outro host);
  * so cria a tabela se ela nao existir e so insere se ela estiver VAZIA (nunca apaga nem altera dados);
  * a senha do administrador vem de PGPASSWORD ou do terminal e nunca e gravada.

Uso (com um PostgreSQL descartavel, ex.: Docker; ver db/teste_local.md):
    set PGHOST=127.0.0.1& set PGPORT=55432& set PGPASSWORD=...   (PowerShell: $env:PGHOST=...)
    python db/seed_teste.py
    python db/aplicar.py          # extensoes, view v_navios e papel navios_leitura
"""

import getpass
import os
import sys

import psycopg

LOCAIS = {"localhost", "127.0.0.1", "::1"}

DDL = """
CREATE TABLE IF NOT EXISTS public.navios_historicos (
  id                   serial PRIMARY KEY,
  nome                 varchar(120) NOT NULL,
  designacao_casco     varchar(40),
  marinha              varchar(60)  NOT NULL,
  tipo                 varchar(60)  NOT NULL,
  classe               varchar(80),
  guerra               varchar(40)  NOT NULL,
  data_batismo         date,
  data_comissionamento date,
  data_baixa           date,
  primeiro_comandante  varchar(120),
  ultimo_comandante    varchar(120),
  batalhas             text,
  armamento            text,
  estado_atual         varchar(120),
  fonte_observacoes    text,
  criado_em            timestamptz NOT NULL DEFAULT now()
)
"""

G1, G2, AMB = "1ª Guerra Mundial", "2ª Guerra Mundial", "Ambas"
EUA, RU, ALE, JAP, BRA = "Estados Unidos", "Reino Unido", "Alemanha", "Japão", "Brasil"
BB, CV, CA, DD, SS = "Encouraçado", "Porta-aviões", "Cruzador", "Destróier", "Submarino"

# (nome, casco, marinha, tipo, classe, guerra, ano de lancamento, estado atual)
NAVIOS = [
    # Estados Unidos
    ("USS Arizona", "BB-39", EUA, BB, "Pennsylvania", G2, 1915, "Naufrágio (memorial em Pearl Harbor)"),
    ("USS Missouri", "BB-63", EUA, BB, "Iowa", G2, 1944, "Navio-museu"),
    ("USS Enterprise", "CV-6", EUA, CV, "Yorktown", G2, 1936, "Desmontado"),
    ("USS Yorktown", "CV-5", EUA, CV, "Yorktown", G2, 1936, "Naufrágio"),
    ("USS Lexington", "CV-2", EUA, CV, "Lexington", G2, 1925, "Naufrágio"),
    ("USS Nevada", "BB-36", EUA, BB, "Nevada", G2, 1914, "Afundado como alvo"),
    ("USS Oklahoma", "BB-37", EUA, BB, "Nevada", G2, 1914, "Naufrágio"),
    ("USS West Virginia", "BB-48", EUA, BB, "Colorado", G2, 1921, "Desmontado"),
    ("USS Indianapolis", "CA-35", EUA, CA, "Portland", G2, 1931, "Naufrágio"),
    ("USS Johnston", "DD-557", EUA, DD, "Fletcher", G2, 1943, "Naufrágio"),
    ("USS Laffey", "DD-724", EUA, DD, "Allen M. Sumner", G2, 1943, "Navio-museu"),
    ("USS Nautilus", "SS-168", EUA, SS, "Narwhal", G2, 1930, "Desmontado"),
    ("USS Gato", "SS-212", EUA, SS, "Gato", G2, 1941, "Desmontado"),
    ("USS Wahoo", "SS-238", EUA, SS, "Gato", G2, 1942, "Naufrágio"),
    ("USS Houston", "CA-30", EUA, CA, "Northampton", G2, 1929, "Naufrágio"),
    ("USS Juneau", "CL-52", EUA, CA, "Atlanta", G2, 1941, "Naufrágio"),
    ("USS Hornet", "CV-8", EUA, CV, "Yorktown", G2, 1940, "Naufrágio"),
    ("USS Wasp", "CV-7", EUA, CV, "Wasp", G2, 1939, "Naufrágio"),
    ("USS Saratoga", "CV-3", EUA, CV, "Lexington", G2, 1925, "Afundado como alvo"),
    ("USS Texas", "BB-35", EUA, BB, "New York", AMB, 1912, "Navio-museu"),
    # Reino Unido
    ("HMS Hood", "51", RU, BB, "Admiral", G2, 1918, "Naufrágio"),
    ("HMS Prince of Wales", "53", RU, BB, "King George V", G2, 1939, "Naufrágio"),
    ("HMS Warspite", "03", RU, BB, "Queen Elizabeth", AMB, 1913, "Encalhado e desmontado"),
    ("HMS Ark Royal", "91", RU, CV, "Ark Royal", G2, 1937, "Naufrágio"),
    ("HMS Belfast", "C35", RU, CA, "Town", G2, 1938, "Navio-museu"),
    ("HMS Dreadnought", "N/A", RU, BB, "Dreadnought", G1, 1906, "Desmontado"),
    ("HMS Invincible", "N/A", RU, CA, "Invincible", G1, 1907, "Naufrágio"),
    ("HMS Queen Mary", "N/A", RU, CA, "Lion", G1, 1912, "Naufrágio"),
    ("HMS Lion", "N/A", RU, CA, "Lion", G1, 1910, "Desmontado"),
    ("HMS Barham", "04", RU, BB, "Queen Elizabeth", AMB, 1914, "Naufrágio"),
    ("HMS Royal Oak", "08", RU, BB, "Revenge", AMB, 1914, "Naufrágio"),
    ("HMS Rodney", "29", RU, BB, "Nelson", G2, 1925, "Desmontado"),
    ("HMS Nelson", "28", RU, BB, "Nelson", G2, 1925, "Desmontado"),
    ("HMS Sheffield", "C24", RU, CA, "Town", G2, 1936, "Afundado como alvo"),
    ("HMS Exeter", "68", RU, CA, "York", G2, 1929, "Naufrágio"),
    ("HMS Ajax", "22", RU, CA, "Leander", G2, 1934, "Desmontado"),
    ("HMS Achilles", "70", RU, CA, "Leander", G2, 1932, "Vendido à Índia"),
    ("HMS Glorious", "77", RU, CV, "Courageous", G2, 1916, "Naufrágio"),
    ("HMS Courageous", "50", RU, CV, "Courageous", G2, 1916, "Naufrágio"),
    ("HMS Furious", "47", RU, CV, "Furious", AMB, 1916, "Desmontado"),
    # Alemanha
    ("Bismarck", "N/A", ALE, BB, "Bismarck", G2, 1939, "Naufrágio"),
    ("Tirpitz", "N/A", ALE, BB, "Bismarck", G2, 1939, "Desmontado"),
    ("Scharnhorst", "N/A", ALE, BB, "Scharnhorst", G2, 1936, "Naufrágio"),
    ("Gneisenau", "N/A", ALE, BB, "Scharnhorst", G2, 1936, "Desmontado"),
    ("Admiral Graf Spee", "N/A", ALE, CA, "Deutschland", G2, 1934, "Afundado pela tripulação"),
    ("Admiral Hipper", "N/A", ALE, CA, "Admiral Hipper", G2, 1937, "Desmontado"),
    ("Blücher", "N/A", ALE, CA, "Admiral Hipper", G2, 1937, "Naufrágio"),
    ("Prinz Eugen", "N/A", ALE, CA, "Admiral Hipper", G2, 1938, "Naufrágio (Kwajalein)"),
    ("SMS Seydlitz", "N/A", ALE, CA, "Seydlitz", G1, 1912, "Afundado em Scapa Flow"),
    ("SMS Emden", "N/A", ALE, CA, "Emden", G1, 1908, "Encalhado"),
    ("SMS Dresden", "N/A", ALE, CA, "Dresden", G1, 1907, "Naufrágio"),
    ("U-47", "N/A", ALE, SS, "Tipo VII", G2, 1938, "Desaparecido"),
    ("U-96", "N/A", ALE, SS, "Tipo VII", G2, 1940, "Afundado"),
    ("SMS Bayern", "N/A", ALE, BB, "Bayern", G1, 1915, "Afundado em Scapa Flow"),
    ("SMS Derfflinger", "N/A", ALE, CA, "Derfflinger", G1, 1913, "Afundado em Scapa Flow"),
    ("SMS Von der Tann", "N/A", ALE, CA, "Von der Tann", G1, 1910, "Afundado em Scapa Flow"),
    ("Schleswig-Holstein", "N/A", ALE, BB, "Deutschland", AMB, 1906, "Naufrágio"),
    ("Schlesien", "N/A", ALE, BB, "Deutschland", AMB, 1906, "Naufrágio"),
    ("Graf Zeppelin", "N/A", ALE, CV, "Graf Zeppelin", G2, 1938, "Naufrágio"),
    ("SMS Goeben", "N/A", ALE, CA, "Moltke", G1, 1911, "Desmontado"),
    # Japao
    ("Yamato", "N/A", JAP, BB, "Yamato", G2, 1939, "Naufrágio"),
    ("Musashi", "N/A", JAP, BB, "Yamato", G2, 1940, "Naufrágio"),
    ("Akagi", "N/A", JAP, CV, "Akagi", G2, 1925, "Naufrágio"),
    ("Kaga", "N/A", JAP, CV, "Kaga", G2, 1921, "Naufrágio"),
    ("Sōryū", "N/A", JAP, CV, "Sōryū", G2, 1935, "Naufrágio"),
    ("Hiryū", "N/A", JAP, CV, "Hiryū", G2, 1937, "Naufrágio"),
    ("Shōkaku", "N/A", JAP, CV, "Shōkaku", G2, 1939, "Naufrágio"),
    ("Zuikaku", "N/A", JAP, CV, "Shōkaku", G2, 1939, "Naufrágio"),
    ("Kongō", "N/A", JAP, BB, "Kongō", AMB, 1912, "Naufrágio"),
    ("Fusō", "N/A", JAP, BB, "Fusō", AMB, 1914, "Naufrágio"),
    ("Nagato", "N/A", JAP, BB, "Nagato", G2, 1919, "Afundado em teste nuclear"),
    ("Mutsu", "N/A", JAP, BB, "Nagato", G2, 1920, "Naufrágio"),
    ("Haruna", "N/A", JAP, BB, "Kongō", AMB, 1913, "Desmontado"),
    ("Kirishima", "N/A", JAP, BB, "Kongō", AMB, 1913, "Naufrágio"),
    ("Taihō", "N/A", JAP, CV, "Taihō", G2, 1943, "Naufrágio"),
    ("Shinano", "N/A", JAP, CV, "Yamato", G2, 1944, "Naufrágio"),
    ("Mikasa", "N/A", JAP, BB, "Shikishima", G1, 1900, "Navio-museu"),
    ("Yukikaze", "N/A", JAP, DD, "Kagerō", G2, 1939, "Desmontado"),
    # Brasil
    ("Minas Geraes", "N/A", BRA, BB, "Minas Geraes", G1, 1908, "Desmontado"),
    ("São Paulo", "N/A", BRA, BB, "Minas Geraes", G1, 1909, "Naufrágio"),
    ("Bahia", "N/A", BRA, CA, "Bahia", G2, 1909, "Naufrágio"),
    ("Humaitá", "S14", BRA, SS, "Humaitá", G2, 1927, "Desmontado"),
    ("Vital de Oliveira", "F44", BRA, CA, "Vital de Oliveira", G2, 1943, "Desmontado"),
    ("Minas Gerais", "A11", BRA, CV, "Colossus", G2, 1944, "Desmontado"),
]

NOTA = "DADO SINTETICO DE TESTE (db/seed_teste.py): nao e fonte historica."


def conectar():
    host = os.environ.get("PGHOST", "localhost")
    if host not in LOCAIS:
        sys.exit(f"Recusado: seed_teste.py so roda em localhost (PGHOST={host}).")
    user = os.environ.get("PGUSER", "postgres")
    senha = os.environ.get("PGPASSWORD") or getpass.getpass(f"Senha do administrador ({user}@{host}): ")
    return psycopg.connect(host=host, port=int(os.environ.get("PGPORT", "5432")),
                           dbname=os.environ.get("PGDATABASE", "postgres"), user=user, password=senha,
                           connect_timeout=5, autocommit=True)


def main():
    with conectar() as conn:
        conn.execute(DDL)
        if conn.execute("SELECT count(*) FROM public.navios_historicos").fetchone()[0]:
            sys.exit("A tabela ja tem dados: nada foi inserido (o seed nunca altera dados existentes).")
        for nome, casco, marinha, tipo, classe, guerra, ano, estado in NAVIOS:
            conn.execute(
                "INSERT INTO public.navios_historicos (nome, designacao_casco, marinha, tipo, classe, guerra,"
                " data_batismo, data_comissionamento, data_baixa, primeiro_comandante, ultimo_comandante,"
                " batalhas, armamento, estado_atual, fonte_observacoes)"
                " VALUES (%s,%s,%s,%s,%s,%s, make_date(%s,3,1), make_date(%s,6,15), make_date(%s,9,30),"
                " %s,%s,%s,%s,%s,%s)",
                (nome, casco, marinha, tipo, classe, guerra, ano, ano + 1, ano + 6,
                 "Comandante de teste A", "Comandante de teste B",
                 "Batalha de teste", "Armamento de teste", estado, NOTA))
        print(f"{len(NAVIOS)} navios sinteticos inseridos.")


if __name__ == "__main__":
    main()
