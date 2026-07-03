import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";
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

const parseFileName = (fileName: string) => {
  const withoutExt = fileName.replace(/\.[^/.]+$/, "").trim();
  const separators = [" - ", " – ", " — ", "_-_"];
  for (const sep of separators) {
    const idx = withoutExt.indexOf(sep);
    if (idx > 0) {
      const left = withoutExt.slice(0, idx).trim();
      const right = withoutExt.slice(idx + sep.length).trim();
      const artist = left.replace(/^\d+[\s._-]+/, "");
      return { artist: artist || null, title: right || withoutExt };
    }
  }
  return { artist: null, title: withoutExt };
};

export default function HomeScreen() {
  const colors = useColors();
  const { colorScheme, setColorScheme } = useThemeContext();
  const toggleTheme = () => setColorScheme(colorScheme === "dark" ? "light" : "dark");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const { data: tracks, isLoading, refetch } = trpc.tracks.list.useQuery();

  // ── Onboarding check ───────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem("onboarding_complete").then((value) => {
      if (!value) {
        router.replace("/onboarding");
      }
    });
  }, []);

  const getUploadUrlMutation = trpc.tracks.getUploadUrl.useMutation();
  const createTrackMutation = trpc.tracks.create.useMutation({
    onSuccess: () => refetch(),
  });
  const startSeparationMutation = trpc.separation.start.useMutation();

  const handleUploadAudio = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await DocumentPicker.getDocumentAsync({
        type: SUPPORTED_MIME,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? "audio/mpeg";
      const fileName = asset.name;
      const fileSize = asset.size ?? 0;
      const { artist, title } = parseFileName(fileName);

      if (!SUPPORTED_MIME.includes(mimeType)) {
        Alert.alert(
          "Unsupported file",
          "Please choose an MP3, WAV, FLAC, or M4A file."
        );
        return;
      }

      setUploading(true);
      setUploadProgress("Getting upload URL…");

      const { uploadUrl, key } = await getUploadUrlMutation.mutateAsync({
        fileName,
        mimeType,
      });

      setUploadProgress("Uploading file…");
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

      setUploadProgress("Saving track…");
      const fileUrl = `/manus-storage/${key}`;

      const trackId = await createTrackMutation.mutateAsync({
        fileName,
        fileSize,
        mimeType,
        fileUrl,
        title,
        artist: artist ?? undefined,
      });

      setUploadProgress("Starting separation…");
      await startSeparationMutation.mutateAsync({ trackId: trackId || 0 });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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
      <TouchableOpacity onPress={() => handleTrackTap(item.id)} activeOpacity={0.7}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 10,
              backgroundColor: colors.primary + "20",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22 }}>🎵</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}
              numberOfLines={1}
            >
              {item.title || item.fileName}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
              {item.artist || "Unknown Artist"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {formatDuration(item.duration)}
              </Text>
              {item.status && (
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor: statusColor + "25",
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "600", color: statusColor }}>
                    {item.status}
                  </Text>
                </View>
              )}
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
        <View style={{ gap: 24 }}>

          {/* Header with theme toggle */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 30, fontWeight: "700", color: colors.foreground }}>
                StemSplitter
              </Text>
              <Text style={{ fontSize: 15, color: colors.muted }}>
                Extract stems from any track
              </Text>
            </View>
            <TouchableOpacity onPress={toggleTheme} activeOpacity={0.7}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 22 }}>
                  {colorScheme === "dark" ? "☀️" : "🌙"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Upload button */}
          <TouchableOpacity
            onPress={handleUploadAudio}
            disabled={uploading}
            style={{ opacity: uploading ? 0.7 : 1 }}
            activeOpacity={0.8}
          >
            <View
              style={{
                borderRadius: 16,
                padding: 32,
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                backgroundColor: colors.primary,
              }}
            >
              {uploading ? (
                <>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
                    {uploadProgress ?? "Uploading…"}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 40 }}>📤</Text>
                  <Text style={{ fontSize: 18, fontWeight: "600", color: "#fff" }}>
                    Upload Audio
                  </Text>
                  <Text style={{ fontSize: 13, color: "#ffffff99" }}>
                    MP3 · WAV · FLAC · M4A
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Recent tracks */}
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
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
                style={{
                  borderRadius: 12,
                  padding: 40,
                  alignItems: "center",
                  gap: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Text style={{ fontSize: 40 }}>🎼</Text>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
                  No tracks yet
                </Text>
                <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
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