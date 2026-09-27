# Banco de dados da consulta de navios

O site lê os navios de uma tabela PostgreSQL (`public.navios_historicos`, 17 colunas). Esta pasta prepara o banco
para uma consulta **segura**. Nenhum script apaga ou altera dados: só **acrescentam** extensões, funções, uma *view*,
índices e um papel de leitura.

| Arquivo | O que faz |
|---|---|
| `01_busca.sql` | extensões `unaccent` e `pg_trgm`; funções `rn_norm`/`rn_busca` (busca sem acento); índices; **view `v_navios`** (única coisa que a API lê) |
| `02_papel_leitura.sql` | papel `navios_leitura` (sem superusuário, 10 conexões, somente-leitura, `statement_timeout` 3 s) e as permissões mínimas |
| `aplicar.py` | executa os dois SQL, define a senha do papel (aleatória), grava os segredos e **verifica por dentro** que o papel não consegue escrever |

## Primeira vez

```bash
python db/aplicar.py                 # pede a senha do administrador (postgres); ela NUNCA é gravada
python app.py
```

O `aplicar.py` cria o arquivo de segredos em `~/.royalnavy/consulta.env` (Windows:
`C:\Users\<você>\.royalnavy\consulta.env`) com permissão só para o seu usuário. Esse local **não é sincronizado** pelo OneDrive e
não está no repositório. Para usar outro caminho: variável `RN_ENV_FILE`. Modelo: [`../.env.example`](../.env.example).

Opções: `--rotacionar-senha` (gera nova senha para o papel de leitura) e `--fechar-rede` (veja abaixo).

## O que o papel `navios_leitura` consegue (e não consegue)

| Pode | Não pode (testado em `tests/test_consulta.py`) |
|---|---|
| `SELECT` na view `v_navios` | ler a tabela `navios_historicos` · `INSERT` · `UPDATE` · `DELETE` · `TRUNCATE` · `DROP` |
| conectar (até 10 sessões) | criar tabelas/funções/papéis · virar superusuário · ler arquivos do servidor · `COPY ... PROGRAM` |
| | consultas com mais de 3 s (são canceladas) · ver colunas internas (`criado_em`) |

## Tarefas do administrador (só você pode fazer)

1. **Trocar a senha do `postgres`.** A senha atual é curta e apareceu em conversa. No terminal, digite a nova senha quando
   o `psql` pedir (ela não aparece na linha de comando):

   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -c "\password postgres"
   ```

   Depois atualize a senha salva no **pgAdmin** (o servidor cadastrado vai pedi-la de novo). O site não é afetado: ele usa
   o papel `navios_leitura`.

2. **Fechar o PostgreSQL para a rede.** `python db/aplicar.py --fechar-rede` grava `listen_addresses = 'localhost'`
   (`postgresql.auto.conf`), mas o valor só vale depois de **reiniciar o serviço**, o que exige administrador. No
   PowerShell **como administrador**:

   ```powershell
   Restart-Service postgresql-x64-18
   ```

   Conferir: `Get-NetTCPConnection -State Listen -LocalPort 5432` deve mostrar só `127.0.0.1` e `::1`.
   (Mesmo antes disso o `pg_hba.conf` só aceita conexões de 127.0.0.1/::1, sempre com `scram-sha-256`.)

## Backup e restauração

Antes de mexer, foi feito um backup completo em `..\..\backups\postgres_antes_da_v3.sql` (fora do repositório).

```powershell
# backup
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h localhost -U postgres -d postgres -f backup.sql
# restaurar em um banco vazio
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d novo_banco -f backup.sql
```

## Publicando (banco em servidor)

Crie um banco **dedicado** ao site, restaure os dados, rode `db/aplicar.py` apontando para ele
(`PGHOST`, `PGDATABASE`, `PGUSER` no ambiente) e:

- conexão do site com TLS: `DB_SSLMODE=verify-full`;
- `pg_hba.conf` com `hostssl <banco> navios_leitura <IP-do-site>/32 scram-sha-256` (e nada mais aberto);
- firewall liberando a porta 5432 **só** para o IP do servidor do site;
- senha longa e aleatória; backups automáticos e testados;
- se a lista de navios crescer para dezenas de milhares, considere trocar o `word_similarity(...) >= 0.5` da consulta
  pelo operador indexado `<%` (com `SET pg_trgm.word_similarity_threshold`).

Se as regras do `unaccent` mudarem (atualização do PostgreSQL), reconstrua os índices: `REINDEX INDEX idx_navios_busca_trgm;`.
