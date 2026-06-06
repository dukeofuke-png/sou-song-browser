import React, { useState } from 'react';
import './ChartsView.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function ChartsView() {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState('');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!title.trim()) {
      setError('Please enter a song title');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setChartData(null);

      const params = new URLSearchParams({ title: title.trim(), limit: 100 });
      if (artist.trim()) params.set('artist', artist.trim());
      if (year.trim()) params.set('year', year.trim());

      const response = await fetch(
        `${API_URL}/api/search/charts/aggregate?${params}`,
        { credentials: 'include' }
      );

      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }

      if (!response.ok) {
        throw new Error('Chart lookup failed');
      }

      const data = await response.json();
      setChartData(data);

      if (!data.charts || data.charts.length === 0) {
        setError('No chart data found for this song');
      }
    } catch (err) {
      console.error('Chart search error:', err);
      setError(err.message || 'Failed to fetch chart data');
    } finally {
      setLoading(false);
    }
  };

  const getSourceColor = (source) => {
    const colors = {
      soundcharts: '#3498db',
      wikidata: '#e67e22',
      wikipedia: '#95a5a6',
      internal: '#27ae60',
      'popularity-fallback': '#e74c3c'
    };
    return colors[source] || '#95a5a6';
  };

  const getSourceIcon = (source) => {
    const icons = {
      soundcharts: '📊',
      wikidata: '🔗',
      wikipedia: '📖',
      internal: '💾',
      'popularity-fallback': '⚠️'
    };
    return icons[source] || '❓';
  };

  return (
    <div className="charts-view">
      <div className="page-header">
        <h1>📈 Chart Position Lookup</h1>
        <p>Multi-source chart aggregation: Soundcharts → Wikidata → Wikipedia → Internal</p>
      </div>

      <div className="chart-search-container">
        {/* Search Form */}
        <div className="chart-search-form">
          <div className="form-group">
            <label>Song Title *</label>
            <input
              type="text"
              placeholder="e.g., Upside Down"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Artist</label>
              <input
                type="text"
                placeholder="e.g., Diana Ross"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div className="form-group">
              <label>Year</label>
              <input
                type="text"
                placeholder="e.g., 1980"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>

          <button
            className="search-button"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Searching...' : '🔍 Lookup Charts'}
          </button>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>

        {/* Results Display */}
        {chartData && (
          <div className="chart-results">
            {/* Overall Peak */}
            {chartData.overallPeak && (
              <div className="overall-peak">
                <div className="peak-number">#{chartData.overallPeak}</div>
                <div className="peak-label">Overall Best Peak</div>
              </div>
            )}

            {/* Source Provenance */}
            <div className="source-provenance">
              <h3>📊 Data Sources Used</h3>
              <div className="source-badges">
                {chartData.sourcesUsed && chartData.sourcesUsed.length > 0 ? (
                  chartData.sourcesUsed.map((source, i) => (
                    <span
                      key={i}
                      className="source-badge"
                      style={{ backgroundColor: getSourceColor(source) }}
                      title={`Data from ${source}`}
                    >
                      {getSourceIcon(source)} {source}
                    </span>
                  ))
                ) : (
                  <span className="no-sources">No authoritative sources</span>
                )}
              </div>
              <div className="source-order">
                <small>
                  💡 Fallback order: Soundcharts → Wikidata → Wikipedia → Internal Dataset → Popularity Approximation
                </small>
              </div>
            </div>

            {/* Chart Positions Table */}
            <div className="chart-table">
              <h3>📋 Chart Positions ({chartData.charts?.length || 0})</h3>
              {chartData.charts && chartData.charts.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Chart Name</th>
                      <th>Peak</th>
                      <th>Country</th>
                      <th>Date</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.charts.map((chart, i) => (
                      <tr key={i}>
                        <td className="chart-name">{chart.chartName || 'Unknown'}</td>
                        <td className="chart-peak">
                          {chart.chartPeak ? (
                            <span className="peak-badge">#{chart.chartPeak}</span>
                          ) : (
                            <span className="no-data">—</span>
                          )}
                        </td>
                        <td className="chart-country">{chart.country || '—'}</td>
                        <td className="chart-date">
                          {chart.date ? new Date(chart.date).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          <span
                            className="source-tag"
                            style={{ backgroundColor: getSourceColor(chart.source) }}
                          >
                            {getSourceIcon(chart.source)} {chart.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="no-charts">No chart positions found</div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!chartData && !loading && !error && (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <h3>No chart lookup performed yet</h3>
            <p>Enter a song title and click Lookup Charts to aggregate chart data from multiple sources</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Searching Soundcharts, Wikidata, Wikipedia, and internal data...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChartsView;
