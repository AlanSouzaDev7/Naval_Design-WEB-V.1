"""
Regenera, DENTRO dos slides de apresentacao/project/slides, os graficos 3D animados e o navio.

Quando usar: depois de mudar um DADO de grafico (abaixo, em EMBEDS) ou um motor (ferramentas/engines/*.js).
Textos, cores e layout dos slides se editam direto nos .html de project/slides - nao precisam deste script.

    python ferramentas/rebuild_embeds.py            # regenera todos
    python ferramentas/rebuild_embeds.py rf fps     # so os graficos citados

Cada <x-embed> e uma mini-pagina com ate 16 KB; o script avisa se passar do limite.
Nao depende de nada alem do Python 3.
"""
import json
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent
MOTORES = RAIZ / "engines"
SLIDES = RAIZ.parent / "project" / "slides"
LIMITE = 16384

SEA, GOLD, IVORY, STEEL, BLUE = "#5DB8C9", "#D4AE5A", "#E9E4D6", "#8FA9C4", "#4F86C2"


def barra(rotulo, segmentos):
    """Uma barra: rotulo acima dela e lista de segmentos [valor, cor] (varios = empilhada)."""
    return {"s": segmentos, "l": rotulo}


# nome -> slide em que o grafico vive, motor, posicao no slide (esq, topo, larg, alt) e dados
EMBEDS = {
    "rf": dict(slide="rf-grafico", motor="bars", pos=(128, 330, 1130, 600), cfg=dict(
        w=1130, h=600, yaw=0.36, max=6, inner=1,
        cats=["Experiência\ninstitucional", "Modelos\n3D", "Temas e\nimersão", "Consulta\nde navios", "Publicação\nonline", "Sugestões\ne painel"],
        bars=[
            [barra("4", [[4, SEA]])],
            [barra("3", [[3, SEA]])],
            [barra("3", [[3, SEA]])],
            [barra("6", [[5, GOLD], [1, SEA]])],  # v4.4: + RF-20 (PDF da ficha e da busca)
            [barra("2", [[2, IVORY]])],
            [barra("2", [[2, GOLD]])],            # v4.3: sugerir navio + painel do administrador
        ])),
    "fps": dict(slide="rnf-desempenho", motor="bars", pos=(128, 330, 1180, 600), cfg=dict(
        w=1180, h=600, yaw=0.34, max=128, ref=60, refl="60 fps · fluidez",
        cats=["Hero", "Mergulho", "Navios\n3D", "Patrulha", "Batalhas", "Recife", "Rodapé"],
        bars=[
            [barra("104", [[104.0, GOLD]]), barra("87", [[86.7, BLUE]])],
            [barra("113", [[113.3, GOLD]]), barra("93", [[93.1, BLUE]])],
            [barra("119", [[119.2, GOLD]]), barra("118", [[118.4, BLUE]])],
            [barra("120", [[120.2, GOLD]])],
            [barra("120", [[120.2, GOLD]]), barra("120", [[119.7, BLUE]])],
            [barra("106", [[105.7, GOLD]])],
            [barra("120", [[120.2, GOLD]]), barra("120", [[120.1, BLUE]])],
        ])),
    "antesdepois": dict(slide="rnf-otimizacao", motor="bars", pos=(128, 330, 760, 600), cfg=dict(
        w=760, h=600, yaw=0.34, max=64, ref=60, refl="60 fps", bwf=0.42,
        cats=["v1.0\noriginal", "v1.1\notimizada"],
        bars=[
            [barra("1,7", [[1.7, STEEL]])],
            [barra("56,7", [[56.7, GOLD]])],
        ])),
    "codigo": dict(slide="rnf-manutencao", motor="bars", pos=(128, 330, 1100, 600), cfg=dict(
        w=1100, h=600, yaw=0.34, max=6000, bwf=0.55,
        cats=["JavaScript", "CSS", "Python", "HTML", "Testes", "SQL"],
        # v4.4 (wc -l no commit 25c787a; Python = todos os .py exceto tests/ e enable_custom_domain.py)
        bars=[
            [barra("5.536", [[5536, SEA]])],
            [barra("2.815", [[2815, SEA]])],
            [barra("2.190", [[2190, SEA]])],
            [barra("1.244", [[1244, SEA]])],
            [barra("940", [[940, GOLD]])],
            [barra("112", [[112, SEA]])],
        ])),
    "testes": dict(slide="rnf-testes", motor="donut", pos=(128, 330, 760, 600), cfg=dict(
        w=760, h=600, cx=380, cy=270, R=270, r=160, th=40,
        # v4.4: 186 testes (52 de sugestoes/painel na v4.3; 29 de PDFs na v4.4; front-end/CSP = 10)
        segs=[[52, "#7FC8A9"], [29, "#E39B6B"], [28, "#5DB8C9"], [23, "#3E92AC"], [17, "#2C6F93"], [10, "#D4AE5A"], [8, "#B38C3A"], [7, "#8F6F2A"], [10, "#A9BED3"], [2, "#E9E4D6"]],
        names=["Sugestões\ne painel", "PDFs", "Validação\nde entrada", "Cargas\nhostis", "Privilégios\ndo banco", "Robustez e\nresiliência", "Cabeçalhos\ne rede", "Funcionamento", "Front-end\ne CSP", "Segredos"])),
    "camadas": dict(slide="seguranca", motor="layers", pos=(128, 306, 980, 620), cfg=dict(
        w=980, h=620, px=210, py=60, rx=170, ry=38, gap=80,
        l=["Host, método GET e URL curta", "Limite de requisições por IP", "Validação estrita de entrada",
           "SQL sempre parametrizado", "Papel que só lê uma view", "Timeouts, pool e LIMIT", "Erros genéricos ao cliente"])),
    "navio_capa": dict(slide="cover", motor="ship", pos=(0, 0, 1920, 1080), cfg=dict(
        fx=0.68, fy=0.64, F=1500, D=17, a0=0.7, spd=0.07, dim=1, sx=0.84)),
    "navio_fim": dict(slide="encerramento", motor="ship", pos=(0, 0, 1920, 1080), cfg=dict(
        fx=0.74, fy=0.64, F=1500, D=17, a0=2.1, spd=-0.06, dim=1, sx=0.80)),
}


