import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  Share,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useStemPlayer } from "@/hooks/use-stem-player";
import * as Haptics from "expo-haptics";

const STEM_TYPES = [
  { id: "master", label: "Master", color: "#0a7ea4", icon: "🎵" },
  { id: "vocals", label: "Vocals", color: "#EC4899", icon: "🎤" },
  { id: "drums",  label: "Drums",  color: "#8B5CF6", icon: "🥁" },
  { id: "bass",   label: "Bass",   color: "#06B6D4", icon: "🎸" },
  { id: "piano",  label: "Piano",  color: "#F59E0B", icon: "🎹" },
  { id: "guitar", label: "Guitar", color: "#10B981", icon: "🎸" },
  { id: "other",  label: "Other",  color: "#6B7280", icon: "🎼" },
] as const;

type StemId = (typeof STEM_TYPES)[number]["id"];

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

const getApiBaseUrl = () => {
  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) return `${protocol}//${apiHostname}`;
  }
  return "";
};

export default function StemPlayerScreen() {
  const colors = useColors();
  const { trackId } = useLocalSearchParams();
  const [selectedStem, setSelectedStem] = useState<StemId>("master");

  // ── Data ───────────────────────────────────────────────────────────────
  const { data: track } = trpc.tracks.get.useQuery(
    { trackId: parseInt(trackId as string) },
    { enabled: !!trackId }
  );

  const { data: stemData } = trpc.stems.get.useQuery(
    { trackId: parseInt(trackId as string), stemType: selectedStem },
    { enabled: !!trackId }
  );

  // Build a fully-qualified URL the player can stream
  const stemUrl = stemData?.fileUrl
    ? stemData.fileUrl.startsWith("http")
      ? stemData.fileUrl
      : `${getApiBaseUrl()}${stemData.fileUrl}`
    : undefined;

  // ── Playback ───────────────────────────────────────────────────────────
  const {
    isPlaying,
    currentTime,
    duration,
    isLoaded,
    handlePlayPause,
    handleSeek,
  } = useStemPlayer(stemUrl);

  // ── Volume per stem ────────────────────────────────────────────────────
  const [stemVolumes, setStemVolumes] = useState<Record<string, number>>(
    Object.fromEntries(STEM_TYPES.map((s) => [s.id, 100]))
  );

  const handleVolumeAdjust = useCallback(
    (stemId: string, delta: number) => {
      setStemVolumes((prev) => ({
        ...prev,
        [stemId]: Math.max(0, Math.min(100, (prev[stemId] ?? 100) + delta)),
      }));
    },
    []
  );

  // ── Export / Share ─────────────────────────────────────────────────────
  const utils = trpc.useUtils();

  const handleDownload = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await utils.export.downloadStem.fetch({
        trackId: parseInt(trackId as string),
        stemType: selectedStem,
        format: "mp3",
      });
      if (result?.downloadUrl) {
        Alert.alert(
          "Download ready",
          `${selectedStem} stem download URL:\n${result.downloadUrl}`,
          [{ text: "OK" }]
        );
      }
    } catch {
      Alert.alert("Download failed", "Could not generate a download link.");
    }
  };

  const handleShare = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await utils.export.downloadStem.fetch({
        trackId: parseInt(trackId as string),
        stemType: selectedStem,
        format: "mp3",
      });
      if (result?.downloadUrl) {
        await Share.share({
          title: `${track?.title || track?.fileName} — ${selectedStem}`,
          url: result.downloadUrl,
          message: result.downloadUrl,
        });
      }
    } catch {
      Alert.alert("Share failed", "Could not generate a share link.");
    }
  };

  // ── Stem tab renderer ──────────────────────────────────────────────────
  const renderStemTab = ({
    item,
  }: {
    item: (typeof STEM_TYPES)[number];
  }) => {
    const active = selectedStem === item.id;
    return (
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedStem(item.id);
        }}
        activeOpacity={0.7}
        style={{ marginRight: 8 }}
      >
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: active ? 2 : 1,
            borderColor: active ? item.color : colors.border,
            backgroundColor: active ? item.color + "20" : "transparent",
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 20 }}>{item.icon}</Text>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: active ? item.color : colors.muted,
            }}
          >
            {item.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Progress bar ───────────────────────────────────────────────────────
  const progressFraction = duration > 0 ? currentTime / duration : 0;

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6">
          {/* Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{ alignSelf: "flex-start" }}
          >
            <Text style={{ color: colors.primary, fontSize: 15 }}>← Back</Text>
          </TouchableOpacity>

          {/* Album art placeholder */}
          <View
            className="w-full aspect-square rounded-2xl items-center justify-center"
            style={{ backgroundColor: colors.surface }}
          >
            <Text style={{ fontSize: 72 }}>🎵</Text>
          </View>

          {/* Track info */}
          <View className="gap-1">
            <Text
              className="text-2xl font-bold"
              style={{ color: colors.foreground }}
              numberOfLines={1}
            >
              {track?.title || track?.fileName || "Loading…"}
            </Text>
            <Text style={{ color: colors.muted }} numberOfLines={1}>
              {track?.artist || "Unknown Artist"}
            </Text>
          </View>

          {/* Playback progress */}
          <View className="gap-2">
            {/* Tappable progress bar */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => {
                if (!duration) return;
                // approximate: tap position ratio → seek time
                const { locationX, nativeEvent } = e as any;
                // nativeEvent.layout isn't available here; use a fixed width heuristic
                // A proper implementation would use onLayout on the track view
                const ratio = Math.min(1, Math.max(0, locationX / 300));
                handleSeek(ratio * duration);
              }}
            >
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.border,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${progressFraction * 100}%`,
                    backgroundColor: colors.primary,
                    borderRadius: 2,
                  }}
                />
              </View>
            </TouchableOpacity>

            <View className="flex-row justify-between">
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {formatTime(currentTime)}
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {formatTime(duration || track?.duration || 0)}
              </Text>
            </View>
          </View>

          {/* Transport controls */}
          <View className="flex-row items-center justify-center gap-8">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleSeek(Math.max(0, currentTime - 10))}
            >
              <Text style={{ fontSize: 30 }}>⏮</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePlayPause}
              activeOpacity={0.8}
              disabled={!isLoaded && !!stemUrl}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor:
                    !isLoaded && stemUrl ? colors.border : colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 28 }}>
                  {!isLoaded && stemUrl ? "⏳" : isPlaying ? "⏸" : "▶"}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                handleSeek(Math.min(duration, currentTime + 10))
              }
            >
              <Text style={{ fontSize: 30 }}>⏭</Text>
            </TouchableOpacity>
          </View>

          {/* Stem selector */}
          <View className="gap-3">
            <Text
              style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}
            >
              Stems
            </Text>
            <FlatList
              data={STEM_TYPES}
              renderItem={renderStemTab}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
            />
          </View>

          {/* Volume control for selected stem */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              gap: 12,
            }}
          >
            {(() => {
              const stem = STEM_TYPES.find((s) => s.id === selectedStem)!;
              const vol = stemVolumes[selectedStem] ?? 100;
              return (
                <>
                  <View className="flex-row items-center justify-between">
                    <Text
                      style={{
                        fontWeight: "600",
                        fontSize: 15,
                        color: colors.foreground,
                      }}
                    >
                      {stem.label} Volume
                    </Text>
                    <Text
                      style={{ fontWeight: "700", color: stem.color }}
                    >
                      {vol}%
                    </Text>
                  </View>

                  {/* Volume track */}
                  <View
                    style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.border,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${vol}%`,
                        backgroundColor: stem.color,
                        borderRadius: 4,
                      }}
                    />
                  </View>

                  <View className="flex-row gap-2">
                    {[-25, -10, 10, 25].map((delta) => (
                      <TouchableOpacity
                        key={delta}
                        onPress={() => handleVolumeAdjust(selectedStem, delta)}
                        activeOpacity={0.7}
                        style={{ flex: 1 }}
                      >
                        <View
                          style={{
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "600",
                              color: colors.foreground,
                            }}
                          >
                            {delta > 0 ? `+${delta}` : delta}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              );
            })()}
          </View>

          {/* Action buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleDownload}
              activeOpacity={0.7}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}
                >
                  📥 Download
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              activeOpacity={0.7}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}
                >
                  🔗 Share
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/stem-mixer",
                  params: { trackId: trackId as string },
                })
              }
              activeOpacity={0.7}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
                  🎚 Mix
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
