import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };
}

export default function TabLayout() {
  const { mode } = useAuth();
  const theme = useTheme();
  const farrier = mode === 'farrier';

  // Farriers start on the due list. Owners start on their horses, so the
  // first tab shows horses for them and the separate Horses tab is hidden.
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.accent }}>
      <Tabs.Screen
        name="index"
        options={{
          title: farrier ? 'Due' : 'My horses',
          tabBarIcon: icon(farrier ? 'calendar-outline' : 'heart-outline'),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: farrier ? 'Schedule' : 'Visits', tabBarIcon: icon('time-outline') }}
      />
      <Tabs.Screen
        name="horses"
        options={{ title: 'Horses', tabBarIcon: icon('list-outline'), href: farrier ? undefined : null }}
      />
      <Tabs.Screen
        name="clients"
        options={{ title: 'Clients', tabBarIcon: icon('people-outline'), href: farrier ? undefined : null }}
      />
      <Tabs.Screen name="invoices" options={{ title: 'Invoices', tabBarIcon: icon('receipt-outline') }} />
      {/* Farriers reach barns from Account to keep the tab bar to six. */}
      <Tabs.Screen
        name="barns"
        options={{ title: 'Barns', tabBarIcon: icon('home-outline'), href: farrier ? null : undefined }}
      />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
