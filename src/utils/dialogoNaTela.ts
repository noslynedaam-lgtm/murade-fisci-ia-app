// Confirmação e pergunta DENTRO da página (no lugar de window.confirm / window.prompt).
// Os avisos do navegador podem ser bloqueados ("Impedir que esta página crie caixas de diálogo adicionais") e então o clique em
// Excluir/Bloquear não faz nada, sem aviso. Estes funcionam sempre, funcionam no app instalado e têm botões grandes para o celular.
type Resultado = { ok: boolean; valor: string };

function abrir(mensagem: string, comCampo: boolean, valorInicial: string): Promise<Resultado> {
  return new Promise((resolve) => {
    const perigoso = /^\s*(EXCLUIR|Bloquear|Revogar|Tirar)\b/i.test(mensagem);
    const fundo = document.createElement('div');
    fundo.setAttribute('role', 'dialog'); fundo.setAttribute('aria-modal', 'true');
    fundo.className = 'fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4';
    const caixa = document.createElement('div');
    caixa.className = 'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl';
    const texto = document.createElement('p');
    texto.className = 'whitespace-pre-wrap text-sm leading-relaxed'; texto.textContent = mensagem;
    caixa.appendChild(texto);
    let campo: HTMLInputElement | null = null;
    if (comCampo) {
      campo = document.createElement('input'); campo.type = 'text'; campo.value = valorInicial; campo.autocomplete = 'off';
      campo.className = 'mt-3 w-full rounded-lg border border-slate-300 p-3 text-base'; caixa.appendChild(campo);
    }
    const linha = document.createElement('div'); linha.className = 'mt-4 flex justify-end gap-3';
    const cancelar = document.createElement('button'); cancelar.type = 'button'; cancelar.textContent = 'Cancelar';
    cancelar.className = 'rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold';
    const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = perigoso ? 'Confirmar' : 'OK';
    ok.className = `rounded-lg px-4 py-3 text-sm font-bold text-white ${perigoso ? 'bg-red-700' : 'bg-slate-800'}`;
    linha.append(cancelar, ok); caixa.appendChild(linha); fundo.appendChild(caixa);
    const anterior = document.activeElement as HTMLElement | null;
    const fechar = (r: Resultado) => { document.removeEventListener('keydown', teclas, true); fundo.remove(); anterior?.focus?.(); resolve(r); };
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar({ ok: false, valor: '' }); }
      else if (e.key === 'Enter' && (comCampo || document.activeElement === ok)) { e.preventDefault(); e.stopPropagation(); fechar({ ok: true, valor: campo?.value ?? '' }); }
    };
    cancelar.onclick = () => fechar({ ok: false, valor: '' });
    ok.onclick = () => fechar({ ok: true, valor: campo?.value ?? '' });
    document.addEventListener('keydown', teclas, true);
    document.body.appendChild(fundo);
    (campo ?? ok).focus();
  });
}

/** Igual a window.confirm: true se a pessoa confirmou. */
export async function confirmarNaTela(mensagem: string): Promise<boolean> { return (await abrir(mensagem, false, '')).ok; }
/** Igual a window.prompt: o texto digitado, ou null se cancelou. */
export async function perguntarNaTela(mensagem: string, valorInicial = ''): Promise<string | null> { const r = await abrir(mensagem, true, valorInicial); return r.ok ? r.valor : null; }
