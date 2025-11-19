import React, { useState, useMemo } from "react";

import songsData from "./data/songs_app_export_merged.json";
import SongDetailModal from "./SongDetailModal";

import logo from "./assets/sou-logo.png";

function formatMaterialStatus(raw) {
  const v = (raw || "").trim().toLowerCase();

  if (!v) return "";

  if (["yes", "true", "y", "1"].includes(v)) {
    return "Yes";
  }

  if (["draft", "wip", "work in progress"].includes(v)) {
    return "Draft";
  }

  if (["no", "false", "n", "0"].includes(v)) {
    return "No";
  }

  // Fallback – show original if it's something unexpected
  return raw;
}


function App() {
  const songs = Array.isArray(songsData) ? songsData : [];
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [keyFilter, setKeyFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [eraFilter, setEraFilter] = useState("all");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [chartFilter, setChartFilter] = useState("all");
  const [selectedSong, setSelectedSong] = useState(null);



  const keys = useMemo(() => {
    const set = new Set();
    songs.forEach((song) => {
      const raw = song.originalKey || "";
      raw.split(",").forEach((part) => {
        const k = part.trim();
        if (k) set.add(k);
      });
    });
    return Array.from(set).sort();
  }, [songs]);


    const eras = useMemo(() => {
    const set = new Set();
    songs.forEach((song) => {
      const era = (song.era || "").trim();
      if (era) set.add(era);
    });
    return Array.from(set).sort();
  }, [songs]);

    const seasons = useMemo(() => {
    const set = new Set();
    songs.forEach((song) => {
      const season = (song.season || "").trim();
      if (season) set.add(season);
    });
    return Array.from(set).sort();
  }, [songs]);

    const genres = useMemo(() => {
  const set = new Set();

  songs.forEach((song) => {
    if (!song) return;

    // In our JSON, genre should be an array. Be defensive anyway.
    if (Array.isArray(song.genre)) {
      song.genre.forEach((g) => {
        const trimmed = (g || "").trim();
        if (trimmed) set.add(trimmed);
      });
    } else if (song.genre) {
      String(song.genre)
        .split(",")
        .map((g) => g.trim())
        .forEach((g) => {
          if (g) set.add(g);
        });
    }
  });

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}, [songs]);

const filteredSongs = songs.filter((song) => {
  const query = search.trim().toLowerCase();

  // Text search: title, artist, songwriters
  if (query) {
    const title = (song.title || "").toLowerCase();
    const artist = (song.artist || "").toLowerCase();
    const songwriters = (song.songwriters || "").toLowerCase();

    if (
      !title.includes(query) &&
      !artist.includes(query) &&
      !songwriters.includes(query)
    ) {
      return false;
    }
  }

  // Level filter
  if (levelFilter !== "all") {
    const levelNum = parseInt(levelFilter, 10);
    if (song.level !== levelNum) {
      return false;
    }
  }

  // Key filter (Original Key) – handle multiple keys like "C, Em"
  if (keyFilter !== "all") {
    const raw = song.originalKey || "";
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (!parts.includes(keyFilter)) {
      return false;
    }
  }

  // Mode filter (Major/Minor)
  if (modeFilter !== "all") {
    const mode = (song.mode || "").trim().toLowerCase(); // "major" / "minor"
    if (modeFilter === "major" && mode !== "major") {
      return false;
    }
    if (modeFilter === "minor" && mode !== "minor") {
      return false;
    }
  }

  // Era filter (e.g. "1960s", "2000s")
  if (eraFilter !== "all") {
    const era = (song.era || "").trim();
    if (era !== eraFilter) {
      return false;
    }
  }

  // Season filter (Spring, Summer, Autumn, Winter, etc)
  if (seasonFilter !== "all") {
    const season = (song.season || "").trim();
    if (season !== seasonFilter) {
      return false;
    }
  }

  // Genre filter
  if (genreFilter !== "all") {
    const gfLower = genreFilter.toLowerCase();

    const genresArr = Array.isArray(song.genre)
      ? song.genre
      : (song.genre
          ? String(song.genre)
              .split(",")
              .map((g) => g.trim())
              .filter(Boolean)
          : []);

    const matchesGenre = genresArr.some(
      (g) => g && g.toLowerCase() === gfLower
    );

    if (!matchesGenre) {
      return false;
    }
  }

  // Chart position filter
  if (chartFilter !== "all") {
    const peak = typeof song.chartPeak === "number" ? song.chartPeak : null;
    const isTop10 = song.top10 || (peak && peak > 0 && peak <= 10);
    const isTop40 = song.top40 || (peak && peak > 0 && peak <= 40);
    const charted = !!(peak && peak > 0) || !!song.top10 || !!song.top40;

    if (chartFilter === "number1") {
      if (peak !== 1) return false;
    } else if (chartFilter === "top10") {
      if (!isTop10) return false;
    } else if (chartFilter === "top40") {
      if (!isTop40) return false;
    } else if (chartFilter === "charted") {
      if (!charted) return false;
    } else if (chartFilter === "never") {
      if (charted) return false;
    }
  }

  return true;
});


  // ---------- JSX ----------

  return (
    <div>
      <header className="app-header">
        <img src={logo} alt="School of Uke" className="app-logo" />
        <div>
          <h1>School of Uke – Song Browser</h1>
          <p className="app-tagline">(very early MVP)</p>
        </div>
      </header>

      <div className="app-content">
        <p>Total songs in database: {songs.length}</p>

        {/* Search box + filters */}
        <div
          style={{
            marginBottom: "1rem",
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Search by song, artist or songwriter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "0.5rem", minWidth: "260px" }}
          />

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{ padding: "0.5rem" }}
          >
            <option value="all">All levels</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
            <option value="4">Level 4</option>
            <option value="5">Level 5</option>
          </select>

          <select
            value={keyFilter}
            onChange={(e) => setKeyFilter(e.target.value)}
            style={{ padding: "0.5rem" }}
          >
            <option value="all">All keys</option>
            {keys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            style={{ padding: "0.5rem" }}
          >
            <option value="all">Major &amp; minor</option>
            <option value="major">Major only</option>
            <option value="minor">Minor only</option>
          </select>

          <select
            value={eraFilter}
            onChange={(e) => setEraFilter(e.target.value)}
            style={{ padding: "0.5rem" }}
          >
            <option value="all">All eras</option>
            {eras.map((era) => (
              <option key={era} value={era}>
                {era}
              </option>
            ))}
          </select>

          <select
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            style={{ padding: "0.5rem" }}
          >
            <option value="all">All seasons</option>
            {seasons.map((season) => (
              <option key={season} value={season}>
                {season}
              </option>
            ))}
          </select>

            <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            style={{ padding: "0.5rem" }}
          >
            <option value="all">All genres</option>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
         ))}
          </select>

            {/* Chart position filter */}
            <select
              value={chartFilter}
              onChange={(e) => setChartFilter(e.target.value)}
              style={{ padding: "0.5rem" }}
            >
              <option value="all">Chart Toppers</option>
              <option value="number1">No.1 Hits</option>
              <option value="top10">Top 10</option>
              <option value="top40">Top 40</option>
              <option value="charted">Charted (any)</option>
              <option value="never">Never charted</option>
            </select>

        </div>
        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              minWidth: "1000px",
              fontSize: "0.9rem",
            }}
          >
            <thead>
              <tr>
                <Th>Song</Th>
                <Th>Artist</Th>
                <Th>Year</Th>
                <Th>Genre</Th>
                <Th center>Season</Th>
                <Th center>Major/Minor</Th>
                <Th center width="60px">Key</Th>
                <Th center>Teaching Level</Th>
                <Th center># Chords</Th>
                <Th center>Songsheet</Th>
                <Th center>TAB</Th>
              </tr>
            </thead>
            <tbody>
              {filteredSongs.map((song) => {
                return (
                  <tr 
                    key={song.id}
                    onClick={() => setSelectedSong(song)}
                    style={{ cursor: 'pointer' }}
                    className="song-row"
                  >
                    <Td>{song.title}</Td>
                    <Td>{song.artist}</Td>
                    <Td>{song.year ?? ""}</Td>
                    <Td>
                      {Array.isArray(song.genre) ? song.genre.join(", ") : song.genre}
                    </Td>
                    <Td center>{song.season}</Td>
                    <Td center>{song.mode}</Td>
                    <Td center>{song.originalKey}</Td>
                    <Td center>{song.level ?? ""}</Td>
                    <Td center>{song.numChords ?? ""}</Td>
                    <Td center>{formatMaterialStatus(song.songSheetStatus)}</Td>
                    <Td center>{formatMaterialStatus(song.tabStatus)}</Td>
                  </tr>
                );
              })}

              {filteredSongs.length === 0 && (
                <tr>
                  <Td colSpan={11}>No songs match your search yet.</Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Song Detail Modal */}
        {selectedSong && (
          <SongDetailModal 
            song={selectedSong} 
            onClose={() => setSelectedSong(null)} 
          />
        )}
      </div>
    </div>
  );
}

 // Simple styled table cells
function Th({ children, center, width }) {
  return (
    <th
      style={{
        textAlign: center ? "center" : "left",
        borderBottom: "2px solid #FFE5D9",
        padding: "0.5rem",
        whiteSpace: "nowrap",
        width: width || "auto",
        fontFamily: '"Jost", "Futura", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: "0.85rem",
        color: "#333",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, colSpan, center }) {
  return (
    <td
      colSpan={colSpan}
      style={{
        borderBottom: "1px solid #FFF3E0",
        padding: "0.4rem 0.5rem",
        verticalAlign: "top",
        textAlign: center ? "center" : "left",
        fontFamily: '"Jost", "Futura", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {children}
    </td>
  );
}

export default App;
