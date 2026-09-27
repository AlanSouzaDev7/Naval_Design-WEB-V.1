r"""
Onde ficam os SEGREDOS do site (senha do papel de leitura do banco etc.).

Ordem de busca do arquivo de configuracao:
  1. o caminho da variavel de ambiente RN_ENV_FILE (se definida);
  2. ~/.royalnavy/consulta.env   (Windows: C:\Users\<voce>\.royalnavy\consulta.env)  <- padrao seguro;
  3. %LOCALAPPDATA%\RoyalNavy\consulta.env  (local da primeira versao; algumas execucoes no Windows nao
     enxergam o AppData - por isso deixou de ser o padrao);
  4. .env na pasta do projeto (mais simples, mas CUIDADO: se a pasta for sincronizada - OneDrive,
     Dropbox, Google Drive - a senha sobe para a nuvem).

O padrao seguro e o item 2: pasta do usuario, fora do projeto e fora da sincronizacao (o OneDrive so
sincroniza Desktop/Documentos/Imagens), com permissao somente para o dono. Variaveis de ambiente
reais sempre valem mais que o arquivo.
"""

import os
import subprocess  # nosec B404 - so para chamar o icacls do Windows, sem shell
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent


def caminho_padrao() -> Path:
    if os.environ.get("RN_ENV_FILE"):
        return Path(os.environ["RN_ENV_FILE"])
    return Path.home() / ".royalnavy" / "consulta.env"


def caminho_appdata() -> "Path | None":
    """Local da versao inicial (mantido so para migracao/compatibilidade)."""
    base = os.environ.get("LOCALAPPDATA")
    return Path(base) / "RoyalNavy" / "consulta.env" if base else None


def candidatos():
    lista = [caminho_padrao()]
    antigo = caminho_appdata()
    if antigo and antigo not in lista:
        lista.append(antigo)
    lista.append(RAIZ / ".env")
    return lista


def localizar():
    for p in candidatos():
        if p.is_file():
            return p
    return None


def resumo() -> str:
    """Frase de diagnostico (sem segredos): qual arquivo foi encontrado ou onde procurei."""
    arq = localizar()
    if arq:
        return f"arquivo de segredos: {arq}"
    partes = []
    for p in candidatos():
        try:
            os.stat(p)
            estado = "existe"
            with open(p, "rb") as f:                    # o teste real: conseguimos LER?
                f.read(1)
            estado += " e pode ser lido"
        except OSError as exc:
            estado = f"{exc.__class__.__name__}: {exc.strerror or exc}"
        partes.append(f"{p} -> {estado}")
    return "arquivo de segredos NAO encontrado; procurei em: " + " | ".join(partes)


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
