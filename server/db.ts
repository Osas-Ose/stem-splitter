import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, tracks, stems, mixPresets } from "../drizzle/schema";
import { startSeparationJob, getPredictionStatus, mapReplicateStatus, estimateProgress } from "./services/replicate";

let _db: ReturnType<typeof drizzle> | null = null;

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
  if (!user.openId) throw new Error("User openId is required for upsert");

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
  title?: string;
  artist?: string;
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
    title: data.title || data.fileName.split(".")[0],
    artist: data.artist || null,
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
    separationJobId?: string;
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
  if (data.separationJobId !== undefined) updateData.separationJobId = data.separationJobId;

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

export async function startSeparation(trackId: number, userId: number, model: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let track = await getTrack(trackId, userId);

  // In development, find track without user check
  if (!track && process.env.NODE_ENV === "development") {
    const result = await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1);
    track = result[0] || null;
  }

  if (!track) throw new Error("Track not found");

  const fileUrl = track.fileUrl || "http://localhost:3000/dev-placeholder.mp3";

  let jobId: string | null = null;
  if (process.env.REPLICATE_API_KEY) {
    try {
      jobId = await startSeparationJob(fileUrl);
    } catch (err) {
      console.error("Replicate error:", err);
    }
  }

  // Update directly without userId filter in dev mode
  if (process.env.NODE_ENV === "development") {
    await db
      .update(tracks)
      .set({
        status: "processing" as any,
        ...(jobId ? { separationJobId: jobId } : {}),
      })
      .where(eq(tracks.id, trackId));
  } else {
    await updateTrack(trackId, userId, {
      status: "processing",
      separationJobId: jobId ?? undefined,
    });
  }

  return { trackId, status: "processing", model, startedAt: new Date() };
}

export async function getSeparationStatus(trackId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  let track = await getTrack(trackId, userId);

  // In development, find track without user check
  if (!track && process.env.NODE_ENV === "development") {
    const result = await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1);
    track = result[0] || null;
  }

  if (!track) return null;

  if (track.status === "processing") {
    const startedAt = track.updatedAt ? new Date(track.updatedAt).getTime() : Date.now();
    const jobId = (track as any).separationJobId as string | null;

    if (jobId && process.env.REPLICATE_API_KEY) {
      try {
        const prediction = await getPredictionStatus(jobId);
        const appStatus = mapReplicateStatus(prediction.status);
        const progress = estimateProgress(prediction.status, startedAt);

        if (appStatus === "completed" && prediction.output) {
          await completeSeparationWithRealStems(trackId, userId, prediction.output);
          return { trackId, status: "completed", progress: 100, estimatedTimeRemaining: 0 };
        }

        if (appStatus === "failed") {
          await db.update(tracks).set({ status: "failed" as any }).where(eq(tracks.id, trackId));
          return { trackId, status: "failed", progress: 0, estimatedTimeRemaining: 0 };
        }

        return {
          trackId,
          status: "processing",
          progress,
          estimatedTimeRemaining: Math.max(0, Math.round((90000 - (Date.now() - startedAt)) / 1000)),
        };
      } catch (err) {
        console.error("Replicate poll error:", err);
      }
    }

    // Simulation fallback
    const SIMULATED_DURATION_MS = 8000;
    const elapsedMs = Date.now() - startedAt;
    const progress = Math.min(99, Math.round((elapsedMs / SIMULATED_DURATION_MS) * 100));

    if (elapsedMs >= SIMULATED_DURATION_MS) {
      await completeSeparation(trackId, userId);
      return { trackId, status: "completed", progress: 100, estimatedTimeRemaining: 0 };
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

async function completeSeparationWithRealStems(
  trackId: number,
  userId: number,
  output: { vocals: string; drums: string; bass: string; other: string }
) {
  const db = await getDb();
  if (!db) return;

  await db.update(tracks).set({ status: "completed" as any }).where(eq(tracks.id, trackId));

  const existing = await db.select().from(stems).where(eq(stems.trackId, trackId));
  if (existing.length > 0) return;

  await db.insert(stems).values([
    { trackId, stemType: "vocals" as any, fileUrl: output.vocals, fileSize: 0, duration: 0 },
    { trackId, stemType: "drums"  as any, fileUrl: output.drums,  fileSize: 0, duration: 0 },
    { trackId, stemType: "bass"   as any, fileUrl: output.bass,   fileSize: 0, duration: 0 },
    { trackId, stemType: "other"  as any, fileUrl: output.other,  fileSize: 0, duration: 0 },
  ]);
}

async function completeSeparation(trackId: number, userId: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(tracks).set({ status: "completed" as any }).where(eq(tracks.id, trackId));

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

  const track = await getTrack(trackId, userId);
  if (!track && process.env.NODE_ENV !== "development") return [];

  return db.select().from(stems).where(eq(stems.trackId, trackId));
}

export async function getStemUrl(trackId: number, stemType: string, userId: number) {
  const db = await getDb();
  if (!db) return null;

  const stem = await db
    .select()
    .from(stems)
    .where(and(eq(stems.trackId, trackId), eq(stems.stemType, stemType as any)))
    .limit(1);

  return stem[0] || null;
}

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

export async function generateStemDownload(
  trackId: number,
  stemType: string,
  format: string,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

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

  return {
    trackId,
    format,
    downloadUrl: `/api/download/pack/${trackId}/stems.${format}`,
    expiresIn: 3600,
  };
}