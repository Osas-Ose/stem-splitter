import { View, Text, TouchableOpacity, ScrollView, FlatList, Alert } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";

interface Track {
  id: number;
  fileName: string;
  title: string | null;
  artist: string | null;
  duration: number | null;
  status: string | null;
  isFavorite?: boolean | null;
  createdAt: Date;
}

export default function LibraryScreen() {
  const colors = useColors();
  const [sortBy, setSortBy] = useState<"date" | "name" | "duration">("date");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "processing">("all");

  const { data: tracks, isLoading, refetch } = trpc.tracks.list.useQuery();
  const deleteTrackMutation = trpc.tracks.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const handleDeleteTrack = (trackId: number, fileName: string) => {
    Alert.alert(
      "Delete Track",
      `Are you sure you want to delete "${fileName}"?`,
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Delete",
          onPress: async () => {
            await deleteTrackMutation.mutateAsync({ trackId });
          },
          style: "destructive",
        },
      ]
    );
  };

  const handleTrackTap = (trackId: number) => {
    router.push({
      pathname: "/stem-player",
      params: { trackId: trackId.toString() },
    });
  };

  const filteredTracks = tracks?.filter((track) => {
    if (filterStatus === "all") return true;
    return track.status === filterStatus;
  });

  const sortedTracks = [...(filteredTracks || [])].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return (a.title || a.fileName).localeCompare(b.title || b.fileName);
      case "duration":
        return (b.duration || 0) - (a.duration || 0);
      case "date":
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const renderTrackCard = ({ item }: { item: Track }) => (
    <TouchableOpacity
      onPress={() => handleTrackTap(item.id)}
      activeOpacity={0.7}
    >
      <View
        className="bg-surface rounded-lg p-4 mb-3 border border-border flex-row items-center justify-between"
        style={{
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <View className="flex-1">
          <Text
            className="text-base font-semibold text-foreground mb-1"
            style={{ color: colors.foreground }}
            numberOfLines={1}
          >
            {item.title || item.fileName}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text
              className="text-xs text-muted"
              style={{ color: colors.muted }}
            >
              {item.duration ? `${Math.floor(item.duration / 60)}:${String((item.duration % 60) || 0).padStart(2, "0")}` : "0:00"}
            </Text>
            {item.status && (
              <View
                className="px-2 py-1 rounded"
                style={{
                  backgroundColor:
                    item.status === "completed"
                      ? colors.success
                      : item.status === "processing"
                        ? colors.warning
                        : colors.border,
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{
                    color: item.status === "completed" ? "#fff" : colors.foreground,
                  }}
                >
                  {item.status}
                </Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => handleDeleteTrack(item.id, item.fileName)}
          activeOpacity={0.7}
        >
          <Text className="text-lg ml-4">🗑</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="gap-4">
          <View className="gap-2">
            <Text
              className="text-2xl font-bold text-foreground"
              style={{ color: colors.foreground }}
            >
              Library
            </Text>
            <Text
              className="text-sm text-muted"
              style={{ color: colors.muted }}
            >
              {sortedTracks?.length || 0} tracks
            </Text>
          </View>

          {/* Filter Tabs */}
          <View className="flex-row gap-2">
            {(["all", "completed", "processing"] as const).map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => setFilterStatus(status)}
                activeOpacity={0.7}
              >
                <View
                  className={`px-4 py-2 rounded-lg border ${
                    filterStatus === status ? "border-primary" : "border-border"
                  }`}
                  style={{
                    borderColor: filterStatus === status ? colors.primary : colors.border,
                    backgroundColor: filterStatus === status ? colors.primary + "20" : "transparent",
                  }}
                >
                  <Text
                    className="text-sm font-semibold capitalize"
                    style={{
                      color: filterStatus === status ? colors.primary : colors.muted,
                    }}
                  >
                    {status}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sort Options */}
          <View className="flex-row gap-2">
            {(["date", "name", "duration"] as const).map((sort) => (
              <TouchableOpacity
                key={sort}
                onPress={() => setSortBy(sort)}
                activeOpacity={0.7}
              >
                <View
                  className={`px-3 py-1 rounded border ${
                    sortBy === sort ? "border-primary" : "border-border"
                  }`}
                  style={{
                    borderColor: sortBy === sort ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    className="text-xs font-semibold capitalize"
                    style={{
                      color: sortBy === sort ? colors.primary : colors.muted,
                    }}
                  >
                    {sort}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tracks List */}
          {isLoading ? (
            <Text style={{ color: colors.muted }}>Loading...</Text>
          ) : sortedTracks && sortedTracks.length > 0 ? (
            <FlatList
              data={sortedTracks}
              renderItem={renderTrackCard}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <View
              className="bg-surface rounded-lg p-8 items-center justify-center gap-3 border border-border"
              style={{
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Text className="text-4xl">📚</Text>
              <Text
                className="text-base font-medium text-foreground text-center"
                style={{ color: colors.foreground }}
              >
                No tracks found
              </Text>
              <Text
                className="text-sm text-muted text-center"
                style={{ color: colors.muted }}
              >
                Try adjusting your filters
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
