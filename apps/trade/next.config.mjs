import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Lint runs as its own gate (`npm run lint` via turbo), same as web + crm.
  eslint: { ignoreDuringBuilds: true },
};

export default withNextIntl(nextConfig);
