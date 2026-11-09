import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function BibliotecaLayout() {
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
        name="rituais"
        options={{
          title: 'Rituais',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="itens"
        options={{
          title: 'Itens',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="busca"
        options={{
          title: 'Busca',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
    </Tabs>
  );
}