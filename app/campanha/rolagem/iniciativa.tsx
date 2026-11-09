import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useFicha } from '@/hooks/useFicha';
import { useRolagens } from '@/hooks/useRolagens';
import { Card, CardContent } from '@/components/ui/Card';

export default function IniciativaScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { ficha } = useFicha(campanha, userId);
  const { rolarIniciativa, loading } = useRolagens(campanha, userId);

  const [nome, setNome] = useState(ficha?.investigacao?.aparencia?.split(' ')[0] || 'Personagem');
  const [agi, setAgi] = useState(ficha?.atributos.agi || 1);
  const [ultimo, setUltimo] = useState<{ formula: string; total: number; dados: number[]; critico: boolean; falha: boolean } | null>(null);
  const [iniciativas, setIniciativas] = useState<{ nome: string; valor: number; agi: number }[]>([]);

  const handleRolar = async () => {
    try {
      const resultado = await rolarIniciativa({ agi, nome });
      setUltimo({
        formula: resultado.formula,
        total: resultado.total,
        dados: resultado.dados,
        critico: resultado.critico,
        falha: resultado.falha,
      });
      setIniciativas(prev => [...prev, { nome, valor: resultado.total, agi }].sort((a, b) => b.valor - a.valor));
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    }
  };

  const removerIniciativa = (index: number) => {
    setIniciativas(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.titulo}>Iniciativa</Text>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Personagem</Text>
          <TextInput
            style={styles.textInput}
            value={nome}
            onChangeText={setNome}
            placeholder="Nome do personagem"
          />
          <View style={styles.inputRow}>
            <Text style={styles.agiLabel}>AGI: </Text>
            <TextInput
              style={styles.agiInput}
              value={String(agi)}
              onChangeText={v => setAgi(Math.max(0, parseInt(v) || 0))}
              keyboardType="numeric"
            />
          </View>
        </CardContent>
      </Card>

      <TouchableOpacity style={[styles.botao, loading && styles.botaoDesativado]} onPress={handleRolar} disabled={loading}>
        <Text style={styles.botaoTexto}>{loading ? 'ROLANDO...' : 'ROLAR INICIATIVA (1d20+AGI)'}</Text>
      </TouchableOpacity>

      {ultimo && (
        <Card style={[styles.card, styles.resultadoCard]}>
          <CardContent>
            <Text style={styles.resultadoFormula}>{ultimo.formula}</Text>
            <Text style={styles.resultadoTotal}>{ultimo.total}</Text>
            <Text style={styles.resultadoDados}>
              [{ultimo.dados.join(', ')}]
              {ultimo.critico ? '  ✦ crítico!' : ''}
              {ultimo.falha ? '  ✕ falha crítica' : ''}
            </Text>
          </CardContent>
        </Card>
      )}

      {iniciativas.length > 0 && (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.secao}>Ordem de Iniciativa</Text>
            {iniciativas.map((i, idx) => (
              <View key={idx} style={styles.iniciativaItem}>
                <Text style={styles.iniciativaPos}>#{idx + 1}</Text>
                <Text style={styles.iniciativaNome}>{i.nome}</Text>
                <Text style={styles.iniciativaValor}>{i.valor} (AGI {i.agi})</Text>
                <TouchableOpacity onPress={() => removerIniciativa(idx)} style={styles.remover}>
                  <Text style={styles.removerTexto}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.clearBotao} onPress={() => setIniciativas([])}>
              <Text style={styles.clearBotaoTexto}>Limpar tudo</Text>
            </TouchableOpacity>
          </CardContent>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 16 },
  card: { marginBottom: 12 },
  secao: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  textInput: { backgroundColor: '#0f0f1a', borderWidth: 1, borderColor: '#2a2a3e', borderRadius: 8, padding: 12, color: '#e8e8f0', fontSize: 15, marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  agiLabel: { color: '#e8e8f0', fontSize: 15, fontWeight: '600' },
  agiInput: { backgroundColor: '#0f0f1a', borderWidth: 1, borderColor: '#2a2a3e', borderRadius: 8, padding: 12, color: '#e8e8f0', fontSize: 15, width: 80, textAlign: 'center' },
  botao: { backgroundColor: '#3b82f6', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  botaoDesativado: { opacity: 0.6 },
  botaoTexto: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  resultadoCard: { backgroundColor: '#1a1a2e', borderColor: '#3b82f6', borderWidth: 1 },
  resultadoFormula: { color: '#8888a0', fontSize: 13, textAlign: 'center' },
  resultadoTotal: { color: '#3b82f6', fontSize: 48, fontWeight: 'bold', textAlign: 'center', marginVertical: 4 },
  resultadoDados: { color: '#8888a0', fontSize: 13, textAlign: 'center' },
  iniciativaItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#0f0f1a', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#2a2a3e' },
  iniciativaPos: { color: '#3b82f6', fontSize: 16, fontWeight: 'bold', width: 32 },
  iniciativaNome: { color: '#e8e8f0', fontSize: 15, flex: 1 },
  iniciativaValor: { color: '#a0a0c0', fontSize: 14, width: 100, textAlign: 'right' },
  remover: { padding: 8 },
  removerTexto: { color: '#ef4444', fontSize: 16 },
  clearBotao: { marginTop: 12, padding: 12, alignItems: 'center', backgroundColor: '#2a2a3e', borderRadius: 8 },
  clearBotaoTexto: { color: '#a0a0c0', fontSize: 13 },
});