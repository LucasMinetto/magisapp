import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRegras } from '@/hooks/useRegras';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export default function RegrasScreen() {
  const { regras, loading, error } = useRegras();
  const [busca, setBusca] = useState('');
  const [capitulo, setCapitulo] = useState<number | null>(null);

  const capitulos = useMemo(() => {
    const set = new Set<number>();
    regras.forEach((r) => set.add(r.capitulo));
    return Array.from(set).sort((a, b) => a - b);
  }, [regras]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return regras.filter((r) => {
      if (capitulo !== null && r.capitulo !== capitulo) return false;
      if (!q) return true;
      return r.titulo.toLowerCase().includes(q) || r.conteudo.toLowerCase().includes(q);
    });
  }, [regras, busca, capitulo]);

  if (loading) return <Centered text="Carregando regras..." />;
  if (error) return <Centered text={error} error />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.titulo}>Regras</Text>

      <Card style={styles.card}>
        <CardContent>
          <Input label="Buscar" value={busca} onChangeText={setBusca} placeholder="Buscar nas regras..." />
          <View style={styles.capitulos}>
            <Filtro ativo={capitulo === null} texto="Todos" onPress={() => setCapitulo(null)} />
            {capitulos.map((c) => (
              <Filtro key={c} ativo={capitulo === c} texto={'Cap. ' + String(c)} onPress={() => setCapitulo(c)} />
            ))}
          </View>
        </CardContent>
      </Card>

      {filtradas.length === 0 ? (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.vazio}>Nenhuma regra encontrada.</Text>
          </CardContent>
        </Card>
      ) : (
        filtradas.map((r) => (
          <Card key={r.id} style={styles.card}>
            <CardContent>
              <Text style={styles.regraTitulo}>{r.titulo}</Text>
              <Text style={styles.regraMeta}>
                Cap. {r.capitulo}
                {r.paginaLivro ? ' · pág. ' + String(r.paginaLivro) : ''}
                {r.visivelParaJogadores ? '' : ' · oculta'}
              </Text>
              <Text style={styles.regraConteudo}>{r.conteudo}</Text>
            </CardContent>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function Filtro({ ativo, texto, onPress }: { ativo: boolean; texto: string; onPress: () => void }) {
  return (
    <Text onPress={onPress} style={[styles.filtro, ativo ? styles.filtroAtivo : null]}>
      {texto}
    </Text>
  );
}

function Centered({ text, error }: { text: string; error?: boolean }) {
  return (
    <View style={styles.centered}>
      <Text style={[styles.centeredText, error ? styles.erro : null]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 16 },
  card: { marginBottom: 12 },
  capitulos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  filtro: { backgroundColor: '#0f0f1a', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, color: '#a0a0c0', fontSize: 12, borderWidth: 1, borderColor: '#2a2a3e', overflow: 'hidden' },
  filtroAtivo: { backgroundColor: '#3b82f6', color: 'white', borderColor: '#3b82f6' },
  regraTitulo: { fontSize: 16, fontWeight: '600', color: '#e8e8f0' },
  regraMeta: { fontSize: 11, color: '#8888a0', marginTop: 2, marginBottom: 8 },
  regraConteudo: { fontSize: 13, color: '#c8c8d8', lineHeight: 20 },
  vazio: { color: '#8888a0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centeredText: { color: '#8888a0', textAlign: 'center' },
  erro: { color: '#ef4444' },
});
