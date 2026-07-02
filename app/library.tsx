import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useState, useMemo } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

interface Track {
  id: number;
  fileName: string;
  title: string | null;
  artist: string | null;
  duration: number | null;
  status: string | null;
  createdAt: Date;
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  completed:  { color: "#22C55E", label: "Ready" },
  processing: { color: "#F59E0B", label: "Processing" },
  uploaded:   { color: "#6B7280", label: "Uploaded" },
  failed:     { color: "#EF4444", label: "Failed" },
};

const formatDuration = (seconds: number | null) => {
  if (!seconds) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const formatDate = (date: Date) => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
};

export default function LibraryScreen() {
  const colors = useColors();
  const [sortBy, setSortBy] = useState<"date" | "name" | "duration">("date");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "processing">("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: tracks, isLoading, refetch } = trpc.tracks.list.useQuery();
  const deleteTrackMutation = trpc.tracks.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleDeleteTrack = (trackId: number, fileName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Track",
      `Delete "${fileName}"? This also removes all its stems.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteTrackMutation.mutateAsync({ trackId });
          },
        },
      ]
    );
  };

  const handleTrackTap = (track: Track) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (track.status === "processing") {
      router.push({ pathname: "/processing", params: { trackId: track.id.toString() } });
    } else {
      router.push({ pathname: "/stem-player", params: { trackId: track.id.toString() } });
    }
  };

  const sortedTracks = useMemo(() => {
    let result = tracks ?? [];

    // Filter by status
    if (filterStatus !== "all") {
      result = result.filter((t) => t.status === filterStatus);
    }

    // Filter by search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          (t.title || t.fileName).toLowerCase().includes(q) ||
          (t.artist || "").toLowerCase().includes(q)
      );
    }

    // Sort
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.title || a.fileName).localeCompare(b.title || b.fileName);
        case "duration":
          return (b.duration || 0) - (a.duration || 0);
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [tracks, filterStatus, search, sortBy]);

  const renderTrackCard = ({ item }: { item: Track }) => {
    const meta = STATUS_META[item.status ?? ""] ?? STATUS_META.uploaded;
    return (
      <TouchableOpacity onPress={() => handleTrackTap(item)} activeOpacity={0.7}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Icon */}
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 10,
              backgroundColor: colors.primary + "20",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Text style={{ fontSize: 22 }}>🎵</Text>
          </View>

          {/* Info */}
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {formatDuration(item.duration)}
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>·</Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {formatDate(item.createdAt)}
              </Text>
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 6,
                  backgroundColor: meta.color + "25",
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "600", color: meta.color }}>
                  {meta.label}
                </Text>
              </View>
            </View>
          </View>

          {/* Delete */}
          <TouchableOpacity
            onPress={() => handleDeleteTrack(item.id, item.title || item.fileName)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={{ fontSize: 18 }}>🗑</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="p-4">
      <View style={{ flex: 1, gap: 14 }}>

        {/* Header */}
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.foreground }}>
            Library
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted }}>
            {sortedTracks.length} {sortedTracks.length === 1 ? "track" : "tracks"}
          </Text>
        </View>

        {/* Search bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search tracks or artists…"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: colors.foreground }}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter tabs */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["all", "completed", "processing"] as const).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setFilterStatus(s)}
              activeOpacity={0.7}
            >
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: filterStatus === s ? colors.primary : colors.border,
                  backgroundColor: filterStatus === s ? colors.primary + "20" : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    textTransform: "capitalize",
                    color: filterStatus === s ? colors.primary : colors.muted,
                  }}
                >
                  {s}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sort options */}
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: colors.muted, marginRight: 4 }}>Sort:</Text>
          {(["date", "name", "duration"] as const).map((s) => (
            <TouchableOpacity key={s} onPress={() => setSortBy(s)} activeOpacity={0.7}>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: sortBy === s ? colors.primary : colors.border,
                  backgroundColor: sortBy === s ? colors.primary + "15" : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    textTransform: "capitalize",
                    color: sortBy === s ? colors.primary : colors.muted,
                  }}
                >
                  {s}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Track list */}
        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.muted, fontSize: 14 }}>Loading your library…</Text>
          </View>
        ) : sortedTracks.length > 0 ? (
          <FlatList
            data={sortedTracks}
            renderItem={renderTrackCard}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            scrollEnabled
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: 40,
            }}
          >
            <Text style={{ fontSize: 40 }}>
              {search ? "🔍" : "📚"}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, textAlign: "center" }}>
              {search ? "No results found" : "No tracks yet"}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
              {search ? `No tracks match "${search}"` : "Upload a track from the Home tab"}
            </Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}