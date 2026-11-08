import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

type Aba = 'rituais' | 'itens';

export default function BibliotecaScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? user?.campaignId ?? 'default';
  const userId = user?.id ?? 'user-1';
  const { rituais, itens, loading, error } = useBiblioteca();
  const [aba, setAba] = useState<Aba>('rituais');
  const [busca, setBusca] = useState('');

  const rituaisFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rituais.filter((r) => !q || r.nome.toLowerCase().includes(q) || r.elemento.toLowerCase().includes(q));
  }, [rituais, busca]);

  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((i) => !q || i.nome.toLowerCase().includes(q) || i.tipo.toLowerCase().includes(q));
  }, [itens, busca]);

  if (loading) return <Centered text="Carregando biblioteca..." />;
  if (error) return <Centered text={error} error />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.titulo}>Biblioteca</Text>

      <View style={styles.abas}>
        <TouchableOpacity onPress={() => setAba('rituais')} style={[styles.aba, aba === 'rituais' ? styles.abaAtiva : null]}>
          <Text style={[styles.abaTexto, aba === 'rituais' ? styles.abaTextoAtivo : null]}>Rituais ({rituais.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAba('itens')} style={[styles.aba, aba === 'itens' ? styles.abaAtiva : null]}>
          <Text style={[styles.abaTexto, aba === 'itens' ? styles.abaTextoAtivo : null]}>Itens ({itens.length})</Text>
        </TouchableOpacity>
      </View>

      <Card style={styles.card}>
        <CardContent>
          <Input label="Buscar" value={busca} onChangeText={setBusca} placeholder="Nome ou tipo..." />
        </CardContent>
      </Card>

      {aba === 'rituais' ? (
        rituaisFiltrados.length === 0 ? (
          <Card style={styles.card}>
            <CardContent>
              <Text style={styles.vazio}>Nenhum ritual na biblioteca.</Text>
            </CardContent>
          </Card>
        ) : (
          rituaisFiltrados.map((r) => (
            <Card key={r.id} style={styles.card}>
              <CardContent>
                <Text style={styles.itemNome}>{r.nome}</Text>
                <Text style={styles.itemMeta}>
                  {r.circulo}º círculo{r.elemento ? ' · ' + r.elemento : ''} · {r.alvoTipo}
                  {r.execucao ? ' · ' + r.execucao : ''}
                </Text>
                {r.alcance ? <Text style={styles.linha}>Alcance: {r.alcance}</Text> : null}
                {r.duracao ? <Text style={styles.linha}>Duração: {r.duracao}</Text> : null}
                {r.resistencia ? <Text style={styles.linha}>Resistência: {r.resistencia}</Text> : null}
                {r.danoNormal ? <Text style={styles.linha}>Dano: {r.danoNormal}{r.tipoDano ? ' (' + r.tipoDano + ')' : ''}</Text> : null}
                {r.efeito ? <Text style={styles.efeito}>{r.efeito}</Text> : null}
              </CardContent>
            </Card>
          ))
        )
      ) : itensFiltrados.length === 0 ? (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.vazio}>Nenhum item na biblioteca.</Text>
          </CardContent>
        </Card>
      ) : (
        itensFiltrados.map((i) => (
          <Card key={i.id} style={styles.card}>
            <CardContent>
              <Text style={styles.itemNome}>{i.nome}</Text>
              <Text style={styles.itemMeta}>
                {i.tipo} · categoria {i.categoria} · {i.espacos} esp.
                {i.defesa ? ' · defesa ' + String(i.defesa) : ''}
              </Text>
              {i.dano ? <Text style={styles.linha}>Dano: {i.dano}{i.tipoDano ? ' (' + i.tipoDano + ')' : ''}{i.critico ? ' · crítico ' + i.critico : ''}</Text> : null}
              {i.alcance ? <Text style={styles.linha}>Alcance: {i.alcance}</Text> : null}
              {i.descricao ? <Text style={styles.efeito}>{i.descricao}</Text> : null}
            </CardContent>
          </Card>
        ))
      )}
    </ScrollView>
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
  abas: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  aba: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a3e' },
  abaAtiva: { borderColor: '#3b82f6' },
  abaTexto: { color: '#8888a0', fontWeight: '600', fontSize: 13 },
  abaTextoAtivo: { color: '#3b82f6' },
  card: { marginBottom: 12 },
  itemNome: { fontSize: 16, fontWeight: '600', color: '#e8e8f0' },
  itemMeta: { fontSize: 12, color: '#8888a0', marginTop: 2, marginBottom: 6 },
  linha: { fontSize: 12, color: '#c8c8d8', marginBottom: 2 },
  efeito: { fontSize: 13, color: '#c8c8d8', lineHeight: 20, marginTop: 6 },
  vazio: { color: '#8888a0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centeredText: { color: '#8888a0', textAlign: 'center' },
  erro: { color: '#ef4444' },
});
