const DATABASE_NAME = 'murade-fiscal-documentos-locais';
const DATABASE_VERSION = 2;
const STORE_NAME = 'xmls';
const STORE_PENDENTES = 'arquivos-pendentes';

export interface XmlFiscalLocal {
  id: string;
  empresaId: string;
  chave: string;
  nomeArquivo: string;
  importadoEm: string;
  conteudo: string;
}

export interface ArquivoFiscalPendenteLocal {
  id: string;
  empresaId: string;
  nomeArquivo: string;
  tipoMime: string;
  tamanho: number;
  importadoEm: string;
  motivo: string;
  conteudo: Blob;
}

export type ArquivoFiscalPendenteResumo = Omit<ArquivoFiscalPendenteLocal, 'conteudo'>;

function abrirBanco(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Este navegador não oferece armazenamento local de arquivos.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('empresaId', 'empresaId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PENDENTES)) {
        const store = db.createObjectStore(STORE_PENDENTES, { keyPath: 'id' });
        store.createIndex('empresaId', 'empresaId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir o arquivo local de XMLs.'));
  });
}

/** Guarda o original localmente sem classificá-lo como nota válida ou escriturada. */
export async function salvarArquivoFiscalPendenteLocal(
  input: Omit<ArquivoFiscalPendenteLocal, 'id' | 'importadoEm' | 'tamanho' | 'conteudo' | 'tipoMime'> & { arquivo: File }
): Promise<string> {
  if (input.arquivo.size > 25 * 1024 * 1024) throw new Error('Arquivo acima do limite local de 25 MB; não foi armazenado.');
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const registro: ArquivoFiscalPendenteLocal = {
    id: `${input.empresaId}::pendente::${uuid}`,
    empresaId: input.empresaId,
    nomeArquivo: input.nomeArquivo,
    tipoMime: input.arquivo.type || 'application/octet-stream',
    tamanho: input.arquivo.size,
    importadoEm: new Date().toISOString(),
    motivo: input.motivo,
    conteudo: input.arquivo.slice(0, input.arquivo.size, input.arquivo.type || 'application/octet-stream')
  };
  const db = await abrirBanco();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_PENDENTES, 'readwrite');
      transaction.objectStore(STORE_PENDENTES).add(registro);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Não foi possível guardar o arquivo pendente neste navegador.'));
      transaction.onabort = () => reject(transaction.error || new Error('O armazenamento do arquivo pendente foi cancelado.'));
    });
    return registro.id;
  } finally {
    db.close();
  }
}

export async function listarArquivosFiscaisPendentesEmpresa(empresaId: string): Promise<ArquivoFiscalPendenteResumo[]> {
  const db = await abrirBanco();
  try {
    return await new Promise((resolve, reject) => {
      const resultados: ArquivoFiscalPendenteResumo[] = [];
      const request = db.transaction(STORE_PENDENTES, 'readonly')
        .objectStore(STORE_PENDENTES).index('empresaId').openCursor(IDBKeyRange.only(empresaId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve(resultados);
        const { conteudo: _conteudo, ...resumo } = cursor.value as ArquivoFiscalPendenteLocal;
        resultados.push(resumo);
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error('Não foi possível listar os arquivos pendentes.'));
    });
  } finally {
    db.close();
  }
}

export async function obterArquivoFiscalPendenteLocal(id: string, empresaIdEsperada: string): Promise<ArquivoFiscalPendenteLocal | null> {
  if (!empresaIdEsperada) throw new Error('Empresa obrigatória para ler um arquivo fiscal pendente.');
  const db = await abrirBanco();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_PENDENTES, 'readonly').objectStore(STORE_PENDENTES).get(id);
      request.onsuccess = () => {
        const registro = request.result as ArquivoFiscalPendenteLocal | undefined;
        if (registro && registro.empresaId !== empresaIdEsperada) {
          reject(new Error('O arquivo pendente não pertence à empresa selecionada; nenhum conteúdo foi aberto.'));
          return;
        }
        resolve(registro ?? null);
      };
      request.onerror = () => reject(request.error || new Error('Não foi possível ler o arquivo pendente.'));
    });
  } finally {
    db.close();
  }
}

export async function apagarArquivoFiscalPendenteLocal(id: string, empresaIdEsperada: string): Promise<void> {
  if (!empresaIdEsperada) throw new Error('Empresa obrigatória para excluir um arquivo fiscal pendente.');
  const db = await abrirBanco();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_PENDENTES, 'readwrite');
      const store = transaction.objectStore(STORE_PENDENTES);
      const request = store.get(id);
      let erro: Error | null = null;
      request.onsuccess = () => {
        const registro = request.result as ArquivoFiscalPendenteLocal | undefined;
        if (!registro) {
          erro = new Error('O arquivo pendente não foi encontrado; nenhum item foi removido.');
          transaction.abort();
          return;
        }
        if (registro.empresaId !== empresaIdEsperada) {
          erro = new Error('O arquivo pendente não pertence à empresa selecionada; nenhum item foi removido.');
          transaction.abort();
          return;
        }
        store.delete(id);
      };
      request.onerror = () => { erro = new Error('Não foi possível verificar a empresa do arquivo pendente.'); };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(erro || transaction.error || new Error('Não foi possível excluir o arquivo pendente.'));
      transaction.onabort = () => reject(erro || transaction.error || new Error('A exclusão do arquivo pendente foi cancelada.'));
    });
  } finally {
    db.close();
  }
}

