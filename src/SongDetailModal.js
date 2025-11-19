import React from "react";
import "./SongDetailModal.css";

function SongDetailModal({ song, onClose }) {
  if (!song) return null;

  // Convert Google Drive file path to materials server URL
  const getServerUrl = (filePath) => {
    if (!filePath) return null;
    
    // Extract the path after "Song Sheets PDF ONLY - School of Uke/"
    const match = filePath.match(/Song Sheets PDF ONLY - School of Uke\/(.+)$/);
    if (match) {
      const relativePath = match[1];
      // URL encode the path
      const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
      return `http://localhost:3001/materials/${encodedPath}`;
    }
    return null;
  };

  // Extract clean display name from file path
  const getDisplayName = (filePath) => {
    if (!filePath) return null;
    // Get just the filename without path
    const filename = filePath.split('/').pop();
    // Remove .pdf extension
    const nameWithoutExt = filename.replace(/\.pdf$/i, '');
    
    // Check if it's a TAB
    const isTab = /TAB/i.test(nameWithoutExt);
    
    // Extract key signature (e.g., "Key C", "Key Bm", "Key F#m")
    const keyMatch = nameWithoutExt.match(/Key ([A-G][#b]?m?)/i);
    const key = keyMatch ? keyMatch[1] : null;
    
    // Check for section indicators (Verse, Chorus, Solo, etc.)
    const sectionMatch = nameWithoutExt.match(/(Verse|Chorus|Bridge|Solo|Intro|Outro)/i);
    const section = sectionMatch ? sectionMatch[1] : null;
    
    // Build display name
    let displayName = '';
    if (isTab) {
      displayName = key ? `Melody TAB in Key ${key}` : 'Melody TAB';
      if (section) displayName += ` - ${section}`;
    } else {
      displayName = key ? `Song Sheet in Key ${key}` : 'Song Sheet';
      if (section) displayName += ` - ${section}`;
    }
    
    return displayName;
  };

  // Classify mixed terms into genres vs tags using simple heuristics
  const classifyTerms = (terms, artistName = "") => {
    const artist = (artistName || "").toLowerCase();
    const normalize = (s) => (s || "").toString().trim();
    const flat = (Array.isArray(terms) ? terms : (terms ? [terms] : []))
      .flatMap((t) => normalize(t).split(","))
      .map((t) => normalize(t))
      .filter(Boolean);

    // Known genres list (lowercase)
    const genreSet = new Set([
      "pop","rock","hip hop","hip-hop","r&b","rnb","soul","funk","jazz","blues","country","classical",
      "reggae","ska","punk","metal","electronic","edm","dance","house","techno","trance","drum and bass",
      "dnb","dubstep","indie","alternative","folk","acoustic","ballad","ambient","soundtrack","opera",
      "musical","gospel","latin","salsa","merengue","bachata","reggaeton","afrobeat","amapiano","bhangra",
      "bollywood","k-pop","kpop","j-pop","jpop","c-pop","cpop","cantopop","mandopop","eurodance","synthpop",
      "new wave","grunge","shoegaze","emo","trap","drill","grime","uk garage","2-step","2 step","trip hop",
      "nu metal","hard rock","soft rock","progressive rock","prog rock","post-rock","post rock","disco","boogie",
      "lo-fi","lo fi","lofi","chillout","chill","downtempo","breakbeat","new jack swing","britpop","motown",
      "psychedelic","psychedelic rock","garage rock","garage","bluegrass","industrial","electropop","dream pop"
    ]);

    const nationalityOrMeta = [
      "british","english","scottish","welsh","irish","american","canadian","australian","new zealand",
      "jamaican","male","female","male vocalists","female vocalists","singer-songwriter","singer songwriters",
      "singer-songwriters","vocalists","uk","us","gb","european","latin american","british pop"
    ];
    const tagIndicators = new Set(nationalityOrMeta);

    const toLower = (s) => s.toLowerCase();
    const genreTerms = [];
    const tagTerms = [];

    for (const original of flat) {
      const lower = toLower(original);
      if (artist && (lower === artist || lower.includes(artist))) {
        tagTerms.push(original);
        continue;
      }
      if (genreSet.has(lower)) {
        genreTerms.push(original);
        continue;
      }
      if ([...genreSet].some((g) => lower === g || lower.includes(g))) {
        genreTerms.push(original);
        continue;
      }
      if (tagIndicators.has(lower)) {
        tagTerms.push(original);
        continue;
      }
      if (/vocalist|vocalists|singer|singers/.test(lower)) {
        tagTerms.push(original);
        continue;
      }
      if (/(\b19\d0s\b|\b20\d0s\b|\b\d{2}s\b)/.test(lower)) {
        tagTerms.push(original);
        continue;
      }
      if (/(british|english|scottish|welsh|irish|american|canadian|australian|jamaican|uk|us)\b/.test(lower)) {
        tagTerms.push(original);
        continue;
      }
      if (lower.includes(" ")) {
        tagTerms.push(original);
      } else {
        genreTerms.push(original);
      }
    }

    const uniqPreserve = (arr) => {
      const seen = new Set();
      const out = [];
      for (const item of arr) {
        const key = item.toLowerCase();
        if (!seen.has(key)) { seen.add(key); out.push(item); }
      }
      return out;
    };

    return {
      genres: uniqPreserve(genreTerms),
      tags: uniqPreserve(tagTerms),
    };
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <div className="modal-header">
          <div className="cover-art-wrapper">
            {song.coverArtUrl ? (
              <img
                className="cover-art"
                src={song.coverArtUrl}
                alt={`${song.title} cover art`}
                loading="lazy"
              />
            ) : (
              <div className="cover-art" />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h2>{song.title}</h2>
            <h3>{song.artist}</h3>
            <div className="badges">
              {song.popularityTier && (
                <span className={`badge tier-${song.popularityTier}`}>{song.popularityTier} Popularity</span>
              )}
              {song.top10 && <span className="badge">Top 10</span>}
              {song.top40 && !song.top10 && <span className="badge">Top 40</span>}
              {typeof song.chartPeak === "number" && song.chartPeak > 0 && (
                <span className="badge">Peak #{song.chartPeak}</span>
              )}
            </div>
            <div className="external-links">
              {song.discogsUrl && (
                <a href={song.discogsUrl} target="_blank" rel="noopener noreferrer" className="external-link">Discogs</a>
              )}
              {song.spotifyTrackId && (
                <a
                  href={`https://open.spotify.com/track/${song.spotifyTrackId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >Spotify Track</a>
              )}
              {song.youtubeUrl ? (
                <a href={song.youtubeUrl} target="_blank" rel="noopener noreferrer" className="external-link">YouTube</a>
              ) : (
                <span className="external-link" style={{ opacity: 0.6 }}>YouTube: (pending)</span>
              )}
            </div>
          </div>
        </div>

        <div className="modal-body">
          {/* 1. BASIC INFO - No title, includes border at bottom */}
          <section className="detail-section" style={{ paddingTop: 0, borderTop: '2px solid #FFE5D9', paddingBottom: '20px' }}>
            <div className="detail-grid" style={{ paddingTop: '20px' }}>
              <div className="detail-item">
                <span className="detail-label">Year</span>
                <span className="detail-value">{song.year || "—"}</span>
              </div>
              {/* Release Date: if missing, render a blank placeholder cell to retain layout */}
              {song.releaseDate ? (
                <div className="detail-item">
                  <span className="detail-label">Release Date</span>
                  <span className="detail-value">
                    {song.releaseDate}
                    {song.releaseDateSource && (
                      <span className="detail-source"> ({song.releaseDateSource})</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="detail-item" aria-hidden="true">
                  <span className="detail-label" style={{ visibility: 'hidden' }}>Release Date</span>
                  <span className="detail-value" style={{ visibility: 'hidden' }}> </span>
                </div>
              )}
              {/* Written by: if missing, render invisible placeholder to retain layout */}
              {song.songwriters ? (
                <div className="detail-item full-width">
                  <span className="detail-label">Written by</span>
                  <span className="detail-value">
                    {song.songwriters}
                    {song.songwritersSource && (
                      <span className="detail-source"> ({song.songwritersSource})</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="detail-item full-width" aria-hidden="true">
                  <span className="detail-label" style={{ visibility: 'hidden' }}>Written by</span>
                  <span className="detail-value" style={{ visibility: 'hidden' }}> </span>
                </div>
              )}
              {/* Classify mixed Genre/Tags into Genres vs Tags, keep Genre on first column */}
              {(() => {
                const genresIn = Array.isArray(song.genre) ? song.genre : (song.genre ? [song.genre] : []);
                const tagsIn = Array.isArray(song.tags) ? song.tags : (song.tags ? [song.tags] : []);
                const combined = [...genresIn, ...tagsIn];
                const { genres: genreTerms, tags: tagTermsRaw } = classifyTerms(combined, song.artist);

                // Build final tag list including Season/Era
                const tagExtras = [song.season, song.era].filter(Boolean);
                const allTags = [...tagTermsRaw, ...tagExtras].filter(Boolean);

                return (
                  <>
                    {genreTerms.length > 0 && (
                      <div className="detail-item">
                        <span className="detail-label">Genre</span>
                        <span className="detail-value">{genreTerms.join(", ")}</span>
                      </div>
                    )}
                    {allTags.length > 0 && (
                      <div className="detail-item full-width">
                        <span className="detail-label">Tags</span>
                        <span className="detail-value">{allTags.join(", ")}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </section>

          {/* 2. SONG OVERVIEW - Includes teaching info inline */}
          <section className="detail-section">
            <h4>Song Overview</h4>
            <div className="detail-grid">
              {song.originalKey && (
                <div className="detail-item">
                  <span className="detail-label">Original Key</span>
                  <span className="detail-value">{song.originalKey}</span>
                </div>
              )}
              {song.souKeys && song.souKeys.length > 0 && (
                <div className="detail-item">
                  <span className="detail-label">SOU Keys</span>
                  <span className="detail-value">{song.souKeys.join(", ")}</span>
                </div>
              )}
              {song.mode && (
                <div className="detail-item">
                  <span className="detail-label">Mode</span>
                  <span className="detail-value">{song.mode}</span>
                </div>
              )}
              {song.level && (
                <div className="detail-item">
                  <span className="detail-label">SOU Level</span>
                  <span className="detail-value">{song.level}</span>
                </div>
              )}
              {song.timeSignature && (
                <div className="detail-item">
                  <span className="detail-label">Time Signature</span>
                  <span className="detail-value">{song.timeSignature}</span>
                </div>
              )}
              {song.bpm && (
                <div className="detail-item">
                  <span className="detail-label">BPM</span>
                  <span className="detail-value">{song.bpm}</span>
                </div>
              )}
              {song.tempoLabel && (
                <div className="detail-item">
                  <span className="detail-label">Tempo</span>
                  <span className="detail-value">{song.tempoLabel}</span>
                </div>
              )}
              {song.numChords && (
                <div className="detail-item">
                  <span className="detail-label">Number of Chords</span>
                  <span className="detail-value">{song.numChords}</span>
                </div>
              )}
              {song.chords && song.chords.length > 0 && (
                <div className="detail-item full-width">
                  <span className="detail-label">Chords</span>
                  <span className="detail-value">{song.chords.join(", ")}</span>
                </div>
              )}
              {song.strumStyle && (
                <div className="detail-item">
                  <span className="detail-label">Strum Style</span>
                  <span className="detail-value">{song.strumStyle}</span>
                </div>
              )}
              {song.fingerpickingStyle && (
                <div className="detail-item">
                  <span className="detail-label">Fingerpicking Style</span>
                  <span className="detail-value">{song.fingerpickingStyle}</span>
                </div>
              )}
            </div>
          </section>

          {/* 3. TEACHING NOTES */}
          {song.teachingNotes && (
            <section className="detail-section">
              <h4>Teaching Notes</h4>
              <div className="detail-notes">
                <p>{song.teachingNotes}</p>
              </div>
            </section>
          )}

          {/* 4. AVAILABLE MATERIALS */}
          <section className="detail-section">
            <h4>Available Materials</h4>
            {(song.songSheetPath || song.melodyTabPath) ? (
              <div className="external-links" style={{ marginTop: 0 }}>
                {song.songSheetPath && (
                  <a 
                    href={getServerUrl(song.songSheetPath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                  >
                    📄 {getDisplayName(song.songSheetPath)}
                  </a>
                )}
                {song.melodyTabPath && (
                  <a 
                    href={getServerUrl(song.melodyTabPath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                  >
                    🎵 {getDisplayName(song.melodyTabPath)}
                  </a>
                )}
              </div>
            ) : (
              <div className="no-data-message">
                <p>📋 No learning materials available yet</p>
              </div>
            )}
          </section>

          {/* 5. ABOUT THIS SONG */}
          {song.wikipediaIntro && (
            <section className="detail-section">
              <h4>About This Song</h4>
              <div className="detail-notes wikipedia-intro">
                <p>{song.wikipediaIntro}</p>
                {song.wikipediaUrl && (
                  <p className="wikipedia-link">
                    <a href={song.wikipediaUrl} target="_blank" rel="noopener noreferrer" className="external-link">
                      Read more on Wikipedia →
                    </a>
                  </p>
                )}
              </div>
            </section>
          )}

          {/* 6. POPULARITY & CHARTS */}
          {(song.lastfmPlays || song.lastfmListeners || song.spotifyPopularity || song.chartPeak || song.top10 || song.top40) ? (
            <section className="detail-section">
              <h4>Popularity & Charts</h4>
              
              {/* Chart Achievements */}
              {(song.top10 || song.top40 || song.chartPeak) && (
                <div className="chart-achievements">
                  {song.top10 && <span className="achievement-badge top10">🔥 Top 10 Hit</span>}
                  {song.top40 && !song.top10 && <span className="achievement-badge top40">⭐ Top 40 Hit</span>}
                  {typeof song.chartPeak === "number" && song.chartPeak > 0 && (
                    <span className="achievement-badge peak">Peak Position: #{song.chartPeak}</span>
                  )}
                </div>
              )}
              
              <div className="detail-grid">
                {/* Last.fm Plays with Progress Bar */}
                {song.lastfmPlays && (
                  <div className="detail-item full-width">
                    <span className="detail-label">Last.fm Plays</span>
                    <div className="popularity-metric">
                      <span className="detail-value">{song.lastfmPlays.toLocaleString()}</span>
                      <div className="popularity-bar-container">
                        <div 
                          className="popularity-bar" 
                          style={{ 
                            width: `${Math.min(100, (song.lastfmPlays / 100000) * 100)}%`,
                            background: 'linear-gradient(90deg, #FF6B35, #F7931E)'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Last.fm Listeners with Progress Bar */}
                {song.lastfmListeners && (
                  <div className="detail-item full-width">
                    <span className="detail-label">Last.fm Listeners</span>
                    <div className="popularity-metric">
                      <span className="detail-value">{song.lastfmListeners.toLocaleString()}</span>
                      <div className="popularity-bar-container">
                        <div 
                          className="popularity-bar" 
                          style={{ 
                            width: `${Math.min(100, (song.lastfmListeners / 50000) * 100)}%`,
                            background: 'linear-gradient(90deg, #FF8C42, #FFB347)'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Spotify Popularity with Visual Bar */}
                {song.spotifyPopularity && (
                  <div className="detail-item full-width">
                    <span className="detail-label">Spotify Popularity</span>
                    <div className="popularity-metric">
                      <span className="detail-value">{song.spotifyPopularity}/100</span>
                      <div className="popularity-bar-container">
                        <div 
                          className="popularity-bar" 
                          style={{ 
                            width: `${song.spotifyPopularity}%`,
                            background: 'linear-gradient(90deg, #F7931E, #FFA94D)'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Popularity Tier Badge */}
                {song.popularityTier && song.popularityTier !== "Unknown" && (
                  <div className="detail-item">
                    <span className="detail-label">Tier</span>
                    <span className={`tier-badge tier-${song.popularityTier}`}>
                      {song.popularityTier}
                    </span>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="detail-section">
              <h4>Popularity & Charts</h4>
              <div className="no-data-message">
                <p>📊 Popularity data pending enrichment</p>
                <p className="hint">Run Last.fm enrichment to populate play counts, listener stats, and engagement metrics.</p>
              </div>
            </section>
          )}

          {/* Credits - Optional */}
          {(song.wordsAndMusic || song.publisher) && (
            <section className="detail-section">
              <h4>Credits</h4>
              <div className="detail-grid">
                {song.wordsAndMusic && (
                  <div className="detail-item full-width">
                    <span className="detail-label">Words & Music</span>
                    <span className="detail-value">{song.wordsAndMusic}</span>
                  </div>
                )}
                {song.publisher && (
                  <div className="detail-item full-width">
                    <span className="detail-label">Publisher</span>
                    <span className="detail-value">{song.publisher}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* General Notes - Optional */}
          {song.notes && (
            <section className="detail-section">
              <h4>Notes</h4>
              <div className="detail-notes">
                <p>{song.notes}</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default SongDetailModal;
