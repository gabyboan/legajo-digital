import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [],
  outputFileTracingIncludes: { '/api/validacion-dni{,/**}': ['./modules/validador-dni/*.py', './modules/validador-familiares/*.py'] },
};

export default nextConfig;
