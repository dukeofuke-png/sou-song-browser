import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import SearchPage from './SearchPage';
import ChartsView from './ChartsView';
import SongEditor from './SongEditor';
import BulkImport from './BulkImport';
import PopularityCatalog from './PopularityCatalog';
import { FiTrendingUp, FiMusic, FiUpload, FiSettings, FiHome, FiStar, FiSearch, FiFileText, FiKey } from 'react-icons/fi';
import './AdminDashboard.css';

const AdminDashboard = ({ onLogout }) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSong, setEditingSong] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('Title');
  const [sortDirection, setSortDirection] = useState('asc');

  const API_URL = process.env.REACT_APP_MATERIALS_URL || 'http://localhost:3002';

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    setLoading(true);
    setError('');
    try {
      // First try public export (no auth required)
      let response = await fetch(`${API_URL}/songs`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length) {
          setSongs(data);
          return;
        }
      }
      // Fallback to authenticated CSV view if logged in
      response = await fetch(`${API_URL}/api/songs`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setSongs(Array.isArray(data) ? data : []);
      } else if (response.status === 401) {
        setError('Login required for detailed song data. Showing public set if available.');
      } else {
        setError('Failed to load songs');
      }
    } catch (err) {
      console.error('Load songs error:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      onLogout();
    } catch (err) {
      console.error('Logout error:', err);
      onLogout(); // Logout anyway
    }
  };

  const handleDeleteSong = async (songId) => {
    if (!window.confirm('Are you sure you want to delete this song?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/songs/${songId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await loadSongs(); // Reload the list
      } else {
        const data = await response.json();
        alert(`Failed to delete: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to delete song');
      console.error('Delete error:', err);
    }
  };

  const handleSaveSong = async (song) => {
    try {
      const isNew = !song.ID;
      const url = isNew
        ? `${API_URL}/api/songs`
        : `${API_URL}/api/songs/${song.ID}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(song),
      });

      if (response.ok) {
        await loadSongs();
        setEditingSong(null);
      } else {
        const data = await response.json();
        alert(`Failed to save: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to save song');
      console.error('Save error:', err);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedSongs = songs
    .filter((song, index) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      const title = song['Song Name'] || song.Title || '';
      const artist = song.Artist || '';
      const genre = song['Genres (Best)'] || song.Genre || '';
      return (
        title.toLowerCase().includes(search) ||
        artist.toLowerCase().includes(search) ||
        genre.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      
      // Handle special field mappings
      if (sortField === 'Title') {
        aVal = a['Song Name'] || a.Title || '';
        bVal = b['Song Name'] || b.Title || '';
      }
      
      const comparison = aVal.toString().localeCompare(bVal.toString());
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  if (editingSong) {
    return (
      <SongEditor
        song={editingSong}
        onSave={handleSaveSong}
        onCancel={() => setEditingSong(null)}
      />
    );
  }

  if (showBulkImport) {
    return (
      <BulkImport
        onComplete={() => {
          setShowBulkImport(false);
          loadSongs();
        }}
        onCancel={() => setShowBulkImport(false)}
      />
    );
  }

  // Render different pages based on activePage
  const renderPage = () => {
    switch (activePage) {
      case 'search':
        return (
          <SearchPage
            onImportSongs={(songsToImport) => {
              console.log('Importing songs:', songsToImport);
              // TODO: Implement enrichment and import logic
              loadSongs();
            }}
          />
        );
      
      case 'songs':
        return renderSongsList();
      
      case 'charts':
        return <ChartsView />;
      
      case 'popularity':
        return (
          <div className="page-container">
            <div className="page-header">
              <h1><FiStar style={{marginRight: '12px', color: '#FF6B35'}} />Popularity Catalog</h1>
              <p>Curated seed songs ranked by composite popularity score</p>
            </div>
            <PopularityCatalog />
          </div>
        );
      
      case 'bulk':
        return (
          <div className="page-container">
            <div className="page-header">
              <h1><FiUpload style={{marginRight: '12px', color: '#FF6B35'}} />Bulk Import</h1>
              <p>Import multiple songs at once</p>
            </div>
            <BulkImport
              onComplete={() => {
                loadSongs();
              }}
              onCancel={() => setActivePage('dashboard')}
            />
          </div>
        );
      
      case 'settings':
        return (
          <div className="page-container">
            <div className="page-header">
              <h1><FiSettings style={{marginRight: '12px', color: '#FF6B35'}} />Settings</h1>
              <p>Configure admin settings</p>
            </div>
            <div style={{ padding: '32px', textAlign: 'center', color: '#6c757d' }}>
              Settings page coming soon...
            </div>
          </div>
        );
      
      case 'dashboard':
      default:
        return renderDashboardOverview();
    }
  };

  // Dashboard overview page
  const renderDashboardOverview = () => {
    return (
      <div className="dashboard-overview">
        <div className="page-header">
          <h1><FiHome style={{marginRight: '12px', color: '#FF6B35'}} />Dashboard</h1>
          <p>Welcome to SOU Admin</p>
        </div>

        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon"><FiMusic size={36} color="#FF6B35" /></div>
            <div className="stat-content">
              <h3>{songs.length}</h3>
              <p>Total Songs</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon"><FiFileText size={36} color="#FF6B35" /></div>
            <div className="stat-content">
              <h3>{songs.filter(s => s['Song Sheet Path'] || s.songSheetPath || s.songSheetStatus === 'Yes' || s.songSheetStatus === 'TRUE').length}</h3>
              <p>With PDFs</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon"><FiTrendingUp size={36} color="#FF6B35" /></div>
            <div className="stat-content">
              <h3>{songs.filter(s => s.BPM_Best || s.BPM || s.bpm).length}</h3>
              <p>With BPM</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon"><FiKey size={36} color="#FF6B35" /></div>
            <div className="stat-content">
              <h3>{songs.filter(s => s.Key_Best || s['Original Key'] || s.originalKey || (Array.isArray(s.souKeys) && s.souKeys.length)).length}</h3>
              <p>With Key</p>
            </div>
          </div>
        </div>

        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <button onClick={() => setActivePage('search')} className="action-btn">
              <FiSearch size={18} />
              <span>Search Database</span>
            </button>
            <button onClick={() => setActivePage('songs')} className="action-btn">
              <FiMusic size={18} />
              <span>Manage Songs</span>
            </button>
            <button onClick={() => setActivePage('bulk')} className="action-btn">
              <FiUpload size={18} />
              <span>Bulk Import</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Songs list page
  const renderSongsList = () => {
    return (
      <div className="songs-page">
        <div className="page-header">
          <h1><FiMusic style={{marginRight: '12px', color: '#FF6B35'}} />Manage Songs</h1>
          <p>View and edit your song database</p>
        </div>

        <div className="songs-controls">
          <input
            type="text"
            placeholder="Search songs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button onClick={() => setEditingSong({})} className="btn-primary">
            Add Song
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <div className="loading">Loading songs...</div>
        ) : (
          <div className="songs-table-container">
            <table className="songs-table">
              <thead>
                <tr>
                  <th style={{width: '60px'}}>#</th>
                  <th onClick={() => handleSort('Title')}>
                    Title {sortField === 'Title' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('Artist')}>
                    Artist {sortField === 'Artist' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('BPM_Best')}>
                    BPM {sortField === 'BPM_Best' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('Key_Best')}>
                    Key {sortField === 'Key_Best' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('Genres (Best)')}>
                    Genre {sortField === 'Genres (Best)' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>PDF</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedSongs.map((song, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td className="song-title">{song['Song Name'] || song.Title || '-'}</td>
                    <td>{song.Artist || '-'}</td>
                    <td>{song.BPM_Best || song.BPM || '-'}</td>
                    <td>{song.Key_Best || song['Original Key'] || '-'}</td>
                    <td className="song-genre">{song['Genres (Best)'] || song.Genre || '-'}</td>
                    <td>
                      <span className={`pdf-badge ${song['Song Sheet Path'] ? 'yes' : 'no'}`}>
                        {song['Song Sheet Path'] ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="actions">
                      <button
                        onClick={() => setEditingSong(song)}
                        className="btn-edit"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteSong(index)}
                        className="btn-delete"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-footer">
              Showing {filteredAndSortedSongs.length} of {songs.length} songs
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <AdminLayout
      activePage={activePage}
      onNavigate={setActivePage}
      onLogout={handleLogout}
    >
      {renderPage()}

      {/* Song Editor Modal */}
      {editingSong && (
        <SongEditor
          song={editingSong}
          onSave={handleSaveSong}
          onCancel={() => setEditingSong(null)}
        />
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;
