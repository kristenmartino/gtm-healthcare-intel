import dealScores from "../../public/deal_scores.json";
import ConvertPath from "./ConvertPath";

export default function Page() {
  return <ConvertPath initialDealScores={dealScores} />;
}
