import React, { useEffect, useState } from 'react';
import { agenteAgindo, assinarAgente, avisarMudancaAgente, pararTudo } from '../utils/agenteParar';

// Botão PARAR da Agente: aparece SÓ enquanto ela fala ou age (voz, piloto, apresentação, demonstração da Escola) e some depois.
// "embutido" fica no balão/bolinha da Agente e na faixa do piloto; o "flutuante" aparece no canto só quando nenhum embutido está
// à vista. Grande o bastante para o dedo no celular (44 px). A tecla Esc faz o mesmo.

let embutidosVisiveis = 0;

function useAgenteAgindo(): boolean {
  const [ativo, setAtivo] = useState<boolean>(() => agenteAgindo());
  useEffect(() => {
    const ler = () => setAtivo(agenteAgindo());
    const sair = assinarAgente(ler);
    // A voz do navegador não avisa quando começa: confere de pouco em pouco enquanto a tela está aberta.
    const t = window.setInterval(ler, 300);
    return () => { sair(); window.clearInterval(t); };
  }, []);
  return ativo;
}

const estilo: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, minWidth: 44, padding: '0 14px',
  borderRadius: 9999, border: '2px solid #fff', background: '#dc2626', color: '#fff', fontWeight: 800, fontSize: 14,
  letterSpacing: 0.3, boxShadow: '0 4px 14px rgba(220,38,38,.45)', cursor: 'pointer', touchAction: 'manipulation', lineHeight: 1,
};

export function BotaoPararAgente({ variante = 'embutido', className, compacto = false }: { variante?: 'embutido' | 'flutuante'; className?: string; compacto?: boolean }): React.ReactElement | null {
  const ativo = useAgenteAgindo();
  const [, forcar] = useState(0);
  const visivelEmbutido = variante === 'embutido' && ativo;
  useEffect(() => {
    if (!visivelEmbutido) return;
    embutidosVisiveis += 1; avisarMudancaAgente();
    return () => { embutidosVisiveis -= 1; avisarMudancaAgente(); };
  }, [visivelEmbutido]);
  useEffect(() => (variante === 'flutuante' ? assinarAgente(() => forcar((n) => n + 1)) : undefined), [variante]);

  if (!ativo) return null;
  if (variante === 'flutuante' && embutidosVisiveis > 0) return null;
  const botao = (
    <button
      type="button"
      data-piloto-controles
      data-agente-parar
      data-piloto-ignorar="1"
      data-piloto-ui="1"
      onClick={(e) => { e.stopPropagation(); pararTudo('botao'); }}
      aria-label="Parar a Agente agora"
      title="Parar agora (Esc)"
      className={className}
      style={compacto ? { ...estilo, padding: '0 10px', fontSize: 13 } : estilo}
    >
      <span aria-hidden style={{ display: 'inline-block', width: 12, height: 12, background: '#fff', borderRadius: 2 }} />
      PARAR
    </button>
  );
  if (variante === 'embutido') return botao;
  return (
    <div style={{ position: 'fixed', right: 12, bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', zIndex: 2147483001 }}>{botao}</div>
  );
}
