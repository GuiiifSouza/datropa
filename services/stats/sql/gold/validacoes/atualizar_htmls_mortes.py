"""Atualiza os HTMLs locais dos testes sem consultar ou modificar o BigQuery.

Execute na raiz do checkout: python3 services/stats/sql/gold/validacoes/atualizar_htmls_mortes.py
Lê teste_ascent_mortes.html e testes_mortes_minimapas/teste_*_mortes.html.
Grava cópias e ZIP em testes_mortes_revisados; mantém os originais.
"""
from pathlib import Path
import zipfile

REVISAO = r'''
// REVISAO_COORDENADAS_V1: limites da imagem nao sao limites da area jogavel.
const isoId='0e38b510-41a8-5780-5e8f-568b2a4f2d6c';
const partidasIsoObservadas=new Set([
 '72a9e2e7-f86a-483b-a35c-8291e8c71c89',
 'ffe8bfdd-1687-44cc-8fcf-1e2358999044',
 '4934cac4-80c0-4ece-a51e-ec6a1f644436'
]);
const marcarOriginal=marcar;
marcar=function(p,cor,rotulo,morte=false){
 if(p&&dentro(p))marcarOriginal(p,cor,rotulo,morte);
};
const mostrarOriginal=mostrar;
mostrar=function(d,i){
 mostrarOriginal(d,i);
 const morte=converter(d.posicao,d.matriz);
 const linhas=[];
 let fora=0,invalidos=0;
 function descrever(pos){return 'x='+pos.x+'; y='+pos.y;}
 function percentual(p){return 'u='+(p.u*100).toFixed(2)+'%; v='+(p.v*100).toFixed(2)+'%';}
 const envolvidos=(d.jogadores||[]).filter(j=>j.jogador_id===d.ator_id||j.jogador_id===d.vitima_id);
 const isoEnvolvido=d.ator_agente_id===isoId||envolvidos.some(j=>j.agente_id===isoId);
 const possivelIso=Boolean(d.posicao&&Number(d.posicao.x)<-40000&&
   (isoEnvolvido||partidasIsoObservadas.has(d.partida_id)));
 if(!morte){
   linhas.push('VÍTIMA: posição ausente ou inválida; marcador indisponível.');
 }else if(!dentro(morte)){
   linhas.push('VÍTIMA FORA DA IMAGEM: '+descrever(d.posicao)+' | '+percentual(morte));
   if(possivelIso)linhas.push('Possível arena do Iso — hipótese baseada nas coordenadas e associação observada; não é confirmação de uso da ultimate.');
   else linhas.push('Causa não determinada. Não mover o ponto para dentro do minimapa.');
 }else{
   linhas.push('Vítima dentro da imagem; marcador amarelo exibido.');
 }
 if(d.dano_final_tipo)linhas.push('Dano final registrado: '+d.dano_final_tipo+
   (d.dano_final_tipo==='Fall'?' (queda; não determina intenção).':''));
 (d.jogadores||[]).forEach((j,n)=>{
   const p=converter(j.posicao,d.matriz);
   if(!p){invalidos++;linhas.push('Jogador '+(n+1)+': posição ausente ou inválida.');}
   else if(!dentro(p)){
     fora++;
     linhas.push('Jogador '+(n+1)+' FORA DA IMAGEM: '+descrever(j.posicao)+' | '+percentual(p));
   }
 });
 linhas.push('Snapshots: '+(d.jogadores||[]).length+' disponíveis; '+fora+' fora da imagem; '+invalidos+' inválidos.');
 linhas.push('Os limites 0–1 representam a imagem, não a área caminhável. Eventos e coordenadas originais preservados; sem reposicionamento.');
 let aviso=document.getElementById('aviso-coordenadas');
 if(!aviso){
   aviso=document.createElement('pre');aviso.id='aviso-coordenadas';
   aviso.style.cssText='white-space:pre-wrap;padding:12px;border:1px solid #ffcc00;line-height:1.5';
   info.insertAdjacentElement('afterend',aviso);
 }
 aviso.textContent=linhas.join('\n');
};
mostrar(dados[0],0);
'''


def revisar(html):
    if 'REVISAO_COORDENADAS_V1' in html:
        return html
    for trecho in ('function converter(', 'function dentro(', 'function marcar(',
                   'function mostrar(', 'const dados=', '</script>'):
        if trecho not in html:
            raise ValueError(f'HTML incompatível: trecho ausente: {trecho}')
    # Executa depois da montagem original; botões chamam a função revisada.
    return html.replace('</script>', REVISAO + '\n</script>', 1)


def main():
    fontes = sorted(Path('testes_mortes_minimapas').glob('teste_*_mortes.html'))
    ascent = Path('teste_ascent_mortes.html')
    if ascent.is_file():
        fontes.insert(0, ascent)
    if not fontes:
        raise SystemExit('Nenhum HTML encontrado. Execute na pasta dos testes originais (~/datropa-chico).')
    # Valida todos antes de escrever qualquer cópia.
    revisados = [(p.name, revisar(p.read_text(encoding='utf-8'))) for p in fontes]
    pasta = Path('testes_mortes_revisados')
    pasta.mkdir(exist_ok=True)
    with zipfile.ZipFile(pasta / 'testes_mortes_revisados.zip', 'w', zipfile.ZIP_DEFLATED) as z:
        for nome, conteudo in revisados:
            (pasta / nome).write_text(conteudo, encoding='utf-8')
            z.writestr(nome, conteudo)
            print('Revisado:', nome)
    print(f'Pronto: {len(revisados)} HTMLs; {pasta}/testes_mortes_revisados.zip')
    print('Abra os novos HTMLs, selecione os mesmos minimapas e repita as amostras afetadas.')


if __name__ == '__main__':
    main()
