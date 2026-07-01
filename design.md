# StemSplitter - Mobile App Design

## Overview
StemSplitter is an advanced audio stem separation application that allows users to upload music tracks and extract individual audio components (vocals, drums, bass, piano, guitar, etc.) using AI-powered source separation technology.

## Design Principles
- **Mobile-first (Portrait 9:16)**: All interactions optimized for one-handed usage on iPhone/Android
- **iOS HIG Compliance**: Follows Apple Human Interface Guidelines for native feel
- **Minimal Cognitive Load**: Clear, intuitive workflows with visual feedback
- **Performance**: Fast file uploads, real-time separation progress, smooth playback

---

## Screen List

### 1. **Home Screen** (Tab: Home)
Primary entry point for uploading and managing tracks.

**Content:**
- Header: "StemSplitter" title with settings icon
- Upload Section:
  - Large "Upload Audio" button (primary action)
  - Supported formats hint (MP3, WAV, FLAC, M4A)
- Recent Tracks List:
  - Horizontal scrollable list of recently processed tracks
  - Each card shows: album art thumbnail, track name, artist, duration
  - Tap to view stems
- Empty State: "No tracks yet. Upload your first track to get started."

**Functionality:**
- Tap upload button → Image picker (local files)
- Select audio file → Navigate to Processing Screen
- Tap recent track → Navigate to Stem Player Screen

---

### 2. **Upload & Processing Screen**
Displays upload progress and separation status.

**Content:**
- Track info card: Album art, track name, duration, file size
- Progress indicator:
  - Circular progress ring with percentage
  - Status text: "Uploading...", "Processing...", "Separating stems..."
  - Estimated time remaining
- Cancel button (during upload/processing)
- Action buttons (after completion):
  - "View Stems" (primary)
  - "Save Locally" (secondary)

**Functionality:**
- Real-time progress updates from backend
- Handle upload errors gracefully with retry option
- Auto-navigate to Stem Player when complete

---

### 3. **Stem Player Screen** (Main Feature)
Interactive player for listening to and manipulating individual stems.

**Content:**
- Track Header:
  - Album art (full width, 250x250)
  - Track name, artist, duration
- Master Playback Controls:
  - Play/pause button (large, center)
  - Progress bar with scrubber
  - Current time / Total duration
  - Volume slider
- Stem Tabs (horizontal scroll):
  - "Master" (original mix)
  - "Vocals"
  - "Drums"
  - "Bass"
  - "Piano"
  - "Guitar"
  - "Other"
- Stem Controls (for selected stem):
  - Mute/Solo toggle buttons
  - Individual volume slider
  - Waveform visualization (optional, shows audio peaks)
- Bottom Actions:
  - "Download Stem" button
  - "Share" button
  - "Save to Library" button

**Functionality:**
- Play/pause controls sync across all stems
- Mute individual stems while playing master
- Solo stems (mute all others)
- Adjust individual stem volume
- Scrub through timeline
- Download individual stems or full stem pack

---

### 4. **Stem Mixer Screen** (Advanced Feature)
Mix and remix stems with advanced controls.

**Content:**
- Master Output Level (VU meter style)
- Stem Mixer Panel (vertical layout):
  - Each stem as a vertical fader:
    - Stem name and icon
    - Volume fader (vertical slider)
    - Mute/Solo buttons
    - Pan control (left/right)
- Export Controls:
  - "Export Mix" button (primary)
  - "Save Preset" button (secondary)
- Preset List:
  - Saved mix presets (e.g., "Vocals Only", "Drums + Bass")

**Functionality:**
- Real-time mixing with all stems
- Pan stems left/right
- Save custom mixes as presets
- Export mixed audio as MP3/WAV
- Load preset mixes

---

### 5. **Library Screen** (Tab: Library)
Browse and manage all processed tracks.

**Content:**
- Filter/Sort options:
  - Sort by: Date, Name, Duration
  - Filter by: All, Downloaded, Favorites
- Track List (grid or list view):
  - Each item shows: album art, track name, artist, date processed
  - Swipe actions: Delete, Share, Favorite
- Empty State: "No tracks in library. Upload a track to get started."

