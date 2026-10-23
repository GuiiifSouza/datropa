/**
 * Cartão do jogador para story (1080×1920). Desenhado num <canvas> no próprio navegador:
 * a prévia é a imagem final, e "Baixar" salva exatamente o que aparece. Sem dependência nova.
 */
import { useEffect, useRef, useState } from 'react';
import { COR_AGENTE, corpoAgente } from '../util/arteAgentes';
import { logoTime } from '../util/logosTimes';

export type DadosStory = {
  nome: string; time?: string | null; agente?: string | null; mapas: number; vitoriaPct?: number | null;
  numeros: { v: string; l: string; pos?: string }[];
};

const W = 1080, H = 1920;
const FD = '"Big Shoulders Display", "Arial Narrow", sans-serif';
const FM = '"JetBrains Mono", ui-monospace, monospace';
const FT = '"Inter Tight", system-ui, sans-serif';

function carregar(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
}

function slug(nome: string) { return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, ''); }

function caberTexto(ctx: CanvasRenderingContext2D, txt: string, peso: string, tam: number, fam: string, max: number) {
  let t = tam;
  do { ctx.font = `${peso} ${t}px ${fam}`; t -= 4; } while (ctx.measureText(txt).width > max && t > 40);
}

function caixa(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

async function desenhar(canvas: HTMLCanvasElement, d: DadosStory) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  await Promise.all([document.fonts?.load(`900 100px ${FD}`), document.fonts?.load(`500 30px ${FM}`), document.fonts?.load(`600 30px ${FT}`)].map((p) => p?.catch(() => null)));
  const s = d.agente ? slug(d.agente) : '';
  const cor = COR_AGENTE[s] ?? '#FF4655';
  const [corpo, logo] = await Promise.all([carregar(corpoAgente(s)), carregar(logoTime(d.time))]);

  // fundo
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16212C'); g.addColorStop(.7, '#0F1923'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const r = ctx.createRadialGradient(540, 620, 40, 540, 620, 900); r.addColorStop(0, cor + 'AA'); r.addColorStop(1, cor + '00'); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  // nome do agente vazado
  if (d.agente) { ctx.save(); ctx.font = `900 500px ${FD}`; ctx.strokeStyle = cor + '99'; ctx.lineWidth = 4; ctx.strokeText(d.agente.toUpperCase(), -20, 560); ctx.restore(); }
  // retrato
  if (corpo) ctx.drawImage(corpo, -120, 140, 1320, 1320 * (corpo.height / corpo.width));
  const base = ctx.createLinearGradient(0, 1050, 0, 1560); base.addColorStop(0, 'rgba(15,25,35,0)'); base.addColorStop(.55, 'rgba(15,25,35,.92)'); base.addColorStop(1, '#0F1923');
  ctx.fillStyle = base; ctx.fillRect(0, 1050, W, H - 1050);

  // topo: marca
  ctx.save(); ctx.translate(86, 92); ctx.rotate(-6 * Math.PI / 180); ctx.fillStyle = '#FF4655'; caixa(ctx, -30, -30, 60, 60, 18); ctx.fill();
  ctx.fillStyle = '#0F1923'; ctx.font = `900 36px ${FD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('DT', 0, 2); ctx.restore();
  ctx.fillStyle = '#ECE8E1'; ctx.font = `900 42px ${FD}`; ctx.textBaseline = 'middle'; ctx.fillText('DA TROPA', 136, 94);

  // bloco de baixo
  let y = 1330;
  ctx.textBaseline = 'alphabetic';
  if (logo) ctx.drawImage(logo, 60, y - 70, 88, 88);
  ctx.fillStyle = '#ECE8E1'; ctx.font = `600 38px ${FT}`; ctx.fillText(d.time ?? '', logo ? 166 : 60, y - 12);
  y += 150;
  caberTexto(ctx, d.nome.toUpperCase(), '900', 190, FD, W - 120);
  ctx.fillStyle = '#ECE8E1'; ctx.fillText(d.nome.toUpperCase(), 56, y);
  y += 62;
  ctx.font = `500 28px ${FM}`; ctx.fillStyle = cor === '#FF4655' ? '#FF8A94' : mistura(cor);
  ctx.fillText([d.agente?.toUpperCase(), `${d.mapas} MAPAS`, d.vitoriaPct != null ? `${Math.round(d.vitoriaPct)}% DE VITÓRIA` : null].filter(Boolean).join('  ·  '), 60, y);
  // números
  y += 46;
  const bw = (W - 120 - 2 * 20) / 3;
  d.numeros.slice(0, 3).forEach((n, i) => {
    const x = 60 + i * (bw + 20);
    ctx.fillStyle = 'rgba(28,42,54,.92)'; caixa(ctx, x, y, bw, 200, 34); ctx.fill();
    ctx.strokeStyle = 'rgba(236,232,225,.1)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ECE8E1'; caberTexto(ctx, n.v, '900', 92, FD, bw - 56); ctx.fillText(n.v, x + 28, y + 100);
    ctx.fillStyle = '#9AA6B2'; ctx.font = `500 24px ${FM}`; ctx.fillText(n.l.toUpperCase(), x + 28, y + 142);
    if (n.pos) { ctx.fillStyle = '#F9A23B'; ctx.font = `600 24px ${FT}`; ctx.fillText(n.pos, x + 28, y + 178); }
  });
  // rodapé
  ctx.strokeStyle = 'rgba(236,232,225,.1)'; ctx.beginPath(); ctx.moveTo(60, 1840); ctx.lineTo(W - 60, 1840); ctx.stroke();
  ctx.fillStyle = '#9AA6B2'; ctx.font = `500 22px ${FM}`; ctx.fillText('DA TROPA · DADOS OFICIAIS DO CAMPEONATO', 60, 1882);
  ctx.textAlign = 'right'; ctx.fillText(new Date().toLocaleDateString('pt-BR'), W - 60, 1882); ctx.textAlign = 'left';
}

// clareia a cor do agente para texto pequeno
function mistura(hex: string) {
  const n = parseInt(hex.slice(1), 16), c = (v: number) => Math.round(v + (255 - v) * 0.5);
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

export function StoryJogador({ dados: d, fechar }: { dados: DadosStory; fechar: () => void }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const [pronto, setPronto] = useState(false);
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    if (tela.current) desenhar(tela.current, d).then(() => setPronto(true));
    const html = document.documentElement; html.classList.add('rolagem-presa');
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', esc);
    return () => { html.classList.remove('rolagem-presa'); window.removeEventListener('keydown', esc); };
  }, [d, fechar]);

  const arquivo = () => new Promise<Blob | null>((ok) => tela.current?.toBlob(ok, 'image/png') ?? ok(null));
  const nomeArq = `datropa-${slug(d.nome) || 'jogador'}.png`;
  const baixar = async () => {
    const b = await arquivo(); if (!b) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nomeArq; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); setAviso('Imagem salva.');
  };
  const compartilhar = async () => {
    const b = await arquivo(); if (!b) return;
    const f = new File([b], nomeArq, { type: 'image/png' });
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], title: d.nome }); } catch { /* cancelado */ } }
    else baixar();
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(window.location.href); setAviso('Link copiado.'); } catch { setAviso('Não deu para copiar.'); } };

  return (
    <div className="story-veu" onClick={fechar}>
      <div className="story" role="dialog" aria-modal="true" aria-label={`Cartão de ${d.nome} para story`} onClick={(e) => e.stopPropagation()}>
        <div className="story__topo">
          <span className="rotulo rotulo--vermelho">COMPARTILHAR · STORY 1080×1920</span>
          <button type="button" className="botao-quadrado" onClick={fechar} aria-label="Fechar">✕</button>
        </div>
        <div className={`story__tela${pronto ? ' story__tela--pronta' : ''}`}>
          <canvas ref={tela} width={W} height={H} aria-label={`Prévia do cartão de ${d.nome}`} />
        </div>
        <div className="story__acoes">
          <button type="button" className="botao botao--ia" onClick={compartilhar} disabled={!pronto}>Compartilhar</button>
          <button type="button" className="botao botao--linha" onClick={baixar} disabled={!pronto}>Baixar imagem</button>
          <button type="button" className="botao botao--linha" onClick={copiar}>Copiar link</button>
        </div>
        <span className="apagado story__aviso" role="status">{aviso}</span>
      </div>
    </div>
  );
}
