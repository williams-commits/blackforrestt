import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Lint runs as its own gate (`npm run lint` via turbo), same as web + crm.
  eslint: { ignoreDuringBuilds: true },
  webpack(config) {
    // next-intl's production extractor contains a dynamic `import(t)`
    // expression webpack cannot statically parse; its cache-persistence
    // layer logs a FileSystemInfo <w> about it on every dev start. That
    // message is infrastructure logging, not a compilation warning, so
    // ignoreWarnings can't reach it — quiet the infra channel to errors
    // only (compile warnings/errors still surface normally).
    config.infrastructureLogging = { ...config.infrastructureLogging, level: "error" };
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      /next-intl[/\\].*failed at 'import\(t\)'|Build dependencies behind this expression are ignored/,
    ];
    return config;
  },
};

export default withNextIntl(nextConfig);
