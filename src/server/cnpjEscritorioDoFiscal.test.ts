import test from 'node:test';
import assert from 'node:assert/strict';
import { sincronizarCnpjDosEscritorios, lerEmpresasDoFiscal, fiscalInformouCnpjDoEscritorio, type EmpresaDoFiscal, type ResultadoEmpresasFiscal } from './empresasDoFiscal';
import { decidirAcessoConsulta } from '../services/serpro/acessoConsulta';

const CNPJ = '15267243000168';
const novoOut = (): ResultadoEmpresasFiscal => ({ lidas: 0, criadas: 0, jaExistiam: 0, semEscritorio: 0, invalidas: 0, ambiguas: 0, retiradas: 0, cnpjPreenchidos: 0, avisos: [] });
const emp = (escritorios: EmpresaDoFiscal['escritorios']): EmpresaDoFiscal => ({ cnpj: '12345678000195', razaoSocial: 'A', uf: 'GO', cidade: '', regime: '', status: 'Ativa', escritorio: '', escritorioDonoSistema: false, escritorios });

interface Tenant { id: string; name: string; email: string; cnpj: string | null; dono: boolean }
/** Banco falso: usuário = e-mail, um tenant por e-mail. `semFuncao` simula banco sem a migração 023. */
function bancoFalso(tenants: Tenant[], opts: { semFuncao?: boolean } = {}) {
  const chamadas: string[] = [];
  const porEmail = (e: string) => tenants.find((t) => t.email === e);
  const client = {
    query: async (sql: string, params?: any[]) => {
      if (/FROM fiscoia.tenant_memberships WHERE user_id/.test(sql)) { const t = tenants.find((x) => 'u-' + x.id === params![0]); return { rows: t ? [{ tenant_id: t.id }] : [] }; }
      return { rows: [] };
    }, release: () => undefined,
  };
  return {
    chamadas, tenants,
    connect: async () => client,
    query: async (sql: string, params: any[] = []) => {
      if (/SELECT id FROM fiscoia.users WHERE email/.test(sql)) { const t = porEmail(params[0]); return { rows: t ? [{ id: 'u-' + t.id }] : [] }; }
      if (/tenant_office_info/.test(sql)) { const t = tenants.find((x) => x.id === params[0])!; return { rows: [{ name: t.name, office_cnpj: t.cnpj, is_platform_owner: t.dono }] }; }
      if (/platform_fill_office_cnpj_from_integration/.test(sql)) {
        chamadas.push(`${params[0]}:${params[1]}`);
        if (opts.semFuncao) throw Object.assign(new Error('function does not exist'), { code: '42883' });
        const t = tenants.find((x) => x.id === params[0])!;
        if (t.dono) throw Object.assign(new Error('dono'), { code: '22023' });
        if (t.cnpj) return { rows: [{ ok: false }] };
        t.cnpj = params[1]; return { rows: [{ ok: true }] };
      }
      if (/integration_offices_without_cnpj/.test(sql)) {
        if (opts.semFuncao) throw Object.assign(new Error('x'), { code: '42883' });
        return { rows: tenants.filter((t) => !t.cnpj && !t.dono).map((t) => ({ id: t.id, name: t.name, owner_email: t.email })) };
      }
      return { rows: [] };
    },
  } as any;
}
const T = (id: string, email: string, cnpj: string | null = null, dono = false): Tenant => ({ id, name: 'Esc ' + id, email, cnpj, dono });

test('preenche o CNPJ do escritório só quando está vazio e o Fiscal informa um válido', async () => {
  const pool = bancoFalso([T('t1', 'a@x.com')]); const out = novoOut();
  await sincronizarCnpjDosEscritorios(pool, [emp([{ login: 'a@x.com', donoSistema: false, cnpj: CNPJ }])], out);
  assert.equal(pool.tenants[0].cnpj, CNPJ); assert.equal(out.cnpjPreenchidos, 1); assert.deepEqual(out.avisos, []);
  assert.equal(fiscalInformouCnpjDoEscritorio('t1'), true);
});

test('nunca sobrescreve CNPJ já preenchido: divergência só vira aviso', async () => {
  const outro = '40957233000100';
  const pool = bancoFalso([T('t1', 'a@x.com', outro)]); const out = novoOut();
  await sincronizarCnpjDosEscritorios(pool, [emp([{ login: 'a@x.com', donoSistema: false, cnpj: CNPJ }])], out);
  assert.equal(pool.tenants[0].cnpj, outro); assert.equal(out.cnpjPreenchidos, 0); assert.deepEqual(pool.chamadas, []);
  assert.equal(out.avisos.length, 1); assert.match(out.avisos[0], /difere/);
});

test('CNPJ igual ao já cadastrado não faz nada nem avisa', async () => {
  const pool = bancoFalso([T('t1', 'a@x.com', CNPJ)]); const out = novoOut();
  await sincronizarCnpjDosEscritorios(pool, [emp([{ login: 'a@x.com', donoSistema: false, cnpj: CNPJ }])], out);
  assert.deepEqual(pool.chamadas, []); assert.deepEqual(out.avisos, []);
});

