const BASE = "https://gtm.kristenmartino.ai";

const ROUTES = [
  { path: "/", priority: 1.0 },
  { path: "/northstar", priority: 0.9 },
  { path: "/askgtm", priority: 0.9 },
  { path: "/askpractice", priority: 0.9 },
  { path: "/convertpath", priority: 0.8 },
  { path: "/spectrumiq", priority: 0.8 },
  { path: "/practiceflow", priority: 0.8 },
  { path: "/specialtypulse", priority: 0.8 },
  { path: "/methodology", priority: 0.7 },
  { path: "/q1-review", priority: 0.7 },
];

export default function sitemap() {
  const now = new Date();
  return ROUTES.map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority,
  }));
}
