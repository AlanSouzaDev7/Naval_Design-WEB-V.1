/* ═══════════════════════════════════════════════════════════════
   ROYAL NAVY — CÁLCULOS ASTRONÔMICOS (página Navegação pelas Estrelas)
   ───────────────────────────────────────────────────────────────
   Tudo no navegador, sem servidor (funciona também no GitHub Pages):
   • tempo sideral (GMST) e coordenadas horizontais (altura/azimute);
   • precessão J2000 → data (Meeus, cap. 21): o céu de 1707 sai no lugar certo;
   • planetas pelos elementos keplerianos aproximados da NASA/JPL
     (E. M. Standish, tabelas 2a/2b, válidas de 3000 a.C. a 3000 d.C.);
   • Lua pela fórmula de baixa precisão do Astronomical Almanac (~0,3°);
   • projeção estereográfica (a mesma dos planisférios e astrolábios).
   Exposto como window.RNAstro.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const norm = a => ((a % 360) + 360) % 360;
  const sin = a => Math.sin(a * RAD), cos = a => Math.cos(a * RAD);

  /* Dia juliano a partir de uma data JS (UTC) */
  const jd = date => date.getTime() / 86400000 + 2440587.5;

  /* Tempo sideral médio de Greenwich, em graus (IAU 1982) */
  function gmst(J) {
    const T = (J - 2451545.0) / 36525;
    return norm(280.46061837 + 360.98564736629 * (J - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000);
  }

  /* Precessão de J2000 para a data (Meeus 21.2–21.4). ra/dec em graus. */
  function precessa(ra, dec, J) {
    const T = (J - 2451545.0) / 36525;
    const z1 = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) / 3600;
    const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) / 3600;
    const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) / 3600;
    const A = cos(dec) * sin(ra + z1);
    const B = cos(th) * cos(dec) * cos(ra + z1) - sin(th) * sin(dec);
    const C = sin(th) * cos(dec) * cos(ra + z1) + cos(th) * sin(dec);
    return [norm(Math.atan2(A, B) * DEG + z), Math.asin(Math.max(-1, Math.min(1, C))) * DEG];
  }

  /* (ra, dec) da data → [altura, azimute] para latitude e tempo sideral local (graus). Azimute a partir do Norte, para Leste. */
  function horizontais(ra, dec, lat, lst) {
    const H = lst - ra;
    const alt = Math.asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H)) * DEG;
    const az = Math.atan2(-cos(dec) * sin(H), sin(dec) * cos(lat) - cos(dec) * sin(lat) * cos(H)) * DEG;
    return [alt, norm(az)];
  }

  /* ── Planetas: elementos e taxas por século (J2000), tabelas 2a e 2b da NASA/JPL ── */
  const EL = {
    mercurio: [0.38709843, 0, 0.20563661, 0.00002123, 7.00559432, -0.00590158, 252.25166724, 149472.67486623, 77.45771895, 0.15940013, 48.33961819, -0.12214182],
    venus:    [0.72332102, -0.00000026, 0.00676399, -0.00005107, 3.39777545, 0.00043494, 181.97970850, 58517.81560260, 131.76755713, 0.05679648, 76.67261496, -0.27274174],
    terra:    [1.00000018, -0.00000003, 0.01673163, -0.00003661, -0.00054346, -0.01337178, 100.46691572, 35999.37306329, 102.93005885, 0.31795260, -5.11260389, -0.24123856],
    marte:    [1.52371243, 0.00000097, 0.09336511, 0.00009149, 1.85181869, -0.00724757, -4.56813164, 19140.29934243, -23.91744784, 0.45223625, 49.71320984, -0.26852431],
    jupiter:  [5.20248019, -0.00002864, 0.04853590, 0.00018026, 1.29861416, -0.00322699, 34.33479152, 3034.90371757, 14.27495244, 0.18199196, 100.29282654, 0.13024619],
    saturno:  [9.54149883, -0.00003065, 0.05550825, -0.00032044, 2.49424102, 0.00451969, 50.07571329, 1222.11494724, 92.86136063, 0.54179478, 113.63998702, -0.25015002],
    urano:    [19.18797948, -0.00020455, 0.04685740, -0.00001550, 0.77298127, -0.00180155, 314.20276625, 428.49512595, 172.43404441, 0.09266985, 73.96250215, 0.05739699],
    netuno:   [30.06952752, 0.00006447, 0.00895439, 0.00000818, 1.77005520, 0.00022400, 304.22289287, 218.46515314, 46.68158724, 0.01009938, 131.78635853, -0.00606302]
  };
  const EXTRA = {   // b, c, s, f (termos adicionais de M para os planetas gigantes)
    jupiter: [-0.00012452, 0.06064060, -0.35635438, 38.35125000],
    saturno: [0.00025899, -0.13434469, 0.87320147, 38.35125000],
    urano:   [0.00058331, -0.97731848, 0.17689245, 7.67025000],
    netuno:  [-0.00041348, 0.68346318, -0.10162547, 7.67025000]
  };

  /* Posição heliocêntrica eclíptica (J2000, em UA) */
  function helio(nome, J) {
    const T = (J - 2451545.0) / 36525, e0 = EL[nome];
    const a = e0[0] + e0[1] * T, e = e0[2] + e0[3] * T, I = e0[4] + e0[5] * T;
    const L = e0[6] + e0[7] * T, wbar = e0[8] + e0[9] * T, O = e0[10] + e0[11] * T;
    const w = wbar - O;
    let M = L - wbar;
    const x = EXTRA[nome];
    if (x) M += x[0] * T * T + x[1] * cos(x[3] * T) + x[2] * sin(x[3] * T);
    M = norm(M + 180) - 180;
    const es = e * DEG;
    let E = M + es * sin(M);
    for (let k = 0; k < 12; k++) {
      const dE = (M - (E - es * sin(E))) / (1 - e * cos(E));
      E += dE;
      if (Math.abs(dE) < 1e-6) break;
    }
    const xp = a * (cos(E) - e), yp = a * Math.sqrt(1 - e * e) * sin(E);
    return [
      (cos(w) * cos(O) - sin(w) * sin(O) * cos(I)) * xp + (-sin(w) * cos(O) - cos(w) * sin(O) * cos(I)) * yp,
      (cos(w) * sin(O) + sin(w) * cos(O) * cos(I)) * xp + (-sin(w) * sin(O) + cos(w) * cos(O) * cos(I)) * yp,
      (sin(w) * sin(I)) * xp + (cos(w) * sin(I)) * yp
    ];
  }

  const OBL = 23.43928;
  function eclParaEq(x, y, z) {
    const ye = cos(OBL) * y - sin(OBL) * z, ze = sin(OBL) * y + cos(OBL) * z;
    return [norm(Math.atan2(ye, x) * DEG), Math.atan2(ze, Math.hypot(x, ye)) * DEG, Math.hypot(x, y, z)];
  }

  /* Planeta ou Sol visto da Terra: [ra, dec] J2000, distância em UA */
  function geocentrico(nome, J) {
    const t = helio('terra', J);
    if (nome === 'sol') return eclParaEq(-t[0], -t[1], -t[2]);
    const p = helio(nome, J);
    return eclParaEq(p[0] - t[0], p[1] - t[1], p[2] - t[2]);
  }

  /* Lua (equinócio da data), fórmula de baixa precisão do Astronomical Almanac */
  function lua(J) {
    const T = (J - 2451545.0) / 36525;
    const lam = 218.32 + 481267.881 * T + 6.29 * sin(135.0 + 477198.87 * T) - 1.27 * sin(259.3 - 413335.36 * T)
      + 0.66 * sin(235.7 + 890534.22 * T) + 0.21 * sin(269.9 + 954397.74 * T)
      - 0.19 * sin(357.5 + 35999.05 * T) - 0.11 * sin(186.5 + 966404.03 * T);
    const bet = 5.13 * sin(93.3 + 483202.02 * T) + 0.28 * sin(228.2 + 960400.89 * T)
      - 0.28 * sin(318.3 + 6003.15 * T) - 0.17 * sin(217.6 - 407332.21 * T);
    const x = cos(bet) * cos(lam), y = cos(bet) * sin(lam), z = sin(bet);
    const r = eclParaEq(x, y, z);
    return [r[0], r[1]];
  }

  /* Projeção estereográfica centrada no zênite: devolve [x, y] em unidades do raio do horizonte (1 = horizonte).
     Norte para cima e Leste à ESQUERDA, como num mapa do céu segurado sobre a cabeça. */
  function estereografica(alt, az) {
    const r = Math.tan((90 - alt) * RAD / 2);
    return [-r * sin(az), -r * cos(az)];
  }

  /* Cor aproximada de uma estrela a partir do índice B−V */
  function corBV(bv) {
    if (bv < 0) return [170, 191, 255];
    if (bv < 0.3) return [202, 216, 255];
    if (bv < 0.6) return [248, 247, 255];
    if (bv < 0.8) return [255, 244, 234];
    if (bv < 1.2) return [255, 222, 180];
    if (bv < 1.5) return [255, 196, 140];
    return [255, 170, 120];
  }

  window.RNAstro = { jd, gmst, precessa, horizontais, helio, geocentrico, lua, estereografica, corBV, norm, RAD, DEG };
})();
