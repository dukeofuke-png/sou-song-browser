import React, { useState } from 'react';
import { FiUpload, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import './BulkAddSongs.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/**
 * BulkAddSongs - Paste a list of songs and add them to SOU database
 * Supports formats:
 * - "Title - Artist" (one per line)
 * - "Artist - Title" (one per line)
 * - CSV with Title, Artist columns
 * - Just titles (searches by title only)
 * - Just artists (searches by artist only)
 */
function BulkAddSongs() {
  const [songList, setSongList] = useState('');
  const [matches, setMatches] = useState([]);
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedSongs, setSelectedSongs] = useState(new Set());

  /**
   * Handle CSV file upload
   */
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setSongList(text);
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
  };

  /**
   * Parse pasted song list into array of {title, artist} objects
   */
  const parseSongList = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const parsed = [];

    for (const line of lines) {
      // Try to split by common separators: - | , 
      const separators = [' - ', ' | ', ',', '\t'];
      let parts = null;

      for (const sep of separators) {
        if (line.includes(sep)) {
          parts = line.split(sep).map(p => p.trim());
          break;
        }
      }

      if (parts && parts.length >= 2) {
        // Assume first part could be either title or artist
        // We'll search by both and let the backend fuzzy match
        parsed.push({
          title: parts[0],
          artist: parts[1],
          original: line,
          searchType: 'both'
        });
      } else {
        // No separator found - treat as search query (could be artist OR title)
        parsed.push({
          query: line,
          original: line,
          searchType: 'query'
        });
      }
    }

    return parsed;
  };

  /**
   * Find matches in seed database using fuzzy search
   */
  const handleFindMatches = async () => {
    try {
      setLoading(true);
      setError(null);
      setMatches([]);
      setFailed([]);
      setSuccess(null);
      setSelectedSongs(new Set());

      const parsed = parseSongList(songList);
      
      if (parsed.length === 0) {
        setError('Please paste at least one song');
        setLoading(false);
        return;
      }

      // Search for each song in seed database
      const foundMatches = [];
      const notFound = [];

      for (const song of parsed) {
        let searchParams = {};
        
        if (song.searchType === 'query') {
          // Single search term - try both artist AND title
          // Search with artist first
          const artistResponse = await fetch(`${API_URL}/api/seed/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ artist: song.query, limit: 50 })
          });
          
          // Search with title
          const titleResponse = await fetch(`${API_URL}/api/seed/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title: song.query, limit: 50 })
          });

          if (!artistResponse.ok || !titleResponse.ok) {
            notFound.push({ ...song, reason: 'Search failed' });
            continue;
          }

          const artistData = await artistResponse.json();
          const titleData = await titleResponse.json();
          
          // Combine results (remove duplicates by spotifyId)
          const allResults = [...artistData.songs];
          const existingIds = new Set(allResults.map(s => s.spotifyId));
          titleData.songs.forEach(s => {
            if (!existingIds.has(s.spotifyId)) {
              allResults.push(s);
            }
          });

          if (allResults.length > 0) {
            // Add all matches for this query
            allResults.forEach(match => {
              foundMatches.push({
                ...song,
                match,
                confidence: 'fuzzy',
                searchedBy: 'artist-or-title'
              });
            });
          } else {
            notFound.push({ 
              ...song, 
              reason: 'No match found in catalog'
            });
          }
        } else {
          // Has both title and artist - search by both
          searchParams = { 
            title: song.title, 
            artist: song.artist, 
            limit: 20 
          };

          const response = await fetch(`${API_URL}/api/seed/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(searchParams)
          });

          if (!response.ok) {
            notFound.push({ ...song, reason: 'Search failed' });
            continue;
          }

          const data = await response.json();
          
          if (data.songs.length > 0) {
            // For title+artist searches, try to find best match
            const titleLower = song.title.toLowerCase();
            const artistLower = song.artist.toLowerCase();
            
            // Try exact match first
            let match = data.songs.find(s => 
              s.title.toLowerCase() === titleLower && 
              s.artist.toLowerCase() === artistLower
            );
            let confidence = 'exact';
            
            // If no exact match, try fuzzy matching
            if (!match) {
              match = data.songs.find(s => 
                (s.title.toLowerCase().includes(titleLower) || titleLower.includes(s.title.toLowerCase())) &&
                (s.artist.toLowerCase().includes(artistLower) || artistLower.includes(s.artist.toLowerCase()))
              );
              confidence = 'fuzzy';
            }
            
            // If still no match, just take first result
            if (!match) {
              match = data.songs[0];
              confidence = 'fuzzy';
            }

            foundMatches.push({
              ...song,
              match,
              confidence,
              searchedBy: 'title+artist'
            });
          } else {
            notFound.push({ 
              ...song, 
              reason: 'No match found in catalog'
            });
          }
        }
      }

      setMatches(foundMatches);
      setFailed(notFound);
      
      if (foundMatches.length === 0) {
        setError('No matches found. Check your song titles and artist names.');
      } else {
        // Auto-select all matches
        setSelectedSongs(new Set(foundMatches.map((_, i) => i)));
      }
    } catch (err) {
      console.error('Find matches error:', err);
      setError(err.message || 'Failed to find matches');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Add selected songs to SOU database
   */
  const handleAddSelected = async () => {
    if (selectedSongs.size === 0) {
      setError('Please select at least one song to add');
      return;
    }

    const confirmed = window.confirm(
      `Add ${selectedSongs.size} song${selectedSongs.size > 1 ? 's' : ''} to SOU Database?\n\n` +
      `These songs will be enriched with:\n` +
      `• BPM detection\n` +
      `• Musical key detection\n` +
      `• Audio features analysis\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    try {
      setAdding(true);
      setError(null);
      setSuccess(null);

      const spotifyIds = Array.from(selectedSongs).map(i => matches[i].match.spotifyId);

      const response = await fetch(`${API_URL}/api/seed/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ spotifyIds })
      });

      if (!response.ok) {
        throw new Error('Failed to add songs');
      }

      const result = await response.json();
      
      if (result.promoted > 0) {
        setSuccess(
          `✅ Successfully added ${result.promoted} song${result.promoted > 1 ? 's' : ''} to SOU Database!` +
          (result.failed > 0 ? `\n⚠️ ${result.failed} song${result.failed > 1 ? 's' : ''} failed (duplicates or errors)` : '')
        );
        
        // Clear form on success
        setSongList('');
        setMatches([]);
        setFailed([]);
        setSelectedSongs(new Set());
      } else {
        setError('No songs were added. They may already exist in the database.');
      }
    } catch (err) {
      console.error('Add songs error:', err);
      setError(err.message || 'Failed to add songs');
    } finally {
      setAdding(false);
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
    if (selectedSongs.size === matches.length) {
      setSelectedSongs(new Set());
    } else {
      setSelectedSongs(new Set(matches.map((_, i) => i)));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading && !adding && songList.trim()) {
      handleFindMatches();
    }
  };

  return (
    <div className="bulk-add-container">
      <div className="page-header">
        <h1>📝 Bulk Add Songs</h1>
        <p>Upload a CSV file or paste a list of songs to add them to the SOU Database</p>
      </div>

      <div className="bulk-add-content">
        {/* Input Section */}
        <div className="input-section">
          <div className="input-card">
            <div className="input-header">
              <label className="form-label">
                <FiUpload /> Paste Song List or Upload CSV
              </label>
              <label className="file-upload-btn">
                📁 Upload CSV
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={loading || adding}
                />
              </label>
            </div>
            <textarea
              className="song-list-input"
              value={songList}
              onChange={(e) => setSongList(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Paste songs in any of these formats:\n\nBy Artist:\nPrince\nThe Beatles\n\nBy Title:\nPurple Rain\nLet It Be\n\nOr Artist - Title:\nPrince - Purple Rain\nThe Beatles - Let It Be\n\nOr CSV with Artist, Title columns`}
              rows={12}
              disabled={loading || adding}
            />
            
            <div className="input-actions">
              <button
                className="btn-primary"
                onClick={handleFindMatches}
                disabled={!songList.trim() || loading || adding}
              >
                {loading ? '🔍 Finding Matches...' : '🔍 Find Matches'}
              </button>
              
              {songList && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSongList('');
                    setMatches([]);
                    setFailed([]);
                    setError(null);
                    setSuccess(null);
                  }}
                  disabled={loading || adding}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Info Panel */}
          <div className="info-panel">
            <div className="info-card">
              <h3>💡 How it works</h3>
              <ol>
                <li><strong>Upload CSV</strong> or paste your song list</li>
                <li><strong>Find Matches</strong> searches the 47K song catalog</li>
                <li><strong>Review</strong> matched songs</li>
                <li><strong>Add All</strong> enriches and adds to SOU Database</li>
              </ol>
            </div>

            <div className="info-card">
              <h3>📋 Supported Formats</h3>
              <ul>
                <li>CSV files (.csv, .txt)</li>
                <li><strong>Artist names</strong> (searches all songs by that artist)</li>
                <li><strong>Song titles</strong> (searches all artists)</li>
                <li>Title - Artist</li>
                <li>Artist - Title</li>
                <li>Title | Artist</li>
              </ul>
              <p className="info-note">One entry per line. Press <strong>Enter</strong> or click Find Matches to search.</p>
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="message-box error-box">
            <FiX /> {error}
          </div>
        )}

        {success && (
          <div className="message-box success-box">
            <FiCheck /> {success}
          </div>
        )}

        {/* Results Section */}
        {(matches.length > 0 || failed.length > 0) && (
          <div className="results-section">
            {/* Matched Songs */}
            {matches.length > 0 && (
              <div className="results-card">
                <div className="results-header">
                  <div className="results-meta">
                    <h2>✅ Found {matches.length} Match{matches.length > 1 ? 'es' : ''}</h2>
                  </div>
                  <div className="results-actions">
                    <button onClick={handleSelectAll} className="select-all-btn">
                      {selectedSongs.size === matches.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                      className="btn-success"
                      onClick={handleAddSelected}
                      disabled={selectedSongs.size === 0 || adding}
                    >
                      {adding ? '⏳ Adding...' : `➕ Add ${selectedSongs.size || 0} to SOU Database`}
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
                            checked={selectedSongs.size === matches.length && matches.length > 0}
                            onChange={handleSelectAll}
                          />
                        </th>
                        <th>Your Input</th>
                        <th>Title</th>
                        <th>Artist</th>
                        <th>Year</th>
                        <th>Popularity</th>
                        <th>Genres</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((m, idx) => (
                        <tr 
                          key={idx}
                          className={selectedSongs.has(idx) ? 'selected' : ''}
                          onClick={() => handleSelectSong(idx)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedSongs.has(idx)}
                              onChange={() => handleSelectSong(idx)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="original-text">{m.original}</td>
                          <td className="song-title"><strong>{m.match.title}</strong></td>
                          <td>{m.match.artist}</td>
                          <td>{m.match.releaseYear || '—'}</td>
                          <td>
                            {m.match.popularity && m.match.popularity.spotify !== undefined ? (
                              <span className="popularity-badge">
                                {m.match.popularity.spotify}%
                              </span>
                            ) : '—'}
                          </td>
                          <td className="genres-cell">
                            {m.match.genres && m.match.genres.length > 0 ? (
                              <div className="genres-tags">
                                {m.match.genres.slice(0, 3).map((g, i) => (
                                  <span key={i} className="genre-tag">{g}</span>
                                ))}
                                {m.match.genres.length > 3 && (
                                  <span className="genre-tag more">+{m.match.genres.length - 3}</span>
                                )}
                              </div>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Failed Matches */}
            {failed.length > 0 && (
              <div className="results-card failed-card">
                <div className="results-header">
                  <h2><FiAlertCircle /> {failed.length} Not Found</h2>
                </div>

                <div className="results-table-container">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Your Input</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failed.map((f, idx) => (
                        <tr key={idx}>
                          <td className="original-text">{f.original}</td>
                          <td className="error-text">{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="failed-note">
                  <p>💡 <strong>Tip:</strong> Check spelling, try different separators, or add these songs manually via Search & Add Songs.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BulkAddSongs;
