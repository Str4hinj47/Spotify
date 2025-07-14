import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Search, 
  Heart, 
  Library, 
  Plus, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2,
  Shuffle,
  Repeat,
  VolumeX,
  Volume1,
  Mic2,
  List,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  Clock,
  PlayCircle,
  PauseCircle
} from 'lucide-react';
import Components from './components';

const { 
  Sidebar, 
  TopBar, 
  MainContent, 
  Player, 
  PlaylistCard, 
  TrackRow, 
  NowPlayingBar,
  AlbumCard,
  ArtistCard,
  SearchCategories,
  PlaylistView,
  LibraryView
} = Components;

const App = () => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0); // 0: off, 1: all, 2: one
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);

  // Mock data for tracks
  const mockTracks = [
    {
      id: 1,
      title: "Blinding Lights",
      artist: "The Weeknd",
      album: "After Hours",
      duration: "3:20",
      imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwxfHxtdXNpY3xlbnwwfHx8fDE3NTI1MDQyNTd8MA&ixlib=rb-4.1.0&q=85",
      audioUrl: "https://www.soundjay.com/misc/sounds/fail-buzzer-02.wav"
    },
    {
      id: 2,
      title: "Shape of You",
      artist: "Ed Sheeran",
      album: "÷ (Divide)",
      duration: "3:53",
      imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwzfHxtdXNpY3xlbnwwfHx8fDE3NTI1MDQyNTd8MA&ixlib=rb-4.1.0&q=85",
      audioUrl: "https://www.soundjay.com/misc/sounds/fail-buzzer-02.wav"
    },
    {
      id: 3,
      title: "Bohemian Rhapsody",
      artist: "Queen",
      album: "A Night at the Opera",
      duration: "5:55",
      imageUrl: "https://images.unsplash.com/photo-1624535243357-34369104228c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwxfHxhbGJ1bXxlbnwwfHx8fDE3NTI1MTQwMDN8MA&ixlib=rb-4.1.0&q=85",
      audioUrl: "https://www.soundjay.com/misc/sounds/fail-buzzer-02.wav"
    },
    {
      id: 4,
      title: "Watermelon Sugar",
      artist: "Harry Styles",
      album: "Fine Line",
      duration: "2:54",
      imageUrl: "https://images.unsplash.com/photo-1619983081593-e2ba5b543168?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwyfHxhbGJ1bXxlbnwwfHx8fDE3NTI1MTQwMDN8MA&ixlib=rb-4.1.0&q=85",
      audioUrl: "https://www.soundjay.com/misc/sounds/fail-buzzer-02.wav"
    },
    {
      id: 5,
      title: "Levitating",
      artist: "Dua Lipa",
      album: "Future Nostalgia",
      duration: "3:23",
      imageUrl: "https://images.unsplash.com/photo-1619983081563-430f63602796?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwzfHxhbGJ1bXxlbnwwfHx8fDE3NTI1MTQwMDN8MA&ixlib=rb-4.1.0&q=85",
      audioUrl: "https://www.soundjay.com/misc/sounds/fail-buzzer-02.wav"
    }
  ];

  // Mock playlists
  const mockPlaylists = [
    {
      id: 1,
      title: "Today's Top Hits",
      description: "The most played songs right now",
      imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwxfHxtdXNpY3xlbnwwfHx8fDE3NTI1MDQyNTd8MA&ixlib=rb-4.1.0&q=85",
      tracks: mockTracks.slice(0, 3)
    },
    {
      id: 2,
      title: "Rock Classics",
      description: "Classic rock hits through the decades",
      imageUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzh8MHwxfHNlYXJjaHwxfHxjb25jZXJ0fGVufDB8fHx8MTc1MjUxMzk5NXww&ixlib=rb-4.1.0&q=85",
      tracks: mockTracks.slice(2, 5)
    },
    {
      id: 3,
      title: "Chill Vibes",
      description: "Relaxing music for any time",
      imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzh8MHwxfHNlYXJjaHwxfHxoZWFkcGhvbmVzfGVufDB8fHx8MTc1MjQ4NjYwM3ww&ixlib=rb-4.1.0&q=85",
      tracks: mockTracks.slice(1, 4)
    },
    {
      id: 4,
      title: "Workout Mix",
      description: "High-energy tracks for your workout",
      imageUrl: "https://images.unsplash.com/photo-1628202926206-c63a34b1618f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzh8MHwxfHNlYXJjaHwyfHxoZWFkcGhvbmVzfGVufDB8fHx8MTc1MjQ4NjYwM3ww&ixlib=rb-4.1.0&q=85",
      tracks: mockTracks
    },
    {
      id: 5,
      title: "Discover Weekly",
      description: "Your weekly mixtape of fresh music",
      imageUrl: "https://images.unsplash.com/photo-1588532218970-c2cab983746a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHx2aW55bCUyMHJlY29yZHN8ZW58MHx8fHwxNzUyNDY1Nzc1fDA&ixlib=rb-4.1.0&q=85",
      tracks: mockTracks.slice(0, 4)
    },
    {
      id: 6,
      title: "Hip Hop Central",
      description: "The biggest hip hop hits",
      imageUrl: "https://images.unsplash.com/photo-1582730147924-d92f4da00252?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwyfHx2aW55bCUyMHJlY29yZHN8ZW58MHx8fHwxNzUyNDY1Nzc1fDA&ixlib=rb-4.1.0&q=85",
      tracks: mockTracks.slice(1, 5)
    }
  ];

  const playTrack = (track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    setCurrentTime(0);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleShuffle = () => {
    setIsShuffled(!isShuffled);
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => (prev + 1) % 3);
  };

  const skipToPrevious = () => {
    // Logic to skip to previous track
    console.log('Skip to previous');
  };

  const skipToNext = () => {
    // Logic to skip to next track
    console.log('Skip to next');
  };

  const openPlaylist = (playlist) => {
    setSelectedPlaylist(playlist);
    setCurrentView('playlist');
  };

  const searchTracks = (query) => {
    setSearchQuery(query);
    // In a real app, this would search through a database
    return mockTracks.filter(track => 
      track.title.toLowerCase().includes(query.toLowerCase()) ||
      track.artist.toLowerCase().includes(query.toLowerCase())
    );
  };

  // Simulate time progression
  useEffect(() => {
    let interval;
    if (isPlaying && currentTrack) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentTrack, duration]);

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* Main container */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <Sidebar 
          currentView={currentView} 
          setCurrentView={setCurrentView} 
          playlists={mockPlaylists}
          openPlaylist={openPlaylist}
        />
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <TopBar 
            currentView={currentView} 
            setCurrentView={setCurrentView}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          
          {/* Content */}
          <MainContent 
            currentView={currentView}
            playlists={mockPlaylists}
            tracks={mockTracks}
            selectedPlaylist={selectedPlaylist}
            searchResults={searchTracks(searchQuery)}
            playTrack={playTrack}
            openPlaylist={openPlaylist}
            isPlaying={isPlaying}
            currentTrack={currentTrack}
          />
        </div>
      </div>
      
      {/* Bottom player */}
      <Player 
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        skipToPrevious={skipToPrevious}
        skipToNext={skipToNext}
        volume={volume}
        isMuted={isMuted}
        handleVolumeChange={handleVolumeChange}
        toggleMute={toggleMute}
        isShuffled={isShuffled}
        toggleShuffle={toggleShuffle}
        repeatMode={repeatMode}
        toggleRepeat={toggleRepeat}
        currentTime={currentTime}
        duration={duration}
        setCurrentTime={setCurrentTime}
      />
    </div>
  );
};

export default App;