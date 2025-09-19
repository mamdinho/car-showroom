/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // static export → S3 + CloudFront
};
module.exports = nextConfig;
