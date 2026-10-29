// Token do procurador (escritório) para consultar o Integra Contador em nome de um escritório cliente.
// O certificado e-CNPJ do escritório e o Termo de Autorização ficam no Murade Fiscal; aqui só se pede o token, pelo canal entre sistemas.
import { urlDoSistema } from './agentesEntreSistemas';

export class SemTokenProcurador extends Error {}

export async function buscarTokenProcurador(
  cnpjEscritorio: string, env: Record<string, string | undefined> = process.env, buscar: typeof fetch = fetch,
): Promise<string> {
  const token = env.MURADE_INTEGRATION_TOKEN?.trim();
  if (!token) throw new SemTokenProcurador('Integração entre sistemas (MURADE_INTEGRATION_TOKEN) não configurada; não foi possível autorizar a consulta em nome do escritório.');
  let r: Response;
  try {
    r = await buscar(`${urlDoSistema('fiscal', env)}/api/integracao/serpro/token-procurador`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpj: cnpjEscritorio }), signal: AbortSignal.timeout(30_000),
    });
  } catch { throw new SemTokenProcurador('Não foi possível falar com o Murade Fiscal para autorizar a consulta em nome do escritório. Nada foi consultado nem cobrado.'); }
  const j: any = await r.json().catch(() => ({}));
  if (r.ok && j?.sucesso === true && typeof j.token === 'string' && j.token) return j.token;
  throw new SemTokenProcurador(String(j?.motivo || `O Murade Fiscal recusou (HTTP ${r.status}).`).slice(0, 300) + ' Nada foi consultado nem cobrado.');
}
