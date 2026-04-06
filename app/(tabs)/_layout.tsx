import { Tabs } from "expo-router";
import { View } from "react-native";

import { GlassTabBar } from "@/components/glass-tab-bar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SleepTimerBanner } from "@/components/sleep-timer-banner";

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
        }}
        tabBar={(props) => <GlassTabBar {...props} />}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={22} name="house.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="trends"
          options={{
            title: "Trends",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={22} name="chart.bar.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="journal"
          options={{
            title: "Journal",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={22} name="book.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="assistant"
          options={{
            title: "AI",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={22} name="sparkles" color={color} />
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
