/* ================================================================
   ROYAL NAVY — SHIPS DATABASE
   Complete data for all featured vessels
   ================================================================ */

const SHIPS_DATA = {

  'queen-elizabeth': {
    name:  'HMS Queen Elizabeth',
    class: 'Porta-Avioes · Classe Queen Elizabeth · R08',
    desc:  'O HMS Queen Elizabeth e o maior navio de guerra ja construido para a Marinha Real Britanica. Com 65.000 toneladas e 280 metros de comprimento, representa a projecao de poder naval do seculo XXI. Comissionado em 2017, opera como navio-capitania do Carrier Strike Group 21.',
    color: 0x4a5568,
    type:  'carrier',
    specs: [
      { label: 'Deslocamento',    value: '65.000 toneladas' },
      { label: 'Comprimento',     value: '280 m' },
      { label: 'Boca',            value: '39 m' },
      { label: 'Velocidade Max.', value: '25 nos' },
      { label: 'Autonomia',       value: '10.000 nm' },
      { label: 'Tripulacao',      value: '679 + 900 aviacao' },
      { label: 'Propulsao',       value: 'CODLAG — 2 turbinas' },
      { label: 'Comissionamento', value: '7 dez 2017' },
      { label: 'Construtor',      value: 'Aircraft Carrier Alliance' },
      { label: 'Custo',           value: '3.1 bilhoes de libras' }
    ],
    armament: [
      '3x Phalanx CIWS 20 mm (defesa antimissil)',
      '4x miniguns de 30 mm ASCG',
      'Ate 36x aeronaves F-35B Lightning II',
      'Helicopteros Merlin HM2 / Wildcat AH1',
      'Drones Protector RG Mk1',
      'Capacidade para Crowsnest AEW&C'
    ],
    history: 'O projeto do porta-avioes britanico foi aprovado em 1998 como parte do programa Future Aircraft Carrier (CVF). A construcao foi distribuida por seis estaleiros no Reino Unido e a montagem final ocorreu em Rosyth, Escocia. O navio foi colocado a agua em julho de 2014 pela Rainha Elizabeth II e comissionado em dezembro de 2017. Em 2021 liderou o Carrier Strike Group 21 em missao de 28 semanas pelo Indo-Pacifico, marcando a maior projecao naval britanica em decadas. Seu gemeo, HMS Prince of Wales (R09), foi comissionado em 2019.'
  },

  'type45': {
    name:  'HMS Daring',
    class: 'Destroier · Classe Type 45 (Daring) · D32',
    desc:  'O HMS Daring e o navio lider da classe Type 45, os mais avancados destroieres de defesa aerea do mundo. Equipados com o sistema Sea Viper (PAAMS), sao capazes de rastrear e destruir simultaneamente centenas de alvos aereos, incluindo misseis hipersonicos.',
    color: 0x374a6e,
    type:  'destroyer',
    specs: [
      { label: 'Deslocamento',    value: '7.350 toneladas' },
      { label: 'Comprimento',     value: '152,4 m' },
      { label: 'Boca',            value: '21,2 m' },
      { label: 'Velocidade Max.', value: '30+ nos' },
      { label: 'Autonomia',       value: '7.000 nm' },
      { label: 'Tripulacao',      value: '190 (max 235)' },
      { label: 'Propulsao',       value: 'IFEP — 2 turbinas WR-21' },
      { label: 'Comissionamento', value: '23 jul 2009' },
      { label: 'Construtor',      value: 'BAE Systems, Barrow' },
      { label: 'Classe',          value: '6 navios (D32–D37)' }
    ],
    armament: [
      '48x misseis Sea Viper (Aster 15 e Aster 30) — PAAMS',
      '1x canhao 4,5" Mk 8 Mod 1 (calibre 114 mm)',
      '2x canhoes 30 mm DS30M Mk2 ASCG',
      '2x Phalanx CIWS Block 1B',
      'Torpedos Sting Ray (via helicoptero Wildcat)',
      '1x helicoptero embarcado (Lynx / Wildcat HMA2)'
    ],
    history: 'Os Type 45 foram desenvolvidos para substituir os destroieres Classe Sheffield. O programa foi iniciado na decada de 1990 como parte do projeto europeu PAAMS. O HMS Daring foi lancado em 1o de fevereiro de 2006 e comissionado em 2009. A classe notabilizou-se quando o HMS Dragon interceptou alvos durante exercicios que simulavam ataques com misseis de cruzeiro. Em 2022, o HMS Dragon foi desdobrado para o Mediterraneo durante tensoes na regiao. A Marinha planeja atualizar as propulsoes dos Type 45 com novos geradores a diesel no programa Power Improvement Project.'
  },

  'astute': {
    name:  'HMS Astute',
    class: 'Submarino Nuclear de Ataque · Classe Astute · S119',
    desc:  'O HMS Astute e o submarino mais avancado ja operado pela Royal Navy. Com propulsao nuclear e capacidade de circular o globo sem ressuprir, representa a vanguarda da guerra submarina moderna. Seu reator nao necessita de recarga durante toda a vida util do navio.',
    color: 0x1a2535,
    type:  'submarine',
    specs: [
      { label: 'Deslocamento',      value: '7.800 ton (submerso)' },
      { label: 'Comprimento',       value: '97 m' },
      { label: 'Boca',              value: '11,3 m' },
      { label: 'Velocidade Max.',   value: '29 nos (submerso)' },
      { label: 'Profundidade Max.', value: '> 300 m (classif.)' },
      { label: 'Tripulacao',        value: '98 oficiais e pracas' },
      { label: 'Propulsao',         value: 'Nuclear PWR2 — 1 reator' },
      { label: 'Comissionamento',   value: '27 ago 2010' },
      { label: 'Construtor',        value: 'BAE Systems, Barrow' },
      { label: 'Autonomia',         value: 'Ilimitada (reator)' }
    ],
    armament: [
      '38 cargas totais: torpedos pesados Spearfish',
      'Misseis de cruzeiro Tomahawk BGM-109 (alcance 1.600 km)',
      '6x tubos de torpedo de 533 mm',
      'Minas navais inteligentes Stonefish (opcional)',
      'Sistemas de guerra eletronica Thales',
      'Sonar ativo e passivo de ultima geracao (Thales 2076)'
    ],
    history: 'A classe Astute representa a quinta geracao de submarinos nucleares britanicos, sucedendo a classe Swiftsure. O programa teve inicio em 1997 com contrato com a BAE Systems Submarine Solutions em Barrow-in-Furness. O HMS Astute foi lancado em junho de 2007 apos uma construcao complexa que envolveu mais de 10 milhoes de componentes. Em 2010 encalhou temporariamente ao largo da Ilha de Skye durante exercicios de navegacao. A classe inclui 7 submarinos planejados. O HMS Audacious foi comissionado em 2020 e o HMS Anson em 2022.'
  },

  'victory': {
    name:  'HMS Victory',
    class: 'Navio de Linha de Primeiro Posto · Seculo XVIII',
    desc:  'O HMS Victory e o navio comissionado mais antigo do mundo ainda em servico ativo. Navio-capitania do Almirante Lord Nelson em Trafalgar, 1805, tornou-se o simbolo maximo do poder naval britanico. Hoje esta preservado em Portsmouth e e Monumento Nacional.',
    color: 0x5c4a1e,
    type:  'galleon',
    specs: [
      { label: 'Deslocamento',    value: '3.556 toneladas' },
      { label: 'Comprimento',     value: '69 m (casco)' },
      { label: 'Boca',            value: '15,8 m' },
      { label: 'Calado',          value: '8,8 m' },
      { label: 'Velas',           value: '37 velas — 5.440 m2' },
      { label: 'Tripulacao',      value: '850 homens' },
      { label: 'Propulsao',       value: 'Vela — 3 mastros' },
      { label: 'Construcao',      value: 'Chatham Dockyard, 1759' },
      { label: 'Comissionamento', value: '1778' },
      { label: 'Canhoes',         value: '104 pecas' }
    ],
    armament: [
      '30x canhoes de 32 libras (convés inferior)',
      '28x canhoes de 24 libras (convés medio)',
      '30x canhoes de 12 libras (convés superior)',
      '12x canhoes de 12 libras (castelo de proa/popa)',
      '2x canhoes de 68 libras carronades',
      '2x canhoes de cacada de proa'
    ],
    history: 'Ordenado em 1758 pelo Rei George II, o HMS Victory foi posto a quilha em Chatham em 23 de julho de 1759 e lancado ao mar em 1765. Seu nome honra a Batalha de Cape Finisterre de 1747. Serviu como navio-capitania em multiplas campanhas e ficou eternamente ligado ao Almirante Horatio Nelson, que icou sua bandeira em 1805 para a campanha que culminou em Trafalgar. No dia 21 de outubro de 1805, Nelson dirigiu a batalha a bordo do Victory, sendo mortalmente ferido por um atirador frances as 13h15. O navio esta em doca seca em Portsmouth desde 1922.'
  },

  'type23': {
    name:  'HMS Westminster',
    class: 'Fragata · Classe Type 23 (Duke) · F237',
    desc:  'O HMS Westminster e uma das 13 fragatas da Classe Type 23, a espinha dorsal da frota de superficie da Royal Navy atual. Projetadas originalmente para guerra anti-submarina na Guerra Fria, sao extremamente versateis e tem servido em operacoes desde o Atlantico Norte ate o Golfo Persico.',
    color: 0x2d4a6e,
    type:  'frigate',
    specs: [
      { label: 'Deslocamento',    value: '4.900 toneladas' },
      { label: 'Comprimento',     value: '133 m' },
      { label: 'Boca',            value: '16,1 m' },
      { label: 'Velocidade Max.', value: '28 nos' },
      { label: 'Autonomia',       value: '7.800 nm / 15 nos' },
      { label: 'Tripulacao',      value: '185 (max 205)' },
      { label: 'Propulsao',       value: 'CODLAG — diesel-eletrico + turbina' },
      { label: 'Comissionamento', value: '13 mai 1993' },
      { label: 'Construtor',      value: 'Swan Hunter, Wallsend' },
      { label: 'Substituicao',    value: 'Type 26 City Class (2026+)' }
    ],
    armament: [
      '1x canhao 4,5" Mk 8 (alcance 22 km)',
      '32x misseis Sea Wolf / Sea Ceptor (CAMM)',
      '8x misseis Harpoon SSM anti-superficie',
      '2x tubos torpedo triplos 324 mm (Sting Ray)',
      '2x miniguns 30 mm',
      '1x helicoptero Merlin HM2 ou Wildcat'
    ],
    history: 'As fragatas Type 23 foram projetadas no inicio da decada de 1980 pela Yarrow Shipbuilders para patrulha anti-submarina no Atlantico Norte durante a Guerra Fria. Com o fim da Guerra Fria, o papel das Type 23 evoluiu para missoes mais amplas. O HMS Westminster serviu em diversas missoes de alto perfil, incluindo operacoes no Golfo Persico e patrulhas no Mediterraneo durante a crise dos refugiados. A classe sera gradualmente substituida pelas fragatas Type 26 a partir de 2026. O HMS Westminster foi modernizado entre 2014 e 2016 com novos sistemas de armas e sensores.'
  },

  'dreadnought': {
    name:  'HMS Dreadnought',
    class: 'Couracado · Classe Dreadnought (1906)',
    desc:  'O HMS Dreadnought de 1906 foi o navio que redefiniu a guerra naval moderna. Com artilharia exclusivamente de canhoes pesados de 12 polegadas e propulsao a turbina a vapor, tornava obsoleto qualquer outro navio de guerra do planeta. Seu nome se tornou uma categoria inteira: "dreadnoughts".',
    color: 0x2a2a3e,
    type:  'battleship',
    specs: [
      { label: 'Deslocamento',    value: '18.120 ton (plena carga)' },
      { label: 'Comprimento',     value: '160,4 m' },
      { label: 'Boca',            value: '25 m' },
      { label: 'Calado',          value: '9,4 m' },
      { label: 'Velocidade Max.', value: '21 nos' },
      { label: 'Tripulacao',      value: '773 homens' },
      { label: 'Propulsao',       value: '4 turbinas a vapor Parsons' },
      { label: 'Lancamento',      value: '10 fev 1906' },
      { label: 'Construtor',      value: 'HM Dockyard, Portsmouth' },
      { label: 'Construcao',      value: 'Apenas 366 dias' }
    ],
    armament: [
      '10x canhoes BL 12 polegadas / Mk X (em 5 torres duplas)',
      '27x canhoes QF 12 libras 18 cwt (anti-torpedeiro)',
      '5x tubos torpedo submersos de 457 mm',
      'Casco blindado: 279 mm (cinturao) / 76 mm (convés)',
      'Torre principal: 305 mm de blindagem',
      'Salva lateral: 8 canhoes de 12 polegadas'
    ],
    history: 'O HMS Dreadnought foi construido em segredo absoluto em apenas 366 dias, um recorde extraordinario que o Primeiro Lord do Mar, Almirante Fisher, usou deliberadamente para impressionar o mundo. Lancado em 10 de fevereiro de 1906 pelo Rei Eduardo VII, o navio imediatamente tornou toda a frota de couracados existente obsoleta. A palavra "dreadnought" tornou-se sinonimo de supercouracado em todas as linguas. O navio desencadeou uma corrida armamentista naval entre a Gra-Bretanha e a Alemanha Imperial que contribuiu para as tensoes da Primeira Guerra Mundial. Ironicamente, o Dreadnought original nunca participou de uma grande batalha naval — foi desativado em 1919 apos afundar um submarino alemao com uma manobra de ramming.'
  }

};
