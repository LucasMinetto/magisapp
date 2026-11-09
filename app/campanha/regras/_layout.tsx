import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Slot } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const CAPITULOS = [
  { num: 1, titulo: 'Introdução' },
  { num: 2, titulo: 'Perícias' },
  { num: 3, titulo: 'Combate' },
  { num: 4, titulo: 'Rituais' },
  { num: 5, titulo: 'Equipamento' },
  { num: 6, titulo: 'O Horror' },
  { num: 7, titulo: 'Ameaças' },
  { num: 8, titulo: 'Mestre' },
  { num: 9, titulo: 'Apêndices' },
];

export default function RegrasLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <View style={styles.container}>
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setSidebarOpen(false)}
          activeOpacity={1}
        />
      )}

      {/* Sidebar */}
      <View style={[styles.sidebar, sidebarOpen && styles.sidebarOpen]}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Sumário</Text>
          <TouchableOpacity onPress={() => setSidebarOpen(false)} style={styles.closeBtn}>
            <Ionicons name="close-outline" size={24} color="#e8e8f0" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.sidebarContent}>
          {CAPITULOS.map((cap) => (
            <TouchableOpacity
              key={cap.num}
              style={styles.capItem}
              onPress={() => setSidebarOpen(false)}
            >
              <Text style={styles.capNum}>Cap. {cap.num}</Text>
              <Text style={styles.capTitulo}>{cap.titulo}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main content */}
      <View style={styles.main}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.menuBtn}>
            <Ionicons name="menu-outline" size={28} color="#e8e8f0" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Regras</Text>
        </View>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#1a1a2e',
    borderRightWidth: 1,
    borderRightColor: '#2a2a3e',
    zIndex: 20,
    transform: [{ translateX: -280 }] as any,
  },
  sidebarOpen: {
    transform: [{ translateX: 0 }] as any,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  sidebarTitle: { fontSize: 18, fontWeight: 'bold', color: '#e8e8f0' },
  closeBtn: { padding: 8 },
  sidebarContent: { padding: 12 },
  capItem: { padding: 12, borderRadius: 8, marginBottom: 4 },
  capNum: { color: '#3b82f6', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  capTitulo: { color: '#e8e8f0', fontSize: 15 },
  main: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
    backgroundColor: '#1a1a2e',
  },
  menuBtn: { padding: 8 },
  topBarTitle: { fontSize: 18, fontWeight: 'bold', color: '#e8e8f0' },
});