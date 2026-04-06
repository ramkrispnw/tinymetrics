import { Tabs } from "expo-router";
import { View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { GlassTabBar } from "@/components/glass-tab-bar";
import { SleepTimerBanner } from "@/components/sleep-timer-banner";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.tint,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="house.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="trends"
          options={{
            title: "Trends",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="chart.bar.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="journal"
          options={{
            title: "Journal",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="book.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="assistant"
          options={{
            title: "AI",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="sparkles" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="milestones"
          options={{
            href: null,
          }}
        />
      </Tabs>
      <SleepTimerBanner />
    </View>
  );
}
