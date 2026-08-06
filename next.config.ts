import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project so it doesn't
  // walk upward and pick a parent-directory lockfile as the root —
  // that breaks module resolution for `tailwindcss` etc. and makes
  // Turbopack watch far more of the filesystem than it should.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
