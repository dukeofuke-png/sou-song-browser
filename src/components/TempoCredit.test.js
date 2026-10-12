import { render, screen } from "@testing-library/react";
import { bpmEstimateLabel, GetSongBPMCredit, GETSONGBPM_URL } from "./TempoCredit";
import SongDetailModal from "../SongDetailModal";

describe("bpmEstimateLabel", () => {
  test("tutor-entered tempos carry no estimate label", () => {
    expect(bpmEstimateLabel("manual")).toBeNull();
    expect(bpmEstimateLabel("teaching")).toBeNull();
  });
  test("anything else is an unconfirmed estimate, named by source", () => {
    expect(bpmEstimateLabel("deezer")).toBe("estimate (Deezer), unconfirmed");
    expect(bpmEstimateLabel("getsongbpm")).toBe("estimate (GetSongBPM), unconfirmed");
    expect(bpmEstimateLabel(null)).toBe("estimate, unconfirmed");
  });
});

test("the credit is a visible link to getsongbpm.com", () => {
  render(<GetSongBPMCredit />);
  const link = screen.getByRole("link", { name: "GetSongBPM.com" });
  expect(link).toHaveAttribute("href", GETSONGBPM_URL);
});

describe("SongDetailModal tempo and credit", () => {
  const base = { id: "t1", title: "Test Song", artist: "Test Artist" };

  test("an estimate shows its source and the credit link", () => {
    render(<SongDetailModal song={{ ...base, bpm: 118, bpmSource: "deezer" }} onClose={() => {}} />);
    expect(screen.getByText(/estimate \(Deezer\), unconfirmed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GetSongBPM.com" })).toBeInTheDocument();
  });

  test("a manual tempo shows no estimate label", () => {
    render(<SongDetailModal song={{ ...base, bpm: 100, bpmSource: "manual" }} onClose={() => {}} />);
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.queryByText(/estimate/)).not.toBeInTheDocument();
  });

  test("no tempo and no key: no credit line", () => {
    render(<SongDetailModal song={base} onClose={() => {}} />);
    expect(screen.queryByRole("link", { name: "GetSongBPM.com" })).not.toBeInTheDocument();
  });
});
