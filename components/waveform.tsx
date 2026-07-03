import { useEffect, useMemo } from "react";
import { TouchableOpacity } from "react-native";
import Svg, { Rect } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const BAR_COUNT = 60;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const WAVEFORM_HEIGHT = 80;

// Seeded pseudo-random so same track always looks the same
function seededRandom(seed: number) {
  const bars: number[] = [];
  let s = seed;
  for (let i = 0; i < BAR_COUNT; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const val = ((s >>> 0) / 0xffffffff);
    // Shape the waveform — louder in middle, quieter at edges
    const position = i / BAR_COUNT;
    const envelope = Math.sin(position * Math.PI) * 0.6 + 0.4;
    bars.push(Math.max(0.08, val * envelope));
  }
  return bars;
}

interface WaveformBarProps {
  height: number;
  x: number;
  filled: boolean;
  activeColor: string;
  inactiveColor: string;
  totalHeight: number;
}

function WaveformBar({
  height,
  x,
  filled,
  activeColor,
  inactiveColor,
  totalHeight,
}: WaveformBarProps) {
  const barHeight = height * totalHeight;
  const y = (totalHeight - barHeight) / 2;

  const fillColor = useSharedValue(filled ? activeColor : inactiveColor);

  useEffect(() => {
    fillColor.value = withTiming(filled ? activeColor : inactiveColor, {
      duration: 150,
      easing: Easing.out(Easing.ease),
    });
  }, [filled, activeColor, inactiveColor]);

  const animatedProps = useAnimatedProps(() => ({
    fill: fillColor.value,
  }));

  return (
    <AnimatedRect
      x={x}
      y={y}
      width={BAR_WIDTH}
      height={barHeight}
      rx={BAR_WIDTH / 2}
      animatedProps={animatedProps}
    />
  );
}

interface WaveformProps {
  progress: number; // 0–1
  duration: number;
  trackId: number;
  activeColor: string;
  inactiveColor: string;
  onSeek?: (progress: number) => void;
  width: number;
}

export function Waveform({
  progress,
  trackId,
  activeColor,
  inactiveColor,
  onSeek,
  width,
}: WaveformProps) {
  const bars = useMemo(() => seededRandom(trackId * 997), [trackId]);
  const filledUpTo = Math.floor(progress * BAR_COUNT);
  const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
  const scale = width / totalWidth;

  const handlePress = (e: any) => {
    if (!onSeek) return;
    const tapX = e.nativeEvent.locationX;
    const seekProgress = Math.min(1, Math.max(0, tapX / width));
    onSeek(seekProgress);
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handlePress}
      style={{ width, height: WAVEFORM_HEIGHT }}
    >
      <Svg
        width={width}
        height={WAVEFORM_HEIGHT}
        viewBox={`0 0 ${totalWidth} ${WAVEFORM_HEIGHT}`}
        preserveAspectRatio="none"
      >
        {bars.map((height, i) => (
          <WaveformBar
            key={i}
            height={height}
            x={i * (BAR_WIDTH + BAR_GAP)}
            filled={i <= filledUpTo}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
            totalHeight={WAVEFORM_HEIGHT}
          />
        ))}
      </Svg>
    </TouchableOpacity>
  );
}