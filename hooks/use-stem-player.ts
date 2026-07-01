/**
 * useStemPlayer
 *
 * Manages playback of a single audio stem using expo-audio.
 * Pass a new `stemUrl` to swap the source without rebuilding the hook.
 *
 * Stem-level volume/mute state is kept here so the parent screen
 * can drive the UI from one central place.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

export interface StemTrack {
  id: string;
  name: string;
  volume: number;  // 0–100
  isMuted: boolean;
  isSolo: boolean;
  url?: string;
}

// ─── single-stem playback ──────────────────────────────────────────────────

export function useStemPlayer(stemUrl?: string) {
  const source = stemUrl ? { uri: stemUrl } : null;

  // expo-audio: player is stable across re-renders; replace() swaps the source
  const player = useAudioPlayer(source as any);
  const status = useAudioPlayerStatus(player);

  const isPlaying = status.playing ?? false;
  const currentTime = status.currentTime ?? 0;
  const duration = status.duration ?? 0;
  const isLoaded = status.isLoaded ?? false;

  // Replace the source whenever stemUrl changes
  const prevUrl = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (stemUrl && stemUrl !== prevUrl.current) {
      prevUrl.current = stemUrl;
      try {
        player.replace({ uri: stemUrl });
      } catch {
        // player may not be ready on first mount; useAudioPlayer handles initial source
      }
    }
  }, [stemUrl, player]);

  // Pause when unmounted
  useEffect(() => {
    return () => {
      try { player.pause(); } catch {}
    };
  }, [player]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player]);

  const handleSeek = useCallback((seconds: number) => {
    player.seekTo(seconds);
  }, [player]);

  const setVolume = useCallback((vol: number) => {
    // expo-audio volume is 0.0 – 1.0
    player.volume = Math.max(0, Math.min(1, vol / 100));
  }, [player]);

  return {
    isPlaying,
    currentTime,
    duration,
    isLoaded,
    handlePlayPause,
    handleSeek,
    setVolume,
  };
}

// ─── per-stem mix state (for stem-mixer screen) ────────────────────────────

const DEFAULT_STEMS: StemTrack[] = [
  { id: "vocals",  name: "Vocals",  volume: 100, isMuted: false, isSolo: false },
  { id: "drums",   name: "Drums",   volume: 100, isMuted: false, isSolo: false },
  { id: "bass",    name: "Bass",    volume: 100, isMuted: false, isSolo: false },
  { id: "piano",   name: "Piano",   volume: 100, isMuted: false, isSolo: false },
  { id: "guitar",  name: "Guitar",  volume: 100, isMuted: false, isSolo: false },
  { id: "other",   name: "Other",   volume: 100, isMuted: false, isSolo: false },
];

export function useStemMixState(initialStems: StemTrack[] = DEFAULT_STEMS) {
  const [stems, setStems] = useState<Record<string, StemTrack>>(
    Object.fromEntries(initialStems.map((s) => [s.id, s]))
  );

  const setVolume = useCallback((stemId: string, volume: number) => {
    setStems((prev) => ({
      ...prev,
      [stemId]: { ...prev[stemId], volume: Math.max(0, Math.min(100, volume)) },
    }));
  }, []);

  const toggleMute = useCallback((stemId: string) => {
    setStems((prev) => ({
      ...prev,
      [stemId]: { ...prev[stemId], isMuted: !prev[stemId].isMuted },
    }));
  }, []);

  const toggleSolo = useCallback((stemId: string) => {
    setStems((prev) => {
      const wasSolo = prev[stemId]?.isSolo;
      return Object.fromEntries(
        Object.entries(prev).map(([id, stem]) => [
          id,
          {
            ...stem,
            isSolo: id === stemId ? !wasSolo : false,
            // mute all others when entering solo; restore when leaving
            isMuted: id === stemId ? false : !wasSolo,
          },
        ])
      );
    });
  }, []);

  const resetAll = useCallback(() => {
    setStems(Object.fromEntries(initialStems.map((s) => [s.id, { ...s }])));
  }, [initialStems]);

  return { stems, setVolume, toggleMute, toggleSolo, resetAll };
}
