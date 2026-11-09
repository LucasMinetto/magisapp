import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useFicha } from '@/hooks/useFicha';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import { Card, CardContent } from '@/components/ui/Card';
import { generateId } from '@/lib/id';

export default function FichaRituaisScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? useAuth.getState().campaignId ?? 'default';
  const userId = user?.id ?? 'user-1';
  const { ficha, loading, error, saveFicha } = useFicha(campanha, userId);
  const { rituais } = useBiblioteca();

  if (loading) return <Centered text="Carregando..." />;
  if (error) return <Centered text={error} error />;
  if (!ficha) return <Centered text="Nenhuma ficha nesta campanha ainda." />;

  const conhecidos = ficha.rituais.map((r) => r.nome.toLowerCase());

  const aprender = (nome: string) => {
    if (conhecidos.includes(nome.toLowerCase())) return;
    const modelo = rituais.find((r) => r.nome.toLowerCase() === nome.toLowerCase());
    void saveFicha({
      ...ficha,
      rituais: [
        ...ficha.rituais,
        {
          id: generateId(),
          nome,
          elemento: modelo?.elemento ?? '',
          circulo: modelo?.circulo ?? 1,
          execucao: modelo?.execucao ?? '',
          alcance: modelo?.alcance ?? '',
          alvo: modelo?.alvo ?? '',
          duracao: modelo?.duracao ?? '',
          resistencia: modelo?.resistencia ?? '',
          efeito: modelo?.efeito ?? '',
          discente: modelo?.discente ?? '',
          verdadeiro: modelo?.verdadeiro ?? '',
          danoNormal: modelo?.danoNormal ?? '',
          danoDiscente: modelo?.danoDiscente ?? '',
          danoVerdadeiro: modelo?.danoVerdadeiro ?? '',
          tipoDano: modelo?.tipoDano ?? '',
        },
      ],
    });
  };

  const esquecer = (id: string) => {
    void saveFicha({ ...ficha, rituais: ficha.rituais.filter((r) => r.id !== id) });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Meus rituais ({ficha.rituais.length})</Text>
          {ficha.rituais.length === 0 ? (
            <Text style={styles.vazio}>Nenhum ritual aprendido.</Text>
          ) : (
            ficha.rituais.map((r) => (
              <View key={r.id} style={styles.item}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemNome}>{r.nome}</Text>
                  <Text style={styles.itemMeta}>
                    {r.circulo}º círculo{r.elemento ? ' · ' + r.elemento : ''}
                    {r.execucao ? ' · ' + r.execucao : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => esquecer(r.id)} style={styles.acao}>
                  <Text style={styles.acaoTexto}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Biblioteca de rituais</Text>
          {rituais.length === 0 ? (
            <Text style={styles.vazio}>Biblioteca vazia.</Text>
          ) : (
            rituais.map((r) => {
              const jaTem = conhecidos.includes(r.nome.toLowerCase());
              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => (jaTem ? esquecer(ficha.rituais.find((x) => x.nome.toLowerCase() === r.nome.toLowerCase())?.id ?? '') : aprender(r.nome))}
                  style={[styles.item, jaTem ? styles.itemAtivo : null]}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemNome}>{r.nome}</Text>
                    <Text style={styles.itemMeta}>
                      {r.circulo}º círculo{r.elemento ? ' · ' + r.elemento : ''} · {r.alvoTipo}
                    </Text>
                  </View>
                  <Text style={jaTem ? styles.marcado : styles.marcar}>{jaTem ? 'aprendido' : 'aprender'}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </CardContent>
      </Card>
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
  card: { marginBottom: 12 },
  secao: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f0f1a', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  itemAtivo: { borderColor: '#22c55e' },
  itemInfo: { flex: 1 },
  itemNome: { fontSize: 15, fontWeight: '600', color: '#e8e8f0' },
  itemMeta: { fontSize: 11, color: '#8888a0', marginTop: 2 },
  acao: { padding: 8 },
  acaoTexto: { color: '#ef4444', fontSize: 16 },
  marcado: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  marcar: { color: '#8888a0', fontSize: 12 },
  vazio: { color: '#8888a0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centeredText: { color: '#8888a0', textAlign: 'center' },
  erro: { color: '#ef4444' },
});
