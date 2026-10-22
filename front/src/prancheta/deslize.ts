/**
 * Pílula que desliza entre os botões dos grupos segmentados da prancheta (Abates/Mortes/Plants, Lado, Momento,
 * Compra, Mancha/Pontos...), igual ao trilho das abas do topo (.trilho .deslize, com posição fixa no molde).
 *
 * Aqui os botões têm larguras diferentes, então a posição sai da medida real do botão ativo: todo pai de um
 * .seg.on (fora de .trilho) ganha data-desliza e as variáveis --dz-*, e o ::before desenha a pílula (CSS no
 * exportar_prancheta.py). Só atributos que o React não controla são tocados.
 */
export function ligarDeslize(raiz: HTMLElement): () => void {
  let quadro = 0;

  const atualizar = () => {
    quadro = 0;
    raiz.querySelectorAll<HTMLElement>('.seg.on').forEach((ativo) => {
      const grupo = ativo.parentElement;
      if (!grupo || grupo.classList.contains('trilho')) return;
      const g = grupo.getBoundingClientRect();
      const b = ativo.getBoundingClientRect();
      if (!g.width || !b.width) return; // grupo escondido: mede quando aparecer
      const novo = !grupo.dataset.desliza;
      grupo.dataset.desliza = '';
      grupo.style.setProperty('--dz-x', `${b.left - g.left - grupo.clientLeft}px`);
      grupo.style.setProperty('--dz-y', `${b.top - g.top - grupo.clientTop}px`);
      grupo.style.setProperty('--dz-w', `${b.width}px`);
      grupo.style.setProperty('--dz-h', `${b.height}px`);
      // na primeira medida a pílula já nasce no lugar; só depois as trocas animam
      if (novo) requestAnimationFrame(() => { grupo.dataset.deslizaPronto = ''; });
    });
  };
  const agendar = () => { if (!quadro) quadro = requestAnimationFrame(atualizar); };

  const mo = new MutationObserver(agendar);
  mo.observe(raiz, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  const ro = new ResizeObserver(agendar);
  ro.observe(raiz);
  agendar();

  return () => {
    mo.disconnect();
    ro.disconnect();
    if (quadro) cancelAnimationFrame(quadro);
  };
}
