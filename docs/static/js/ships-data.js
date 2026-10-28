/* ================================================================
   ROYAL NAVY — SHIPS DATABASE
   Complete data for all featured vessels
   ================================================================ */

const SHIPS_DATA = {

  'queen-elizabeth': {
    name:  'HMS Queen Elizabeth',
    class: 'Porta-Aviões · Classe Queen Elizabeth · R08',
    desc:  'O HMS Queen Elizabeth é o maior navio de guerra já construído para a Marinha Real Britânica. Com 65.000 toneladas e 280 metros de comprimento, representa a projeção de poder naval do século XXI. Comissionado em 2017, opera como navio-capitânia do Carrier Strike Group 21.',
    color: 0x4a5568,
    type:  'carrier',
    specs: [
      { label: 'Deslocamento',    value: '65.000 toneladas' },
      { label: 'Comprimento',     value: '280 m' },
      { label: 'Boca',            value: '39 m' },
      { label: 'Velocidade máx.', value: '25 nós' },
      { label: 'Autonomia',       value: '10.000 nm' },
      { label: 'Tripulação',      value: '679 (até 1.600 com o grupo aéreo)' },
      { label: 'Propulsão',       value: 'Elétrica integrada — 2 turbinas MT30 + 4 diesel' },
      { label: 'Comissionamento', value: '7 dez 2017' },
      { label: 'Construtor',      value: 'Aircraft Carrier Alliance' },
      { label: 'Custo',           value: '3,1 bilhões de libras' }
    ],
    armament: [
      '3x Phalanx CIWS 20 mm (defesa antimíssil)',
      '4x canhões de 30 mm DS30M Mk2',
      'Até 36x aeronaves F-35B Lightning II',
      'Helicópteros Merlin HM2 / Wildcat AH1',
      'Drones Protector RG Mk1',
      'Capacidade para Crowsnest AEW&C'
    ],
    history: 'O projeto do porta-aviões britânico foi aprovado em 1998 como parte do programa Future Aircraft Carrier (CVF). A construção foi distribuída por seis estaleiros no Reino Unido e a montagem final ocorreu em Rosyth, na Escócia. O navio foi batizado em julho de 2014 pela Rainha Elizabeth II e comissionado em dezembro de 2017. Em 2021 liderou o Carrier Strike Group 21 em uma missão de 28 semanas pelo Indo-Pacífico, marcando a maior projeção naval britânica em décadas. Seu gêmeo, o HMS Prince of Wales (R09), foi comissionado em 2019.'
  },

  'type45': {
    name:  'HMS Daring',
    class: 'Destróier · Classe Type 45 (Daring) · D32',
    desc:  'O HMS Daring é o navio líder da classe Type 45, destróieres de defesa aérea entre os mais avançados do mundo. Equipados com o sistema Sea Viper (PAAMS), rastreiam centenas de alvos aéreos e engajam vários ao mesmo tempo, inclusive mísseis supersônicos que voam rente ao mar.',
    color: 0x374a6e,
    type:  'destroyer',
    specs: [
      { label: 'Deslocamento',    value: '7.350 toneladas' },
      { label: 'Comprimento',     value: '152,4 m' },
      { label: 'Boca',            value: '21,2 m' },
      { label: 'Velocidade máx.', value: '30+ nós' },
      { label: 'Autonomia',       value: '7.000 nm' },
      { label: 'Tripulação',      value: '190 (máx. 235)' },
      { label: 'Propulsão',       value: 'IFEP — 2 turbinas WR-21' },
      { label: 'Comissionamento', value: '23 jul 2009' },
      { label: 'Construtor',      value: 'BAE Systems, Barrow' },
      { label: 'Classe',          value: '6 navios (D32–D37)' }
    ],
    armament: [
      '48x mísseis Sea Viper (Aster 15 e Aster 30) — PAAMS',
      '1x canhão 4,5" Mk 8 Mod 1 (calibre 114 mm)',
      '2x canhões 30 mm DS30M Mk2 ASCG',
      '2x Phalanx CIWS Block 1B',
      'Torpedos Sting Ray (via helicóptero Wildcat)',
      '1x helicóptero embarcado (Lynx / Wildcat HMA2)'
    ],
    history: 'Os Type 45 foram desenvolvidos para substituir os destróieres da Classe Sheffield (Type 42). O programa foi iniciado na década de 1990 como parte do projeto europeu PAAMS. O HMS Daring foi lançado em 1º de fevereiro de 2006 e comissionado em 2009. A classe notabilizou-se quando o HMS Dragon interceptou alvos durante exercícios que simulavam ataques com mísseis de cruzeiro. Em 2022, o HMS Dragon foi desdobrado para o Mediterrâneo durante tensões na região. A Marinha planeja atualizar a propulsão dos Type 45 com novos geradores a diesel no programa Power Improvement Project.'
  },

  'astute': {
    name:  'HMS Astute',
    class: 'Submarino Nuclear de Ataque · Classe Astute · S119',
    desc:  'O HMS Astute é um dos submarinos mais avançados já operados pela Royal Navy. Com propulsão nuclear e capacidade de circular o globo sem reabastecer, representa a vanguarda da guerra submarina moderna. Seu reator não necessita de recarga durante toda a vida útil do navio.',
    color: 0x1a2535,
    type:  'submarine',
    specs: [
      { label: 'Deslocamento',      value: '7.800 ton (submerso)' },
      { label: 'Comprimento',       value: '97 m' },
      { label: 'Boca',              value: '11,3 m' },
      { label: 'Velocidade máx.',   value: '29 nós (submerso)' },
      { label: 'Profundidade máx.', value: '> 300 m (classif.)' },
      { label: 'Tripulação',        value: '98 oficiais e praças' },
      { label: 'Propulsão',         value: 'Nuclear PWR2 — 1 reator' },
      { label: 'Comissionamento',   value: '27 ago 2010' },
      { label: 'Construtor',        value: 'BAE Systems, Barrow' },
      { label: 'Autonomia',         value: 'Ilimitada (reator)' }
    ],
    armament: [
      '38 armas no total: torpedos pesados Spearfish',
      'Mísseis de cruzeiro Tomahawk BGM-109 (alcance 1.600 km)',
      '6x tubos de torpedo de 533 mm',
      'Minas navais inteligentes Stonefish (opcional)',
      'Sistemas de guerra eletrônica Thales',
      'Sonar ativo e passivo de última geração (Thales 2076)'
    ],
    history: 'A classe Astute representa a quinta geração de submarinos nucleares britânicos, sucedendo a classe Swiftsure. O programa teve início em 1997, com contrato com a BAE Systems Submarine Solutions em Barrow-in-Furness. O HMS Astute foi lançado em junho de 2007, após uma construção complexa que envolveu mais de 10 milhões de componentes. Em 2010 encalhou temporariamente ao largo da Ilha de Skye durante exercícios de navegação. A classe inclui 7 submarinos planejados. O HMS Audacious foi comissionado em 2021 e o HMS Anson em 2022.'
  },

  'victory': {
    name:  'HMS Victory',
    class: 'Navio de Linha de Primeira Classe · Século XVIII',
    desc:  'O HMS Victory é o navio comissionado mais antigo do mundo ainda em serviço ativo. Navio-capitânia do Almirante Lord Nelson em Trafalgar, em 1805, tornou-se o símbolo máximo do poder naval britânico. Hoje está preservado em Portsmouth e é Monumento Nacional.',
    color: 0x5c4a1e,
    type:  'galleon',
    specs: [
      { label: 'Deslocamento',    value: '3.556 toneladas' },
      { label: 'Comprimento',     value: '69 m (casco)' },
      { label: 'Boca',            value: '15,8 m' },
      { label: 'Calado',          value: '8,8 m' },
      { label: 'Velas',           value: '37 velas — 5.440 m²' },
      { label: 'Tripulação',      value: '850 homens' },
      { label: 'Propulsão',       value: 'Vela — 3 mastros' },
      { label: 'Construção',      value: 'Chatham Dockyard, 1759' },
      { label: 'Comissionamento', value: '1778' },
      { label: 'Canhões',         value: '104 peças' }
    ],
    armament: [
      '30x canhões de 32 libras (convés inferior)',
      '28x canhões de 24 libras (convés médio)',
      '30x canhões de 12 libras (convés superior)',
      '12x canhões de 12 libras (castelo de proa/popa)',
      '2x carronadas de 68 libras',
      '2x canhões de caça de proa'
    ],
    history: 'Ordenado em 1758 pelo Rei George II, o HMS Victory teve a quilha assentada em Chatham em 23 de julho de 1759 e foi lançado ao mar em 1765. Seu nome foi escolhido em 1760, no rastro do "Ano das Vitórias" britânicas de 1759. Serviu como navio-capitânia em múltiplas campanhas e ficou eternamente ligado ao Almirante Horatio Nelson, que içou sua bandeira em 1805 para a campanha que culminou em Trafalgar. No dia 21 de outubro de 1805, Nelson dirigiu a batalha a bordo do Victory, sendo mortalmente ferido por um atirador francês por volta das 13h15. O navio está em doca seca em Portsmouth desde 1922.'
  },

  'type23': {
    name:  'HMS Westminster',
    class: 'Fragata · Classe Type 23 (Duke) · F237',
    desc:  'O HMS Westminster é uma das fragatas da Classe Type 23, que foi a espinha dorsal da frota de superfície da Royal Navy. Projetadas originalmente para a guerra antissubmarino na Guerra Fria, são extremamente versáteis e serviram em operações desde o Atlântico Norte até o Golfo Pérsico.',
    color: 0x2d4a6e,
    type:  'frigate',
    specs: [
      { label: 'Deslocamento',    value: '4.900 toneladas' },
      { label: 'Comprimento',     value: '133 m' },
      { label: 'Boca',            value: '16,1 m' },
      { label: 'Velocidade máx.', value: '28 nós' },
      { label: 'Autonomia',       value: '7.800 nm / 15 nós' },
      { label: 'Tripulação',      value: '185 (máx. 205)' },
      { label: 'Propulsão',       value: 'CODLAG — diesel-elétrico + turbina' },
      { label: 'Comissionamento', value: '13 mai 1994' },
      { label: 'Construtor',      value: 'Swan Hunter, Wallsend' },
      { label: 'Substituição',    value: 'Type 26 City Class (2026+)' }
    ],
    armament: [
      '1x canhão 4,5" Mk 8 (alcance 22 km)',
      '32x mísseis Sea Wolf / Sea Ceptor (CAMM)',
      '8x mísseis Harpoon SSM antissuperfície',
      '2x tubos de torpedo triplos 324 mm (Sting Ray)',
      '2x canhões 30 mm',
      '1x helicóptero Merlin HM2 ou Wildcat'
    ],
    history: 'As fragatas Type 23 foram projetadas no início da década de 1980 pela Yarrow Shipbuilders para patrulha antissubmarino no Atlântico Norte durante a Guerra Fria. Com o fim da Guerra Fria, o papel das Type 23 evoluiu para missões mais amplas. O HMS Westminster serviu em diversas missões de alto perfil, incluindo operações no Golfo Pérsico e patrulhas no Mediterrâneo durante a crise dos refugiados. A classe vem sendo gradualmente substituída pelas fragatas Type 26. O HMS Westminster foi modernizado entre 2014 e 2016 com novos sistemas de armas e sensores.'
  },

  'dreadnought': {
    name:  'HMS Dreadnought',
    class: 'Couraçado · Classe Dreadnought (1906)',
    desc:  'O HMS Dreadnought de 1906 foi o navio que redefiniu a guerra naval moderna. Com artilharia composta apenas por canhões pesados de 12 polegadas e propulsão a turbina a vapor, tornou obsoleto qualquer outro navio de guerra do planeta. Seu nome se tornou uma categoria inteira: "dreadnoughts".',
    color: 0x2a2a3e,
    type:  'battleship',
    specs: [
      { label: 'Deslocamento',    value: '18.120 ton (plena carga)' },
      { label: 'Comprimento',     value: '160,4 m' },
      { label: 'Boca',            value: '25 m' },
      { label: 'Calado',          value: '9,4 m' },
      { label: 'Velocidade máx.', value: '21 nós' },
      { label: 'Tripulação',      value: '773 homens' },
      { label: 'Propulsão',       value: '4 turbinas a vapor Parsons' },
      { label: 'Lançamento',      value: '10 fev 1906' },
      { label: 'Construtor',      value: 'HM Dockyard, Portsmouth' },
      { label: 'Construção',      value: 'Apenas 366 dias' }
    ],
    armament: [
      '10x canhões BL 12 polegadas / Mk X (em 5 torres duplas)',
      '27x canhões QF 12 libras 18 cwt (antitorpedeiro)',
      '5x tubos de torpedo submersos de 457 mm',
      'Casco blindado: 279 mm (cinturão) / 76 mm (convés)',
      'Torre principal: 305 mm de blindagem',
      'Salva lateral: 8 canhões de 12 polegadas'
    ],
    history: 'O HMS Dreadnought foi construído em segredo absoluto em apenas 366 dias, um recorde extraordinário que o Primeiro Lord do Mar, Almirante Fisher, usou deliberadamente para impressionar o mundo. Lançado em 10 de fevereiro de 1906 pelo Rei Eduardo VII, o navio imediatamente tornou obsoleta toda a frota de couraçados existente. A palavra "dreadnought" tornou-se sinônimo de supercouraçado em todas as línguas. O navio desencadeou uma corrida armamentista naval entre a Grã-Bretanha e a Alemanha Imperial que contribuiu para as tensões da Primeira Guerra Mundial. Ironicamente, o Dreadnought original nunca participou de uma grande batalha naval: afundou um submarino alemão por abalroamento em 1915 e foi desativado em 1919.'
  }

};
