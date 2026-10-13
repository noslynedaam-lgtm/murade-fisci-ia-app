import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView
} from 'react-native';

export default function TelaPrincipal({ navegarPara = () => {} }) {
  return (
    <SafeAreaView style={styles.tela}>
      <View style={styles.container}>
        {/* ============================================== */}
        {/* 🟦 BARRA LATERAL — AZUL PROFISSIONAL */}
        {/* ============================================== */}
        <View style={styles.barraLateral}>
          {/* 💧 Marca d'água MURADE */}
          <Text style={styles.marcaDAgua}>MURADE</Text>

          <View style={styles.logoArea}>
            <Text style={styles.logoTexto}>FISCOIA</Text>
            <Text style={styles.logoSub}>Sistema de Conformidade</Text>
          </View>

          <View style={styles.painelMurad}>
            <Text style={styles.painelTitulo}>👑 MURADE</Text>
            <Text style={styles.painelSub}>Acesso Master Ativo</Text>
          </View>

          <View style={styles.linha} />

          {/* MENU */}
          {[
            { nome: 'Início', tela: 'Inicio' },
            { nome: 'Empresas', tela: 'Empresas' },
            { nome: 'Fiscal (Agenda)', tela: 'Fiscal' },
            { nome: 'DCTFWeb — Guias INSS', tela: 'DCTFWeb' },
            { nome: 'Guias Fiscais', tela: 'Guias' },
            { nome: 'Procuração e-CAC', tela: 'Procuracao' },
            { nome: 'IA Fiscal', tela: 'IA' },
            { nome: 'Minha Conta', tela: 'Conta' },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.itemMenu, item.tela === 'DCTFWeb' && styles.itemAtivo]}
              onPress={() => navegarPara(item.tela)}
            >
              <Text style={[styles.textoMenu, item.tela === 'DCTFWeb' && styles.textoAtivo]}>
                {item.nome}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.botaoSair}>
            <Text style={styles.textoSair}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* ============================================== */}
        {/* 📄 ÁREA PRINCIPAL */}
        {/* ============================================== */}
        <ScrollView style={styles.conteudo}>
          <View style={styles.cabecalhoTopo}>
            <Text style={styles.tituloPagina}>Painel de Conformidade Fiscal</Text>
            <Text style={styles.subtituloPagina}>Bem-vindo, MURAD</Text>
          </View>

          {/* CARDS */}
          <View style={styles.cards}>
            <TouchableOpacity style={styles.card}>
              <Text style={styles.cardNum}>1</Text>
              <Text style={styles.cardTexto}>Empresa Cadastrada</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.card} onPress={() => navegarPara('DCTFWeb')}>
              <Text style={styles.cardNum}>4</Text>
              <Text style={styles.cardTexto}>Guias</Text>
              <Text style={styles.cardLink}>Consultar →</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.card}>
              <Text style={styles.cardNum}>✓</Text>
              <Text style={styles.cardTexto}>Procuração Ativa</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.card}>
              <Text style={styles.cardNum}>IA</Text>
              <Text style={styles.cardTexto}>Assistente Online</Text>
            </TouchableOpacity>
          </View>

          {/* DADOS DA EMPRESA */}
          <View style={styles.caixaDados}>
            <Text style={styles.dadosTitulo}>Dados da Empresa</Text>
            {[
              ['CNPJ', '—'],
              ['Razão Social', 'Nenhuma empresa cadastrada'],
              ['Código FPAS', '507'],
              ['Cód. Recolhimento', '115']
            ].map(([rot, val], i) => (
              <View key={i} style={styles.linhaDados}>
                <Text style={styles.rotulo}>{rot}:</Text>
                <Text style={styles.valor}>{val}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ==========================================================
// 🎨 ESTILOS — AQUI QUE MUDA A COR!
// ==========================================================
const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: '#f0f6fd'
  },
  container: {
    flex: 1,
    flexDirection: 'row'
  },

  // 🟦 BARRA LATERAL — COR PRINCIPAL
  barraLateral: {
    width: 220,
    backgroundColor: '#3b7cd3', // ← COR DO AZUL AQUI!
    paddingTop: 30,
    paddingHorizontal: 15,
    position: 'relative'
  },

  // 💧 Marca d'água
  marcaDAgua: {
    position: 'absolute',
    top: 100,
    left: 10,
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    opacity: 0.07,
    transform: [{ rotate: '-15deg' }]
  },

  logoArea: {
    alignItems: 'center',
    marginBottom: 20
  },
  logoTexto: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff'
  },
  logoSub: {
    fontSize: 11,
    color: '#d4e4fc'
  },

  painelMurad: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15
  },
  painelTitulo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff'
  },
  painelSub: {
    fontSize: 11,
    color: '#d4e4fc',
    marginTop: 3
  },

  linha: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 10
  },

  itemMenu: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 3
  },
  itemAtivo: {
    backgroundColor: '#fff'
  },
  textoMenu: {
    fontSize: 14,
    color: '#e6f0fa'
  },
  textoAtivo: {
    color: '#1e40af',
    fontWeight: 'bold'
  },

  botaoSair: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    marginTop: 10
  },
  textoSair: {
    fontSize: 13,
    color: '#ffd6d6'
  },

  // 📄 ÁREA DE CONTEÚDO
  conteudo: {
    flex: 1,
    padding: 25
  },

  cabecalhoTopo: {
    marginBottom: 30
  },
  tituloPagina: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3a8a'
  },
  subtituloPagina: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 5
  },

  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 30
  },
  card: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#1e40af',
    shadowOpacity: 0.05,
    shadowRadius: 10
  },
  cardNum: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#3b7cd3',
    marginBottom: 5
  },
  cardTexto: {
    fontSize: 13,
    color: '#475569'
  },
  cardLink: {
    fontSize: 12,
    color: '#3b7cd3',
    marginTop: 10,
    fontWeight: '600'
  },

  caixaDados: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20
  },
  dadosTitulo: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 15
  },
  linhaDados: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  rotulo: {
    fontSize: 13,
    color: '#64748b'
  },
  valor: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '500'
  }
});
