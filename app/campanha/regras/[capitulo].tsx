import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView, Platform, TextStyle } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useRegras } from '@/hooks/useRegras';
import { Card, CardContent } from '@/components/ui/Card';
import { Ionicons } from '@expo/vector-icons';

// Simple markdown renderer for React Native
const MARKDOWN_STYLES: Record<string, TextStyle> = {
  heading1: { fontSize: 24, fontWeight: 'bold' as const, color: '#e8e8f0', marginVertical: 16 },
  heading2: { fontSize: 20, fontWeight: 'bold' as const, color: '#e8e8f0', marginVertical: 12 },
  heading3: { fontSize: 18, fontWeight: '600' as const, color: '#e8e8f0', marginVertical: 8 },
  paragraph: { fontSize: 14, color: '#c8c8d8', lineHeight: 22, marginBottom: 12 },
  strong: { fontWeight: 'bold' as const, color: '#e8e8f0' },
  em: { fontStyle: 'italic' as const, color: '#c8c8d8' },
  link: { color: '#3b82f6', textDecorationLine: 'underline' as const },
  blockquote: { borderLeftWidth: 3, borderLeftColor: '#3b82f6', paddingLeft: 12, marginVertical: 8, opacity: 0.8 },
  code: { fontFamily: 'monospace', backgroundColor: '#1a1a2e', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, color: '#f59e0b', fontSize: 13 },
  codeblock: { fontFamily: 'monospace', backgroundColor: '#1a1a2e', padding: 12, borderRadius: 8, marginVertical: 12, color: '#c8c8d8', fontSize: 13 },
  listitem: { fontSize: 14, color: '#c8c8d8', lineHeight: 22, marginLeft: 16, marginBottom: 4 },
  list: { marginVertical: 8 },
  hr: { borderBottomWidth: 1, borderBottomColor: '#2a2a3e', marginVertical: 16 },
  image: { width: '100%', height: 200, borderRadius: 8, marginVertical: 12 },
};

function renderMarkdown(content: string) {
  // Simple markdown parsing - in production use react-native-markdown-renderer or similar
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<View key={i} style={{ height: 8 }} />);
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(<Text key={i} style={MARKDOWN_STYLES.heading3}>{trimmed.slice(4)}</Text>);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<Text key={i} style={MARKDOWN_STYLES.heading2}>{trimmed.slice(3)}</Text>);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(<Text key={i} style={MARKDOWN_STYLES.heading1}>{trimmed.slice(2)}</Text>);
      continue;
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      elements.push(<View key={i} style={MARKDOWN_STYLES.hr} />);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(
        <View key={i} style={MARKDOWN_STYLES.blockquote}>
          <Text style={MARKDOWN_STYLES.paragraph}>{trimmed.slice(2)}</Text>
        </View>
      );
      continue;
    }

    // Code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      let codeContent = '';
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeContent += lines[i] + '\n';
        i++;
      }
      elements.push(
        <Text key={i} style={MARKDOWN_STYLES.codeblock}>{codeContent.trim()}</Text>
      );
      continue;
    }

    // Lists
    if (trimmed.match(/^[-*+]\s/) || trimmed.match(/^\d+\.\s/)) {
      const text = trimmed.replace(/^[-*+]\s/, '').replace(/^\d+\.\s/, '');
      elements.push(
        <Text key={i} style={MARKDOWN_STYLES.listitem}>
          {'\u2022 '}{parseInline(text)}
        </Text>
      );
      continue;
    }

    // Paragraph with inline formatting
    elements.push(<Text key={i} style={MARKDOWN_STYLES.paragraph}>{parseInline(line)}</Text>);
  }

  return <View style={{ paddingBottom: 20 }}>{elements}</View>;
}

function parseInline(text: string): React.ReactNode {
  // Parse bold, italic, code, links
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={idx} style={MARKDOWN_STYLES.strong}>{part.slice(2, -2)}</Text>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <Text key={idx} style={MARKDOWN_STYLES.em}>{part.slice(1, -1)}</Text>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <Text key={idx} style={MARKDOWN_STYLES.code}>{part.slice(1, -1)}</Text>;
    }
    const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      return <Text key={idx} style={MARKDOWN_STYLES.link}>{linkMatch[1]}</Text>;
    }
    return <Text key={idx}>{part}</Text>;
  });
}

