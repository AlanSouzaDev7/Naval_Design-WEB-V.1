"""
Royal Navy Educational Site - Flask Server (v3.0)
Run: python app.py
Then open: http://localhost:5000

Configuracao: variaveis de ambiente ou o arquivo de segredos (config_env.py; modelo em .env.example):
  PORT             porta do servidor (padrao 5000)
  HOST             interface de rede (padrao 127.0.0.1; use 0.0.0.0 para expor na rede local)
  FLASK_DEBUG      "0" desliga o modo debug (padrao "1"). O debug so liga em host local.
  ALLOWED_HOSTS    nomes de host aceitos no cabecalho Host (padrao: localhost,127.0.0.1,[::1])
  TRUST_PROXY_HOPS quantos proxies confiaveis ha na frente (0 = nenhum; use 1 atras de nginx/Cloudflare)
  RN_HTTPS         "1" ativa o cabecalho HSTS (so quando o site esta servido por HTTPS)
  DB_*             conexao do PAPEL DE LEITURA do banco (ver db/aplicar.py e .env.example)
"""

import logging
import os

from flask import Flask, jsonify, render_template, request
from werkzeug.middleware.proxy_fix import ProxyFix

import config_env

config_env.carregar()                           # segredos: ver config_env.py (fora do Git e, por padrao, fora do OneDrive)

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"),
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", 5000))

# O debugger do Werkzeug permite executar codigo Python no servidor; por isso
# ele so fica ligado quando o servidor esta acessivel apenas nesta maquina.
DEBUG = os.environ.get("FLASK_DEBUG", "1") == "1" and HOST in ("127.0.0.1", "localhost")

ALLOWED_HOSTS = {h.strip().lower() for h in
                 os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]").split(",") if h.strip()}

# Mesma politica da <meta> das paginas (o GitHub Pages so aceita meta); aqui, como cabecalho,
# ela ganha tambem frame-ancestors (anti-clickjacking), que a meta nao suporta.
CSP = ("default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
       "img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'")

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
)

app.config["MAX_CONTENT_LENGTH"] = 4096                 # o site so recebe GET: corpo grande e sempre suspeito

# Fora do debug o navegador guarda os arquivos estaticos por 1 hora;
# em debug fica sem cache para voce ver as mudancas na hora.
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = None if DEBUG else 3600

_hops = int(os.environ.get("TRUST_PROXY_HOPS", "0"))
if _hops > 0:                                           # so confia em X-Forwarded-* se voce configurar
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=_hops, x_proto=_hops, x_host=_hops)


def _host_sem_porta(valor):
    valor = (valor or "").lower()
    if valor.startswith("["):                           # IPv6: [::1]:5000
        return valor.split("]")[0] + "]"
    return valor.rsplit(":", 1)[0] if ":" in valor else valor


@app.before_request
def confere_host():
    """Barra requisicoes com Host inesperado (protege contra DNS rebinding e Host forjado)."""
    if _host_sem_porta(request.host) not in ALLOWED_HOSTS:
        return jsonify(erro="host_nao_permitido", mensagem="Host nao permitido."), 400


# ── Cabecalhos de seguranca (valem para todas as respostas) ────
@app.after_request
def security_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")       # nao "adivinhar" tipos de arquivo
    resp.headers.setdefault("X-Frame-Options", "DENY")                 # impede o site de ser embutido em iframes
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    resp.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    resp.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
    resp.headers["Server"] = "Royal Navy"                              # nao revela versao do Werkzeug/Python
    if resp.mimetype == "text/html":
        resp.headers.setdefault("Content-Security-Policy", CSP + "; frame-ancestors 'none'")
    if os.environ.get("RN_HTTPS") == "1":
        resp.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return resp


# ── Paginas ────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/consulta")
def consulta():
    return render_template("consulta.html")


# ── API de consulta ao banco (somente leitura) ─────────────────
# Se faltar dependencia ou configuracao, o restante do site continua no ar.
try:
    import consulta_api
    consulta_api.init_app(app)
except Exception as exc:                                # noqa: BLE001
    app.logger.warning("API de consulta desativada: %s", exc)

    @app.route("/api/<path:_>")
    def api_indisponivel(_):
        return jsonify(erro="servico_indisponivel", mensagem="O servico de consulta esta indisponivel."), 503


# ── Erros ──────────────────────────────────────────────────────
# A pagina inicial e de uma tela so: URLs desconhecidas voltam para ela. Mas arquivos
# ausentes (/static/..., /favicon.ico) e qualquer /api/... devolvem 404 de verdade.
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify(erro="nao_encontrado", mensagem="Recurso nao encontrado."), 404
    last_segment = request.path.rsplit("/", 1)[-1]
    if request.path.startswith("/static/") or "." in last_segment:
        return "Not found", 404
    return render_template("index.html"), 404


@app.errorhandler(405)
def method_not_allowed(e):
    if request.path.startswith("/api/"):
        return jsonify(erro="metodo_nao_permitido", mensagem="Metodo nao permitido."), 405
    return "Method not allowed", 405


@app.errorhandler(429)
def too_many(e):
    r = jsonify(erro="muitas_requisicoes", mensagem="Muitas requisicoes. Aguarde um instante e tente de novo.")
    r.status_code = 429
    return r


@app.errorhandler(413)
def too_large(e):
    return jsonify(erro="requisicao_grande", mensagem="Requisicao grande demais."), 413


if __name__ == "__main__":
    # Banner so com ASCII: o console do Windows (cp1252) quebrava com caracteres Unicode
    print("\n" + "=" * 55)
    print("  ROYAL NAVY - Educational Site v3.0")
    print(f"  http://localhost:{PORT}")
    print("=" * 55 + "\n")

    app.run(debug=DEBUG, host=HOST, port=PORT)
