-- ============================================================================
-- Royal Navy v3.0 - Consulta de navios: estrutura de BUSCA (idempotente)
--
-- Rode como dono/superusuario do banco (o script aplicar.py faz isso).
-- NAO altera nem apaga nenhum dado: so ACRESCENTA extensoes, funcoes, uma VIEW
-- e indices. Pode ser executado varias vezes.
-- ============================================================================

-- Busca sem acento e tolerante a erro de digitacao
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA public;

-- Normaliza texto: minusculas e sem acentos ("Encouraçado" -> "encouracado").
-- unaccent() e STABLE; este invólucro é declarado IMMUTABLE para poder ser usado
-- em indice (se as regras do unaccent mudarem, e preciso rodar REINDEX).
CREATE OR REPLACE FUNCTION public.rn_norm(t text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $fn$
  SELECT lower(public.unaccent('public.unaccent'::regdictionary, t))
$fn$;

-- Texto de busca de um navio: nome + designacao do casco + classe + marinha
CREATE OR REPLACE FUNCTION public.rn_busca(nome text, casco text, classe text, marinha text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $fn$
  SELECT public.rn_norm(
    coalesce(nome, '')                    || ' ' ||
    coalesce(nullif(casco, 'N/A'), '')    || ' ' ||
    coalesce(classe, '')                  || ' ' ||
    coalesce(marinha, '')
  )
$fn$;

-- Indices: substring (LIKE '%..%') e similaridade (%) usam o mesmo indice trigrama
CREATE INDEX IF NOT EXISTS idx_navios_busca_trgm
  ON public.navios_historicos
  USING gin (public.rn_busca(nome, designacao_casco, classe, marinha) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_navios_nome_norm
  ON public.navios_historicos (public.rn_norm(nome));

-- VIEW publica: e a UNICA coisa que a aplicacao consegue ler.
--  * expoe so os campos de consulta (nada de criado_em / colunas internas);
--  * 'N/A' em designacao_casco vira NULL;
--  * 'fonte_observacoes' e exposta como 'observacoes'.
CREATE OR REPLACE VIEW public.v_navios AS
SELECT
  n.id,
  n.nome,
  nullif(n.designacao_casco, 'N/A')                                             AS designacao_casco,
  n.marinha,
  n.tipo,
  n.classe,
  n.guerra,
  n.data_batismo,
  n.data_comissionamento,
  n.data_baixa,
  n.primeiro_comandante,
  n.ultimo_comandante,
  n.batalhas,
  n.armamento,
  n.estado_atual,
  n.fonte_observacoes                                                           AS observacoes,
  public.rn_norm(n.nome)                                                        AS nome_norm,
  public.rn_busca(n.nome, n.designacao_casco, n.classe, n.marinha)              AS busca_norm
FROM public.navios_historicos n;

COMMENT ON VIEW public.v_navios IS
  'Royal Navy v3.0: visao somente-leitura usada pela API de consulta. Nao expoe colunas internas.';
