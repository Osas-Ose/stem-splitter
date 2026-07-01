import { View, Text, TouchableOpacity, ScrollView, FlatList, TextInput } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const STEM_TYPES = [
  { id: "vocals", label: "Vocals", color: "#EC4899", icon: "🎤" },
  { id: "drums", label: "Drums", color: "#8B5CF6", icon: "🥁" },
  { id: "bass", label: "Bass", color: "#06B6D4", icon: "🎸" },
  { id: "piano", label: "Piano", color: "#F59E0B", icon: "🎹" },
  { id: "guitar", label: "Guitar", color: "#10B981", icon: "🎸" },
  { id: "other", label: "Other", color: "#6B7280", icon: "🎼" },
];

export default function StemMixerScreen() {
  const colors = useColors();
  const { trackId } = useLocalSearchParams();
  const [stemLevels, setStemLevels] = useState<Record<string, number>>(
    STEM_TYPES.reduce((acc, stem) => ({ ...acc, [stem.id]: 100 }), {})
  );
  const [presetName, setPresetName] = useState("");

  const saveMixMutation = trpc.stems.saveMix.useMutation({
    onSuccess: () => {
      router.back();
    },
  });

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;

    await saveMixMutation.mutateAsync({
      trackId: parseInt(trackId as string),
      presetName: presetName.trim(),
      stemLevels,
    });
  };

  const renderStemMixer = ({ item }: { item: (typeof STEM_TYPES)[0] }) => (
    <View className="gap-2 mb-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1">
          <Text className="text-2xl">{item.icon}</Text>
          <Text
            className="text-sm font-semibold flex-1"
            style={{ color: item.color }}
          >
            {item.label}
          </Text>
        </View>
        <Text
          className="text-sm font-bold"
          style={{ color: colors.primary }}
        >
          {Math.round(stemLevels[item.id] || 100)}%
        </Text>
      </View>

      <View className="h-8 bg-border rounded-lg overflow-hidden flex-row" style={{ backgroundColor: colors.border }}>
        <View
          className="bg-primary h-full"
          style={{
            backgroundColor: item.color,
            width: `${stemLevels[item.id] || 100}%`,
          }}
        />
      </View>

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() =>
            setStemLevels((prev) => ({
              ...prev,
              [item.id]: Math.max(0, (prev[item.id] || 100) - 10),
            }))
          }
          activeOpacity={0.7}
        >
          <View
            className="flex-1 py-2 px-3 rounded border border-border items-center"
            style={{ borderColor: colors.border }}
          >
            <Text className="text-sm font-semibold" style={{ color: colors.foreground }}>
              −10
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            setStemLevels((prev) => ({
              ...prev,
              [item.id]: 100,
            }))
          }
          activeOpacity={0.7}
        >
          <View
            className="flex-1 py-2 px-3 rounded border border-border items-center"
            style={{ borderColor: colors.border }}
          >
            <Text className="text-sm font-semibold" style={{ color: colors.foreground }}>
              Reset
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            setStemLevels((prev) => ({
              ...prev,
              [item.id]: Math.min(100, (prev[item.id] || 100) + 10),
            }))
          }
          activeOpacity={0.7}
        >
          <View
            className="flex-1 py-2 px-3 rounded border border-border items-center"
            style={{ borderColor: colors.border }}
          >
            <Text className="text-sm font-semibold" style={{ color: colors.foreground }}>
              +10
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text
              className="text-2xl font-bold text-foreground"
              style={{ color: colors.foreground }}
            >
              Mix Stems
            </Text>
            <Text
              className="text-sm text-muted"
              style={{ color: colors.muted }}
            >
              Adjust individual stem levels
            </Text>
          </View>

          <FlatList
            data={STEM_TYPES}
            renderItem={renderStemMixer}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />

          <View className="gap-3 bg-surface rounded-lg p-4" style={{ backgroundColor: colors.surface }}>
            <Text
              className="text-sm font-semibold text-foreground"
              style={{ color: colors.foreground }}
            >
              Save Preset
            </Text>
            <View
              className="border border-border rounded-lg px-4 py-3"
              style={{ borderColor: colors.border }}
            >
              <TextInput
                value={presetName}
                onChangeText={setPresetName}
                placeholder="Enter preset name..."
                placeholderTextColor={colors.muted}
                style={{ color: colors.foreground, fontSize: 16, padding: 0 }}
              />
            </View>

            <TouchableOpacity
              onPress={handleSavePreset}
              disabled={!presetName.trim() || saveMixMutation.isPending}
              activeOpacity={0.8}
            >
              <View
                className="py-3 px-4 rounded-lg items-center justify-center"
                style={{
                  backgroundColor: presetName.trim() ? colors.primary : colors.border,
                  opacity: saveMixMutation.isPending ? 0.6 : 1,
                }}
              >
                <Text className="text-base font-semibold text-white">
                  {saveMixMutation.isPending ? "Saving..." : "Save Preset"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <View
              className="py-3 px-4 rounded-lg items-center justify-center border border-border"
              style={{ borderColor: colors.border }}
            >
              <Text
                className="text-base font-semibold text-foreground"
                style={{ color: colors.foreground }}
              >
                Back
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
