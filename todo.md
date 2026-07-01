# StemSplitter - Project TODO

## Phase 1: MVP (Home + Upload + Basic Stem Player)
- [x] Design and implement Home Screen with upload button
- [ ] Implement audio file picker (expo-document-picker)
- [x] Build Processing Screen with progress tracking
- [x] Set up backend API for Demucs stem separation
- [x] Create Stem Player Screen with basic playback controls
- [ ] Implement play/pause and volume controls
- [x] Add stem tabs (Vocals, Drums, Bass, Piano, Guitar, Other)
- [ ] Implement mute/solo functionality for individual stems
- [ ] Add waveform visualization (basic)

## Phase 2: Advanced Features
- [x] Build Stem Mixer Screen with vertical faders
- [ ] Implement pan controls for individual stems
- [x] Add preset saving and loading
- [ ] Implement export mix functionality (MP3/WAV)
- [x] Create Library Screen with track management
- [ ] Add favorites/bookmarking system
- [x] Implement track deletion with confirmation

## Phase 3: Polish & Optimization
- [x] Add haptic feedback for interactions
- [ ] Implement smooth animations and transitions
- [ ] Optimize audio processing performance
- [ ] Add error handling and user feedback
- [ ] Implement offline support (cached stems)
- [ ] Add Settings Screen with theme toggle
- [ ] Implement storage management

## Phase 4: Backend & Infrastructure
- [x] Set up Node.js/Express backend
- [ ] Integrate Demucs or Spleeter for stem separation
- [ ] Implement file upload handling
- [ ] Add progress tracking and WebSocket updates
- [x] Set up database for user tracks
- [x] Implement user authentication
- [ ] Add cloud storage for processed stems

## UI Components
- [x] ScreenContainer (already exists)
- [x] Upload button component
- [x] Progress indicator component
- [x] Stem player controls
- [x] Stem mixer fader component
- [ ] Waveform visualization component
- [x] Track card component
- [x] Empty state component

## Testing
- [ ] Unit tests for audio processing logic
- [ ] Integration tests for API endpoints
- [ ] UI tests for main user flows
- [ ] Audio playback testing on iOS and Android
- [ ] File upload and processing testing
- [ ] Performance testing for large audio files

## Documentation
- [ ] API documentation
- [ ] Component documentation
- [ ] Setup and deployment guide
- [ ] User guide and help documentation

## Current Status
- **Phase**: 5 (Advanced Features - In Progress)
- **Completed Screens**: Home, Processing, Stem Player, Stem Mixer, Library
- **Backend**: tRPC API with track/stem/preset management
- **Next**: Audio playback integration, file picker, waveform visualization
