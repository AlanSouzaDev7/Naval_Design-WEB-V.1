"""
Royal Navy Educational Site — Flask Server
Run: python app.py
Then open: http://localhost:5000

Variáveis de ambiente opcionais:
  PORT         porta do servidor (padrão 5000)
  HOST         interface de rede (padrão 127.0.0.1; use 0.0.0.0 para expor na rede local)
  FLASK_DEBUG  "0" desliga o modo debug (padrão "1": recarrega ao salvar arquivos).
               O debug é desligado automaticamente se HOST não for local.
"""

import os

from flask import Flask, render_template, request

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", 5000))

# O debugger do Werkzeug permite executar código Python no servidor; por isso
# ele só fica ligado quando o servidor está acessível apenas nesta máquina.
DEBUG = os.environ.get("FLASK_DEBUG", "1") == "1" and HOST in ("127.0.0.1", "localhost")

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
)

# Fora do debug o navegador guarda os arquivos estáticos por 1 hora;
# em debug fica sem cache para você ver as mudanças na hora.
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = None if DEBUG else 3600


# ── Cabeçalhos de segurança (valem para todas as respostas) ────
@app.after_request
def security_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")       # não "adivinhar" tipos de arquivo
    resp.headers.setdefault("X-Frame-Options", "DENY")                 # impede o site de ser embutido em iframes
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    return resp


# ── Main page ──────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


# ── 404 handler ───────────────────────────────────────────────
# A página é de uma tela só: URLs desconhecidas voltam para ela. Mas arquivos
# ausentes (/static/..., /favicon.ico) devolvem 404 de verdade — antes eles
# recebiam a página inteira (~30 KB) como resposta.
@app.errorhandler(404)
def not_found(e):
    last_segment = request.path.rsplit("/", 1)[-1]
    if request.path.startswith("/static/") or "." in last_segment:
        return "Not found", 404
    return render_template("index.html"), 404


if __name__ == "__main__":
    # Banner só com ASCII: o console do Windows (cp1252) quebrava com "═ ⚓ 🌐"
    print("\n" + "=" * 55)
    print("  ROYAL NAVY - Educational Site")
    print(f"  http://localhost:{PORT}")
    print("=" * 55 + "\n")

    app.run(debug=DEBUG, host=HOST, port=PORT)
