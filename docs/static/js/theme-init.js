/* Aplica o tema salvo ANTES da primeira pintura (evita piscar claro -> escuro).
   Fica em arquivo próprio (e não inline) por causa da Content-Security-Policy. */
(function () {
  var mode = 'light';
  try {
    if (localStorage.getItem('rn-theme') === 'dark') mode = 'dark';
  } catch (e) { /* armazenamento bloqueado: segue no claro */ }
  document.documentElement.setAttribute('data-theme', mode);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta && mode === 'dark') meta.setAttribute('content', '#050b14');
})();
