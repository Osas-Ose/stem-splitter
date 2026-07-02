import { View, Text, TouchableOpacity } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  useAnimatedProps,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 160;
const STROKE_WIDTH = 10;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ProgressRing({
  progress,
  color,
  trackColor,
}: {
  progress: number;
  color: string;
  trackColor: string;
}) {
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(progress / 100, { duration: 600 });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - animatedProgress.value),
  }));

  return (
    <Svg
      width={RING_SIZE}
      height={RING_SIZE}
      style={{ transform: [{ rotate: "-90deg" }] }}
    >
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        stroke={trackColor}
        strokeWidth={STROKE_WIDTH}
        fill="none"
      />
      <AnimatedCircle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        animatedProps={animatedProps}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const STAGES = [
  { min: 0,  max: 15,  label: "Analyzing audio…",       icon: "🔍" },
  { min: 15, max: 30,  label: "Separating vocals…",      icon: "🎤" },
  { min: 30, max: 50,  label: "Extracting drums…",       icon: "🥁" },
  { min: 50, max: 65,  label: "Isolating bass…",         icon: "🎸" },
  { min: 65, max: 80,  label: "Finding piano & guitar…", icon: "🎹" },
  { min: 80, max: 95,  label: "Finalizing stems…",       icon: "🎼" },
  { min: 95, max: 100, label: "Almost there…",           icon: "✨" },
];

function getStage(progress: number) {
  return (
    STAGES.find((s) => progress >= s.min && progress < s.max) ??
    STAGES[STAGES.length - 1]
  );
}

export default function ProcessingScreen() {
  const colors = useColors();
  const { trackId } = useLocalSearchParams();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("processing");
  const navigated = useRef(false);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,  { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const { data: track } = trpc.tracks.get.useQuery(
    { trackId: parseInt(trackId as string) },
    { enabled: !!trackId }
  );

  const { data: separationStatus } = trpc.separation.status.useQuery(
    { trackId: parseInt(trackId as string) },
    { enabled: !!trackId, refetchInterval: 2000 }
  );

  useEffect(() => {
    if (!separationStatus) return;

    setProgress(separationStatus.progress ?? 0);
    setStatus(separationStatus.status || "processing");

    if (separationStatus.status === "completed" && !navigated.current) {
      navigated.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        router.replace({
          pathname: "/stem-player",
          params: { trackId: trackId as string },
        });
      }, 800);
    }
  }, [separationStatus, trackId]);

  const stage = getStage(progress);
  const isFailed = status === "failed";
  const isCompleted = status === "completed";

  return (
    <ScreenContainer className="p-6 items-center justify-center">
      <View style={{ width: "100%", maxWidth: 320, gap: 32, alignItems: "center" }}>

        {track && (
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text
              style={{ fontSize: 18, fontWeight: "600", color: colors.foreground, textAlign: "center" }}
              numberOfLines={2}
            >
              {track.title || track.fileName}
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>
              {track.artist || "Unknown Artist"}
            </Text>
          </View>
        )}

        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <ProgressRing
            progress={isCompleted ? 100 : progress}
            color={isFailed ? "#EF4444" : isCompleted ? "#10B981" : colors.primary}
            trackColor={colors.border}
          />
          <View style={{ position: "absolute", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Animated.Text style={[{ fontSize: 28 }, pulseStyle]}>
              {isCompleted ? "✅" : isFailed ? "❌" : stage.icon}
            </Animated.Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: isFailed ? "#EF4444" : isCompleted ? "#10B981" : colors.foreground,
              }}
            >
              {isCompleted ? "100" : progress}%
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, textAlign: "center" }}>
            {isCompleted ? "Separation complete!" : isFailed ? "Processing failed" : stage.label}
          </Text>
          {status === "processing" &&
            separationStatus?.estimatedTimeRemaining != null &&
            separationStatus.estimatedTimeRemaining > 0 && (
              <Text style={{ fontSize: 13, color: colors.muted }}>
                ~{separationStatus.estimatedTimeRemaining}s remaining
              </Text>
            )}
        </View>

        {!isCompleted && !isFailed && (
          <View style={{ flexDirection: "row", gap: 6 }}>
            {STAGES.map((s, i) => (
              <View
                key={i}
                style={{
                  width: progress >= s.min ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: progress >= s.min ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>
        )}

        {isCompleted ? (
          <TouchableOpacity
            onPress={() => router.replace({ pathname: "/stem-player", params: { trackId: trackId as string } })}
            activeOpacity={0.8}
            style={{ width: "100%" }}
          >
            <View style={{ paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#10B981" }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>View Stems →</Text>
            </View>
          </TouchableOpacity>
        ) : isFailed ? (
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ width: "100%" }}>
            <View style={{ paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#EF4444" }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#EF4444" }}>Go Back</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ width: "100%" }}>
            <View style={{ paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.muted }}>Cancel</Text>
            </View>
          </TouchableOpacity>
        )}

      </View>
    </ScreenContainer>
  );
}