r"""
Gera o HASH da senha do painel de sugestoes (/admin) - Royal Navy v4.3.

A senha NUNCA e gravada nem exibida: e digitada no terminal (getpass) e so o hash (scrypt) sai na tela.
Cole o hash na variavel de ambiente ADMIN_PASSWORD_HASH:
  * no Render: Environment -> Add Environment Variable (o valor vai inteiro, com os simbolos $);
  * no arquivo de segredos local (~/.royalnavy/consulta.env): ADMIN_PASSWORD_HASH='hash-entre-aspas-simples'
    (aspas simples evitam que o carregador interprete os simbolos $).

Uso:
    python ferramentas/gerar_hash_admin.py
"""

import getpass
import sys

from werkzeug.security import generate_password_hash

MINIMO = 14


def main():
    senha = getpass.getpass(f"Nova senha do painel (mínimo {MINIMO} caracteres): ")
    if len(senha) < MINIMO:
        sys.exit(f"Senha curta demais: use ao menos {MINIMO} caracteres (uma frase longa é ótima).")
    if len(senha) > 200:
        sys.exit("Senha longa demais: use até 200 caracteres.")
    if getpass.getpass("Repita a senha: ") != senha:
        sys.exit("As senhas não conferem. Nada foi gerado.")
    print("\nADMIN_PASSWORD_HASH=" + generate_password_hash(senha, method="scrypt"))
    print("\nGuarde a SENHA num gerenciador de senhas; o hash acima não permite recuperá-la.")


if __name__ == "__main__":
    main()
