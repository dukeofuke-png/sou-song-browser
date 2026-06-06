import React, { useState, useEffect } from 'react';
import './SongEditor.css';

const SongEditor = ({ song, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    ID: '',
    Title: '',
    Artist: '',
    BPM_Best: '',
    Key_Best: '',
    Mode: '',
    TimeSignature: '',
    Genre: '',
    Tags: '',
    Level: '',
    Era: '',
    Season: '',
    songSheetStatus: 'No',
    melodyTabStatus: 'No',
    chartPosition: '',
    chartYear: '',
    releaseYear: '',
    spotifyId: '',
    youtubeId: '',
    ...song,
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.Title?.trim()) {
      newErrors.Title = 'Title is required';
    }
    if (!formData.Artist?.trim()) {
      newErrors.Artist = 'Artist is required';
    }
    if (formData.BPM_Best && isNaN(formData.BPM_Best)) {
      newErrors.BPM_Best = 'BPM must be a number';
    }
    if (formData.releaseYear && isNaN(formData.releaseYear)) {
      newErrors.releaseYear = 'Year must be a number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const isNewSong = !song.ID;

  return (
    <div className="song-editor">
      <div className="editor-header">
        <h2>{isNewSong ? 'Add New Song' : `Edit Song: ${song.Title}`}</h2>
        <button onClick={onCancel} className="btn-close" disabled={saving}>
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="editor-form">
        <div className="form-sections">
          {/* Basic Information */}
          <section className="form-section">
            <h3>Basic Information</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.Title}
                  onChange={(e) => handleChange('Title', e.target.value)}
                  className={errors.Title ? 'error' : ''}
                />
                {errors.Title && <span className="error-text">{errors.Title}</span>}
              </div>

              <div className="form-field">
                <label>Artist *</label>
                <input
                  type="text"
                  value={formData.Artist}
                  onChange={(e) => handleChange('Artist', e.target.value)}
                  className={errors.Artist ? 'error' : ''}
                />
                {errors.Artist && <span className="error-text">{errors.Artist}</span>}
              </div>

              <div className="form-field">
                <label>Release Year</label>
                <input
                  type="text"
                  value={formData.releaseYear}
                  onChange={(e) => handleChange('releaseYear', e.target.value)}
                  placeholder="e.g., 1975"
                  className={errors.releaseYear ? 'error' : ''}
                />
                {errors.releaseYear && <span className="error-text">{errors.releaseYear}</span>}
              </div>

              <div className="form-field">
                <label>Level</label>
                <select
                  value={formData.Level}
                  onChange={(e) => handleChange('Level', e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
            </div>
          </section>

          {/* Musical Properties */}
          <section className="form-section">
            <h3>Musical Properties</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>BPM</label>
                <input
                  type="text"
                  value={formData.BPM_Best}
                  onChange={(e) => handleChange('BPM_Best', e.target.value)}
                  placeholder="e.g., 120"
                  className={errors.BPM_Best ? 'error' : ''}
                />
                {errors.BPM_Best && <span className="error-text">{errors.BPM_Best}</span>}
              </div>

              <div className="form-field">
                <label>Key</label>
                <input
                  type="text"
                  value={formData.Key_Best}
                  onChange={(e) => handleChange('Key_Best', e.target.value)}
                  placeholder="e.g., C, Am, F#"
                />
              </div>

              <div className="form-field">
                <label>Mode</label>
                <select
                  value={formData.Mode}
                  onChange={(e) => handleChange('Mode', e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Major">Major</option>
                  <option value="Minor">Minor</option>
                </select>
              </div>

              <div className="form-field">
                <label>Time Signature</label>
                <input
                  type="text"
                  value={formData.TimeSignature}
                  onChange={(e) => handleChange('TimeSignature', e.target.value)}
                  placeholder="e.g., 4/4, 3/4, 6/8"
                />
              </div>
            </div>
          </section>

          {/* Classification */}
          <section className="form-section">
            <h3>Classification</h3>
            <div className="form-grid">
              <div className="form-field full-width">
                <label>Genre</label>
                <input
                  type="text"
                  value={formData.Genre}
                  onChange={(e) => handleChange('Genre', e.target.value)}
                  placeholder="e.g., Pop, Rock, Jazz"
                />
              </div>

              <div className="form-field full-width">
                <label>Tags</label>
                <input
                  type="text"
                  value={formData.Tags}
                  onChange={(e) => handleChange('Tags', e.target.value)}
                  placeholder="Comma-separated: romantic, upbeat, summer"
                />
              </div>

              <div className="form-field">
                <label>Era</label>
                <select
                  value={formData.Era}
                  onChange={(e) => handleChange('Era', e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="1950s">1950s</option>
                  <option value="1960s">1960s</option>
                  <option value="1970s">1970s</option>
                  <option value="1980s">1980s</option>
                  <option value="1990s">1990s</option>
                  <option value="2000s">2000s</option>
                  <option value="2010s">2010s</option>
                  <option value="2020s">2020s</option>
                </select>
              </div>

              <div className="form-field">
                <label>Season</label>
                <select
                  value={formData.Season}
                  onChange={(e) => handleChange('Season', e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Spring">Spring</option>
                  <option value="Summer">Summer</option>
                  <option value="Fall">Fall</option>
                  <option value="Winter">Winter</option>
                  <option value="Christmas">Christmas</option>
                </select>
              </div>
            </div>
          </section>

          {/* Chart Data */}
          <section className="form-section">
            <h3>Chart Data</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Chart Position</label>
                <input
                  type="text"
                  value={formData.chartPosition}
                  onChange={(e) => handleChange('chartPosition', e.target.value)}
                  placeholder="e.g., 1, 5, 23"
                />
              </div>

              <div className="form-field">
                <label>Chart Year</label>
                <input
                  type="text"
                  value={formData.chartYear}
                  onChange={(e) => handleChange('chartYear', e.target.value)}
                  placeholder="e.g., 2015"
                />
              </div>
            </div>
          </section>

          {/* External Links */}
          <section className="form-section">
            <h3>External Links</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Spotify ID</label>
                <input
                  type="text"
                  value={formData.spotifyId}
                  onChange={(e) => handleChange('spotifyId', e.target.value)}
                  placeholder="Spotify track ID"
                />
              </div>

              <div className="form-field">
                <label>YouTube ID</label>
                <input
                  type="text"
                  value={formData.youtubeId}
                  onChange={(e) => handleChange('youtubeId', e.target.value)}
                  placeholder="YouTube video ID"
                />
              </div>
            </div>
          </section>

          {/* PDF Status */}
          <section className="form-section">
            <h3>Sheet Music</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Song Sheet Status</label>
                <select
                  value={formData.songSheetStatus}
                  onChange={(e) => handleChange('songSheetStatus', e.target.value)}
                >
                  <option value="Yes">Yes</option>
                  <option value="Draft">Draft</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div className="form-field">
                <label>Melody Tab Status</label>
                <select
                  value={formData.melodyTabStatus}
                  onChange={(e) => handleChange('melodyTabStatus', e.target.value)}
                >
                  <option value="Yes">Yes</option>
                  <option value="Draft">Draft</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        <div className="editor-footer">
          <button type="button" onClick={onCancel} disabled={saving} className="btn-cancel">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-save">
            {saving ? 'Saving...' : isNewSong ? 'Add Song' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SongEditor;
