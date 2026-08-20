import React from "react";
import "./SongDetailModal.css";

function SongDetailModal({ song, onClose }) {
  if (!song) return null;

  // Build materials URL from sanitized relative path fields (preferred) or legacy absolute path fallback.
  const materialsBaseUrl = process.env.REACT_APP_MATERIALS_URL || 'http://localhost:3002';

  const buildMaterialsUrl = (relativePath) => {
    if (!relativePath) return null;
    const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
    return `${materialsBaseUrl}/materials/${encodedPath}`;
  };

  // Legacy support: if sanitized fields absent, derive relative path from original absolute path.
  const deriveRelativeFromAbsolute = (abs) => {
    if (!abs) return null;
    const marker = 'Song Sheets PDF ONLY - School of Uke/';
    const idx = abs.indexOf(marker);
    if (idx === -1) return null;
    return abs.substring(idx + marker.length);
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
                <span className={`badge tier-${song.popularityTier.toLowerCase()}`}>
                  {song.popularityTier.charAt(0).toUpperCase() + song.popularityTier.slice(1)} Popularity
                </span>
              )}
              {song.top10 === true && <span className="badge">Top 10</span>}
              {song.top40 === true && song.top10 !== true && <span className="badge">Top 40</span>}
              {/* Show peak badge with chart name */}
              {(() => {
                // Determine which chart to show in badge (best peak)
                const allPeaks = [
                  { peak: song.chartPeakUk, label: 'UK Singles Chart' },
                  { peak: song.chartPeakUs, label: 'US Billboard Hot 100' },
                  { peak: song.chartPeakAus, label: 'Australian Singles Chart' },
                  { peak: song.chartPeakCanada, label: 'Canadian Hot 100' },
                  { peak: song.chartPeakGermany, label: 'German Singles Chart' },
                  { peak: song.chartPeakFrance, label: 'French Singles Chart' },
                  { peak: song.chartPeakSweden, label: 'Swedish Singles Chart' },
                ].filter(c => c.peak);

                // Add wikiChartPeak if no specific country match
                if (song.wikiChartPeak && !song.chartPeakUs && !song.chartPeakUk && !song.chartPeakAus && !song.chartPeakCanada && !song.chartPeakGermany && !song.chartPeakFrance && !song.chartPeakSweden) {
                  allPeaks.push({
                    peak: song.wikiChartPeak,
                    label: song.wikiChartSource ? song.wikiChartSource.replace('Wikipedia (', '').replace(/\[.*?\].*$/, '').replace(/\)$/, '').trim() : 'Chart'
                  });
                }

                const bestPeak = allPeaks.length > 0 ? allPeaks.reduce((best, current) => 
                  (!best || current.peak < best.peak) ? current : best
                , null) : null;

                return bestPeak ? (
                  <span className="badge">
                    Peak #{bestPeak.peak} {bestPeak.label}
                  </span>
                ) : null;
              })()}
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
              {(song.youtubeUrl || song.youtubeVideoId) ? (
                <a
                  href={song.youtubeUrl || `https://youtu.be/${song.youtubeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >YouTube</a>
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

          {/* WIKIPEDIA BACKGROUND */}
          {song.wikipediaBackground && (
            <section className="detail-section">
              <h4>📖 Background & History</h4>
              <div className="detail-notes" style={{lineHeight: '1.6', whiteSpace: 'pre-wrap'}}>
                <p>{song.wikipediaBackground}</p>
              </div>
            </section>
          )}

          {/* WIKIPEDIA COMPOSITION */}
          {song.wikipediaComposition && (
            <section className="detail-section">
              <h4>🎼 Composition & Musical Structure</h4>
              <div className="detail-notes" style={{lineHeight: '1.6', whiteSpace: 'pre-wrap'}}>
                <p>{song.wikipediaComposition}</p>
              </div>
            </section>
          )}

          {/* COVER VERSIONS */}
          {song.coverVersionsList && (
            <section className="detail-section">
              <h4>🎤 Notable Cover Versions ({song.coverVersionsCount || 0})</h4>
              <div className="detail-notes">
                {song.coverVersionsList.split('|||').map((cover, idx) => {
                  const [artist, ...descParts] = cover.split(':');
                  const description = descParts.join(':').trim();
                  return (
                    <div key={idx} style={{marginBottom: '15px', paddingLeft: '15px', borderLeft: '3px solid #3498db'}}>
                      <strong style={{color: '#2c3e50', fontSize: '1.05em'}}>{artist.trim()}</strong>
                      {description && <p style={{marginTop: '5px', color: '#555'}}>{description}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

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
            {song.songSheetPath && song.songSheetPath.startsWith('https://') ? (
              // R2 direct link — song sheet uploaded to Cloudflare R2
              <div className="external-links" style={{ marginTop: 0 }}>
                <a
                  href={song.songSheetPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  📄 Song Sheet
                </a>
              </div>
            ) : song.materials && song.materials.length > 0 ? (
              <div className="external-links" style={{ marginTop: 0 }}>
                {song.materials.map((material, index) => {
                  const url = buildMaterialsUrl(material.relativePath);
                  if (!url) return null;
                  
                  // Build display name from material metadata
                  const isTab = material.isTab;
                  const key = material.key;
                  
                  // Extract additional info from filename
                  const filename = material.filename || '';
                  const hasEasy = /easy/i.test(filename);
                  const hasVersion = filename.match(/v(\d+)/i);
                  const hasEnsemble = /ensemble/i.test(filename);
                  const hasChordsLyrics = /chords.*lyrics|lyrics.*chords/i.test(filename);
                  const hasChordsOnly = /chords(?!.*lyrics)/i.test(filename);
                  
                  let displayName = isTab ? '🎵 Melody TAB' : '📄 Song Sheet';
                  
                  if (key) {
                    displayName += ` - Key ${key}`;
                  }
                  
                  if (hasEasy) {
                    displayName += ' (Easy)';
                  } else if (hasVersion) {
                    displayName += ` (v${hasVersion[1]})`;
                  } else if (hasEnsemble) {
                    displayName += ' (Ensemble)';
                  } else if (hasChordsLyrics) {
                    displayName += ' (Chords & Lyrics)';
                  } else if (hasChordsOnly) {
                    displayName += ' (Chords Only)';
                  }
                  
                  return (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-link"
                    >
                      {displayName}
                    </a>
                  );
                })}
              </div>
            ) : (song.songSheetRelPath || song.melodyTabRelPath || song.songSheetPath || song.melodyTabPath) ? (
              // Fallback for legacy format (single sheet/tab)
              <div className="external-links" style={{ marginTop: 0 }}>
                {(() => {
                  const rel = song.songSheetRelPath || deriveRelativeFromAbsolute(song.songSheetPath);
                  const displaySource = song.songSheetRelPath ? song.songSheetRelPath : song.songSheetPath;
                  if (rel) {
                    return (
                      <a
                        href={buildMaterialsUrl(rel)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link"
                      >
                        📄 {getDisplayName(displaySource)}
                      </a>
                    );
                  }
                  return null;
                })()}
                {(() => {
                  const rel = song.melodyTabRelPath || deriveRelativeFromAbsolute(song.melodyTabPath);
                  const displaySource = song.melodyTabRelPath ? song.melodyTabRelPath : song.melodyTabPath;
                  if (rel) {
                    return (
                      <a
                        href={buildMaterialsUrl(rel)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link"
                      >
                        🎵 {getDisplayName(displaySource)}
                      </a>
                    );
                  }
                  return null;
                })()}
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
          {(song.lastfmPlays || song.lastfmListeners || song.spotifyPopularity || song.chartPeak || song.wikiChartPeak || song.top10 === true || song.top40 === true) ? (
            <section className="detail-section">
              <h4>Popularity & Charts</h4>
              
              {/* Chart Achievements */}
              {(song.top10 === true || song.top40 === true || song.chartPeak > 0 || song.wikiChartPeak > 0) && (
                <div className="chart-achievements">
                  {song.top10 === true && <span className="achievement-badge top10">🔥 Top 10 Hit</span>}
                  {song.top40 === true && song.top10 !== true && <span className="achievement-badge top40">⭐ Top 40 Hit</span>}
                  {(song.chartPeak > 0 || song.wikiChartPeak > 0) && (
                    <span className="achievement-badge peak">
                      Peak Position: #{song.chartPeak || song.wikiChartPeak}
                    </span>
                  )}
                </div>
              )}
              
              <div className="detail-grid">
                {/* Chart Peak Positions - Show best peak first if it's not UK/US */}
                {(() => {
                  const allPeaks = [
                    { country: 'Australia', peak: song.chartPeakAus, label: 'Australian Singles Chart', weeks: song.chartWeeksAus },
                    { country: 'Canada', peak: song.chartPeakCanada, label: 'Canadian Hot 100', weeks: song.chartWeeksCanada },
                    { country: 'Germany', peak: song.chartPeakGermany, label: 'German Singles Chart', weeks: song.chartWeeksGermany },
                    { country: 'France', peak: song.chartPeakFrance, label: 'French Singles Chart', weeks: song.chartWeeksFrance },
                    { country: 'Sweden', peak: song.chartPeakSweden, label: 'Swedish Singles Chart', weeks: song.chartWeeksSweden },
                    { country: 'Ireland', peak: song.chartPeakIreland, label: 'Irish Singles Chart', weeks: song.chartWeeksIreland },
                    { country: 'Netherlands', peak: song.chartPeakNetherlands, label: 'Dutch Singles Chart', weeks: song.chartWeeksNetherlands },
                    { country: 'New Zealand', peak: song.chartPeakNewZealand, label: 'New Zealand Singles Chart', weeks: song.chartWeeksNewZealand },
                    { country: 'Switzerland', peak: song.chartPeakSwitzerland, label: 'Swiss Singles Chart', weeks: song.chartWeeksSwitzerland },
                    { country: 'Other', peak: song.wikiChartPeak && !song.chartPeakUs && !song.chartPeakUk && !song.chartPeakAus && !song.chartPeakCanada && !song.chartPeakGermany && !song.chartPeakFrance && !song.chartPeakSweden ? song.wikiChartPeak : null, label: song.wikiChartSource ? song.wikiChartSource.replace('Wikipedia (', '').replace(/\[.*?\].*$/, '').replace(/\)$/, '').trim() : 'Chart', weeks: null }
                  ].filter(c => c.peak);

                  // Find best non-UK/US peak
                  const bestOtherPeak = allPeaks.length > 0 ? allPeaks.reduce((best, current) => 
                    (!best || current.peak < best.peak) ? current : best
                  , null) : null;

                  // Check if best other peak is better than UK/US
                  const showBestFirst = bestOtherPeak && 
                    (bestOtherPeak.peak < (song.chartPeakUk || 999)) && 
                    (bestOtherPeak.peak < (song.chartPeakUs || 999));

                  // Helper function to format chart entry
                  const formatChart = (peak, label, weeks) => {
                    let text = `#${peak} ${label}`;
                    if (peak === 1 && weeks && weeks > 1) {
                      text += ` for ${weeks} weeks`;
                    }
                    return text;
                  };

                  return (
                    <>
                      {/* Show best international peak first if it's better than UK/US */}
                      {showBestFirst && bestOtherPeak && (
                        <div className="detail-item full-width">
                          <span className="detail-label">Chart Peak</span>
                          <span className="detail-value">{formatChart(bestOtherPeak.peak, bestOtherPeak.label, bestOtherPeak.weeks)}</span>
                        </div>
                      )}
                      
                      {/* Always show UK and US if available */}
                      {song.chartPeakUk && (
                        <div className="detail-item full-width">
                          <span className="detail-label">UK Charts</span>
                          <span className="detail-value">{formatChart(song.chartPeakUk, 'UK Singles Chart', song.chartWeeksUk)}</span>
                        </div>
                      )}
                      {song.chartPeakUs && (
                        <div className="detail-item full-width">
                          <span className="detail-label">US Charts</span>
                          <span className="detail-value">{formatChart(song.chartPeakUs, 'US Billboard Hot 100', song.chartWeeksUs)}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
                
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
