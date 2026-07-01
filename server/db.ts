import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, tracks, stems, mixPresets } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result[0] || null;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.openId, user.openId))
    .limit(1);

  if (existingUser.length > 0) {
    await db
      .update(users)
      .set({
        name: user.name,
        email: user.email,
        loginMethod: user.loginMethod,
        lastSignedIn: new Date(),
      })
      .where(eq(users.openId, user.openId));
  } else {
    await db.insert(users).values(user);
  }
}

// Track management
export async function getUserTracks(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(tracks).where(eq(tracks.userId, userId));
}

export async function getTrack(trackId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)))
    .limit(1);

  return result[0] || null;
}

export async function createTrack(data: {
  userId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl?: string;
  status: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tracks).values({
    userId: data.userId,
    fileName: data.fileName,
    fileSize: data.fileSize,
    mimeType: data.mimeType,
    fileUrl: data.fileUrl,
    status: data.status as any,
    title: data.fileName.split(".")[0],
    artist: "Unknown",
    duration: 0,
    isFavorite: false,
  });

  return (result as any).insertId || 0;
}

export async function updateTrack(
  trackId: number,
  userId: number,
  data: {
    title?: string;
    artist?: string;
    isFavorite?: boolean;
    status?: string;
    duration?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Record<string, any> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.artist !== undefined) updateData.artist = data.artist;
  if (data.isFavorite !== undefined) updateData.isFavorite = data.isFavorite;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.duration !== undefined) updateData.duration = data.duration;

  await db
    .update(tracks)
    .set(updateData)
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));
}

export async function deleteTrack(trackId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));
}

// Stem separation
export async function startSeparation(trackId: number, userId: number, model: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify track belongs to user
  const track = await getTrack(trackId, userId);
  if (!track) throw new Error("Track not found");

  // Update track status to processing
  await updateTrack(trackId, userId, { status: "processing" });

  // In production, this would trigger a background job
  // For now, return a processing status
  return {
    trackId,
    status: "processing",
    model,
    startedAt: new Date(),
  };
}

export async function getSeparationStatus(trackId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  const track = await getTrack(trackId, userId);
  if (!track) return null;

  // Simulate a separation job progressing over time based on how long ago
  // processing started (updatedAt). Once it crosses the simulated duration,
  // mark the track as completed and seed placeholder stem rows so the
  // player/mixer screens have real data to work with.
  if (track.status === "processing") {
    const startedAt = track.updatedAt ? new Date(track.updatedAt).getTime() : Date.now();
    const elapsedMs = Date.now() - startedAt;
    const SIMULATED_DURATION_MS = 8000; // 8s demo "processing" time
    const progress = Math.min(99, Math.round((elapsedMs / SIMULATED_DURATION_MS) * 100));

    if (elapsedMs >= SIMULATED_DURATION_MS) {
      await completeSeparation(trackId, userId);
      return {
        trackId,
        status: "completed",
        progress: 100,
        estimatedTimeRemaining: 0,
      };
    }

    return {
      trackId,
      status: "processing",
      progress,
      estimatedTimeRemaining: Math.max(0, Math.round((SIMULATED_DURATION_MS - elapsedMs) / 1000)),
    };
  }

  return {
    trackId,
    status: track.status,
    progress: track.status === "completed" ? 100 : 0,
    estimatedTimeRemaining: 0,
  };
}

// Mark a track's separation as complete and seed the stems table with one
// row per stem type, pointing at placeholder URLs. Replace `url` generation
// here once a real separation backend (e.g. Demucs) is wired up.
async function completeSeparation(trackId: number, userId: number) {
  const db = await getDb();
  if (!db) return;

  await updateTrack(trackId, userId, { status: "completed" });

  const existing = await db.select().from(stems).where(eq(stems.trackId, trackId));
  if (existing.length > 0) return;

  const stemTypes = ["master", "vocals", "drums", "bass", "piano", "guitar", "other"] as const;
  await db.insert(stems).values(
    stemTypes.map((stemType) => ({
      trackId,
      stemType: stemType as any,
      fileUrl: `/manus-storage/stems/${trackId}/${stemType}.mp3`,
      fileSize: 0,
      duration: 0,
    }))
  );
}

export async function getStems(trackId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  // Verify track belongs to user
  const track = await getTrack(trackId, userId);
  if (!track) return [];

  return db.select().from(stems).where(eq(stems.trackId, trackId));
}

export async function getStemUrl(trackId: number, stemType: string, userId: number) {
  const db = await getDb();
  if (!db) return null;

  // Verify track belongs to user
  const track = await getTrack(trackId, userId);
  if (!track) return null;

  const stem = await db
    .select()
    .from(stems)
    .where(and(eq(stems.trackId, trackId), eq(stems.stemType, stemType as any)))
    .limit(1);

  return stem[0] || null;
}

// Mix presets
export async function saveMixPreset(data: {
  userId: number;
  trackId: number;
  presetName: string;
  stemLevels: Record<string, number>;
  panValues?: Record<string, number>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(mixPresets).values({
    userId: data.userId,
    trackId: data.trackId,
    presetName: data.presetName,
    stemLevels: JSON.stringify(data.stemLevels) as any,
    panValues: data.panValues ? JSON.stringify(data.panValues) as any : null,
  });

  return (result as any).insertId || 0;
}

export async function getMixPresets(trackId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(mixPresets)
    .where(and(eq(mixPresets.trackId, trackId), eq(mixPresets.userId, userId)));
}

export async function deleteMixPreset(presetId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(mixPresets)
    .where(and(eq(mixPresets.id, presetId), eq(mixPresets.userId, userId)));
}

// Export functions
export async function generateStemDownload(
  trackId: number,
  stemType: string,
  format: string,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify track belongs to user
  const track = await getTrack(trackId, userId);
  if (!track) throw new Error("Track not found");

  // In production, this would generate a download link
  return {
    trackId,
    stemType,
    format,
    downloadUrl: `/api/download/stem/${trackId}/${stemType}.${format}`,
    expiresIn: 3600,
  };
}

export async function exportMixedAudio(
  trackId: number,
  stemLevels: Record<string, number>,
  format: string,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify track belongs to user
  const track = await getTrack(trackId, userId);
  if (!track) throw new Error("Track not found");

  // In production, this would mix stems and generate export
  return {
    trackId,
    format,
    downloadUrl: `/api/download/mix/${trackId}/mix.${format}`,
    expiresIn: 3600,
  };
}

export async function generateStemPack(trackId: number, format: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify track belongs to user
  const track = await getTrack(trackId, userId);
  if (!track) throw new Error("Track not found");

  // In production, this would create a zip file with all stems
  return {
    trackId,
    format,
    downloadUrl: `/api/download/pack/${trackId}/stems.${format}`,
    expiresIn: 3600,
  };
}
