import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

const STEM_TYPES = [
  { id: "master", label: "Master", icon: "🎵", color: "#0a7ea4" },
  { id: "vocals", label: "Vocals", icon: "🎤", color: "#EC4899" },
  { id: "drums",  label: "Drums",  icon: "🥁", color: "#8B5CF6" },
  { id: "bass",   label: "Bass",   icon: "🎸", color: "#06B6D4" },
  { id: "piano",  label: "Piano",  icon: "🎹", color: "#F59E0B" },
  { id: "guitar", label: "Guitar", icon: "🎸", color: "#10B981" },
  { id: "other",  label: "Other",  icon: "🎼", color: "#6B7280" },
] as const;

type Format = "mp3" | "wav";

export default function ExportScreen() {
  const colors = useColors();
  const { trackId } = useLocalSearchParams();
  const tid = parseInt(trackId as string);
  const [format, setFormat] = useState<Format>("mp3");
  const [loadingStem, setLoadingStem] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState(false);
  const [loadingMix, setLoadingMix] = useState(false);

  const { data: track } = trpc.tracks.get.useQuery(
    { trackId: tid },
    { enabled: !!tid }
  );

  const utils = trpc.useUtils();
  const exportMixMutation = trpc.export.exportMix.useMutation();

  // ── Download single stem ───────────────────────────────────────────────
  const handleDownloadStem = async (stemId: string) => {
    try {
      setLoadingStem(stemId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await utils.export.downloadStem.fetch({
        trackId: tid,
        stemType: stemId,
        format,
      });

      if (result?.downloadUrl) {
        Alert.alert(
          "✅ Download Ready",
          `Your ${stemId} stem (${format.toUpperCase()}) is ready.`,
          [
            { text: "Share Link", onPress: () => Share.share({ url: result.downloadUrl, message: result.downloadUrl }) },
            { text: "OK" },
          ]
        );
      }
    } catch {
      Alert.alert("Failed", `Could not download ${stemId} stem.`);
    } finally {
      setLoadingStem(null);
    }
  };

  // ── Download all stems as zip ──────────────────────────────────────────
  const handleDownloadPack = async () => {
    try {
      setLoadingPack(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await utils.export.downloadPack.fetch({
        trackId: tid,
        format: "zip",
      });

      if (result?.downloadUrl) {
        Alert.alert(
          "✅ Stem Pack Ready",
          "All stems have been packed into a zip file.",
          [
            { text: "Share Link", onPress: () => Share.share({ url: result.downloadUrl, message: result.downloadUrl }) },
            { text: "OK" },
          ]
        );
      }
    } catch {
      Alert.alert("Failed", "Could not generate stem pack.");
    } finally {
      setLoadingPack(false);
    }
  };

  // ── Export mixed audio ─────────────────────────────────────────────────
  const handleExportMix = async () => {
    try {
      setLoadingMix(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Default equal mix levels
      const stemLevels = Object.fromEntries(
        STEM_TYPES.map((s) => [s.id, 100])
      );

      const result = await exportMixMutation.mutateAsync({
        trackId: tid,
        stemLevels,
        format,
      });

      if (result?.downloadUrl) {
        Alert.alert(
          "✅ Mix Export Ready",
          `Your mixed track (${format.toUpperCase()}) is ready.`,
          [
            { text: "Share Link", onPress: () => Share.share({ url: result.downloadUrl, message: result.downloadUrl }) },
            { text: "OK" },
          ]
        );
      }
    } catch {
      Alert.alert("Failed", "Could not export mix.");
    } finally {
      setLoadingMix(false);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 24 }}>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={{ color: colors.primary, fontSize: 15 }}>← Back</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 26, fontWeight: "700", color: colors.foreground }}>
              Export
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>
              {track?.title || track?.fileName || "Loading…"}
            </Text>
          </View>

          {/* Format selector */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              gap: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>
              Export Format
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(["mp3", "wav"] as Format[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFormat(f)}
                  activeOpacity={0.7}
                  style={{ flex: 1 }}
                >
                  <View
                    style={{
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: "center",
                      borderWidth: 2,
                      borderColor: format === f ? colors.primary : colors.border,
                      backgroundColor: format === f ? colors.primary + "15" : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "700", color: format === f ? colors.primary : colors.muted }}>
                      {f.toUpperCase()}
                    </Text>
                    <Text style={{ fontSize: 11, color: format === f ? colors.primary : colors.muted, marginTop: 2 }}>
                      {f === "mp3" ? "Smaller size" : "Higher quality"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Download all stems */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              gap: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>
                  Download All Stems
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  Get all stems as a zip file
                </Text>
              </View>
              <Text style={{ fontSize: 28 }}>📦</Text>
            </View>

            <TouchableOpacity
              onPress={handleDownloadPack}
              disabled={loadingPack}
              activeOpacity={0.8}
            >
              <View
                style={{
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: colors.primary,
                  opacity: loadingPack ? 0.7 : 1,
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {loadingPack && <ActivityIndicator size="small" color="#fff" />}
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
                  {loadingPack ? "Preparing…" : `Download Zip`}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Export mix */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              gap: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>
                  Export Mixed Track
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  Export all stems combined
                </Text>
              </View>
              <Text style={{ fontSize: 28 }}>🎛</Text>
            </View>

            <TouchableOpacity
              onPress={handleExportMix}
              disabled={loadingMix}
              activeOpacity={0.8}
            >
              <View
                style={{
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: "#10B981",
                  opacity: loadingMix ? 0.7 : 1,
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {loadingMix && <ActivityIndicator size="small" color="#fff" />}
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
                  {loadingMix ? "Exporting…" : `Export ${format.toUpperCase()}`}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Individual stem downloads */}
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>
              Individual Stems
            </Text>

            {STEM_TYPES.map((stem) => (
              <TouchableOpacity
                key={stem.id}
                onPress={() => handleDownloadStem(stem.id)}
                disabled={loadingStem === stem.id}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      backgroundColor: stem.color + "20",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{stem.icon}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                      {stem.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {format.toUpperCase()} · Single stem
                    </Text>
                  </View>

                  {loadingStem === stem.id ? (
                    <ActivityIndicator size="small" color={stem.color} />
                  ) : (
                    <Text style={{ fontSize: 20 }}>📥</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

        </View>
      </ScrollView>
    </ScreenContainer>
  );
}