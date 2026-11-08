import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useRegras } from '@/hooks/useRegras';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';

const CAPITULOS = [
  '1. Introdução', '2. Criando o Agente', '3. Atributos e Perícias',
  '4. Combate', '5. Dano e Cura', '6. Investigação e Mistério',
  '7. O Outro Lado', '8. Ritualística', '9. Equipamentos',
  '10. Ameaças', '11. Mestragem', 'Apêndices',
];

export default function RegrasScreen() {
  const { campaignId } = React.useContext(require('expo-router').useLocalSearchParams());
  const { data: regras, loading, error } = useRegras(campaignId || '');
  const [search, setSearch] = useState('');
  const [selectedCapitulo, setSelectedCapitulo] = useState<string | null>(null);

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;

  const filtered = (regras || []).filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.dados.conteudo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Regras</Text>
      </View>

      <Card style={styles.card}>
        <CardContent>
          <Input
            label="Buscar"
            value={search}
            onChange={setSearch}
            placeholder="Buscar nas regras..."
            leftIcon={<Ionicons name="search" size={20} color="#8888a0" />}
          />
        </CardContent>
      </Card>

      <View style={styles.capitulosScroll}>
        {CAPITULOS.map((cap) => (
          <TouchableOpacity
            key={cap}
            onPress={() => setSelectedCapitulo(selectedCapitulo === cap ? null : cap)}
            style={[styles.capituloButton, selectedCapitulo === cap && styles.capituloButtonActive]}
          >
            <Text style={[styles.capituloText, selectedCapitulo === cap && styles.capituloTextActive]}>{cap}</Text>
            <Ionicons name={selectedCapitulo === cap ? 'remove-circle' : 'add-circle'} size={20} color={selectedCapitulo === cap ? '#3b82f6' : '#8888a0'} />
          </TouchableOpacity>
        ))}
      </View>

      {selectedCapitulo && (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.capituloTitle}>{selectedCapitulo}</Text>
            <View style={styles.regrasList}>
              {filtered.filter(r => r.dados.capitulo === selectedCapitulo).map((regra) => (
                <RegraItem key={regra.id} regra={regra} />
              ))}
            </View>
          </CardContent>
        </Card>
      )}

      {!selectedCapitulo && (
        <View style={styles.regrasList}>
          {filtered.map((regra) => (
            <RegraItem key={regra.id} regra={regra} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function RegraItem({ regra }: { regra: any }) {
  return (
    <View style={styles.regraCard}>
      <Text style={styles.regraNome}>{regra.name}</Text>
      <Text style={styles.regraMeta}>Cap. {regra.dados.capitulo} | Pág. {regra.dados.pagina || '?'}</Text>
      {regra.dados.conteudo && <Text style={styles.regraConteudo} numberOfLines={3}>{regra.dados.conteudo}</Text>}
    </View>
  );
}

function LoadingView() { return <View style={styles.centerContainer}><Text style={{ color: '#8888a0' }}>Carregando...</Text></View>; }
function ErrorView({ message }: { message: string }) { return <View style={styles.centerContainer}><Text style={{ color: '#ef4444', textAlign: 'center' }}>{message}</Text></View>; }

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0' },
  card: { marginBottom: 12 },
  capitulosScroll: { marginBottom: 16, maxHeight: 120 },
  capituloButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, marginRight: 8, minWidth: 180 },
  capituloButtonActive: { borderWidth: 1, borderColor: '#3b82f6' },
  capituloText: { fontSize: 13, color: '#e8e8f0', flex: 1 },
  capituloTextActive: { color: '#3b82f6', fontWeight: '600' },
  capituloTitle: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  regraCard: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, marginBottom: 8 },
  regraNome: { fontSize: 15, fontWeight: '600', color: '#e8e8f0', marginBottom: 2 },
  regraMeta: { fontSize: 11, color: '#8888a0', marginBottom: 4 },
  regraConteudo: { fontSize: 12, color: '#aaaaaa' },
  regrasList: { gap: 8 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});