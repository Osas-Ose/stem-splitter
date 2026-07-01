import { View, Text, TouchableOpacity } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

export default function ProcessingScreen() {
  const colors = useColors();
  const { trackId } = useLocalSearchParams();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("uploading");

  const { data: track } = trpc.tracks.get.useQuery(
    { trackId: parseInt(trackId as string) },
    { enabled: !!trackId }
  );

  const { data: separationStatus } = trpc.separation.status.useQuery(
    { trackId: parseInt(trackId as string) },
    {
      enabled: !!trackId,
      refetchInterval: 2000,
    }
  );

  useEffect(() => {
    if (separationStatus) {
      setProgress(separationStatus.progress);
      setStatus(separationStatus.status || "processing");

      if (separationStatus.status === "completed") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          router.replace({
            pathname: "/stem-player",
            params: { trackId: trackId as string },
          });
        }, 500);
      }
    }
  }, [separationStatus, trackId]);

  const handleCancel = () => {
    router.back();
  };

  const getStatusText = () => {
    switch (status) {
      case "uploading":
        return "Uploading audio...";
      case "processing":
        return "Processing audio...";
      case "completed":
        return "Separation complete!";
      case "failed":
        return "Processing failed";
      default:
        return "Processing...";
    }
  };

  return (
    <ScreenContainer className="p-6 items-center justify-center">
      <View className="gap-8 w-full max-w-xs">
        <View
          className="w-full aspect-square rounded-2xl items-center justify-center"
          style={{ backgroundColor: colors.surface }}
        >
          <Text className="text-6xl">🎵</Text>
        </View>

        {track && (
          <View className="gap-2">
            <Text
              className="text-lg font-semibold text-foreground text-center"
              style={{ color: colors.foreground }}
              numberOfLines={2}
            >
              {track.title || track.fileName}
            </Text>
            <Text
              className="text-sm text-muted text-center"
              style={{ color: colors.muted }}
            >
              {track.artist || "Unknown Artist"}
            </Text>
          </View>
        )}

        <View className="items-center gap-4">
          <View className="relative w-32 h-32 items-center justify-center">
            <View
              className="w-full h-full rounded-full border-4"
              style={{
                borderColor: colors.border,
                borderTopColor: colors.primary,
                borderRightColor: colors.primary,
              }}
            />
            <View className="absolute items-center justify-center">
              <Text
                className="text-3xl font-bold text-foreground"
                style={{ color: colors.foreground }}
              >
                {progress}%
              </Text>
            </View>
          </View>

          <Text
            className="text-base font-medium text-foreground"
            style={{ color: colors.foreground }}
          >
            {getStatusText()}
          </Text>

          {status === "processing" && separationStatus?.estimatedTimeRemaining && (
            <Text
              className="text-sm text-muted"
              style={{ color: colors.muted }}
            >
              ~{Math.ceil(separationStatus.estimatedTimeRemaining / 60)}s remaining
            </Text>
          )}
        </View>

        {status !== "completed" && (
          <TouchableOpacity
            onPress={handleCancel}
            activeOpacity={0.7}
          >
            <View
              className="py-3 px-6 rounded-lg items-center justify-center border border-border"
              style={{ borderColor: colors.border }}
            >
              <Text
                className="text-base font-semibold text-foreground"
                style={{ color: colors.foreground }}
              >
                Cancel
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {status === "completed" && (
          <TouchableOpacity
            onPress={() => {
              router.replace({
                pathname: "/stem-player",
                params: { trackId: trackId as string },
              });
            }}
            activeOpacity={0.8}
          >
            <View
              className="py-3 px-6 rounded-lg items-center justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-base font-semibold text-white">View Stems</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </ScreenContainer>
  );
}
