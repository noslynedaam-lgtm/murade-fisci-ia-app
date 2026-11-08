import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

type Estado = { disponivel: boolean; ativo: boolean; emergenciaRestantes: number; obrigatorio: boolean };
type Props = {
  /** Texto que aparece no aplicativo do celular, ex.: "Murade Fiscal". */
  sistema: string;
  /** Avisa a tela de fora que o código foi ligado ou desligado (para atualizar a sessão). */
  aoMudar: () => void | Promise<void>;
  /** Tela cheia, sem botão de fechar (dono que ainda precisa ligar o código). */
  obrigatorio?: boolean;
  aoFechar?: () => void;
  aoSair?: () => void;
};

async function chamar(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<{ ok: boolean; dados: any }> {
  const resposta = await fetch(caminho, { method: metodo, credentials: 'include', cache: 'no-store', headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  return { ok: resposta.ok, dados: await resposta.json().catch(() => ({})) };
}

export function SegurancaConta({ sistema, aoMudar, obrigatorio = false, aoFechar, aoSair }: Props) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [fase, setFase] = useState<'inicio' | 'configurando' | 'emergencia'>('inicio');
  const [qr, setQr] = useState(''); const [segredo, setSegredo] = useState('');
  const [codigo, setCodigo] = useState(''); const [senha, setSenha] = useState('');
  const [emergencia, setEmergencia] = useState<string[]>([]); const [guardou, setGuardou] = useState(false);
  const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('');
  const [desligando, setDesligando] = useState(false);

  const carregar = async () => {
    const r = await chamar('GET', '/api/auth/2fa');
    if (r.ok && r.dados.sucesso) setEstado({ disponivel: r.dados.disponivel === true, ativo: r.dados.ativo === true, emergenciaRestantes: Number(r.dados.emergenciaRestantes || 0), obrigatorio: r.dados.obrigatorio === true });
    else setErro(r.dados.motivo || 'Não foi possível consultar a segurança da conta.');
  };
  useEffect(() => { void carregar(); }, []);

  const comecar = async () => {
    setOcupado(true); setErro('');
    try {
      const r = await chamar('POST', '/api/auth/2fa/iniciar', {});
      if (!r.ok || r.dados.sucesso !== true) throw new Error(r.dados.motivo || 'Não foi possível preparar agora.');
      setQr(r.dados.qr || ''); setSegredo(r.dados.segredo || ''); setCodigo(''); setFase('configurando');
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível preparar agora.'); } finally { setOcupado(false); }
  };
  const confirmar = async (evento: React.FormEvent) => {
    evento.preventDefault(); setOcupado(true); setErro('');
    try {
      const r = await chamar('POST', '/api/auth/2fa/ativar', { codigo });
      if (!r.ok || r.dados.sucesso !== true) throw new Error(r.dados.motivo || 'Código incorreto.');
      setEmergencia(Array.isArray(r.dados.codigosEmergencia) ? r.dados.codigosEmergencia : []); setGuardou(false); setFase('emergencia'); setQr(''); setSegredo('');
    } catch (e) { setErro(e instanceof Error ? e.message : 'Código incorreto.'); } finally { setOcupado(false); }
  };
  const concluir = async () => { await carregar(); setFase('inicio'); setEmergencia([]); await aoMudar(); };
  const desligar = async (evento: React.FormEvent) => {
    evento.preventDefault(); setOcupado(true); setErro('');
    try {
      const r = await chamar('POST', '/api/auth/2fa/desativar', { senha, codigo });
      if (!r.ok || r.dados.sucesso !== true) throw new Error(r.dados.motivo || 'Senha ou código incorretos.');
      setSenha(''); setCodigo(''); setDesligando(false); setAviso('Código de segurança desligado.'); await carregar(); await aoMudar();
    } catch (e) { setErro(e instanceof Error ? e.message : 'Senha ou código incorretos.'); } finally { setOcupado(false); }
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(emergencia.join('\n')); setAviso('Códigos copiados.'); } catch { setAviso('Não deu para copiar; anote os códigos à mão.'); } };

  const conteudo = (
    <section className="w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-2xl">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold"><ShieldCheck className="mr-2 inline h-5 w-5 text-emerald-700" />Código de segurança</h2>
        {!obrigatorio && aoFechar && <button type="button" onClick={aoFechar} className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold" aria-label="Fechar">Fechar</button>}
      </header>
      {!estado && !erro && <p className="text-sm text-slate-600">Carregando…</p>}
      {erro && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
      {aviso && !erro && <p className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">{aviso}</p>}

      {estado && !estado.disponivel && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">O código de segurança ainda não está disponível neste sistema. Fale com o administrador.</p>}

      {estado?.disponivel && fase === 'inicio' && !estado.ativo && <div className="space-y-3 text-sm">
        {obrigatorio && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">Para proteger os dados dos clientes, o dono do sistema precisa ligar o código de segurança antes de continuar. Leva 2 minutos.</p>}
        <p>Com o código ligado, quem descobrir sua senha ainda não consegue entrar: precisa do número de 6 dígitos que aparece no <strong>seu celular</strong>.</p>
        <button type="button" disabled={ocupado} onClick={() => void comecar()} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-60">{ocupado ? 'Aguarde…' : 'Ligar o código de segurança'}</button>
      </div>}

      {estado?.disponivel && fase === 'configurando' && <form onSubmit={confirmar} className="space-y-3 text-sm">
        <ol className="list-decimal space-y-1 pl-5">
          <li>No celular, instale o aplicativo grátis <strong>Google Authenticator</strong> ou <strong>Microsoft Authenticator</strong>.</li>
          <li>Abra o aplicativo, toque no <strong>+</strong> e escolha <strong>Ler código QR</strong>.</li>
          <li>Aponte a câmera para a imagem abaixo.</li>
          <li>Digite aqui o número de 6 dígitos que aparecer no aplicativo para <strong>{sistema}</strong>.</li>
        </ol>
        {qr && <img src={qr} alt="QR Code para o aplicativo de código de segurança" className="mx-auto h-48 w-48 rounded-lg border border-slate-200" />}
        <details className="rounded-lg bg-slate-50 p-2"><summary className="cursor-pointer font-semibold">Não consigo ler o QR Code</summary><p className="mt-1 break-all font-mono text-xs">No aplicativo escolha “Inserir chave de configuração” e digite: <strong>{segredo}</strong></p></details>
        <label className="block font-semibold">Número de 6 dígitos
          <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} value={codigo} onChange={(e) => setCodigo(e.target.value)} className="mt-1 w-full rounded-lg border p-3 text-center text-2xl font-normal tracking-[0.3em]" placeholder="000000" />
        </label>
        <button disabled={ocupado} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-60">{ocupado ? 'Conferindo…' : 'Conferir e ligar'}</button>
      </form>}

      {fase === 'emergencia' && <div className="space-y-3 text-sm">
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-900">Código de segurança ligado.</p>
        <p><strong>Guarde estes códigos de emergência</strong> (foto da tela, papel ou gerenciador de senhas). Se perder o celular, cada um deixa você entrar <strong>uma vez</strong>. Eles não aparecem de novo.</p>
        <ul className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-3 font-mono text-sm">{emergencia.map((c) => <li key={c}>{c}</li>)}</ul>
        <button type="button" onClick={() => void copiar()} className="w-full rounded-lg bg-slate-200 px-4 py-2 font-semibold">Copiar os códigos</button>
        <label className="flex items-start gap-2"><input type="checkbox" checked={guardou} onChange={(e) => setGuardou(e.target.checked)} className="mt-1" />Guardei os códigos em lugar seguro.</label>
        <button type="button" disabled={!guardou} onClick={() => void concluir()} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">Concluir</button>
      </div>}

      {estado?.disponivel && fase === 'inicio' && estado.ativo && <div className="space-y-3 text-sm">
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-900"><strong>Ligado.</strong> Neste aparelho a senha é pedida normalmente e o código só na primeira vez. Códigos de emergência que ainda restam: {estado.emergenciaRestantes}.</p>
        {estado.obrigatorio
          ? <p className="text-slate-600">Para o dono do sistema o código é obrigatório e não pode ser desligado.</p>
          : !desligando
            ? <button type="button" onClick={() => { setDesligando(true); setErro(''); setAviso(''); }} className="w-full rounded-lg bg-slate-200 px-4 py-2 font-semibold">Desligar o código de segurança</button>
            : <form onSubmit={desligar} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <p className="font-semibold">Para desligar, confirme sua senha e um código.</p>
              <input required type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha" className="w-full rounded-lg border p-2" />
              <input required inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código de 6 dígitos" className="w-full rounded-lg border p-2" />
              <div className="flex gap-2"><button disabled={ocupado} className="flex-1 rounded-lg bg-red-700 px-3 py-2 font-bold text-white disabled:opacity-60">Desligar</button><button type="button" onClick={() => setDesligando(false)} className="flex-1 rounded-lg bg-slate-200 px-3 py-2 font-semibold">Cancelar</button></div>
            </form>}
      </div>}

      {obrigatorio && aoSair && fase !== 'emergencia' && <button type="button" onClick={aoSair} className="mt-3 w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold">Sair</button>}
    </section>
  );

  if (obrigatorio) return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">{conteudo}</main>;
  return <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/50 p-4">{conteudo}</div>;
}
