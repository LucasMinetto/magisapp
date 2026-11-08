import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function CampaignTabsLayout() {
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
        name="ficha"
        options={{
          title: 'Ficha',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="rolagem"
        options={{
          title: 'Rolagem',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="regras"
        options={{
          title: 'Regras',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="biblioteca"
        options={{
          title: 'Biblioteca',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'library' : 'library-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="arquivo"
        options={{
          title: 'Arquivo',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'folder' : 'folder-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'sync' : 'sync-outline'} size={24} color={focused ? '#3b82f6' : '#666680'} />
          ),
        }}
      />
    </Tabs>
  );
}