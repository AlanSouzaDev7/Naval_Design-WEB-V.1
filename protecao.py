"""
Protecoes dos formularios (POST) do site - Royal Navy v4.3.

  * CSRF: token aleatorio guardado na sessao (cookie assinado, HttpOnly, SameSite=Strict) e repetido
    num campo oculto do formulario; os dois precisam bater (comparacao em tempo constante).
  * Origem: se o navegador mandar o cabecalho Origin, ele precisa ser o proprio site.
  * Campo-isca: um campo que pessoas nao veem (escondido por CSS); robos que preenchem tudo
    se denunciam. A resposta finge sucesso para nao ensinar o robo.
"""

import hmac
import secrets
from functools import wraps

from flask import abort, request, session

CAMPO_CSRF = "csrf_token"
CAMPO_ISCA = "website"          # nome atraente para robos; escondido para pessoas


def csrf_token():
    """Token CSRF da sessao atual (cria na primeira vez). Usado nos templates."""
    token = session.get("csrf")
    if not token:
        token = secrets.token_urlsafe(32)
        session["csrf"] = token
    return token


def renovar_csrf():
    """Troca o token (depois do login, por exemplo)."""
    session["csrf"] = secrets.token_urlsafe(32)
    return session["csrf"]


def _origem_ok():
    origem = request.headers.get("Origin")
    if not origem or origem == "null":
        return origem is None                       # "null" (sandbox, data:) nao e o proprio site
    return origem.rstrip("/") == request.host_url.rstrip("/")


def csrf_valido():
    enviado = request.form.get(CAMPO_CSRF, "")
    esperado = session.get("csrf", "")
    return bool(enviado) and bool(esperado) and hmac.compare_digest(enviado, esperado) and _origem_ok()


def exige_csrf(view):
    """Decorador: em POST, recusa (403) sem token CSRF valido ou com Origin de outro site."""
    @wraps(view)
    def interno(*args, **kwargs):
        if request.method == "POST" and not csrf_valido():
            abort(403)
        return view(*args, **kwargs)
    return interno


def isca_preenchida():
    return bool((request.form.get(CAMPO_ISCA) or "").strip())


def configurar(app):
    """Sessao segura + token disponivel nos templates como {{ csrf_token() }}."""
    import logging
    import os

    chave = os.environ.get("SECRET_KEY", "")
    if len(chave) < 32:
        if chave:
            logging.getLogger("royalnavy").warning("SECRET_KEY curta (< 32 caracteres): usando uma chave aleatoria.")
        elif not app.debug:
            logging.getLogger("royalnavy").warning(
                "SECRET_KEY ausente: usando uma chave aleatoria (sessoes e logins caem a cada reinicio).")
        chave = secrets.token_hex(32)
    app.secret_key = chave
    app.config.update(
        SESSION_COOKIE_NAME="rn_sessao",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Strict",
        SESSION_COOKIE_SECURE=os.environ.get("RN_HTTPS") == "1",
    )
    app.jinja_env.globals["csrf_token"] = csrf_token
    app.jinja_env.globals["CAMPO_CSRF"] = CAMPO_CSRF
    app.jinja_env.globals["CAMPO_ISCA"] = CAMPO_ISCA

    @app.errorhandler(403)
    def _proibido(_e):
        from flask import jsonify, render_template_string
        if request.path.startswith("/api/"):
            return jsonify(erro="proibido", mensagem="Requisição recusada."), 403
        return render_template_string(
            "<!DOCTYPE html><meta charset=\"utf-8\"><title>Requisição recusada</title>"
            "<p>A requisição foi recusada (o formulário expirou ou veio de outro site). "
            "<a href=\"{{ request.path }}\">Recarregue a página</a> e tente de novo.</p>"), 403