test('ignora o escritório do dono do sistema (pelo Fiscal e pelo banco)', async () => {
  const pool = bancoFalso([T('d', 'dono@x.com', null, true), T('t2', 'cli@x.com', null, true)]); const out = novoOut();
  await sincronizarCnpjDosEscritorios(pool, [emp([{ login: 'dono@x.com', donoSistema: true, cnpj: CNPJ }, { login: 'cli@x.com', donoSistema: false, cnpj: CNPJ }])], out);
  assert.equal(pool.tenants[0].cnpj, null); assert.equal(pool.tenants[1].cnpj, null); assert.equal(out.cnpjPreenchidos, 0);
  assert.ok(!pool.chamadas.some((c: string) => c.startsWith('d:')));
});

test('Fiscal sem CNPJ válido (ausente ou inválido) não preenche nada; só avisa o conferidor', async () => {
  const pool = bancoFalso([T('t1', 'a@x.com')]); const out = novoOut();
  await sincronizarCnpjDosEscritorios(pool, [emp([{ login: 'a@x.com', donoSistema: false }])], out);
  assert.deepEqual(pool.chamadas, []); assert.equal(pool.tenants[0].cnpj, null);
  assert.equal(out.avisos.length, 1); assert.match(out.avisos[0], /o Fiscal também não tem o CNPJ/);
  const bruto = (async () => new Response(JSON.stringify({ sucesso: true, empresas: [{ cnpj: '12345678000195', razaoSocial: 'A', escritorio: 'a@x.com', escritorios: [{ login: 'a@x.com', donoSistema: false, cnpj: '12345678000100' }] }] }))) as any;
  const lida = await lerEmpresasDoFiscal({ MURADE_INTEGRATION_TOKEN: 't', MURADE_FISCAL_URL: 'https://f.test' }, bruto);
  assert.equal(lida[0].escritorios![0].cnpj, undefined);
});

test('lê o CNPJ do escritório quando o Fiscal o envia (formatado) e segue compatível com Fiscal antigo (sem cnpj)', async () => {
  const env = { MURADE_INTEGRATION_TOKEN: 't', MURADE_FISCAL_URL: 'https://f.test' };
  const novo = (async () => new Response(JSON.stringify({ sucesso: true, empresas: [{ cnpj: '12345678000195', escritorios: [{ login: 'A@x.com', donoSistema: false, cnpj: '15.267.243/0001-68' }] }] }))) as any;
  assert.deepEqual((await lerEmpresasDoFiscal(env, novo))[0].escritorios, [{ login: 'a@x.com', donoSistema: false, cnpj: CNPJ }]);
  const antigo = (async () => new Response(JSON.stringify({ sucesso: true, empresas: [{ cnpj: '12345678000195', escritorios: [{ login: 'a@x.com', donoSistema: false }] }] }))) as any;
  assert.deepEqual((await lerEmpresasDoFiscal(env, antigo))[0].escritorios, [{ login: 'a@x.com', donoSistema: false }]);
});

test('Fiscal com CNPJs diferentes para o mesmo login: não preenche e avisa', async () => {
  const pool = bancoFalso([T('t1', 'a@x.com')]); const out = novoOut();
  await sincronizarCnpjDosEscritorios(pool, [emp([{ login: 'a@x.com', donoSistema: false, cnpj: CNPJ }]), emp([{ login: 'a@x.com', donoSistema: false, cnpj: '40957233000100' }])], out);
  assert.equal(pool.tenants[0].cnpj, null); assert.match(out.avisos[0], /CNPJs diferentes/);
});

test('conferidor: escritório cliente sem CNPJ e sem correspondência no Fiscal gera aviso', async () => {
  const pool = bancoFalso([T('t1', 'a@x.com'), T('t9', 'sozinho@x.com')]); const out = novoOut();
  await sincronizarCnpjDosEscritorios(pool, [emp([{ login: 'a@x.com', donoSistema: false, cnpj: CNPJ }])], out);
  assert.equal(pool.tenants[0].cnpj, CNPJ);
  assert.equal(out.avisos.length, 1); assert.match(out.avisos[0], /Esc t9/); assert.match(out.avisos[0], /não tem correspondência no Fiscal/);
});

test('banco sem a migração 023: só avisa, não preenche e não quebra', async () => {
  const pool = bancoFalso([T('t1', 'a@x.com')], { semFuncao: true }); const out = novoOut();
  await sincronizarCnpjDosEscritorios(pool, [emp([{ login: 'a@x.com', donoSistema: false, cnpj: CNPJ }])], out);
  assert.equal(pool.tenants[0].cnpj, null); assert.equal(out.cnpjPreenchidos, 0);
  assert.equal(out.avisos.length, 1); assert.match(out.avisos[0], /023/);
});

test('mensagem do 409: diz quando o Fiscal já tem o CNPJ; sem isso, mantém o texto de sempre', () => {
  const base = { ehAdmin: false, tenantId: 't1', vinculado: true, info: { nome: 'E', cnpj: null, donoDoSistema: false } };
  const a: any = decidirAcessoConsulta({ ...base, fiscalTemCnpj: true });
  assert.equal(a.http, 409); assert.match(a.mensagem, /robô de empresas do Fiscal em até 10 minutos/); assert.match(a.mensagem, /Escritórios contratantes/); assert.match(a.mensagem, /Nada foi consultado nem cobrado/);
  const b: any = decidirAcessoConsulta(base);
  assert.match(b.mensagem, /ainda não foi cadastrado pelo fornecedor do sistema/);
  assert.equal((decidirAcessoConsulta({ ...base, info: { nome: 'E', cnpj: CNPJ, donoDoSistema: false } }) as any).ok, true);
});
