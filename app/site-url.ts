export function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.CF_PAGES_URL) {
    return process.env.CF_PAGES_URL.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}
