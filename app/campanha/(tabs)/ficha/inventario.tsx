import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useFicha } from '@/hooks/useFicha';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

function novoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function FichaInventarioScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? user?.campaignId ?? 'default';
  const userId = user?.id ?? 'user-1';
  const { ficha, loading, error, saveFicha } = useFicha(campanha, userId);
  const [novo, setNovo] = useState('');

  if (loading) return <Centered text="Carregando..." />;
  if (error) return <Centered text={error} error />;
  if (!ficha) return <Centered text="Nenhuma ficha nesta campanha ainda." />;

  const atualizar = (patch: Partial<NonNullable<typeof ficha>>) => {
    void saveFicha({ ...ficha, ...patch });
  };

  const adicionar = () => {
    const nome = novo.trim();
    if (!nome) return;
    atualizar({
      inventario: [
        ...ficha.inventario,
        {
          id: novoId(),
          nome,
          tipo: 'Equipamento',
          categoria: 0,
          espacos: 1,
          defesa: 0,
          dano: '',
          tipoDano: '',
          critico: '',
          alcance: '',
          proficiencia: '',
          empunhadura: '',
          descricao: '',
          elemento: '',
          quantidade: 1,
          equipado: false,
        },
      ],
    });
    setNovo('');
  };

  const remover = (id: string) => {
    atualizar({ inventario: ficha.inventario.filter((i) => i.id !== id) });
  };

  const alternarEquipado = (id: string) => {
    atualizar({
      inventario: ficha.inventario.map((i) => (i.id === id ? { ...i, equipado: !i.equipado } : i)),
    });
  };

  const totalEspacos = ficha.inventario.reduce((s, i) => s + (i.espacos || 0) * (i.quantidade || 1), 0);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Adicionar item</Text>
          <Input label="Nome do item" value={novo} onChangeText={setNovo} placeholder="Ex.: Faca ritualística" />
          <TouchableOpacity style={styles.botao} onPress={adicionar}>
            <Text style={styles.botaoTexto}>Adicionar</Text>
          </TouchableOpacity>
          <Text style={styles.rodape}>{ficha.inventario.length} itens · {totalEspacos} espaços usados</Text>
        </CardContent>
      </Card>

      {ficha.inventario.length === 0 ? (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.vazio}>Inventário vazio.</Text>
          </CardContent>
        </Card>
      ) : (
        ficha.inventario.map((item) => (
          <Card key={item.id} style={styles.card}>
            <CardContent>
              <View style={styles.itemTopo}>
                <Text style={styles.itemNome}>{item.nome}</Text>
                <TouchableOpacity onPress={() => alternarEquipado(item.id)} style={styles.marcador}>
                  <Text style={item.equipado ? styles.equipado : styles.desEquipado}>
                    {item.equipado ? 'equipado' : 'guardado'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.itemMeta}>
                {item.tipo} · cat {item.categoria} · {item.espacos} esp. · qtd {item.quantidade}
                {item.dano ? ' · dano ' + item.dano : ''}
                {item.defesa ? ' · def ' + String(item.defesa) : ''}
              </Text>
              <View style={styles.grid}>
                <View style={styles.cell}>
                  <Input label="Qtd" value={String(item.quantidade)} keyboardType="numeric" onChangeText={(v) => atualizar({ inventario: ficha.inventario.map((i) => (i.id === item.id ? { ...i, quantidade: Number(v) || 0 } : i)) })} />
                </View>
                <View style={styles.cell}>
                  <Input label="Espaços" value={String(item.espacos)} keyboardType="numeric" onChangeText={(v) => atualizar({ inventario: ficha.inventario.map((i) => (i.id === item.id ? { ...i, espacos: Number(v) || 0 } : i)) })} />
                </View>
                <View style={styles.cell}>
                  <Input label="Defesa" value={String(item.defesa)} keyboardType="numeric" onChangeText={(v) => atualizar({ inventario: ficha.inventario.map((i) => (i.id === item.id ? { ...i, defesa: Number(v) || 0 } : i)) })} />
                </View>
                <View style={styles.cell}>
                  <Input label="Categoria" value={String(item.categoria)} keyboardType="numeric" onChangeText={(v) => atualizar({ inventario: ficha.inventario.map((i) => (i.id === item.id ? { ...i, categoria: Number(v) || 0 } : i)) })} />
                </View>
              </View>
              <TouchableOpacity onPress={() => remover(item.id)} style={styles.remover}>
                <Text style={styles.removerTexto}>Remover</Text>
              </TouchableOpacity>
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
  card: { marginBottom: 12 },
  secao: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  botao: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 10 },
  botaoTexto: { color: 'white', fontWeight: '600' },
  rodape: { color: '#8888a0', fontSize: 12, marginTop: 8 },
  itemTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemNome: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', flex: 1 },
  marcador: { paddingHorizontal: 8, paddingVertical: 2 },
  equipado: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  desEquipado: { color: '#8888a0', fontSize: 12 },
  itemMeta: { fontSize: 12, color: '#8888a0', marginTop: 4, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexGrow: 1, minWidth: 80 },
  remover: { marginTop: 10, padding: 8, alignItems: 'center' },
  removerTexto: { color: '#ef4444' },
  vazio: { color: '#8888a0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centeredText: { color: '#8888a0', textAlign: 'center' },
  erro: { color: '#ef4444' },
});
