/**
 * Home Screen - BuildIt Network
 */
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
          BuildIt Network
        </Text>
        <Text className="text-base text-zinc-500 dark:text-zinc-400 text-center">
          Privacy-first organizing for activists
        </Text>
      </View>
    </SafeAreaView>
  );
}
