import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Fuse from 'fuse.js';

const TIPOS_ITEM = ['Arma', 'Proteção', 'Equipamento', 'Munição', 'Amaldiçoado'];
const CATEGORIAS = [0, 1, 2, 3, 4];

export default function ItensScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { itens, loading, error } = useBiblioteca();

  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<string>('');
  const [categoria, setCategoria] = useState<number | ''>('');

  const fuse = useMemo(
    () =>
      new Fuse(itens, {
        keys: ['nome', 'tipo', 'descricao', 'dano', 'tipoDano'],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [itens]
  );

  const filtrados = useMemo(() => {
    let resultado = itens;

    if (busca.trim()) {
      const fuseResults = fuse.search(busca.trim());
      const ids = new Set(fuseResults.map(r => r.item.id));
      resultado = resultado.filter(r => ids.has(r.id));
    }

    if (tipo) {
      resultado = resultado.filter(r => r.tipo === tipo);
    }

    if (categoria !== '') {
      resultado = resultado.filter(r => r.categoria === categoria);
    }

    return resultado;
  }, [itens, busca, tipo, categoria, fuse]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Carregando itens...</Text>
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
        <Text style={styles.titulo}>Itens</Text>
      </View>

      <Card style={styles.filterCard}>
        <CardContent>
          <Input label="Buscar" value={busca} onChangeText={setBusca} placeholder="Nome, tipo, descrição..." />

          <View style={styles.filterRow}>
            <Select
              label="Tipo"
              value={tipo}
              onChange={setTipo}
              options={[{ value: '', label: 'Todos' }, ...TIPOS_ITEM.map(t => ({ value: t, label: t }))]}
              style={styles.filterSelect}
            />
            <Select
              label="Categoria"
              value={String(categoria)}
              onChange={v => setCategoria(v === '' ? '' : parseInt(v))}
              options={[{ value: '', label: 'Todas' }, ...CATEGORIAS.map(c => ({ value: String(c), label: `Cat. ${c}` }))]}
              style={styles.filterSelect}
            />
          </View>
        </CardContent>
      </Card>

      {filtrados.length === 0 ? (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.vazio}>Nenhum item encontrado.</Text>
          </CardContent>
        </Card>
      ) : (
        <ScrollView contentContainerStyle={styles.lista}>
          {filtrados.map(i => (
            <TouchableOpacity
              key={i.id}
              onPress={() => router.push(`/campanha/biblioteca/${i.id}`)}
              style={styles.item}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTipoBadge}>{i.tipo}</Text>
                <Text style={styles.itemCategoria}>Cat. {i.categoria}</Text>
              </View>
              <Text style={styles.itemNome}>{i.nome}</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.metaItem}>{i.espacos} esp.</Text>
                {i.defesa && <Text style={styles.metaItem}>Def: {i.defesa}</Text>}
              </View>
              {i.dano && (
                <Text style={styles.itemDano}>Dano: {i.dano} {i.tipoDano || ''}{i.critico ? ` · Crítico: ${i.critico}` : ''}</Text>
              )}
              {i.alcance && <Text style={styles.itemAlcance}>Alcance: {i.alcance}</Text>}
              {i.descricao && <Text style={styles.itemDesc} numberOfLines={2}>{i.descricao}</Text>}
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
  filterCard: { margin: 16, marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  filterSelect: { flex: 1 },
  card: { margin: 16, marginBottom: 12 },
  lista: { paddingHorizontal: 16, paddingBottom: 100 },
  item: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a3e' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTipoBadge: { backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2a2a3e' },
  itemCategoria: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },
  itemNome: { fontSize: 18, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 8 },
  itemMeta: { flexDirection: 'row', gap: 16, marginBottom: 8, flexWrap: 'wrap' },
  metaItem: { color: '#8888a0', fontSize: 12 },
  itemDano: { color: '#f59e0b', fontSize: 12, fontWeight: '600', marginTop: 4 },
  itemAlcance: { color: '#8888a0', fontSize: 12, marginTop: 4 },
  itemDesc: { color: '#c8c8d8', fontSize: 12, lineHeight: 18, marginTop: 8 },
  vazio: { color: '#8888a0', textAlign: 'center' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8888a0' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#ef4444', textAlign: 'center' },
});