import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useRegras } from '@/hooks/useRegras';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import Fuse from 'fuse.js';

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

export default function RegrasIndex() {
  const { regras, loading, error } = useRegras();
  const [busca, setBusca] = useState('');
  const [capituloFiltro, setCapituloFiltro] = useState<number | null>(null);

  // Fuse.js para busca full-text
  const fuse = useMemo(
    () =>
      new Fuse(regras, {
        keys: ['titulo', 'conteudo'],
        threshold: 0.4,
        includeScore: true,
        includeMatches: true,
        minMatchCharLength: 2,
      }),
    [regras]
  );

  const resultados = useMemo(() => {
    let filtradas = regras;

    // Filtro por capítulo
    if (capituloFiltro !== null) {
      filtradas = filtradas.filter(r => r.capitulo === capituloFiltro);
    }

    // Busca full-text
    if (busca.trim()) {
      const fuseResults = fuse.search(busca.trim());
      const ids = new Set(fuseResults.map(r => r.item.id));
      filtradas = filtradas.filter(r => ids.has(r.id));
    }

    return filtradas;
  }, [regras, busca, capituloFiltro, fuse]);

  const capitulosDisponiveis = useMemo(() => {
    const set = new Set<number>();
    regras.forEach(r => set.add(r.capitulo));
    return Array.from(set).sort((a, b) => a - b);
  }, [regras]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Carregando regras...</Text>
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
        <Text style={styles.titulo}>Regras</Text>
      </View>

      <Card style={styles.searchCard}>
        <CardContent>
          <Input label="Buscar" value={busca} onChangeText={setBusca} placeholder="Buscar nas regras..." />

          <View style={styles.capitulosFiltro}>
            <TouchableOpacity
              onPress={() => setCapituloFiltro(null)}
              style={[styles.filtroBtn, capituloFiltro === null && styles.filtroBtnAtivo]}
            >
              <Text style={[styles.filtroBtnTexto, capituloFiltro === null && styles.filtroBtnTextoAtivo]}>
                Todos
              </Text>
            </TouchableOpacity>
            {capitulosDisponiveis.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setCapituloFiltro(c)}
                style={[styles.filtroBtn, capituloFiltro === c && styles.filtroBtnAtivo]}
              >
                <Text style={[styles.filtroBtnTexto, capituloFiltro === c && styles.filtroBtnTextoAtivo]}>
                  Cap. {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </CardContent>
      </Card>

      {resultados.length === 0 ? (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.vazio}>
              {busca || capituloFiltro !== null ? 'Nenhuma regra encontrada.' : 'Nenhuma regra carregada.'}
            </Text>
          </CardContent>
        </Card>
      ) : (
        <ScrollView contentContainerStyle={styles.lista}>
          {resultados.map(r => (
            <TouchableOpacity
              key={r.id}
              onPress={() => router.push(`/campanha/regras/${r.capitulo}`)}
              style={styles.item}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemCapitulo}>Cap. {r.capitulo}</Text>
                <Text style={styles.itemTitulo}>{r.titulo}</Text>
              </View>
              <Text style={styles.itemPreview} numberOfLines={3}>
                {r.conteudo.replace(/[#*_`\[\]]/g, '').slice(0, 200)}...
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: { padding: 16, paddingBottom: 8 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0' },
  searchCard: { margin: 16, marginBottom: 12 },
  capitulosFiltro: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  filtroBtn: {
    backgroundColor: '#0f0f1a',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  filtroBtnAtivo: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  filtroBtnTexto: { color: '#a0a0c0', fontSize: 12, fontWeight: '600' },
  filtroBtnTextoAtivo: { color: 'white' },
  card: { margin: 16, marginBottom: 12 },
  lista: { paddingHorizontal: 16, paddingBottom: 100 },
  item: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a3e' },
  itemHeader: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  itemCapitulo: { color: '#3b82f6', fontSize: 11, fontWeight: '600', backgroundColor: '#1a1a2e', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  itemTitulo: { color: '#e8e8f0', fontSize: 16, fontWeight: '600' },
  itemPreview: { color: '#c8c8d8', fontSize: 13, lineHeight: 20 },
  vazio: { color: '#8888a0', textAlign: 'center' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8888a0' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#ef4444', textAlign: 'center' },
});