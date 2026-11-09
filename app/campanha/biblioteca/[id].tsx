import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import { Card, CardContent } from '@/components/ui/Card';
import { Ionicons } from '@expo/vector-icons';

type RitualBiblioteca = {
  id: string;
  nome: string;
  elemento: string;
  circulo: number;
  execucao: string;
  alcance: string;
  alvo: string;
  duracao: string;
  resistencia: string;
  efeito: string;
  discente: string;
  verdadeiro: string;
  danoNormal: string;
  danoDiscente: string;
  danoVerdadeiro: string;
  tipoDano: string;
  alvoTipo: 'Alvo' | 'Área' | 'Efeito';
  pagina: number;
};

type ItemBiblioteca = {
  id: string;
  nome: string;
  tipo: string;
  categoria: number;
  espacos: number;
  defesa: number;
  dano: string;
  tipoDano: string;
  critico: string;
  alcance: string;
  proficiencia: string;
  empunhadura: string;
  elemento: string;
  descricao: string;
  quantidade: number;
  pagina: number;
};

export default function BibliotecaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { rituais, itens, loading, error } = useBiblioteca();

  const ritual = useMemo(() => rituais.find(r => r.id === id) as RitualBiblioteca | undefined, [rituais, id]);
  const item = useMemo(() => itens.find(i => i.id === id) as ItemBiblioteca | undefined, [itens, id]);
  const entry = ritual || item;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !entry) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.error}>
          <Text style={styles.errorText}>Registro não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isRitual = !!ritual;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={24} color="#e8e8f0" />
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>{isRitual ? 'Ritual' : 'Item'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <CardContent>
            <View style={styles.detailHeader}>
              <Text style={styles.detailNome}>{entry.nome}</Text>
              {isRitual && (
                <View style={styles.detailBadges}>
                  <View style={[styles.badge, { backgroundColor: getElementoColor((entry as RitualBiblioteca).elemento) }]}>
                    <Text style={styles.badgeTexto}>{(entry as RitualBiblioteca).elemento}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#3b82f6' }]}>
                    <Text style={styles.badgeTexto}>{(entry as RitualBiblioteca).circulo}º círculo</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#666680' }]}>
                    <Text style={styles.badgeTexto}>{(entry as RitualBiblioteca).alvoTipo}</Text>
                  </View>
                </View>
              )}
              {!isRitual && (
                <View style={styles.detailBadges}>
                  <View style={[styles.badge, { backgroundColor: '#1a1a2e' }, { borderWidth: 1, borderColor: '#2a2a3e' }]}>
                    <Text style={styles.badgeTexto}>{(entry as ItemBiblioteca).tipo}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#3b82f6' }]}>
                    <Text style={styles.badgeTexto}>Cat. {(entry as ItemBiblioteca).categoria}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#666680' }]}>
                    <Text style={styles.badgeTexto}>{(entry as ItemBiblioteca).espacos} esp.</Text>
                  </View>
                </View>
              )}
            </View>

            {isRitual && (
              <>
                <Text style={styles.detailLabel}>Execução</Text>
                <Text style={styles.detailValue}>{(entry as RitualBiblioteca).execucao || 'Padrão'}</Text>

                <Text style={styles.detailLabel}>Alcance</Text>
                <Text style={styles.detailValue}>{(entry as RitualBiblioteca).alcance || '-'}</Text>

                <Text style={styles.detailLabel}>Alvo</Text>
                <Text style={styles.detailValue}>{(entry as RitualBiblioteca).alvo || '-'}</Text>

                <Text style={styles.detailLabel}>Duração</Text>
                <Text style={styles.detailValue}>{(entry as RitualBiblioteca).duracao || '-'}</Text>

                <Text style={styles.detailLabel}>Resistência</Text>
                <Text style={styles.detailValue}>{(entry as RitualBiblioteca).resistencia || 'Nenhuma'}</Text>

                <Text style={styles.detailLabel}>Efeito</Text>
                <Text style={styles.detailValue}>{(entry as RitualBiblioteca).efeito || '-'}</Text>

                <Text style={styles.detailLabel}>Discente</Text>
                <Text style={styles.detailValue}>{(entry as RitualBiblioteca).discente || '-'}</Text>

                <Text style={styles.detailLabel}>Verdadeiro</Text>
                <Text style={styles.detailValue}>{(entry as RitualBiblioteca).verdadeiro || '-'}</Text>

                {(entry as RitualBiblioteca).danoNormal && (
                  <>
                    <Text style={styles.detailLabel}>Dano Normal</Text>
                    <Text style={styles.detailValue}>{(entry as RitualBiblioteca).danoNormal} {(entry as RitualBiblioteca).tipoDano || ''}</Text>
                  </>
                )}
                {(entry as RitualBiblioteca).danoDiscente && (
                  <>
                    <Text style={styles.detailLabel}>Dano Discente</Text>
                    <Text style={styles.detailValue}>{(entry as RitualBiblioteca).danoDiscente} {(entry as RitualBiblioteca).tipoDano || ''}</Text>
                  </>
                )}
                {(entry as RitualBiblioteca).danoVerdadeiro && (
                  <>
                    <Text style={styles.detailLabel}>Dano Verdadeiro</Text>
                    <Text style={styles.detailValue}>{(entry as RitualBiblioteca).danoVerdadeiro} {(entry as RitualBiblioteca).tipoDano || ''}</Text>
                  </>
                )}
              </>
            )}

            {!isRitual && (
              <>
                {(entry as ItemBiblioteca).dano && (
                  <>
                    <Text style={styles.detailLabel}>Dano</Text>
                    <Text style={styles.detailValue}>{(entry as ItemBiblioteca).dano} {(entry as ItemBiblioteca).tipoDano || ''}{(entry as ItemBiblioteca).critico ? ` · Crítico: ${(entry as ItemBiblioteca).critico}` : ''}</Text>
                  </>
                )}
                {(entry as ItemBiblioteca).alcance && (
                  <>
                    <Text style={styles.detailLabel}>Alcance</Text>
                    <Text style={styles.detailValue}>{(entry as ItemBiblioteca).alcance}</Text>
                  </>
                )}
                {(entry as ItemBiblioteca).proficiencia && (
                  <>
                    <Text style={styles.detailLabel}>Proficiência</Text>
                    <Text style={styles.detailValue}>{(entry as ItemBiblioteca).proficiencia}</Text>
                  </>
                )}
                {(entry as ItemBiblioteca).empunhadura && (
                  <>
                    <Text style={styles.detailLabel}>Empunhadura</Text>
                    <Text style={styles.detailValue}>{(entry as ItemBiblioteca).empunhadura}</Text>
                  </>
                )}
                {(entry as ItemBiblioteca).elemento && (
                  <>
                    <Text style={styles.detailLabel}>Elemento</Text>
                    <Text style={styles.detailValue}>{(entry as ItemBiblioteca).elemento}</Text>
                  </>
                )}
                <Text style={styles.detailLabel}>Defesa</Text>
                <Text style={styles.detailValue}>{(entry as ItemBiblioteca).defesa}</Text>

                <Text style={styles.detailLabel}>Espaços</Text>
                <Text style={styles.detailValue}>{(entry as ItemBiblioteca).espacos}</Text>

                <Text style={styles.detailLabel}>Quantidade</Text>
                <Text style={styles.detailValue}>{(entry as ItemBiblioteca).quantidade}</Text>

                {(entry as ItemBiblioteca).descricao && (
                  <>
                    <Text style={styles.detailLabel}>Descrição</Text>
                    <Text style={styles.detailValue}>{(entry as ItemBiblioteca).descricao}</Text>
                  </>
                )}
              </>
            )}

            {entry.pagina && (
              <View style={styles.pagina}>
                <Text style={styles.paginaTexto}>📖 Página do livro: {entry.pagina} {entry.pagina <= 10 ? '(OP)' : '(SaH)'}</Text>
              </View>
            )}
          </CardContent>
        </Card>
      </ScrollView>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a3e', backgroundColor: '#1a1a2e' },
  backBtn: { padding: 8 },
  headerTitulo: { fontSize: 18, fontWeight: 'bold', color: '#e8e8f0' },
  content: { padding: 16, paddingBottom: 40 },
  card: { marginBottom: 12 },
  detailHeader: { marginBottom: 16 },
  detailNome: { fontSize: 22, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 8 },
  detailBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  badge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  badgeTexto: { color: 'white', fontSize: 11, fontWeight: '600' },
  detailLabel: { color: '#8888a0', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 4 },
  detailValue: { color: '#c8c8d8', fontSize: 14, lineHeight: 22 },
  pagina: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#2a2a3e' },
  paginaTexto: { color: '#3b82f6', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8888a0' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#ef4444', textAlign: 'center' },
});