export async function salvarXmlFiscalLocal(input: Omit<XmlFiscalLocal, 'id' | 'importadoEm'>): Promise<string> {
  const db = await abrirBanco();
  try {
    return await new Promise<string>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const porEmpresa = store.index('empresaId').openCursor(IDBKeyRange.only(input.empresaId));
      let idSalvo: string | null = null;
      let erro: Error | null = null;
      porEmpresa.onsuccess = () => {
        const cursor = porEmpresa.result;
        if (cursor) {
          const existente = cursor.value as XmlFiscalLocal;
          if (input.chave && existente.chave === input.chave) {
            if (existente.conteudo !== input.conteudo) {
              erro = new Error('A mesma chave já está associada a outro XML nesta empresa; o original foi preservado e o novo arquivo deve ser revisado.');
              transaction.abort();
              return;
            }
            idSalvo = existente.id;
            return;
          }
          cursor.continue();
          return;
        }
        const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const id = `${input.empresaId}::${input.chave || 'sem-chave'}::${uuid}`;
        const registro: XmlFiscalLocal = { ...input, id, importadoEm: new Date().toISOString() };
        const adicionar = store.add(registro);
        adicionar.onsuccess = () => { idSalvo = id; };
        adicionar.onerror = () => { erro = new Error('Não foi possível salvar o XML local.'); };
      };
      porEmpresa.onerror = () => { erro = new Error('Não foi possível verificar os XMLs anteriores da empresa.'); };
      transaction.oncomplete = () => {
        if (idSalvo) resolve(idSalvo);
        else reject(erro || new Error('Não foi possível salvar o XML local.'));
      };
      transaction.onerror = () => reject(transaction.error || new Error('Não foi possível salvar o XML local.'));
      transaction.onabort = () => reject(erro || transaction.error || new Error('O armazenamento do XML local foi cancelado.'));
    });
  } finally {
    db.close();
  }
}

export async function obterXmlFiscalLocal(id: string): Promise<XmlFiscalLocal | null> {
  const db = await abrirBanco();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve((request.result as XmlFiscalLocal | undefined) ?? null);
      request.onerror = () => reject(request.error || new Error('Não foi possível ler o XML local.'));
    });
  } finally {
    db.close();
  }
}

/** Localiza o XML já guardado para distinguir reimportação idêntica de conflito. */
export async function obterXmlFiscalPorChaveEmpresa(empresaId: string, chave: string): Promise<XmlFiscalLocal | null> {
  if (!chave) return null;
  const db = await abrirBanco();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME).index('empresaId').openCursor(IDBKeyRange.only(empresaId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve(null);
        const registro = cursor.value as XmlFiscalLocal;
        if (registro.chave === chave) return resolve(registro);
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error('Não foi possível verificar o XML original já importado.'));
    });
  } finally {
    db.close();
  }
}

export async function apagarXmlFiscalLocal(id: string): Promise<void> {
  const db = await abrirBanco();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Não foi possível remover o XML local.'));
      transaction.onabort = () => reject(transaction.error || new Error('A remoção do XML local foi cancelada.'));
    });
  } finally {
    db.close();
  }
}

export async function apagarXmlsFiscaisEmpresa(empresaId: string): Promise<void> {
  const db = await abrirBanco();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, STORE_PENDENTES], 'readwrite');
      for (const storeName of [STORE_NAME, STORE_PENDENTES]) {
        const store = transaction.objectStore(storeName);
        const request = store.index('empresaId').openKeyCursor(IDBKeyRange.only(empresaId));
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          store.delete(cursor.primaryKey);
          cursor.continue();
        };
        request.onerror = () => transaction.abort();
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Não foi possível apagar os documentos fiscais locais.'));
      transaction.onabort = () => reject(transaction.error || new Error('A exclusão dos documentos fiscais locais foi cancelada.'));
    });
  } finally {
    db.close();
  }
}

/** Remove todos os XMLs fiscais deste navegador. Usado ao limpar a carteira inteira. */
export async function apagarTodosXmlsFiscaisLocais(): Promise<void> {
  const db = await abrirBanco();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, STORE_PENDENTES], 'readwrite');
      transaction.objectStore(STORE_NAME).clear();
      transaction.objectStore(STORE_PENDENTES).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Não foi possível apagar os documentos fiscais locais.'));
      transaction.onabort = () => reject(transaction.error || new Error('A limpeza dos documentos fiscais locais foi cancelada.'));
    });
  } finally {
    db.close();
  }
}