def montar(nome):
    d = EMBEDS[nome]
    codigo = "\n".join(l.strip() for l in (MOTORES / (d["motor"] + ".js")).read_text(encoding="utf-8").splitlines() if l.strip())
    assert "</script>" not in codigo
    dados = json.dumps(d["cfg"], ensure_ascii=False, separators=(",", ":"))
    e, t, w, h = d["pos"]
    return ('<x-embed style="position:absolute;left:%dpx;top:%dpx;width:%dpx;height:%dpx">'
            '<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}canvas{display:block}</style>'
            '<canvas id="c"></canvas><script>\n%s\n</script></x-embed>') % (e, t, w, h, codigo.replace("__DATA__", dados))


def main(nomes):
    for nome in (nomes or EMBEDS):
        if nome not in EMBEDS:
            sys.exit("Grafico desconhecido: %s (opcoes: %s)" % (nome, ", ".join(EMBEDS)))
        arq = SLIDES / (EMBEDS[nome]["slide"] + ".html")
        texto = arq.read_text(encoding="utf-8")
        novo_embed = montar(nome)
        novo, n = re.subn(r"<x-embed\b.*?</x-embed>", lambda m: novo_embed, texto, count=1, flags=re.S)
        if n != 1:
            sys.exit("Nao achei o <x-embed> em %s" % arq.name)
        arq.write_text(novo, encoding="utf-8")
        tam = len(novo_embed.encode("utf-8"))
        print("%-12s %-22s %6d bytes %s" % (nome, arq.name, tam, "OK" if tam <= LIMITE else "ACIMA DE 16 KB - reduza"))


if __name__ == "__main__":
    main(sys.argv[1:])
