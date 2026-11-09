import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent } from '@/components/ui/Card';

const MODOS: { id: string; nome: string; icone: string; desc: string }[] = [
  { id: 'teste', nome: 'Teste', icone: 'flash', desc: 'Perícia/Atributo → bônus → d20s' },
  { id: 'ataque', nome: 'Ataque', icone: 'cube', desc: 'Seleciona ataque → d20 → dano' },
  { id: 'dano', nome: 'Dano', icone: 'bonfire', desc: 'Expressão livre (2d6+3, 1d8+1d4+2)' },
  { id: 'ritual', nome: 'Ritual', icone: 'book', desc: 'Seleciona ritual → teste Ocultismo' },
  { id: 'iniciativa', nome: 'Iniciativa', icone: 'timer', desc: '1d20+AGI → adiciona à sessão' },
  { id: 'historico', nome: 'Histórico', icone: 'time', desc: 'Rolagens da sessão persistidas' },
];

export default function RolagemSeletor() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.titulo}>Rolagem de Dados</Text>
      <Text style={styles.subtitulo}>Escolha o modo de rolagem</Text>

      {MODOS.map((modo) => (
        <TouchableOpacity
          key={modo.id}
          style={styles.card}
          onPress={() => router.push(`/campanha/rolagem/${modo.id}`)}
        >
          <CardContent>
            <View style={styles.cardRow}>
              <View style={styles.iconContainer}>
                            <Ionicons name={modo.icone as any} size={28} color="#3b82f6" />
                          </View>
              <View style={styles.cardText}>
                <Text style={styles.cardNome}>{modo.nome}</Text>
                <Text style={styles.cardDesc}>{modo.desc}</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={24} color="#666680" />
            </View>
          </CardContent>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  titulo: { fontSize: 28, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 4 },
  subtitulo: { fontSize: 14, color: '#8888a0', marginBottom: 20 },
  card: { marginBottom: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a3e' },
  cardText: { flex: 1 },
  cardNome: { fontSize: 18, fontWeight: '600', color: '#e8e8f0' },
  cardDesc: { fontSize: 12, color: '#8888a0', marginTop: 2 },
});