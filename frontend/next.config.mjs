/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["tone", "@tonejs/midi"],
};

export default nextConfig;
