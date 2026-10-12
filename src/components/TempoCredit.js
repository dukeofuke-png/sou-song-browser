import React from "react";

// GetSongBPM's free API requires a visible link back to getsongbpm.com wherever its
// data is used ("a link back to GetSongBPM.com is REQUIRED ... or we will suspend your
// account without notice"). Enrichment cleanup approved 12 Oct 2026.
export const GETSONGBPM_URL = "https://getsongbpm.com";

const SOURCE_NAMES = { getsongbpm: "GetSongBPM", deezer: "Deezer", spotify: "Spotify" };

// A tutor-entered tempo ('manual' or the teaching tempo) is shown as-is; anything else is
// an unconfirmed estimate, labelled with where it came from. Returns null when no label.
export function bpmEstimateLabel(source) {
  if (source === "manual" || source === "teaching") return null;
  const name = SOURCE_NAMES[source];
  return name ? `estimate (${name}), unconfirmed` : "estimate, unconfirmed";
}

export function GetSongBPMCredit({ style }) {
  return (
    <span className="getsongbpm-credit" style={{ fontSize: "0.8rem", opacity: 0.8, ...style }}>
      Tempo and key data:{" "}
      <a href={GETSONGBPM_URL} target="_blank" rel="noopener noreferrer">
        GetSongBPM.com
      </a>
    </span>
  );
}
