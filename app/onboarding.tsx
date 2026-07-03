import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useState, useRef } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "🎵",
    title: "Welcome to StemSplitter",
    description:
      "Split any song into individual stems — vocals, drums, bass, guitar and more. Powered by AI.",
    color: "#0a7ea4",
  },
  {
    icon: "📤",
    title: "Upload Any Track",
    description:
      "Pick any MP3, WAV, FLAC or M4A file from your device. We handle the rest.",
    color: "#EC4899",
  },
  {
    icon: "🤖",
    title: "AI Separation",
    description:
      "Our AI model analyses your track and separates it into clean individual stems in seconds.",
    color: "#8B5CF6",
  },
  {
    icon: "🎚",
    title: "Mix & Export",
    description:
      "Play each stem, adjust volumes, create mixes and export or share your stems with anyone.",
    color: "#10B981",
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentSlide < SLIDES.length - 1) {
      const next = currentSlide + 1;
      setCurrentSlide(next);
      scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleFinish();
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem("onboarding_complete", "true");
    router.replace("/(tabs)");
  };

  const handleScroll = (e: any) => {
    const slide = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentSlide(slide);
  };

  const slide = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;

  return (
    <ScreenContainer style={{ padding: 0 }}>
      <View style={{ flex: 1 }}>

        {/* Skip button */}
        {!isLast && (
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}
          >
            <Text style={{ fontSize: 15, color: colors.muted }}>Skip</Text>
          </TouchableOpacity>
        )}

        {/* Slides */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {SLIDES.map((s, i) => (
            <View
              key={i}
              style={{
                width: SCREEN_WIDTH,
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 32,
                gap: 24,
              }}
            >
              {/* Icon circle */}
              <View
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  backgroundColor: s.color + "20",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: s.color + "40",
                }}
              >
                <Text style={{ fontSize: 60 }}>{s.icon}</Text>
              </View>

              {/* Text */}
              <View style={{ gap: 12, alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: "700",
                    color: colors.foreground,
                    textAlign: "center",
                  }}
                >
                  {s.title}
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.muted,
                    textAlign: "center",
                    lineHeight: 24,
                  }}
                >
                  {s.description}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Bottom controls */}
        <View style={{ padding: 24, gap: 20 }}>

          {/* Dots */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === currentSlide ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor:
                    i === currentSlide ? slide.color : colors.border,
                }}
              />
            ))}
          </View>

          {/* Next / Get Started button */}
          <TouchableOpacity onPress={handleNext} activeOpacity={0.8}>
            <View
              style={{
                paddingVertical: 16,
                borderRadius: 14,
                alignItems: "center",
                backgroundColor: slide.color,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>
                {isLast ? "Get Started 🚀" : "Next →"}
              </Text>
            </View>
          </TouchableOpacity>

        </View>
      </View>
    </ScreenContainer>
  );
}