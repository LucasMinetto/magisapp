import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import Fuse from 'fuse.js';

type BuscaTipo = 'rituais' | 'itens' | 'todos';

export default function BuscaScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { rituais, itens, loading, error } = useBiblioteca();

  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<BuscaTipo>('todos');

  const fuseRituais = useMemo(
    () =>
      new Fuse(rituais, {
        keys: ['nome', 'elemento', 'efeito', 'resistencia', 'execucao'],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [rituais]
  );

  const fuseItens = useMemo(
    () =>
      new Fuse(itens, {
        keys: ['nome', 'tipo', 'descricao', 'dano', 'tipoDano'],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [itens]
  );

  const resultados = useMemo(() => {
    if (!busca.trim()) return { rituais: [], itens: [] };

    let rituaisResultado: typeof rituais = [];
    let itensResultado: typeof itens = [];

    if (tipo === 'rituais' || tipo === 'todos') {
      const fuseResults = fuseRituais.search(busca.trim());
      rituaisResultado = fuseResults.map(r => r.item);
    }

    if (tipo === 'itens' || tipo === 'todos') {
      const fuseResults = fuseItens.search(busca.trim());
      itensResultado = fuseResults.map(r => r.item);
    }

    return { rituais: rituaisResultado, itens: itensResultado };
  }, [busca, tipo, fuseRituais, fuseItens]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Carregando...</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Busca Unificada</Text>
      </View>

      <Card style={styles.searchCard}>
        <CardContent>
          <Input label="Buscar" value={busca} onChangeText={setBusca} placeholder="Nome, texto, tipo..." />

          <View style={styles.tipoToggle}>
            <TouchableOpacity
              onPress={() => setTipo('todos')}
              style={[styles.tipoBtn, tipo === 'todos' && styles.tipoBtnAtivo]}
            >
              <Text style={[styles.tipoBtnTexto, tipo === 'todos' && styles.tipoBtnTextoAtivo]}>Todos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTipo('rituais')}
              style={[styles.tipoBtn, tipo === 'rituais' && styles.tipoBtnAtivo]}
            >
              <Text style={[styles.tipoBtnTexto, tipo === 'rituais' && styles.tipoBtnTextoAtivo]}>Rituais</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTipo('itens')}
              style={[styles.tipoBtn, tipo === 'itens' && styles.tipoBtnAtivo]}
            >
              <Text style={[styles.tipoBtnTexto, tipo === 'itens' && styles.tipoBtnTextoAtivo]}>Itens</Text>
            </TouchableOpacity>
          </View>
        </CardContent>
      </Card>

      {tipo !== 'itens' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rituais ({resultados.rituais.length})</Text>
          {resultados.rituais.length === 0 ? (
            <Card style={styles.card}><CardContent><Text style={styles.vazio}>Nenhum ritual encontrado.</Text></CardContent></Card>
          ) : (
            <ScrollView contentContainerStyle={styles.lista}>
              {resultados.rituais.map(r => (
                <TouchableOpacity key={r.id} onPress={() => router.push(`/campanha/biblioteca/${r.id}`)} style={styles.item}>
                  <View style={styles.itemHeader}>
                    <View style={[styles.elementoBadge, { backgroundColor: getElementoColor(r.elemento) }]} />
                    <Text style={styles.itemElementoTexto}>{r.elemento}</Text>
                    <Text style={styles.itemCirculo}>{r.circulo}º círculo</Text>
                  </View>
                  <Text style={styles.itemNome}>{r.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {tipo !== 'rituais' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Itens ({resultados.itens.length})</Text>
          {resultados.itens.length === 0 ? (
            <Card style={styles.card}><CardContent><Text style={styles.vazio}>Nenhum item encontrado.</Text></CardContent></Card>
          ) : (
            <ScrollView contentContainerStyle={styles.lista}>
              {resultados.itens.map(i => (
                <TouchableOpacity key={i.id} onPress={() => router.push(`/campanha/biblioteca/${i.id}`)} style={styles.item}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTipoBadge}>{i.tipo}</Text>
                    <Text style={styles.itemCategoria}>Cat. {i.categoria}</Text>
                  </View>
                  <Text style={styles.itemNome}>{i.nome}</Text>
                  {i.dano && <Text style={styles.itemDano}>Dano: {i.dano} {i.tipoDano || ''}</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {!busca && (
        <Card style={styles.card}><CardContent><Text style={styles.vazio}>Digite algo para buscar.</Text></CardContent></Card>
      )}
    </SafeAreaView>
  );
}

function getElementoColor(elemento: string): string {
  switch (elemento) {
    case 'Sangue': return '#ef4444';
    case 'Morte': return '#6b7280';
    case 'Conhecimento': return '#3b82f6';
    case 'Energia': return '#f59e0b';
    case 'Medo': return '#8b5cf6';
    default: return '#666680';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: { padding: 16, paddingBottom: 8 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0' },
  searchCard: { margin: 16, marginBottom: 12 },
  tipoToggle: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tipoBtn: { flex: 1, backgroundColor: '#0f0f1a', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a3e' },
  tipoBtnAtivo: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  tipoBtnTexto: { color: '#a0a0c0', fontSize: 12, fontWeight: '600' },
  tipoBtnTextoAtivo: { color: 'white' },
  section: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 8 },
  card: { margin: 16, marginBottom: 12 },
  lista: { paddingHorizontal: 16, paddingBottom: 100 },
  item: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a3e' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  elementoBadge: { width: 10, height: 10, borderRadius: 5 },
  itemElementoTexto: { color: '#a0a0c0', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  itemCirculo: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },
  itemTipoBadge: { backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2a2a3e' },
  itemCategoria: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },
  itemNome: { fontSize: 18, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 8 },
  itemDano: { color: '#f59e0b', fontSize: 12, fontWeight: '600', marginTop: 4 },
  vazio: { color: '#8888a0', textAlign: 'center' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8888a0' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#ef4444', textAlign: 'center' },
});