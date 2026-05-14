import metroScores from "../../public/metro_scores.json";
import SpectrumIQ from "./SpectrumIQ";

export default function Page() {
  return <SpectrumIQ initialData={metroScores} />;
}
