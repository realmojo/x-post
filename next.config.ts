import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// next dev 에서도 Cloudflare 바인딩·환경변수(.dev.vars)를 쓸 수 있게 한다.
initOpenNextCloudflareForDev();
