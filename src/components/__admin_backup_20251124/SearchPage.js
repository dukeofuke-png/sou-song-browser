import React, { useState } from 'react';
import './SearchPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function SearchPage({ onImportSongs }) {
  // Search criteria state
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

  // Results state
  const [results, setResults] = useState([]);
  const [searchMeta, setSearchMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSongs, setSelectedSongs] = useState(new Set());

  const handleSearch = async () => {
    try {
      setLoading(true);
      setError(null);
      setResults([]);

      const filters = { limit: 50 };
      if (artistName.trim()) filters.artist = artistName.trim();
      if (tag.trim()) filters.tag = tag.trim();
      if (genre.trim()) filters.genre = genre.trim();
      if (yearStart) filters.yearStart = parseInt(yearStart);
      if (yearEnd) filters.yearEnd = parseInt(yearEnd);
      if (chartPosition.trim()) filters.chartPosition = chartPosition.trim();
      if (songwriter.trim()) filters.songwriter = songwriter.trim();
      if (season.trim()) filters.season = season.trim();
      if (key.trim()) filters.key = key.trim();
      if (mode) filters.mode = mode;
      if (sourcePreference && sourcePreference !== 'auto') filters.sourcePreference = sourcePreference;

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
      setSearchMeta(data.meta || null);
      
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

  const handleSelectSong = (index) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSongs(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedSongs.size === results.length) {
      setSelectedSongs(new Set());
    } else {
      setSelectedSongs(new Set(results.map((_, i) => i)));
    }
  };

  const handleImport = () => {
    const songsToImport = Array.from(selectedSongs).map(i => results[i]);
    onImportSongs(songsToImport);
    setSelectedSongs(new Set());
  };

  return (
    <div className="search-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>🔍 Search Music Database</h1>
        <p>Search across Spotify, MusicBrainz, Last.fm, and more</p>
      </div>

      <div className="search-container">
        {/* Left Panel - Search Form */}
        <div className="search-panel">
          <div className="search-form-page">
            <div className="form-section">
              <h3>Basic Search</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Artist</label>
                  <input
                    type="text"
                    placeholder="e.g., The Beatles, Adele"
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
            </div>

            <div className="form-section">
              <h3>Filters</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Start Year</label>
                  <input
                    type="number"
                    placeholder="e.g., 1990"
                    value={yearStart}
                    onChange={(e) => setYearStart(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>End Year</label>
                  <input
                    type="number"
                    placeholder="e.g., 2000"
                    value={yearEnd}
                    onChange={(e) => setYearEnd(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Chart Position</label>
                  <input
                    type="text"
                    placeholder="e.g., No.1, Top 10"
                    value={chartPosition}
                    onChange={(e) => setChartPosition(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Season (Internal)</label>
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
                    <option value="">Any</option>
                    <option value="Major">Major</option>
                    <option value="Minor">Minor</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Source Preference</h3>
              <div className="form-group">
                <select
                  value={sourcePreference}
                  onChange={(e) => setSourcePreference(e.target.value)}
                >
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
              className="search-button-page"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? 'Searching...' : '🔍 Search'}
            </button>

            {error && (
              <div className="error-message-page">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="results-panel">
          {results.length > 0 && (
            <>
              <div className="results-header">
                <h2>{results.length} Results</h2>
                {searchMeta && (
                  <div className="search-meta">
                    <span className="meta-badge" title="Primary data source used">
                      📊 {searchMeta.sourceUsed || 'Multiple'}
                    </span>
                    {searchMeta.fallbackUsed && (
                      <span className="meta-badge fallback" title="Fallback source was used">
                        ⚠️ Fallback: {searchMeta.fallbackUsed}
                      </span>
                    )}
                    <span className="meta-stat" title="Total results before filtering">
                      🔢 {searchMeta.totalFetched || 0} fetched
                    </span>
                  </div>
                )}
                <div className="results-actions">
                  <button onClick={handleSelectAll} className="select-all-btn">
                    {selectedSongs.size === results.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={selectedSongs.size === 0}
                    className="import-btn"
                  >
                    Import {selectedSongs.size} Selected
                  </button>
                </div>
              </div>

              <div className="results-list">
                {results.map((song, index) => (
                  <div
                    key={index}
                    className={`result-card ${selectedSongs.has(index) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSongs.has(index)}
                      onChange={() => handleSelectSong(index)}
                      className="song-checkbox"
                    />
                    
                    <div className="result-content">
                      <div className="result-main">
                        <h3>{song.title}</h3>
                        <p className="artist">{song.artist}</p>
                      </div>

                      <div className="result-meta">
                        {song.album && <span className="album">📀 {song.album}</span>}
                        {song.releaseYear && <span className="year">📅 {song.releaseYear}</span>}
                        {song.duration && (
                          <span className="duration">
                            ⏱️ {Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, '0')}
                          </span>
                        )}
                        {song.popularity && <span className="popularity">📊 {song.popularity}%</span>}
                        {song.source && (
                          <span className={`source-badge source-${song.source.toLowerCase()}`}>
                            {song.source}
                          </span>
                        )}
                      </div>

                      {song.previewUrl && (
                        <audio controls className="preview-audio">
                          <source src={song.previewUrl} type="audio/mpeg" />
                        </audio>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {results.length === 0 && !loading && !error && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No search performed yet</h3>
              <p>Enter search criteria and click Search to find songs</p>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Searching music databases...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchPage;
