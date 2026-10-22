/**
 * Movimento do site como um todo:
 * - holofote: cartões ganham um brilho que segue o ponteiro;
 * - revelação: blocos abaixo da dobra sobem e aparecem quando entram na tela
 *   (o que já está visível ao carregar nunca fica escondido);
 * - header compacta ao rolar;
 * - Contador: números que contam até o valor.
 * Quem pede menos movimento no sistema não recebe nada disso.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocal } from '../rotas';

const menosMovimento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const HOLOFOTE = '.cartao, .serie, .figura, .kpi, .metrica, .fato, .sugestao, .destaque-jogador, .agente-meta, .banner-prancheta';
const REVELA = '.figura, .cartao, .serie, .kpi, .fato, .metrica, .agente-meta, .mapa-meta, .destaque-jogador, .banner-prancheta, .lider, .dia__topo';

export function MotorDeVida() {
  const { caminho } = useLocal();

  // Holofote e header: listeners globais, uma vez só.
  useEffect(() => {
    if (menosMovimento()) return;
    const mover = (e: PointerEvent) => {
      const alvo = (e.target as Element | null)?.closest?.(HOLOFOTE) as HTMLElement | null;
      if (!alvo) return;
      const r = alvo.getBoundingClientRect();
      alvo.style.setProperty('--mx', `${e.clientX - r.left}px`);
      alvo.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    const rolar = () => document.documentElement.toggleAttribute('data-rolou', window.scrollY > 12);
    document.addEventListener('pointermove', mover, { passive: true });
    window.addEventListener('scroll', rolar, { passive: true });
    rolar();
    return () => {
      document.removeEventListener('pointermove', mover);
      window.removeEventListener('scroll', rolar);
    };
  }, []);

  // Revelação: reexamina a página a cada troca de rota e quando o conteúdo carrega.
  useEffect(() => {
    if (menosMovimento() || !('IntersectionObserver' in window)) return;
    const raiz = document.getElementById('conteudo');
    if (!raiz) return;
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.revela = '1';
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    const vistos = new WeakSet<Element>();
    const varrer = () => {
      raiz.querySelectorAll<HTMLElement>(REVELA).forEach((el) => {
        if (vistos.has(el)) return;
        vistos.add(el);
        // Filho direto da página já tem a animação de entrada; e o que está na tela fica como está.
        if (el.parentElement?.classList.contains('pagina')) return;
        if (el.getBoundingClientRect().top < window.innerHeight) return;
        el.dataset.revela = '0';
        io.observe(el);
      });
    };
    varrer();
    const mo = new MutationObserver(() => varrer());
    mo.observe(raiz, { childList: true, subtree: true });
    return () => { mo.disconnect(); io.disconnect(); };
  }, [caminho]);

  return null;
}

/** Número que conta de 0 até o valor quando aparece. `formato` recebe o valor parcial. */
export function Contador({ valor, formato, duracao = 1100 }: { valor: number | null | undefined; formato: (v: number | null) => string; duracao?: number }) {
  const [atual, setAtual] = useState<number | null>(menosMovimento() ? valor ?? null : 0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (valor == null || !Number.isFinite(valor)) { setAtual(valor ?? null); return; }
    if (menosMovimento()) { setAtual(valor); return; }
    let quadro = 0;
    let inicio = 0;
    const animar = (t: number) => {
      inicio ||= t;
      const p = Math.min(1, (t - inicio) / duracao);
      const suave = 1 - Math.pow(1 - p, 4);
      setAtual(p >= 1 ? valor : valor * suave);
      if (p < 1) quadro = requestAnimationFrame(animar);
    };
    const comecar = () => { quadro = requestAnimationFrame(animar); };
    const el = ref.current;
    if (el && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { comecar(); io.disconnect(); } });
      io.observe(el);
      return () => { io.disconnect(); cancelAnimationFrame(quadro); };
    }
    comecar();
    return () => cancelAnimationFrame(quadro);
  }, [valor, duracao]);
  return <span ref={ref} className="contador">{formato(atual)}</span>;
}
