import React, { useState } from 'react';
import './SongSearch.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function SongSearch({ onClose, onImportSongs }) {
  // Unified search state - all fields optional
  const [artistName, setArtistName] = useState('');
  const [tag, setTag] = useState('');
  const [genre, setGenre] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [chartPosition, setChartPosition] = useState('');
  const [songwriter, setSongwriter] = useState('');
  const [season, setSeason] = useState('');
  const [key, setKey] = useState('');
  const [mode, setMode] = useState('');
  const [sourcePreference, setSourcePreference] = useState('auto');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSongs, setSelectedSongs] = useState(new Set());

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setResults([]);
    setSelectedSongs(new Set());

    try {
      // Build search payload with only non-empty fields
      const filters = {};
      if (artistName.trim()) filters.artist = artistName.trim();
      if (tag.trim()) filters.tag = tag.trim();
      if (genre.trim()) filters.genre = genre.trim();
      if (yearStart) filters.yearStart = parseInt(yearStart);
      if (yearEnd) filters.yearEnd = parseInt(yearEnd);
      if (chartPosition.trim()) filters.chartPosition = chartPosition.trim();
      if (songwriter.trim()) filters.songwriter = songwriter.trim();
      if (season.trim()) filters.season = season.trim();
      if (key.trim()) filters.key = key.trim();
      if (mode && mode !== 'all') filters.mode = mode;
      if (sourcePreference && sourcePreference !== 'auto') filters.sourcePreference = sourcePreference;
      filters.limit = 50;

      // Validate at least one filter
      if (Object.keys(filters).length === 1) { // only 'limit' present
        setError('Please enter at least one search criterion');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${API_URL}/api/search/advanced`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(filters)
        }
      );

      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.songs || []);
      
      if (data.songs.length === 0) {
        setError('No results found. Try a different search.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSongSelection = (index) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSongs(newSelected);
  };

  const selectAll = () => {
    setSelectedSongs(new Set(results.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedSongs(new Set());
  };

  const handleImport = async () => {
    const songsToImport = results.filter((_, i) => selectedSongs.has(i));
    
    if (songsToImport.length === 0) {
      setError('Please select at least one song to import');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Enrich the selected songs first
      const enrichResponse = await fetch(`${API_URL}/api/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ songs: songsToImport.map(s => ({ Title: s.title, Artist: s.artist })) })
      });

      if (!enrichResponse.ok) {
        throw new Error('Enrichment failed');
      }

      const enrichData = await enrichResponse.json();
      
      // Import each enriched song
      let successCount = 0;
      for (const song of enrichData.songs) {
        try {
          const importResponse = await fetch(`${API_URL}/api/songs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(song)
          });

          if (importResponse.ok) {
            successCount++;
          }
        } catch (err) {
          console.error('Failed to import song:', song.Title, err);
        }
      }

      // Notify parent and close
      if (onImportSongs) {
        onImportSongs(successCount);
      }
      
      alert(`Successfully imported ${successCount} of ${songsToImport.length} songs!`);
      onClose();
    } catch (err) {
      console.error('Import error:', err);
      setError('Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <h2>🔍 Search Music Database</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="search-form unified-search">
          <div className="form-row">
            <div className="form-group">
              <label>Artist</label>
              <input
                type="text"
                placeholder="e.g., Blondie"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Tag</label>
              <input
                type="text"
                placeholder="e.g., love songs, ballads"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Genre</label>
              <input
                type="text"
                placeholder="e.g., rock, pop, jazz"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Songwriter</label>
              <input
                type="text"
                placeholder="e.g., Paul McCartney"
                value={songwriter}
                onChange={(e) => setSongwriter(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Year</label>
              <input
                type="number"
                placeholder="1990"
                value={yearStart}
                onChange={(e) => setYearStart(e.target.value)}
                min="1900"
                max={new Date().getFullYear()}
              />
            </div>
            <div className="form-group">
              <label>End Year</label>
              <input
                type="number"
                placeholder="2000"
                value={yearEnd}
                onChange={(e) => setYearEnd(e.target.value)}
                min="1900"
                max={new Date().getFullYear()}
              />
            </div>
            <div className="form-group">
              <label>Chart Position</label>
              <input
                type="text"
                placeholder="e.g., No.1, Top 10, Top 40"
                value={chartPosition}
                onChange={(e) => setChartPosition(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Season</label>
              <input
                type="text"
                placeholder="e.g., Spring, Summer, Winter"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Key</label>
              <input
                type="text"
                placeholder="e.g., C, G, Am"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Major/Minor</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="">All</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Source Preference</label>
              <select value={sourcePreference} onChange={(e) => setSourcePreference(e.target.value)}>
                <option value="auto">Auto (best available)</option>
                <option value="SP">Spotify</option>
                <option value="MBZ">MusicBrainz</option>
                <option value="LFM">Last.fm</option>
                <option value="SC">Soundcharts</option>
                <option value="DZ">Deezer</option>
              </select>
              <small>Prefer a specific data source when multiple options exist</small>
            </div>
          </div>

          <button 
            className="search-button" 
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {results.length > 0 && (
          <div className="search-results">
            <div className="results-header">
              <h3>{results.length} Results</h3>
              <div className="selection-actions">
                <button onClick={selectAll} className="select-action">Select All</button>
                <button onClick={deselectAll} className="select-action">Deselect All</button>
                <button 
                  onClick={handleImport} 
                  className="import-button"
                  disabled={selectedSongs.size === 0 || loading}
                >
                  Import {selectedSongs.size} Selected
                </button>
              </div>
            </div>

            <div className="results-list">
              {results.map((song, index) => (
                <div 
                  key={index} 
                  className={`result-item ${selectedSongs.has(index) ? 'selected' : ''}`}
                  onClick={() => toggleSongSelection(index)}
                >
                  <input
                    type="checkbox"
                    checked={selectedSongs.has(index)}
                    onChange={() => toggleSongSelection(index)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="result-info">
                    <div className="result-title">{song.title}</div>
                    <div className="result-artist">{song.artist}</div>
                    {song.album && <div className="result-album">{song.album}</div>}
                    <div className="result-meta">
                      {song.releaseYear && <span className="meta-badge">📅 {song.releaseYear}</span>}
                      {song.popularity && <span className="meta-badge">🔥 {song.popularity}%</span>}
                      {song.duration && <span className="meta-badge">⏱️ {Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, '0')}</span>}
                      {song.source && <span className={`source-badge source-${song.source.toLowerCase()}`}>{song.source}</span>}
                    </div>
                  </div>
                  {song.previewUrl && (
                    <audio controls onClick={(e) => e.stopPropagation()}>
                      <source src={song.previewUrl} type="audio/mpeg" />
                    </audio>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SongSearch;
