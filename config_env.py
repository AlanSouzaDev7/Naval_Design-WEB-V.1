"""
Onde ficam os SEGREDOS do site (senha do papel de leitura do banco etc.).

Ordem de busca do arquivo de configuracao:
  1. o caminho da variavel de ambiente RN_ENV_FILE (se definida);
  2. %LOCALAPPDATA%\\RoyalNavy\\consulta.env  (Windows)  |  ~/.config/royalnavy/consulta.env  (Linux/macOS);
  3. .env na pasta do projeto (mais simples, mas CUIDADO: se a pasta for sincronizada - OneDrive,
     Dropbox, Google Drive - a senha sobe para a nuvem).

O padrao seguro e o item 2: pasta do usuario, fora do projeto e fora da sincronizacao, com permissao
somente para o dono. Variaveis de ambiente reais sempre valem mais que o arquivo.
"""

import os
import subprocess  # nosec B404 - so para chamar o icacls do Windows, sem shell
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent


def caminho_padrao() -> Path:
    if os.environ.get("RN_ENV_FILE"):
        return Path(os.environ["RN_ENV_FILE"])
    base = os.environ.get("LOCALAPPDATA")
    base = Path(base) if base else Path.home() / ".config"
    return base / "RoyalNavy" / "consulta.env"


def candidatos():
    lista = []
    if os.environ.get("RN_ENV_FILE"):
        lista.append(Path(os.environ["RN_ENV_FILE"]))
    lista += [caminho_padrao(), RAIZ / ".env"]
    return lista


def localizar():
    for p in candidatos():
        if p.is_file():
            return p
    return None


def carregar() -> "Path | None":
    """Le o arquivo de configuracao (se existir) para os.environ, sem sobrescrever o que ja estiver definido."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return None
    arq = localizar()
    if arq:
        load_dotenv(arq, override=False)
    return arq


def proteger(arq: Path) -> str:
    """Deixa o arquivo legivel so pelo dono. Devolve uma frase descrevendo o resultado."""
    try:
        if sys.platform == "win32":
            usuario = os.environ.get("USERNAME", "")
            dominio = os.environ.get("USERDOMAIN", "")
            alvo = f"{dominio}\\{usuario}" if dominio and usuario else usuario
            icacls = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "icacls.exe"      # caminho completo
            subprocess.run([str(icacls), str(arq), "/inheritance:r", "/grant:r", f"{alvo}:(R,W)"],   # nosec B603 - sem shell; argumentos nossos
                           check=True, capture_output=True)
            return "permissao restrita ao seu usuario (icacls)"
        os.chmod(arq, 0o600)
        return "permissao 600 (somente o dono)"
    except Exception as exc:                            # noqa: BLE001
        return f"NAO foi possivel restringir a permissao ({exc.__class__.__name__}); restrinja manualmente"
