import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Fuse from 'fuse.js';

const ELEMENTOS = ['Sangue', 'Morte', 'Conhecimento', 'Energia', 'Medo'];
const CIRCULOS = [1, 2, 3, 4];

export default function RituaisScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { rituais, loading, error } = useBiblioteca();

  const [busca, setBusca] = useState('');
  const [elemento, setElemento] = useState<string>('');
  const [circulo, setCirculo] = useState<number | ''>('');

  const fuse = useMemo(
    () =>
      new Fuse(rituais, {
        keys: ['nome', 'elemento', 'efeito', 'resistencia', 'execucao'],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [rituais]
  );

  const filtrados = useMemo(() => {
    let resultado = rituais;

    if (busca.trim()) {
      const fuseResults = fuse.search(busca.trim());
      const ids = new Set(fuseResults.map(r => r.item.id));
      resultado = resultado.filter(r => ids.has(r.id));
    }

    if (elemento) {
      resultado = resultado.filter(r => r.elemento === elemento);
    }

    if (circulo !== '') {
      resultado = resultado.filter(r => r.circulo === circulo);
    }

    return resultado;
  }, [rituais, busca, elemento, circulo, fuse]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Carregando rituais...</Text>
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
        <Text style={styles.titulo}>Rituais</Text>
      </View>

      <Card style={styles.filterCard}>
        <CardContent>
          <Input label="Buscar" value={busca} onChangeText={setBusca} placeholder="Nome, efeito, resistência..." />

          <View style={styles.filterRow}>
            <Select
              label="Elemento"
              value={elemento}
              onChange={setElemento}
              options={[{ value: '', label: 'Todos' }, ...ELEMENTOS.map(e => ({ value: e, label: e }))]}
              style={styles.filterSelect}
            />
            <Select
              label="Círculo"
              value={String(circulo)}
              onChange={v => setCirculo(v === '' ? '' : parseInt(v))}
              options={[{ value: '', label: 'Todos' }, ...CIRCULOS.map(c => ({ value: String(c), label: `${c}º` }))]}
              style={styles.filterSelect}
            />
          </View>
        </CardContent>
      </Card>

      {filtrados.length === 0 ? (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.vazio}>Nenhum ritual encontrado.</Text>
          </CardContent>
        </Card>
      ) : (
        <ScrollView contentContainerStyle={styles.lista}>
          {filtrados.map(r => (
            <TouchableOpacity
              key={r.id}
              onPress={() => router.push(`/campanha/biblioteca/${r.id}`)}
              style={styles.item}
            >
              <View style={styles.itemHeader}>
                <View style={styles.itemElemento}>
                  <View style={[styles.elementoBadge, { backgroundColor: getElementoColor(r.elemento) }]} />
                  <Text style={styles.itemElementoTexto}>{r.elemento}</Text>
                </View>
                <Text style={styles.itemCirculo}>{r.circulo}o círculo</Text>
              </View>
              <Text style={styles.itemNome}>{r.nome}</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.metaItem}>{r.execucao || 'Padrão'}</Text>
                <Text style={styles.metaItem}>{r.alcance || '-'}</Text>
                <Text style={styles.metaItem}>{r.duracao || '-'}</Text>
              </View>
              {r.danoNormal && (
                <Text style={styles.itemDano}>Dano: {r.danoNormal} {r.tipoDano || ''}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
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
  filterCard: { margin: 16, marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  filterSelect: { flex: 1 },
  card: { margin: 16, marginBottom: 12 },
  lista: { paddingHorizontal: 16, paddingBottom: 100 },
  item: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a3e' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemElemento: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  elementoBadge: { width: 10, height: 10, borderRadius: 5 },
  itemElementoTexto: { color: '#a0a0c0', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  itemCirculo: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },
  itemNome: { fontSize: 18, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 8 },
  itemMeta: { flexDirection: 'row', gap: 16, marginBottom: 8, flexWrap: 'wrap' },
  metaItem: { color: '#8888a0', fontSize: 12 },
  itemDano: { color: '#f59e0b', fontSize: 12, fontWeight: '600', marginTop: 4 },
  vazio: { color: '#8888a0', textAlign: 'center' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8888a0' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#ef4444', textAlign: 'center' },
});