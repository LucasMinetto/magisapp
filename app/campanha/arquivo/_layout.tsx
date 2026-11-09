import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function ArquivoLayout() {
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
        name="pessoas"
        options={{
          title: 'Pessoas',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="lugares"
        options={{
          title: 'Lugares',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'location' : 'location-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="anotacoes"
        options={{
          title: 'Anotações',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
    </Tabs>
  );
}