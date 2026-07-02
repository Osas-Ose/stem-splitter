import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useStemPlayer } from "@/hooks/use-stem-player";
import * as Haptics from "expo-haptics";

const STEM_TYPES = [
  { id: "vocals", label: "Vocals", color: "#EC4899", icon: "🎤" },
  { id: "drums",  label: "Drums",  color: "#8B5CF6", icon: "🥁" },
  { id: "bass",   label: "Bass",   color: "#06B6D4", icon: "🎸" },
  { id: "piano",  label: "Piano",  color: "#F59E0B", icon: "🎹" },
  { id: "guitar", label: "Guitar", color: "#10B981", icon: "🎸" },
  { id: "other",  label: "Other",  color: "#6B7280", icon: "🎼" },
] as const;

type StemId = (typeof STEM_TYPES)[number]["id"];

const getApiBaseUrl = () => {
  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) return `${protocol}//${apiHostname}`;
  }
  return "";
};

export default function StemMixerScreen() {
  const colors = useColors();
  const { trackId } = useLocalSearchParams();
  const tid = parseInt(trackId as string);

  // ── Volume & mute state per stem ───────────────────────────────────────
  const [volumes, setVolumes] = useState<Record<string, number>>(
    Object.fromEntries(STEM_TYPES.map((s) => [s.id, 100]))
  );
  const [muted, setMuted] = useState<Record<string, boolean>>(
    Object.fromEntries(STEM_TYPES.map((s) => [s.id, false]))
  );
  const [soloId, setSoloId] = useState<StemId | null>(null);
  const [previewStem, setPreviewStem] = useState<StemId>("vocals");
  const [presetName, setPresetName] = useState("");

  // ── Fetch all stem URLs ────────────────────────────────────────────────
  const { data: vocalsData }  = trpc.stems.get.useQuery({ trackId: tid, stemType: "vocals"  }, { enabled: !!tid });
  const { data: drumsData }   = trpc.stems.get.useQuery({ trackId: tid, stemType: "drums"   }, { enabled: !!tid });
  const { data: bassData }    = trpc.stems.get.useQuery({ trackId: tid, stemType: "bass"    }, { enabled: !!tid });
  const { data: pianoData }   = trpc.stems.get.useQuery({ trackId: tid, stemType: "piano"   }, { enabled: !!tid });
  const { data: guitarData }  = trpc.stems.get.useQuery({ trackId: tid, stemType: "guitar"  }, { enabled: !!tid });
  const { data: otherData }   = trpc.stems.get.useQuery({ trackId: tid, stemType: "other"   }, { enabled: !!tid });

  const stemUrls: Record<string, string | undefined> = {
    vocals: vocalsData?.fileUrl  ? `${getApiBaseUrl()}${vocalsData.fileUrl}`  : undefined,
    drums:  drumsData?.fileUrl   ? `${getApiBaseUrl()}${drumsData.fileUrl}`   : undefined,
    bass:   bassData?.fileUrl    ? `${getApiBaseUrl()}${bassData.fileUrl}`    : undefined,
    piano:  pianoData?.fileUrl   ? `${getApiBaseUrl()}${pianoData.fileUrl}`   : undefined,
    guitar: guitarData?.fileUrl  ? `${getApiBaseUrl()}${guitarData.fileUrl}`  : undefined,
    other:  otherData?.fileUrl   ? `${getApiBaseUrl()}${otherData.fileUrl}`   : undefined,
  };

  // ── Preview player (plays whichever stem is selected) ─────────────────
  const {
    isPlaying,
    isLoaded,
    handlePlayPause,
    setVolume: setPlayerVolume,
  } = useStemPlayer(stemUrls[previewStem]);

  // Keep player volume in sync with slider
  useEffect(() => {
    const effectiveVolume = muted[previewStem] ? 0 : volumes[previewStem] ?? 100;
    setPlayerVolume(effectiveVolume);
  }, [volumes, muted, previewStem]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const adjustVolume = (stemId: string, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVolumes((prev) => ({
      ...prev,
      [stemId]: Math.max(0, Math.min(100, (prev[stemId] ?? 100) + delta)),
    }));
  };

  const toggleMute = (stemId: StemId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMuted((prev) => ({ ...prev, [stemId]: !prev[stemId] }));
  };

  const toggleSolo = (stemId: StemId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSoloId((prev) => (prev === stemId ? null : stemId));
  };

  const handlePreview = (stemId: StemId) => {
    setPreviewStem(stemId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const resetAll = () => {
    setVolumes(Object.fromEntries(STEM_TYPES.map((s) => [s.id, 100])));
    setMuted(Object.fromEntries(STEM_TYPES.map((s) => [s.id, false])));
    setSoloId(null);
  };

  // ── Save mix ───────────────────────────────────────────────────────────
  const saveMixMutation = trpc.stems.saveMix.useMutation({
    onSuccess: () => {
      Alert.alert("Saved!", `Preset "${presetName}" saved.`);
      setPresetName("");
      router.back();
    },
  });

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      Alert.alert("Name required", "Please enter a preset name.");
      return;
    }
    saveMixMutation.mutateAsync({
      trackId: tid,
      presetName: presetName.trim(),
      stemLevels: volumes,
    });
  };

  // Effective volume accounting for solo mode
  const effectiveVolume = (stemId: StemId) => {
    if (soloId && soloId !== stemId) return 0;
    if (muted[stemId]) return 0;
    return volumes[stemId] ?? 100;
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 20 }}>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 24, fontWeight: "700", color: colors.foreground }}>
                Mix Stems
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Tap a stem to preview it
              </Text>
            </View>
            <TouchableOpacity onPress={resetAll} activeOpacity={0.7}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 13, color: colors.muted }}>Reset all</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Preview player bar */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 22 }}>
              {STEM_TYPES.find((s) => s.id === previewStem)?.icon}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
                Previewing: {STEM_TYPES.find((s) => s.id === previewStem)?.label}
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {isLoaded ? "Ready" : stemUrls[previewStem] ? "Loading…" : "No audio yet"}
              </Text>
            </View>
            <TouchableOpacity onPress={handlePlayPause} activeOpacity={0.8}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 20 }}>
                  {isPlaying ? "⏸" : "▶"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Stem sliders */}
          {STEM_TYPES.map((stem) => {
            const vol = effectiveVolume(stem.id);
            const isMuted = muted[stem.id];
            const isSolo = soloId === stem.id;
            const isPreviewing = previewStem === stem.id;

            return (
              <TouchableOpacity
                key={stem.id}
                onPress={() => handlePreview(stem.id)}
                activeOpacity={0.9}
              >
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 14,
                    gap: 10,
                    borderWidth: isPreviewing ? 2 : 1,
                    borderColor: isPreviewing ? stem.color : colors.border,
                  }}
                >
                  {/* Stem header */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ fontSize: 22 }}>{stem.icon}</Text>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: stem.color }}>
                      {stem.label}
                    </Text>

                    {/* Solo button */}
                    <TouchableOpacity onPress={() => toggleSolo(stem.id)} activeOpacity={0.7}>
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 6,
                          backgroundColor: isSolo ? "#F59E0B" : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: isSolo ? "#fff" : colors.muted }}>
                          S
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Mute button */}
                    <TouchableOpacity onPress={() => toggleMute(stem.id)} activeOpacity={0.7}>
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 6,
                          backgroundColor: isMuted ? "#EF4444" : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: isMuted ? "#fff" : colors.muted }}>
                          M
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Volume % */}
                    <Text style={{ fontSize: 13, fontWeight: "700", color: isMuted ? colors.muted : stem.color, minWidth: 38, textAlign: "right" }}>
                      {isMuted ? "—" : `${vol}%`}
                    </Text>
                  </View>

                  {/* Volume bar */}
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" }}>
                    <View
                      style={{
                        height: "100%",
                        width: `${vol}%`,
                        backgroundColor: isMuted ? colors.border : stem.color,
                        borderRadius: 4,
                      }}
                    />
                  </View>

                  {/* Controls */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[-25, -10, 10, 25].map((delta) => (
                      <TouchableOpacity
                        key={delta}
                        onPress={(e) => { e.stopPropagation?.(); adjustVolume(stem.id, delta); }}
                        activeOpacity={0.7}
                        style={{ flex: 1 }}
                      >
                        <View
                          style={{
                            paddingVertical: 7,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }}>
                            {delta > 0 ? `+${delta}` : delta}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Save preset */}
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
              Save Preset
            </Text>
            <TextInput
              value={presetName}
              onChangeText={setPresetName}
              placeholder="Enter preset name…"
              placeholderTextColor={colors.muted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: colors.foreground,
              }}
            />
            <TouchableOpacity
              onPress={handleSavePreset}
              disabled={!presetName.trim() || saveMixMutation.isPending}
              activeOpacity={0.8}
            >
              <View
                style={{
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: presetName.trim() ? colors.primary : colors.border,
                  opacity: saveMixMutation.isPending ? 0.6 : 1,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
                  {saveMixMutation.isPending ? "Saving…" : "Save Preset"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <View
              style={{
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.muted }}>
                ← Back
              </Text>
            </View>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </ScreenContainer>
  );
}