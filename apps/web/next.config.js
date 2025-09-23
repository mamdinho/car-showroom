/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true, //needed because export disables the Image optimizer
  },
};

module.exports = nextConfig;
