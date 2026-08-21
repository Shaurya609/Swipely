import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { cleanupExpiredTrash, initialize } from '@/utils/trash-service';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    async function cleanupTrash() {
      try {
        await initialize();
        await cleanupExpiredTrash();
      } catch (error) {
        console.error('[TabLayout] Error running automatic Trash cleanup:', error);
      }
    }

    cleanupTrash();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Trash',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="trash.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
