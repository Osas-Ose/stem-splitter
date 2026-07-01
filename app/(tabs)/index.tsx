import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  Platform,
} from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";

const SUPPORTED_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
];

interface Track {
  id: number;
  fileName: string;
  title: string | null;
  artist: string | null;
  duration: number | null;
  status: string | null;
  createdAt: Date;
}

const formatDuration = (seconds: number | null) => {
  if (!seconds) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const STATUS_COLORS: Record<string, string> = {
  completed: "#10B981",
  processing: "#F59E0B",
  uploaded: "#6B7280",
  failed: "#EF4444",
};

export default function HomeScreen() {
  const colors = useColors();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const { data: tracks, isLoading, refetch } = trpc.tracks.list.useQuery();

  const getUploadUrlMutation = trpc.tracks.getUploadUrl.useMutation();
  const createTrackMutation = trpc.tracks.create.useMutation({
    onSuccess: () => refetch(),
  });
  const startSeparationMutation = trpc.separation.start.useMutation();

  const handleUploadAudio = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // ── 1. Pick a file ──────────────────────────────────────────────────
      const result = await DocumentPicker.getDocumentAsync({
        type: SUPPORTED_MIME,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? "audio/mpeg";
      const fileName = asset.name;
      const fileSize = asset.size ?? 0;

      if (!SUPPORTED_MIME.includes(mimeType)) {
        Alert.alert(
          "Unsupported file",
          "Please choose an MP3, WAV, FLAC, or M4A file."
        );
        return;
      }

      setUploading(true);
      setUploadProgress("Getting upload URL…");

      // ── 2. Get a presigned PUT URL from the server ───────────────────────
      const { uploadUrl, key } = await getUploadUrlMutation.mutateAsync({
        fileName,
        mimeType,
      });

      // ── 3. Upload the file directly to storage ───────────────────────────
      setUploadProgress("Uploading file…");

      // Build a Blob from the local URI so we can PUT it
      const fileResponse = await fetch(asset.uri);
      const fileBlob = await fileResponse.blob();

      const uploadResp = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: fileBlob,
      });

      if (!uploadResp.ok) {
        throw new Error(`Upload failed (${uploadResp.status})`);
      }

      // ── 4. Create the track record in the DB ─────────────────────────────
      setUploadProgress("Saving track…");
      const fileUrl = `/manus-storage/${key}`;

      const trackId = await createTrackMutation.mutateAsync({
        fileName,
        fileSize,
        mimeType,
        fileUrl,
      });

      // ── 5. Kick off stem separation ──────────────────────────────────────
      setUploadProgress("Starting separation…");
      await startSeparationMutation.mutateAsync({ trackId: trackId || 0 });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // ── 6. Navigate to the processing screen ─────────────────────────────
      router.push({
        pathname: "/processing",
        params: { trackId: (trackId || 0).toString() },
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Upload failed",
        error?.message ?? "Something went wrong. Please try again."
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleTrackTap = (trackId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/stem-player",
      params: { trackId: trackId.toString() },
    });
  };

  const renderTrackCard = ({ item }: { item: Track }) => {
    const statusColor = STATUS_COLORS[item.status ?? ""] ?? colors.border;
    return (
      <TouchableOpacity
        onPress={() => handleTrackTap(item.id)}
        activeOpacity={0.7}
      >
        <View
          className="bg-surface rounded-lg p-4 mb-3 border border-border"
          style={{ borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text
                className="text-base font-semibold text-foreground mb-1"
                style={{ color: colors.foreground }}
                numberOfLines={1}
              >
                {item.title || item.fileName}
              </Text>
              <Text
                className="text-sm text-muted mb-2"
                style={{ color: colors.muted }}
                numberOfLines={1}
              >
                {item.artist || "Unknown"}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-xs" style={{ color: colors.muted }}>
                  {formatDuration(item.duration)}
                </Text>
                {item.status && (
                  <View
                    className="px-2 py-1 rounded"
                    style={{ backgroundColor: statusColor + "33" }}
                  >
                    <Text
                      className="text-xs font-medium capitalize"
                      style={{ color: statusColor }}
                    >
                      {item.status}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View
              className="w-12 h-12 rounded-lg items-center justify-center"
              style={{ backgroundColor: colors.primary + "20" }}
            >
              <Text className="text-xl">🎵</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text
              className="text-3xl font-bold text-foreground"
              style={{ color: colors.foreground }}
            >
              StemSplitter
            </Text>
            <Text className="text-base" style={{ color: colors.muted }}>
              Extract stems from any track
            </Text>
          </View>

          {/* Upload button */}
          <TouchableOpacity
            onPress={handleUploadAudio}
            disabled={uploading}
            style={{ opacity: uploading ? 0.7 : 1 }}
            activeOpacity={0.8}
          >
            <View
              className="rounded-2xl p-8 items-center justify-center gap-3"
              style={{ backgroundColor: colors.primary }}
            >
              {uploading ? (
                <>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text className="text-base font-semibold text-white text-center">
                    {uploadProgress ?? "Uploading…"}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-4xl">📤</Text>
                  <Text className="text-lg font-semibold text-white text-center">
                    Upload Audio
                  </Text>
                  <Text className="text-sm text-white text-center opacity-80">
                    MP3 · WAV · FLAC · M4A
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Recent tracks */}
          <View className="gap-3">
            <Text
              className="text-lg font-semibold"
              style={{ color: colors.foreground }}
            >
              Recent Tracks
            </Text>

            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : tracks && tracks.length > 0 ? (
              <FlatList
                data={tracks}
                renderItem={renderTrackCard}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
              />
            ) : (
              <View
                className="rounded-lg p-8 items-center justify-center gap-3 border"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Text className="text-4xl">🎼</Text>
                <Text
                  className="text-base font-medium text-center"
                  style={{ color: colors.foreground }}
                >
                  No tracks yet
                </Text>
                <Text
                  className="text-sm text-center"
                  style={{ color: colors.muted }}
                >
                  Upload your first track to get started
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
