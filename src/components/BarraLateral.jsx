import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function BarraLateral({ navegarPara }) {
  return (
    <View style={styles.barraLateral}>
      {/* 💧 Marca d'água MURADE */}
      <Text style={styles.marcaDAgua}>MURADE</Text>

      {/* LOGO */}
      <View style={styles.cabecalho}>
        <Text style={styles.logo}>FISCOIA</Text>
        <Text style={styles.subtitulo}>Sistema de Conformidade</Text>
      </View>

      {/* PAINEL MURADE */}
      <View style={styles.painelMurad}>
        <Text style={styles.tituloPainel}>👑 MURADE</Text>
        <Text style={styles.textoPainel}>Acesso Master</Text>
      </View>

      <View style={styles.linhaDivisoria} />

      {/* MENU */}
      {[
        { nome: 'Início', tela: 'Inicio' },
        { nome: 'Cadastrar Empresa', tela: 'CadastroEmpresa' },
        { nome: 'Empresas', tela: 'Empresas' },
        { nome: 'Fiscal (Agenda)', tela: 'Fiscal' },
        { nome: 'CND / Certidões', tela: 'CND' },
        { nome: 'Guias', tela: 'DCTFWeb' },
        { nome: 'Integração SERPRO', tela: 'SERPRO' },
        { nome: 'Procuração e-CAC', tela: 'Procuracao' },
        { nome: 'Minha Conta', tela: 'Conta' },
      ].map((item, i) => (
        <TouchableOpacity
          key={i}
          style={[
            styles.itemMenu,
            item.tela === 'DCTFWeb' && styles.itemAtivo
          ]}
          onPress={() => navegarPara && navegarPara(item.tela)}
        >
          <Text style={[
            styles.textoMenu,
            item.tela === 'DCTFWeb' && styles.textoAtivo
          ]}>
            {item.nome}
          </Text>
        </TouchableOpacity>
      ))}

      <View style={{ flex: 1 }} />

      <TouchableOpacity style={styles.botaoSair}>
        <Text style={styles.textoSair}>Sair do Sistema</Text>
      </TouchableOpacity>
    </View>
  );
}

// ==========================================================
// 🎨 AZUL ESCURO — AQUI É ONDE MUDA A COR!
// ==========================================================
const styles = StyleSheet.create({
  barraLateral: {
    width: 220,
    backgroundColor: '#1e3a8a', // 🔵 AZUL ESCURO — bem fechado e elegante!
    paddingTop: 30,
    paddingHorizontal: 15,
    position: 'relative',
    
    // Sombra pra dar profundidade
    shadowColor: '#0f172a',
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8
  },

  // 💧 Marca d'água MURAD
  marcaDAgua: {
    position: 'absolute',
    top: 100,
    left: 15,
    fontSize: 38,
    fontWeight: '900',
    color: '#ffffff',
    opacity: 0.06,
    transform: [{ rotate: '-15deg' }],
    letterSpacing: 6
  },

  cabecalho: {
    alignItems: 'center',
    marginBottom: 25,
    marginTop: 10
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  subtitulo: {
    fontSize: 11,
    color: '#a5b4fc',
    marginTop: 3
  },

  painelMurad: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15
  },
  tituloPainel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff'
  },
  textoPainel: {
    fontSize: 11,
    color: '#a5b4fc',
    marginTop: 2
  },

  linhaDivisoria: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 12
  },

  itemMenu: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4
  },
  itemAtivo: {
    backgroundColor: '#3b82f6',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4
  },
  textoMenu: {
    fontSize: 14,
    color: '#e0e7ff'
  },
  textoAtivo: {
    color: '#ffffff',
    fontWeight: 'bold'
  },

  botaoSair: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    marginTop: 10
  },
  textoSair: {
    fontSize: 13,
    color: '#fca5a5'
  }
});