const CAPITULOS = [
  { num: 1, titulo: 'Introdução' },
  { num: 2, titulo: 'Perícias' },
  { num: 3, titulo: 'Combate' },
  { num: 4, titulo: 'Rituais' },
  { num: 5, titulo: 'Equipamento' },
  { num: 6, titulo: 'O Horror' },
  { num: 7, titulo: 'Ameaças' },
  { num: 8, titulo: 'Mestre' },
  { num: 9, titulo: 'Apêndices' },
];

export default function RegrasCapitulo() {
  const { capitulo } = useLocalSearchParams<{ capitulo: string }>();
  const capNum = parseInt(capitulo, 10);
  const { regras, loading, error } = useRegras();
  const [fontSize, setFontSize] = useState(14);
  const [scrollY, setScrollY] = useState(0);

  const regra = useMemo(() => regras.find(r => r.capitulo === capNum), [regras, capNum]);
  const capInfo = CAPITULOS.find(c => c.num === capNum);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Carregando capítulo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!regra) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.error}>
          <Text style={styles.errorText}>Capítulo não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Scroll spy - highlight current section in sidebar (simplified)
  const prevCap = capNum > 1 ? capNum - 1 : null;
  const nextCap = capNum < 9 ? capNum + 1 : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={24} color="#e8e8f0" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerCapitulo}>Capítulo {capNum}</Text>
          <Text style={styles.headerTitulo}>{capInfo?.titulo || regra.titulo}</Text>
        </View>
        <View style={styles.fontControls}>
          <TouchableOpacity onPress={() => setFontSize(Math.max(12, fontSize - 1))} style={styles.fontBtn}>
            <Ionicons name="remove-outline" size={20} color="#e8e8f0" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFontSize(Math.min(20, fontSize + 1))} style={styles.fontBtn}>
            <Ionicons name="add-outline" size={20} color="#e8e8f0" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        onScroll={e => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
      >
        <View style={styles.content}>
          {/* Page marker */}
          {regra.paginaLivro && (
            <View style={styles.pageMarker}>
              <Text style={styles.pageMarkerTexto}>
                📖 Página do livro: {regra.paginaLivro} {regra.paginaLivro <= 10 ? '(OP)' : '(SaH)'}
              </Text>
            </View>
          )}

          <Text style={[MARKDOWN_STYLES.heading1, { fontSize: fontSize + 10 }]}>{regra.titulo}</Text>

          {regra.paginaLivro && (
            <Text style={[MARKDOWN_STYLES.paragraph, { fontSize, opacity: 0.6 }]}>
              Livro base: {regra.paginaLivro <= 10 ? 'Ordem Paranormal' : 'Sobrevivendo ao Horror'} — pág. {regra.paginaLivro}
            </Text>
          )}

          {/* Render markdown content */}
          {renderMarkdown(regra.conteudo)}

          {/* Navigation */}
          <View style={styles.nav}>
            {prevCap && (
              <TouchableOpacity onPress={() => router.push(`/campanha/regras/${prevCap}`)} style={styles.navBtn}>
                <Ionicons name="chevron-back-outline" size={20} color="#e8e8f0" />
                <Text style={styles.navBtnTexto}>Cap. {prevCap}</Text>
              </TouchableOpacity>
            )}
            {nextCap && (
              <TouchableOpacity onPress={() => router.push(`/campanha/regras/${nextCap}`)} style={[styles.navBtn, styles.navBtnNext]}>
                <Text style={styles.navBtnTexto}>Cap. {nextCap}</Text>
                <Ionicons name="chevron-forward-outline" size={20} color="#e8e8f0" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8888a0' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#ef4444', textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
    backgroundColor: '#1a1a2e',
  },
  backBtn: { padding: 8 },
  headerCenter: { flex: 1, paddingHorizontal: 12 },
  headerCapitulo: { color: '#3b82f6', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  headerTitulo: { color: '#e8e8f0', fontSize: 18, fontWeight: 'bold' },
  fontControls: { flexDirection: 'row', gap: 8 },
  fontBtn: { padding: 8 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  pageMarker: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  pageMarkerTexto: { color: '#3b82f6', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#2a2a3e' },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1a1a2e', borderRadius: 8, borderWidth: 1, borderColor: '#2a2a3e' },
  navBtnNext: { flexDirection: 'row-reverse' },
  navBtnTexto: { color: '#e8e8f0', fontSize: 14, fontWeight: '600' },
});