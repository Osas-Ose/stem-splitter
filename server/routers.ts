import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import * as db from "./db";
import { getPresignedUploadUrl } from "./_core/storageProxy";

// Zod schemas for input validation
const uploadAudioSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().positive(),
  mimeType: z.string(),
  fileUrl: z.string().optional(),
  title: z.string().optional(),
  artist: z.string().optional(),
});

const stemSeparationSchema = z.object({
  trackId: z.number(),
  model: z.enum(["demucs", "htdemucs"]).default("htdemucs"),
});

const stemPlayerSchema = z.object({
  trackId: z.number(),
  stemType: z.enum(["vocals", "drums", "bass", "piano", "guitar", "other", "master"]),
});

export const appRouter = router({
  // Health check
  health: publicProcedure.query(() => ({ status: "ok" })),

  // Audio track management
  tracks: router({
    // Request a presigned URL to upload an audio file directly to storage
getUploadUrl: protectedProcedure
      .input(z.object({ fileName: z.string().min(1).max(255), mimeType: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const key = `tracks/${ctx.user.id}/${Date.now()}-${input.fileName}`;

        // In development without storage configured, return a fake upload URL
        if (process.env.NODE_ENV === "development" && !process.env.BUILT_IN_FORGE_API_URL) {
          return {
            uploadUrl: `http://localhost:3000/api/dev-upload/${key}`,
            key,
          };
        }

        return getPresignedUploadUrl(key, input.mimeType);
      }),

    // List user's tracks
    list: protectedProcedure.query(({ ctx }) => {
      return db.getUserTracks(ctx.user.id);
    }),

    // Get track details
    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(({ ctx, input }) => {
        return db.getTrack(input.trackId, ctx.user.id);
      }),

    // Create a new track (after upload)
      create: protectedProcedure
      .input(uploadAudioSchema)
      .mutation(({ ctx, input }) => {
        return db.createTrack({
          userId: ctx.user.id,
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          fileUrl: input.fileUrl,
          title: input.title,
          artist: input.artist,
          status: "uploaded",
        });
      }),

    // Update track metadata
    update: protectedProcedure
      .input(
        z.object({
          trackId: z.number(),
          title: z.string().optional(),
          artist: z.string().optional(),
          isFavorite: z.boolean().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        return db.updateTrack(input.trackId, ctx.user.id, {
          title: input.title,
          artist: input.artist,
          isFavorite: input.isFavorite,
        });
      }),

    // Delete track
    delete: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(({ ctx, input }) => {
        return db.deleteTrack(input.trackId, ctx.user.id);
      }),
  }),

  // Stem separation
  separation: router({
    // Initiate stem separation
    start: protectedProcedure
      .input(stemSeparationSchema)
      .mutation(({ ctx, input }) => {
        return db.startSeparation(input.trackId, ctx.user.id, input.model);
      }),

    // Get separation status
    status: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(({ ctx, input }) => {
        return db.getSeparationStatus(input.trackId, ctx.user.id);
      }),

    // Get separated stems
    stems: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(({ ctx, input }) => {
        return db.getStems(input.trackId, ctx.user.id);
      }),
  }),

  // Stem playback and mixing
  stems: router({
    // Get stem file URL
    get: protectedProcedure
      .input(stemPlayerSchema)
      .query(({ ctx, input }) => {
        return db.getStemUrl(input.trackId, input.stemType, ctx.user.id);
      }),

    // Save mix preset
    saveMix: protectedProcedure
      .input(
        z.object({
          trackId: z.number(),
          presetName: z.string().min(1).max(255),
          stemLevels: z.record(z.string(), z.number()),
          panValues: z.record(z.string(), z.number()).optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        return db.saveMixPreset({
          userId: ctx.user.id,
          trackId: input.trackId,
          presetName: input.presetName,
          stemLevels: input.stemLevels,
          panValues: input.panValues,
        });
      }),

    // Get saved mix presets
    presets: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(({ ctx, input }) => {
        return db.getMixPresets(input.trackId, ctx.user.id);
      }),

    // Delete mix preset
    deletePreset: protectedProcedure
      .input(z.object({ presetId: z.number() }))
      .mutation(({ ctx, input }) => {
        return db.deleteMixPreset(input.presetId, ctx.user.id);
      }),
  }),

  // Download and export
  export: router({
    // Download single stem
    downloadStem: protectedProcedure
      .input(
        z.object({
          trackId: z.number(),
          stemType: z.string(),
          format: z.enum(["mp3", "wav"]).default("mp3"),
        })
      )
      .query(({ ctx, input }) => {
        return db.generateStemDownload(input.trackId, input.stemType, input.format, ctx.user.id);
      }),

    // Export mixed audio
    exportMix: protectedProcedure
      .input(
        z.object({
          trackId: z.number(),
          stemLevels: z.record(z.string(), z.number()),
          format: z.enum(["mp3", "wav"]).default("mp3"),
        })
      )
      .mutation(({ ctx, input }) => {
        return db.exportMixedAudio(input.trackId, input.stemLevels as Record<string, number>, input.format, ctx.user.id);
      }),

    // Download all stems as pack
    downloadPack: protectedProcedure
      .input(
        z.object({
          trackId: z.number(),
          format: z.enum(["zip"]).default("zip"),
        })
      )
      .query(({ ctx, input }) => {
        return db.generateStemPack(input.trackId, input.format, ctx.user.id);
      }),
  }),

  // System notifications
  system: router({
    notifyOwner: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          content: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { notifyOwner } = await import("./_core/notification");
        return notifyOwner(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
