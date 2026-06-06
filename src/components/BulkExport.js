import React, { useState } from 'react';
import { FiUpload, FiDownload, FiX } from 'react-icons/fi';
import './BulkExport.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function BulkExport() {
  const [artists, setArtists] = useState('');
  const [titles, setTitles] = useState('');
  const [format, setFormat] = useState('json');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleExport = async () => {
    try {
      setLoading(true);
      setError(null);

      const artistList = artists.split(',').map(a => a.trim()).filter(a => a);
      const titleList = titles.split(',').map(t => t.trim()).filter(t => t);

      if (artistList.length === 0 && titleList.length === 0) {
        setError('Please enter at least one artist or title');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/seed/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          artists: artistList.length > 0 ? artistList : undefined,
          titles: titleList.length > 0 ? titleList : undefined,
          format
        })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `seed_export_${new Date().toISOString().split('T')[0]}.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) filename = match[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setArtists('');
      setTitles('');

    } catch (err) {
      console.error('Export error:', err);
      setError(err.message || 'Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bulk-export-page">
      <div className="page-header">
        <h1><FiUpload style={{marginRight: '12px', color: '#FF6B35'}} />Bulk Export</h1>
        <p>Export songs from seed database by artist or title</p>
      </div>

      <div className="export-container">
        <div className="export-card">
          <div className="form-section">
            <h3>Export Criteria</h3>
            <p className="help-text">
              Enter comma-separated values for artists and/or titles. 
              Songs matching any artist OR any title will be exported.
            </p>

            <div className="form-group">
              <label>Artist Name(s)</label>
              <textarea
                placeholder="e.g., The Beatles, Adele, Ed Sheeran"
                value={artists}
                onChange={(e) => setArtists(e.target.value)}
                rows={4}
              />
              <small>{artists.split(',').filter(a => a.trim()).length} artist(s)</small>
            </div>

            <div className="form-group">
              <label>Song Title(s)</label>
              <textarea
                placeholder="e.g., Hello, Let It Be, Shape of You"
                value={titles}
                onChange={(e) => setTitles(e.target.value)}
                rows={4}
              />
              <small>{titles.split(',').filter(t => t.trim()).length} title(s)</small>
            </div>
          </div>

          <div className="form-section">
            <h3>Export Format</h3>
            <div className="format-options">
              <label className="format-option">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === 'json'}
                  onChange={(e) => setFormat(e.target.value)}
                />
                <span className="format-label">
                  <strong>JSON</strong>
                  <small>For programmatic use, includes all metadata</small>
                </span>
              </label>

              <label className="format-option">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value)}
                />
                <span className="format-label">
                  <strong>CSV</strong>
                  <small>For spreadsheet software, basic fields only</small>
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <FiX /> {error}
            </div>
          )}

          <button
            className="export-button"
            onClick={handleExport}
            disabled={loading}
          >
            <FiDownload />
            {loading ? 'Exporting...' : 'Export Songs'}
          </button>
        </div>

        <div className="info-panel">
          <h3>💡 Tips</h3>
          <ul>
            <li>Use comma-separated values for multiple artists or titles</li>
            <li>Partial matches are supported (e.g., "Beatles" matches "The Beatles")</li>
            <li>If both artists AND titles are provided, songs matching either will be exported</li>
            <li>Export is limited to songs found in the seed database only</li>
            <li>JSON format includes genres, popularity, and other metadata</li>
            <li>CSV format is best for importing into spreadsheet software</li>
          </ul>

          <div className="info-box">
            <h4>Seed Database Info</h4>
            <p>The seed database contains 47K+ songs from Spotify playlists. These are candidate songs for promotion to the SOU teaching database.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulkExport;
