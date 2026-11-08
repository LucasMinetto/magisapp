import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function FichaTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#666680',
        tabBarStyle: {
          backgroundColor: '#0f0f1a',
          borderTopWidth: 1,
          borderTopColor: '#1a1a2e',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Resumo',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="atributos"
        options={{
          title: 'Atributos',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'construct' : 'construct-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventario"
        options={{
          title: 'Inventário',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="condicoes"
        options={{
          title: 'Condições',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'medical' : 'medical-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="ataques"
        options={{
          title: 'Ataques',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'flash' : 'flash-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="habilidades"
        options={{
          title: 'Habilidades',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="rituais"
        options={{
          title: 'Rituais',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'flame' : 'flame-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
    </Tabs>
  );
}