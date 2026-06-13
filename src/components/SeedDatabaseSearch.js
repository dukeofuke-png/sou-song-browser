import React, { useState } from 'react';
import { FiSearch, FiCheck, FiX } from 'react-icons/fi';
import './SeedDatabaseSearch.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/**
 * SeedDatabaseSearch - Search 47K+ seed songs and promote to SOU database
 */
function SeedDatabaseSearch() {
  // Search criteria
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [genre, setGenre] = useState('');
  const [popularityMin, setPopularityMin] = useState('');
  const [popularityMax, setPopularityMax] = useState('');

  // Results
  const [results, setResults] = useState([]);
  const [searchMeta, setSearchMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [promoting, setPromoting] = useState(false);

  // Selection
  const [selectedSongs, setSelectedSongs] = useState(new Set());

  const handleSearch = async () => {
    try {
      setLoading(true);
      setError(null);
      setResults([]);
      setSelectedSongs(new Set());

      // Build search payload
      const filters = {};
      if (title.trim()) filters.title = title.trim();
      if (artist.trim()) filters.artist = artist.trim();
      if (yearStart) filters.yearStart = parseInt(yearStart);
      if (yearEnd) filters.yearEnd = parseInt(yearEnd);
      if (genre.trim()) filters.genre = genre.trim();
      if (popularityMin) filters.popularityMin = parseInt(popularityMin);
      if (popularityMax) filters.popularityMax = parseInt(popularityMax);
      filters.limit = 100;

      // Validate at least one filter
      if (Object.keys(filters).length === 1) {
        setError('Please enter at least one search criterion');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/seed/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(filters)
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.songs || []);
      setSearchMeta({
        total: data.total,
        returned: data.returned,
        took: data.took
      });

      if (data.songs.length === 0) {
        setError('No results found. Try different criteria.');
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

  const handlePromote = async () => {
    if (selectedSongs.size === 0) {
      setError('Please select at least one song to promote');
      return;
    }

    if (!window.confirm(`Promote ${selectedSongs.size} song(s) to SOU Database?\n\nThis will enrich them with BPM, Key, and other metadata.`)) {
      return;
    }

    try {
      setPromoting(true);
      setError(null);

      // Get Spotify IDs of selected songs
      const spotifyIds = Array.from(selectedSongs).map(i => results[i].spotifyId);

      const response = await fetch(`${API_URL}/api/seed/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ spotifyIds })
      });

      if (!response.ok) {
        throw new Error('Promotion failed');
      }

      const data = await response.json();
      
      alert(`Successfully promoted ${data.promoted} of ${data.total} songs!\n${data.failed > 0 ? `\n${data.failed} songs failed (may already exist).` : ''}`);
      
      // Clear selection
      setSelectedSongs(new Set());

      // Optionally refresh results
      if (data.promoted > 0) {
        handleSearch();
      }
    } catch (err) {
      console.error('Promotion error:', err);
      setError(err.message || 'Promotion failed. Please try again.');
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="seed-search-page">
      <div className="page-header">
        <h1><FiSearch style={{marginRight: '12px', color: '#FF6B35'}} />Search & Add Songs</h1>
        <p>Search 47K+ discovery catalog and add songs to SOU teaching database</p>
      </div>

      <div className="seed-search-container">
        {/* Left Panel - Search Form */}
        <div className="search-panel">
          <div className="search-form">
            <div className="form-section">
              <h3>Search Criteria</h3>
              
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  placeholder="e.g., Like a Virgin, Wonderwall"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              <div className="form-group">
                <label>Artist</label>
                <input
                  type="text"
                  placeholder="e.g., The Beatles, Adele"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Year</label>
                  <input
                    type="number"
                    placeholder="e.g., 1990"
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
                    placeholder="e.g., 2000"
                    value={yearEnd}
                    onChange={(e) => setYearEnd(e.target.value)}
                    min="1900"
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Genre</label>
                <input
                  type="text"
                  placeholder="e.g., rock, pop, jazz"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Popularity (Min)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={popularityMin}
                    onChange={(e) => setPopularityMin(e.target.value)}
                    min="0"
                    max="100"
                  />
                </div>

                <div className="form-group">
                  <label>Popularity (Max)</label>
                  <input
                    type="number"
                    placeholder="100"
                    value={popularityMax}
                    onChange={(e) => setPopularityMax(e.target.value)}
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>

            <button
              className="search-button"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? 'Searching...' : '🔍 Search'}
            </button>

            {error && (
              <div className="error-message">
                <FiX /> {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="results-panel">
          {results.length > 0 && (
            <>
              <div className="results-header">
                <div className="results-meta">
                  <h2>{searchMeta.returned} Results</h2>
                  {searchMeta.total > searchMeta.returned && (
                    <span className="meta-badge">
                      {searchMeta.total} total (showing first {searchMeta.returned})
                    </span>
                  )}
                  <span className="meta-badge">
                    {searchMeta.took}ms
                  </span>
                </div>

                <div className="results-actions">
                  <button onClick={handleSelectAll} className="select-all-btn">
                    {selectedSongs.size === results.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={handlePromote}
                    disabled={selectedSongs.size === 0 || promoting}
                    className="promote-btn"
                  >
                    <FiCheck />
                    {promoting ? 'Adding...' : `Add ${selectedSongs.size} to SOU Database`}
                  </button>
                </div>
              </div>

              <div className="results-table-container">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th style={{width: '50px'}}>
                        <input
                          type="checkbox"
                          checked={selectedSongs.size === results.length && results.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th>Title</th>
                      <th>Artist</th>
                      <th>Year</th>
                      <th>Popularity</th>
                      <th>Genres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((song, index) => (
                      <tr 
                        key={index}
                        className={selectedSongs.has(index) ? 'selected' : ''}
                        onClick={() => handleSelectSong(index)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedSongs.has(index)}
                            onChange={() => handleSelectSong(index)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="song-title">{song.title}</td>
                        <td>{song.artist}</td>
                        <td>{song.releaseYear || '-'}</td>
                        <td>
                          {song.popularity && song.popularity.spotify !== undefined ? (
                            <span className="popularity-badge">
                              {song.popularity.spotify}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="genres-cell">
                          {song.genres && song.genres.length > 0 ? (
                            <div className="genres-tags">
                              {song.genres.slice(0, 3).map((g, i) => (
                                <span key={i} className="genre-tag">{g}</span>
                              ))}
                              {song.genres.length > 3 && (
                                <span className="genre-tag more">+{song.genres.length - 3}</span>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <p>Searching seed database...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SeedDatabaseSearch;
