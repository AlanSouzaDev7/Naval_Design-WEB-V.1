"""Configuracao dos testes: usa o mesmo .env do site (papel de LEITURA do banco)."""
import os
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import app as site_app            # noqa: E402  (carrega o .env)
import consulta_api               # noqa: E402


@pytest.fixture(scope="session")
def client():
    return site_app.app.test_client()


@pytest.fixture(autouse=True)
def zera_limitador():
    """Cada teste comeca com o contador de requisicoes zerado."""
    consulta_api.limiter.reset()
    yield
    consulta_api.limiter.reset()


@pytest.fixture(scope="session", autouse=True)
def exige_banco(client):
    r = client.get("/api/saude")
    if r.status_code != 200:
        pytest.skip("Banco de dados indisponivel: rode 'python db/aplicar.py' antes dos testes.")


@pytest.fixture()
def conexao():
    """Conexao DIRETA ao banco com o papel de leitura (para provar o que ele NAO pode fazer)."""
    import psycopg
    conn = psycopg.connect(host=os.environ.get("DB_HOST", "localhost"), port=os.environ.get("DB_PORT", "5432"),
                           dbname=os.environ.get("DB_NAME", "postgres"), user=os.environ["DB_USER"],
                           password=os.environ["DB_PASSWORD"], connect_timeout=5, autocommit=True)
    yield conn
    conn.close()
