import React, { useState } from 'react';
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
  PauseCircle,
  User,
  Settings,
  ExternalLink
} from 'lucide-react';

// Sidebar Component
const Sidebar = ({ currentView, setCurrentView, playlists, openPlaylist }) => {
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(true);
  
  const navigationItems = [
    { id: 'home', label: 'Home', icon: Home, active: currentView === 'home' },
    { id: 'search', label: 'Search', icon: Search, active: currentView === 'search' },
  ];

  const libraryItems = [
    { id: 'library', label: 'Your Library', icon: Library, active: currentView === 'library' },
  ];

  return (
    <div className="w-64 bg-black border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <Play className="w-4 h-4 text-black fill-black" />
          </div>
          <span className="text-2xl font-bold">Spotify</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-6 space-y-2">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`flex items-center gap-4 w-full p-3 rounded-lg transition-colors ${
              item.active 
                ? 'bg-gray-800 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <item.icon className="w-6 h-6" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Library Section */}
      <div className="mt-6 px-6">
        <button
          onClick={() => setCurrentView('library')}
          className={`flex items-center gap-4 w-full p-3 rounded-lg transition-colors ${
            currentView === 'library' 
              ? 'bg-gray-800 text-white' 
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Library className="w-6 h-6" />
          <span className="font-medium">Your Library</span>
        </button>
      </div>

      {/* Playlists */}
      <div className="flex-1 px-6 mt-4 overflow-y-auto">
        <div className="space-y-2">
          {playlists.slice(0, 6).map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => openPlaylist(playlist)}
              className="flex items-center gap-3 w-full p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <img 
                src={playlist.imageUrl} 
                alt={playlist.title}
                className="w-10 h-10 rounded object-cover"
              />
              <div className="text-left">
                <p className="font-medium truncate">{playlist.title}</p>
                <p className="text-sm text-gray-500">Playlist</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Create Playlist */}
      <div className="p-6 border-t border-gray-800">
        <button className="flex items-center gap-4 w-full p-3 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
          <Plus className="w-6 h-6" />
          <span className="font-medium">Create Playlist</span>
        </button>
      </div>
    </div>
  );
};

// Top Bar Component
const TopBar = ({ currentView, setCurrentView, searchQuery, setSearchQuery }) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <div className="h-16 bg-black border-b border-gray-800 flex items-center justify-between px-6">
      {/* Navigation buttons */}
      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Search bar (only visible on search page) */}
      {currentView === 'search' && (
        <div className="flex-1 max-w-md mx-8">
          <div className={`relative ${isSearchFocused ? 'ring-2 ring-green-500' : ''} rounded-full`}>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="What do you want to listen to?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      )}

      {/* User menu */}
      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
          <Download className="w-5 h-5" />
        </button>
        <button className="flex items-center gap-2 p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
          <User className="w-5 h-5" />
          <span className="text-sm">Profile</span>
        </button>
      </div>
    </div>
  );
};

// Main Content Component
const MainContent = ({ 
  currentView, 
  playlists, 
  tracks, 
  selectedPlaylist, 
  searchResults, 
  playTrack, 
  openPlaylist,
  isPlaying,
  currentTrack
}) => {
  const renderHomeContent = () => (
    <div className="space-y-8">
      {/* Recently Played */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Recently played</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
          {playlists.slice(0, 6).map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} openPlaylist={openPlaylist} />
          ))}
        </div>
      </section>

      {/* Made for you */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Made for you</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
          {playlists.slice(2, 8).map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} openPlaylist={openPlaylist} />
          ))}
        </div>
      </section>

      {/* Popular playlists */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Popular playlists</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
          {playlists.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} openPlaylist={openPlaylist} />
          ))}
        </div>
      </section>
    </div>
  );

  const renderSearchContent = () => (
    <div className="space-y-8">
      {searchResults.length > 0 ? (
        <section>
          <h2 className="text-2xl font-bold mb-6">Search results</h2>
          <div className="space-y-2">
            {searchResults.map((track, index) => (
              <TrackRow 
                key={track.id} 
                track={track} 
                index={index} 
                playTrack={playTrack}
                isPlaying={isPlaying && currentTrack?.id === track.id}
              />
            ))}
          </div>
        </section>
      ) : (
        <SearchCategories />
      )}
    </div>
  );

  const renderPlaylistContent = () => (
    <PlaylistView 
      playlist={selectedPlaylist} 
      playTrack={playTrack}
      isPlaying={isPlaying}
      currentTrack={currentTrack}
    />
  );

  const renderLibraryContent = () => (
    <LibraryView 
      playlists={playlists} 
      openPlaylist={openPlaylist}
    />
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-900 to-black">
      <div className="p-6">
        {currentView === 'home' && renderHomeContent()}
        {currentView === 'search' && renderSearchContent()}
        {currentView === 'playlist' && renderPlaylistContent()}
        {currentView === 'library' && renderLibraryContent()}
      </div>
    </div>
  );
};

// Playlist Card Component
const PlaylistCard = ({ playlist, openPlaylist }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="bg-gray-800 p-4 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-700 group"
      onClick={() => openPlaylist(playlist)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative mb-4">
        <img 
          src={playlist.imageUrl} 
          alt={playlist.title}
          className="w-full aspect-square object-cover rounded-lg"
        />
        {isHovered && (
          <button className="absolute bottom-2 right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:scale-105">
            <Play className="w-6 h-6 text-black fill-black ml-1" />
          </button>
        )}
      </div>
      <h3 className="font-bold text-white mb-2 truncate">{playlist.title}</h3>
      <p className="text-gray-400 text-sm line-clamp-2">{playlist.description}</p>
    </div>
  );
};

// Track Row Component
const TrackRow = ({ track, index, playTrack, isPlaying }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="grid grid-cols-12 gap-4 items-center p-2 rounded-lg hover:bg-gray-800 group cursor-pointer"
      onClick={() => playTrack(track)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="col-span-1 flex items-center justify-center">
        {isHovered || isPlaying ? (
          isPlaying ? (
            <PauseCircle className="w-5 h-5 text-green-500" />
          ) : (
            <PlayCircle className="w-5 h-5 text-white" />
          )
        ) : (
          <span className="text-gray-400 text-sm">{index + 1}</span>
        )}
      </div>
      
      <div className="col-span-5 flex items-center gap-3">
        <img 
          src={track.imageUrl} 
          alt={track.title}
          className="w-10 h-10 rounded object-cover"
        />
        <div>
          <p className={`font-medium ${isPlaying ? 'text-green-500' : 'text-white'}`}>
            {track.title}
          </p>
          <p className="text-gray-400 text-sm">{track.artist}</p>
        </div>
      </div>
      
      <div className="col-span-4 text-gray-400 text-sm">
        {track.album}
      </div>
      
      <div className="col-span-2 flex items-center justify-end gap-2">
        <button className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Heart className="w-4 h-4 text-gray-400 hover:text-white" />
        </button>
        <span className="text-gray-400 text-sm">{track.duration}</span>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreHorizontal className="w-4 h-4 text-gray-400 hover:text-white" />
        </button>
      </div>
    </div>
  );
};

// Search Categories Component
const SearchCategories = () => {
  const categories = [
    { name: 'Pop', color: 'bg-pink-500', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwxfHxtdXNpY3xlbnwwfHx8fDE3NTI1MDQyNTd8MA&ixlib=rb-4.1.0&q=85' },
    { name: 'Rock', color: 'bg-red-500', image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzh8MHwxfHNlYXJjaHwxfHxjb25jZXJ0fGVufDB8fHx8MTc1MjUxMzk5NXww&ixlib=rb-4.1.0&q=85' },
    { name: 'Hip-Hop', color: 'bg-orange-500', image: 'https://images.unsplash.com/photo-1582730147924-d92f4da00252?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwyfHx2aW55bCUyMHJlY29yZHN8ZW58MHx8fHwxNzUyNDY1Nzc1fDA&ixlib=rb-4.1.0&q=85' },
    { name: 'Jazz', color: 'bg-blue-500', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwzfHxtdXNpY3xlbnwwfHx8fDE3NTI1MDQyNTd8MA&ixlib=rb-4.1.0&q=85' },
    { name: 'Electronic', color: 'bg-purple-500', image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzh8MHwxfHNlYXJjaHwyfHxjb25jZXJ0fGVufDB8fHx8MTc1MjUxMzk5NXww&ixlib=rb-4.1.0&q=85' },
    { name: 'Country', color: 'bg-yellow-500', image: 'https://images.unsplash.com/photo-1596633313465-1256feb1c6d9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHx2aW55bCUyMHJlY29yZHN8ZW58MHx8fHwxNzUyNDY1Nzc1fDA&ixlib=rb-4.1.0&q=85' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Browse all</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {categories.map((category) => (
          <div 
            key={category.name}
            className={`${category.color} relative rounded-lg aspect-square cursor-pointer overflow-hidden hover:scale-105 transition-transform duration-200`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/30" />
            <img 
              src={category.image} 
              alt={category.name}
              className="absolute inset-0 w-full h-full object-cover mix-blend-overlay"
            />
            <div className="absolute bottom-4 left-4">
              <h3 className="text-white font-bold text-lg">{category.name}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Playlist View Component
const PlaylistView = ({ playlist, playTrack, isPlaying, currentTrack }) => {
  if (!playlist) return null;

  return (
    <div className="space-y-6">
      {/* Playlist Header */}
      <div className="flex items-end gap-6">
        <img 
          src={playlist.imageUrl} 
          alt={playlist.title}
          className="w-48 h-48 rounded-lg object-cover shadow-2xl"
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-300 mb-2">PLAYLIST</p>
          <h1 className="text-4xl font-bold text-white mb-4">{playlist.title}</h1>
          <p className="text-gray-300 mb-4">{playlist.description}</p>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="font-medium">Spotify</span>
            <span>•</span>
            <span>{playlist.tracks.length} songs</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <button className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-400 transition-colors">
          <Play className="w-6 h-6 text-black fill-black ml-1" />
        </button>
        <button className="p-2 hover:bg-gray-800 rounded-full transition-colors">
          <Heart className="w-8 h-8 text-gray-400 hover:text-green-500" />
        </button>
        <button className="p-2 hover:bg-gray-800 rounded-full transition-colors">
          <MoreHorizontal className="w-8 h-8 text-gray-400 hover:text-white" />
        </button>
      </div>

      {/* Track List */}
      <div className="space-y-2">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 items-center p-2 border-b border-gray-700 text-gray-400 text-sm">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-5">TITLE</div>
          <div className="col-span-4">ALBUM</div>
          <div className="col-span-2 text-center">
            <Clock className="w-4 h-4 mx-auto" />
          </div>
        </div>

        {/* Tracks */}
        {playlist.tracks.map((track, index) => (
          <TrackRow 
            key={track.id} 
            track={track} 
            index={index} 
            playTrack={playTrack}
            isPlaying={isPlaying && currentTrack?.id === track.id}
          />
        ))}
      </div>
    </div>
  );
};

// Library View Component
const LibraryView = ({ playlists, openPlaylist }) => {
  const [viewType, setViewType] = useState('grid');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Your Library</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setViewType('list')}
            className={`p-2 rounded transition-colors ${
              viewType === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewType('grid')}
            className={`p-2 rounded transition-colors ${
              viewType === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="w-5 h-5 grid grid-cols-2 gap-0.5">
              <div className="bg-current rounded-sm" />
              <div className="bg-current rounded-sm" />
              <div className="bg-current rounded-sm" />
              <div className="bg-current rounded-sm" />
            </div>
          </button>
        </div>
      </div>

      {/* Playlists */}
      {viewType === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
          {playlists.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} openPlaylist={openPlaylist} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {playlists.map((playlist) => (
            <div 
              key={playlist.id}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-800 cursor-pointer group"
              onClick={() => openPlaylist(playlist)}
            >
              <img 
                src={playlist.imageUrl} 
                alt={playlist.title}
                className="w-12 h-12 rounded object-cover"
              />
              <div className="flex-1">
                <h3 className="font-medium text-white">{playlist.title}</h3>
                <p className="text-sm text-gray-400">Playlist • {playlist.tracks.length} songs</p>
              </div>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Player Component
const Player = ({ 
  currentTrack, 
  isPlaying, 
  togglePlay, 
  skipToPrevious, 
  skipToNext,
  volume,
  isMuted,
  handleVolumeChange,
  toggleMute,
  isShuffled,
  toggleShuffle,
  repeatMode,
  toggleRepeat,
  currentTime,
  duration,
  setCurrentTime
}) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (x / width) * duration;
    setCurrentTime(newTime);
  };

  if (!currentTrack) {
    return (
      <div className="h-20 bg-gray-900 border-t border-gray-800 flex items-center justify-center">
        <p className="text-gray-400">Select a song to play</p>
      </div>
    );
  }

  return (
    <div className="h-20 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-4">
      {/* Current track info */}
      <div className="flex items-center gap-4 w-1/3">
        <img 
          src={currentTrack.imageUrl} 
          alt={currentTrack.title}
          className="w-12 h-12 rounded object-cover"
        />
        <div>
          <p className="font-medium text-white text-sm">{currentTrack.title}</p>
          <p className="text-gray-400 text-xs">{currentTrack.artist}</p>
        </div>
        <button className="p-2 hover:bg-gray-800 rounded transition-colors">
          <Heart className="w-4 h-4 text-gray-400 hover:text-green-500" />
        </button>
      </div>

      {/* Player controls */}
      <div className="flex flex-col items-center gap-2 w-1/3">
        {/* Control buttons */}
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleShuffle}
            className={`p-2 rounded transition-colors ${
              isShuffled ? 'text-green-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Shuffle className="w-4 h-4" />
          </button>
          
          <button 
            onClick={skipToPrevious}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          
          <button 
            onClick={togglePlay}
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-black" />
            ) : (
              <Play className="w-4 h-4 text-black fill-black ml-0.5" />
            )}
          </button>
          
          <button 
            onClick={skipToNext}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </button>
          
          <button 
            onClick={toggleRepeat}
            className={`p-2 rounded transition-colors ${
              repeatMode > 0 ? 'text-green-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Repeat className="w-4 h-4" />
            {repeatMode === 2 && <span className="text-xs">1</span>}
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs text-gray-400 w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <div 
            className="flex-1 h-1 bg-gray-600 rounded-full cursor-pointer"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-white rounded-full relative"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            >
              <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <span className="text-xs text-gray-400 w-10">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Volume and extras */}
      <div className="flex items-center gap-4 w-1/3 justify-end">
        <button className="p-2 text-gray-400 hover:text-white transition-colors">
          <Mic2 className="w-4 h-4" />
        </button>
        <button className="p-2 text-gray-400 hover:text-white transition-colors">
          <List className="w-4 h-4" />
        </button>
        <button className="p-2 text-gray-400 hover:text-white transition-colors">
          <Monitor className="w-4 h-4" />
        </button>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleMute}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : volume < 50 ? (
              <Volume1 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          
          <div className="w-24 h-1 bg-gray-600 rounded-full">
            <div 
              className="h-full bg-white rounded-full"
              style={{ width: `${isMuted ? 0 : volume}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Export all components
const Components = {
  Sidebar,
  TopBar,
  MainContent,
  Player,
  PlaylistCard,
  TrackRow,
  SearchCategories,
  PlaylistView,
  LibraryView
};

export default Components;