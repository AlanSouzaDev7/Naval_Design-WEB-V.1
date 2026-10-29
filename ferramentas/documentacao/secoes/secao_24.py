# -*- coding: utf-8 -*-
"""Seção 24 — Animações, degradês, integração das páginas e modelos 3D fiéis (v4.6)."""
from pathlib import Path

from reportlab.lib.units import cm

TITULO = "24. Movimento, integração e modelos 3D fiéis (v4.6)"
FIG = Path(__file__).resolve().parent.parent / "figuras"


def conteudo(e):
    M, P, B, T = e.M, e.P, e.B, e.table
    f = lambda nome: str(FIG / nome)
    s = []
    s.append(P("A versão 4.6.0 (28 de outubro de 2026, commit " + M("d10c608") + ") mantém a identidade visual do site e trabalha o que o "
               "visitante sente ao usar: as animações, os degradês, a passagem de uma página para outra e a fidelidade dos seis navios em 3D, "
               "refeitos a partir do perfil real de cada classe. Nenhum texto ou dado do conteúdo mudou.", e.callout))

    # ── 24.1 ───────────────────────────────────────────────────────────────────
    s.append(P("24.1  Animações", e.h2))
    s.append(P("O ajuste seguiu a filosofia de animação de interfaces de Emil Kowalski: animar só o que tem propósito, com curvas fortes, "
               "durações curtas na interface e sempre com alternativa para quem pede menos movimento."))
    s.append(T([
        ["Onde", "Antes", "Agora"],
        ["Curvas", M("cubic-bezier(0.4, 0, 0.2, 1)") + " em tudo", "Entradas " + M("cubic-bezier(0.23, 1, 0.32, 1)") + "; movimento na tela "
         + M("cubic-bezier(0.77, 0, 0.175, 1)") + "; cor e hover com " + M("ease")],
        ["Botões e cards", "Subiam 2–8 px ao passar o mouse; sem resposta ao toque", "Sobem menos (cards 5 px); "
         + M("scale(0.97)") + " ao pressionar (140 ms); no celular o hover não fica “grudado”"],
        ["Modal do navio", "Abria e fechava em 400 ms", "Abre em 340 ms e fecha em 180 ms: a resposta do sistema é mais rápida que a chegada"],
        ["Topo da página inicial", "Peças entravam até 1,2 s depois", "Mesma sequência em 80 ms entre peças, toda dentro de 0,6 s"],
        ["Troca de tema", "Círculo de 900 ms", "Círculo de 760 ms com a curva forte de ease-in-out"],
        ["Página Estrelas", "Sem animação de entrada", "Blocos sobem ao entrar na tela, com animação ligada à rolagem (só CSS)"],
    ], [3.0 * cm, 5.2 * cm, e.CW - 8.2 * cm], first_bold=True))
    s += B([
        "<b>Transição entre páginas.</b> Com " + M("@view-transition { navigation: auto; }") + " e " + M("view-transition-name") + " na barra, "
        "ao ir do Início para Estrelas, Consulta, Contato ou Sugerir a barra fica parada e o conteúdo entra com um esmaecimento de 160 ms e "
        "uma subida de 14 px, no lugar do “pisca” branco. A troca de tema continua com o seu círculo: durante ela a transição padrão é desligada.",
        "<b>Movimento reduzido.</b> Com " + M("prefers-reduced-motion") + ", a transição entre páginas e os deslocamentos são desligados; o "
        "conteúdo aparece direto no lugar.",
        "<b>Medidor de profundidade.</b> Ao voltar de uma vez ao topo, ele continuava mostrando a última profundidade; agora some junto com o mergulho.",
    ])

    # ── 24.2 ───────────────────────────────────────────────────────────────────
    s.append(P("24.2  Degradês e integração das páginas", e.h2))
    s += B([
        "<b>Degradês em OKLab.</b> Os 72 degradês com ângulo passaram a misturar as cores no espaço OKLab (" + M("linear-gradient(180deg in oklab, …)") + "), "
        "que evita o meio acinzentado entre azul e turquesa e as faixas visíveis no dourado.",
        "<b>Cabeçalho e rodapé em onda recortada.</b> Antes, a onda era uma faixa pintada com a cor “de baixo”; nas páginas internas sobrava uma "
        "faixa azul-clara solta acima do rodapé. Agora o próprio cabeçalho e o próprio rodapé recortam a borda com uma máscara em onda, e o fundo "
        "da página pode ser um degradê contínuo, da água rasa ao leito de areia, como na página inicial.",
        "<b>Página Estrelas.</b> O céu calculado termina na mesma onda e revela o papel de carta por baixo, no lugar do corte reto.",
        "<b>Fim da página inicial.</b> O formulário de contato passou para antes dos Jardins de Coral (claro) e dos Navios Naufragados (escuro). "
        "Assim o fundo do mar encosta no rodapé, como foi pensado: a areia desenhada se dissolve na areia do rodapé e o leito escuro desce sem o "
        "filete laranja que marcava a emenda.",
        "<b>Batalhas no modo escuro.</b> O véu escuro da seção volta a clarear no fim, sem a linha reta na emenda com a Frota.",
    ])
    s.append(e.shot(f("v46_paginas.jpg"), "Figura 49 — Páginas internas integradas. Esquerda: cabeçalho do Contato terminando em onda. Centro: o fundo em "
                                         "degradê descendo até o rodapé de areia. Direita: o céu da página Estrelas terminando em onda sobre o papel de carta."))
    s.append(e.shot(f("v46_fundo.jpg"), "Figura 50 — O novo fim da página inicial. Esquerda: Contato e, logo abaixo, os Jardins de Coral. Centro: a areia do "
                                        "recife se dissolvendo no rodapé. Direita: no modo escuro, os naufrágios descendo direto até o rodapé."))

    # ── 24.3 ───────────────────────────────────────────────────────────────────
    s.append(P("24.3  Modelos 3D fiéis aos navios reais", e.h2))
    s.append(P("Os modelos eram caixas e cilindros com um cone na proa. Foram refeitos com base no perfil de cada classe, pesquisado em fontes "
               "públicas (Wikipedia, Navy Lookout, Navypedia, naval-technology, GlobalSecurity e History of War). A base é um gerador novo de "
               "<b>casco por seções</b> (" + M("loftHull") + " em " + M("static/js/ships-3d.js") + "): o casco afina na proa, a borda abre para cima, "
               "a popa termina num espelho, a roda de proa é inclinada e a linha d'água é pintada como nos navios reais (obras vivas vermelhas e faixa "
               "preta; no Victory, fundo forrado de cobre)."))
    s.append(T([
        ["Navio", "Medidas reais", "O que o modelo mostra"],
        ["HMS Queen Elizabeth", "284 m; convés de voo de 73 m",
         "Convés com o contorno real e rampa de salto de 12° a bombordo; duas ilhas a estibordo, com chaminés; radares S1850M e Type 997 Artisan girando; "
         "controle de voo envidraçado; dois elevadores; três Phalanx; marcações, pontos de pouso, cinco F-35B e um Merlin"],
        ["HMS Daring (Type 45)", "152 m × 21 m",
         "Mastro em pirâmide com a esfera do SAMPSON; S1850M girando no mastro de ré, entre as duas chaminés; canhão Mk 8 em torre furtiva; "
         "48 células Sylver; Phalanx nos dois bordos; botes; hangar, convoo e o número D32"],
        ["HMS Astute", "97 m × 11,3 m",
         "Casco charuto revestido de placas acústicas; torre bem a vante com mastros optrônicos; lemes de profundidade no casco; popa em cruz com "
         "placas nas pontas; propulsor pump-jet com duto"],
        ["HMS Victory", "57 m de convés de bateria; mastro grande a 62,5 m",
         "Padrão preto e ocre de Nelson; 104 portinholas com os canhões; galerias na popa; figura de proa; três mastros com quatro velas redondas "
         "cada; gurupés com três bujarronas; vela de ré; cordame; White Ensign"],
        ["HMS Westminster (Type 23)", "133 m × 16 m",
         "Superestrutura de faces inclinadas; canhão Mk 8; silo de 32 células; dois Harpoon cruzados; Type 997 girando; chaminé inclinada; "
         "hangar, convoo e o número F237"],
        ["HMS Dreadnought", "160,6 m × 25 m",
         "Cinco torres duplas nas posições A, P, Q, X e Y; convés de madeira; mastro tripé atrás da chaminé de vante; duas chaminés ovais; "
         "botes; tripé de controle de torpedos; canhões antitorpedeiro; prateleiras das redes; proa de aríete; White Ensign"],
    ], [3.1 * cm, 3.0 * cm, e.CW - 6.1 * cm], first_bold=True))
    s.append(e.shot(f("v46_modelos.jpg"), "Figura 51 — Os seis modelos de perfil. Em cima: HMS Queen Elizabeth, HMS Daring (Type 45) e HMS Westminster "
                                          "(Type 23). Embaixo: HMS Dreadnought, HMS Victory e HMS Astute."))
    s += B([
        "<b>Radares que giram.</b> Os radares S1850M e Type 997 Artisan giram no mesmo laço de animação que "
        "já existia, sem custo extra de cena.",
        "<b>Frota em escala real.</b> Na visão geral da Frota Atual, cada navio aparece no tamanho relativo verdadeiro: o porta-aviões tem 284 m, "
        "o Type 45 152 m, o Type 23 133 m e o Astute 97 m.",
        "<b>Desempenho.</b> Geometrias e materiais continuam em cache; peças repetidas (portinholas, canhões, células de mísseis) usam "
        + M("InstancedMesh") + ", e todo o cordame do Victory é um único desenho de linhas.",
    ])
    s.append(e.shot(f("v46_frota.jpg"), "Figura 52 — Esquerda: a Frota Atual em escala relativa real. Direita: a galeria 3D no modo escuro."))

    # ── 24.4 ───────────────────────────────────────────────────────────────────
    s.append(P("24.4  Verificação e limites", e.h2))
    s += B([
        "Os 226 testes passaram antes do envio. Os seis modelos foram renderizados um a um no Edge sem interface, nos dois temas, sem nenhum "
        "erro no console; o site foi conferido no computador, no tablet e no celular.",
        "<b>Limites.</b> Os modelos continuam sendo geometria feita em código, sem texturas fotográficas: mostram formas e disposição corretas, "
        "não o nível de um modelo profissional. Onde as fontes divergem, valeu a mais bem apoiada: a rampa do Queen Elizabeth aparece com 9°, 12° "
        "ou 13° (usado 12°); há fonte que diz que os lemes de vante do Astute não recolhem; e não se achou confirmação de qual ilha do Queen "
        "Elizabeth leva cada radar.",
        "A transição entre páginas depende do navegador (Chrome e Edge); nos outros, a navegação continua como antes.",
    ])
    return s
