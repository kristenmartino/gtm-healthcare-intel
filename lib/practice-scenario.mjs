// Invented aggregate practice data, shared by the page and API. No patient records.
function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 11) % 2147483647; return s / 2147483647; };
}

function generatePracticeData() {
  const r = seededRandom(42);
  const rand = (min, max) => Math.round((r() * (max - min) + min) * 100) / 100;

  // Providers intentionally use different surnames than the GTM sales reps so
  // a careful reader doesn't conflate the two personas.
  const providers = ["Dr. Anya Lin", "Dr. Priya Shah", "Dr. Maya Singh", "Dr. Devon Brooks", "Dr. Hana Yamamoto"];
  const payers = ["Blue Cross", "Aetna", "UnitedHealth", "Medicare", "Cigna", "Self-Pay"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const months = [];

  for (let m = 0; m < 12; m++) {
    const monthData = { month: monthNames[m], year: 2025, providers: {} };
    providers.forEach((p) => {
      const base = p.includes("Lin") ? 1.1 : p.includes("Shah") ? 0.95 : p.includes("Singh") ? 1.05 : p.includes("Brooks") ? 0.88 : 1.0;
      const seasonal = 1 + 0.08 * Math.sin((m - 3) * Math.PI / 6);
      monthData.providers[p] = {
        patients: Math.round(rand(140, 210) * base * seasonal),
        revenue: Math.round(rand(85000, 145000) * base * seasonal),
        collections: Math.round(rand(78000, 135000) * base * seasonal),
        denials: Math.round(rand(8, 28) * (2 - base)),
        noShows: Math.round(rand(6, 18) / base),
        avgReimb: Math.round(rand(245, 380) * base),
        procedures: {
          "Mohs Surgery": Math.round(rand(8, 22) * base),
          "Biopsy": Math.round(rand(35, 65) * base * seasonal),
          "Lesion Destruction": Math.round(rand(20, 45) * base),
          "E&M Visit": Math.round(rand(80, 140) * base * seasonal),
          "Cosmetic Consult": Math.round(rand(5, 18) * base),
        },
        payerMix: {},
      };
      let remaining = monthData.providers[p].revenue;
      payers.forEach((pay, i) => {
        const share = pay === "Medicare" ? rand(0.2, 0.3) : pay === "Blue Cross" ? rand(0.18, 0.25) : pay === "Self-Pay" ? rand(0.05, 0.1) : rand(0.08, 0.18);
        const amt = i === payers.length - 1 ? remaining : Math.round(remaining * share);
        monthData.providers[p].payerMix[pay] = Math.min(amt, remaining);
        remaining -= monthData.providers[p].payerMix[pay];
      });
    });
    months.push(monthData);
  }

  return { practiceName: "Advanced Dermatology Associates", providers, payers, months };
}

export const PRACTICE_DATA = generatePracticeData();

export function summarizePractice(monthIndexes = PRACTICE_DATA.months.map((_, i) => i), providers = PRACTICE_DATA.providers) {
  const rows = providers.map(provider => ({
    provider,
    denials: monthIndexes.reduce((total, i) => total + PRACTICE_DATA.months[i].providers[provider].denials, 0),
  }));
  return { providers: rows, total: rows.reduce((total, row) => total + row.denials, 0) };
}
export function practiceDenialSummary() {
  return {
    fullYear2025: summarizePractice(),
    quarters: [0,1,2,3].map(q => ({ period: `Q${q+1} 2025`, ...summarizePractice([q*3,q*3+1,q*3+2]) })),
    months: PRACTICE_DATA.months.map((m,i) => ({ period: `${m.month} 2025`, ...summarizePractice([i]) })),
  };
}