**Functionality:**
- Tap track → Navigate to Stem Player Screen
- Long-press → Context menu (delete, share, favorite)
- Swipe to delete with confirmation
- Mark tracks as favorites

---

### 6. **Settings Screen** (Tab: Settings)
App configuration and user preferences.

**Content:**
- Account Section:
  - Profile info (if logged in)
  - Login/Logout button
- App Preferences:
  - Theme (Light/Dark/Auto)
  - Audio Quality (High/Medium/Low)
  - Auto-delete processed files (toggle)
  - Storage usage indicator
- About:
  - App version
  - Help & Support link
  - Privacy Policy link
  - Terms of Service link

**Functionality:**
- Switch themes
- Manage storage
- View app info
- Access help resources

---

## Key User Flows

### Flow 1: Upload and Separate
1. User taps "Upload Audio" on Home Screen
2. File picker opens → User selects audio file
3. App navigates to Processing Screen
4. Progress updates in real-time
5. When complete, app auto-navigates to Stem Player Screen
6. User can now play, mute, solo, and download stems

### Flow 2: Mix and Export
1. User is on Stem Player Screen
2. User taps "Mixer" tab or icon
3. Navigates to Stem Mixer Screen
4. User adjusts faders for each stem
5. User taps "Export Mix"
6. Choose format (MP3/WAV) and quality
7. Export completes, user can share or save

### Flow 3: Browse Library
1. User taps "Library" tab
2. Sees list of all processed tracks
3. Taps a track → Navigates to Stem Player Screen
4. Can download, share, or delete from here

---

## Color Choices

**Brand Palette:**
- **Primary**: `#0a7ea4` (Vibrant Teal) — Used for buttons, active states, highlights
- **Secondary**: `#6366f1` (Indigo) — Used for accents and secondary actions
- **Background**: `#ffffff` (Light) / `#151718` (Dark)
- **Surface**: `#f5f5f5` (Light) / `#1e2022` (Dark)
- **Foreground**: `#11181C` (Light) / `#ECEDEE` (Dark)
- **Success**: `#22C55E` (Green) — Processing complete, upload success
- **Warning**: `#F59E0B` (Amber) — Processing errors, warnings
- **Error**: `#EF4444` (Red) — Destructive actions, errors

**Semantic Colors:**
- Stem colors (for visual distinction):
  - Vocals: `#EC4899` (Pink)
  - Drums: `#8B5CF6` (Purple)
  - Bass: `#06B6D4` (Cyan)
  - Piano: `#F59E0B` (Amber)
  - Guitar: `#10B981` (Emerald)
  - Other: `#6B7280` (Gray)

---

## Layout Specifications

### Safe Area & Padding
- All screens use `ScreenContainer` for proper SafeArea handling
- Standard padding: 16px (p-4 in Tailwind)
- Bottom padding increased for tab bar (handled by ScreenContainer)

### Typography
- **Headings**: 28px, bold (text-2xl font-bold)
- **Subheadings**: 20px, semibold (text-lg font-semibold)
- **Body**: 16px, regular (text-base)
- **Captions**: 12px, regular (text-xs text-muted)

### Spacing
- Component gap: 16px (gap-4)
- Section gap: 24px (gap-6)
- Button height: 48px (py-3)
- Card border radius: 12px (rounded-lg)

---

## Interaction Patterns

### Press Feedback
- **Primary Buttons**: Scale 0.97 + haptic feedback
- **List Items**: Opacity 0.7 on press
- **Icons**: Opacity 0.6 on press

### Loading States
- Circular progress indicator during upload/processing
- Skeleton loaders for track lists
- Disabled buttons during processing

### Empty States
- Illustrated empty state with call-to-action
- "No tracks yet" on Home Screen
- "No library items" on Library Screen

---

## Technical Notes

- **Audio Playback**: Uses `expo-audio` for playback control
- **File Upload**: Uses `expo-document-picker` for file selection
- **Backend Integration**: REST API for stem separation (Demucs/Spleeter)
- **State Management**: React Context + AsyncStorage for local persistence
- **Waveform Visualization**: Optional feature using canvas-based rendering
- **Database**: Optional cloud sync for user tracks (PostgreSQL)

