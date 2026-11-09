import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useRolagens } from '@/hooks/useRolagens';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export default function DanoScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { rolarDano, loading } = useRolagens(campanha, userId);

  const [expressao, setExpressao] = useState('2d6+3');
  const [multiplicador, setMultiplicador] = useState(1);
  const [bonusExtra, setBonusExtra] = useState(0);
  const [ultimo, setUltimo] = useState<{ formula: string; total: number; dados: number[]; critico: boolean; falha: boolean } | null>(null);

  const PRESETS = ['1d4', '1d6', '1d8', '1d10', '1d12', '2d6', '2d6+3', '1d8+1d4+2', '3d6', '4d6'];

  const handleRolar = async () => {
    try {
      const resultado = await rolarDano({
        expressao,
        multiplicador,
        bonusExtra,
        rotulo: 'Dano',
      });
      setUltimo({
        formula: resultado.formula,
        total: resultado.total,
        dados: resultado.dados,
        critico: resultado.critico,
        falha: resultado.falha,
      });
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.titulo}>Rolagem de Dano</Text>

      <Card style={styles.card}>
        <CardContent>
          <Input label="Expressão de dano" value={expressao} onChangeText={setExpressao} placeholder="2d6+3, 1d8+1d4+2" />

          <View style={styles.presets}>
            {PRESETS.map(p => (
              <TouchableOpacity key={p} onPress={() => setExpressao(p)} style={styles.preset}>
                <Text style={styles.presetTexto}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputRow}>
            <Input
              label="Multiplicador (crítico)"
              value={String(multiplicador)}
              onChangeText={v => setMultiplicador(Math.max(1, parseInt(v) || 1))}
              keyboardType="numeric"
              style={styles.inputHalf}
            />
            <Input
              label="Bônus extra"
              value={String(bonusExtra)}
              onChangeText={v => setBonusExtra(parseInt(v) || 0)}
              keyboardType="numeric"
              style={styles.inputHalf}
            />
          </View>
        </CardContent>
      </Card>

      <TouchableOpacity style={[styles.botao, loading && styles.botaoDesativado]} onPress={handleRolar} disabled={loading}>
        <Text style={styles.botaoTexto}>{loading ? 'ROLANDO...' : 'ROLAR DANO'}</Text>
      </TouchableOpacity>

      {ultimo && (
        <Card style={[styles.card, styles.resultadoCard]}>
          <CardContent>
            <Text style={styles.resultadoFormula}>{ultimo.formula}</Text>
            <Text style={styles.resultadoTotal}>{ultimo.total}</Text>
            <Text style={styles.resultadoDados}>
              [{ultimo.dados.join(', ')}]
            </Text>
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
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 12 },
  preset: { backgroundColor: '#0f0f1a', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#2a2a3e' },
  presetTexto: { color: '#a0a0c0', fontSize: 13 },
  inputRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  inputHalf: { flex: 1 },
  botao: { backgroundColor: '#3b82f6', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  botaoDesativado: { opacity: 0.6 },
  botaoTexto: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  resultadoCard: { backgroundColor: '#1a1a2e', borderColor: '#3b82f6', borderWidth: 1 },
  resultadoFormula: { color: '#8888a0', fontSize: 13, textAlign: 'center' },
  resultadoTotal: { color: '#3b82f6', fontSize: 48, fontWeight: 'bold', textAlign: 'center', marginVertical: 4 },
  resultadoDados: { color: '#8888a0', fontSize: 13, textAlign: 'center' },
});