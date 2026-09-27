-- ============================================================================
-- Royal Navy v3.0 - Papel de LEITURA com privilegios minimos (idempotente)
--
-- A API do site conecta SOMENTE com este papel, nunca como 'postgres'.
-- A senha NAO fica aqui: o aplicar.py define a senha em outro passo.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'navios_leitura') THEN
    CREATE ROLE navios_leitura
      LOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      NOINHERIT
      CONNECTION LIMIT 10;                    -- no maximo 10 conexoes simultaneas
  END IF;
END
$$;

-- Defesa em camadas: mesmo que algo escape, a sessao nasce SOMENTE LEITURA e com limites
ALTER ROLE navios_leitura SET default_transaction_read_only = on;
ALTER ROLE navios_leitura SET statement_timeout                    = '3s';   -- consulta lenta e cancelada
ALTER ROLE navios_leitura SET lock_timeout                         = '1s';
ALTER ROLE navios_leitura SET idle_in_transaction_session_timeout  = '5s';
ALTER ROLE navios_leitura SET search_path                          = public;

-- Porteira do banco e do esquema: so quem foi autorizado entra
REVOKE ALL ON DATABASE postgres FROM PUBLIC;
GRANT  CONNECT ON DATABASE postgres TO navios_leitura;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT  USAGE ON SCHEMA public TO navios_leitura;

-- O papel NAO enxerga a tabela original: so a VIEW (que roda com os direitos do dono)
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM navios_leitura;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM navios_leitura;
GRANT  SELECT ON public.v_navios TO navios_leitura;

-- Funcao usada diretamente pela consulta (normaliza o texto digitado)
REVOKE ALL     ON FUNCTION public.rn_norm(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rn_norm(text) TO navios_leitura;
