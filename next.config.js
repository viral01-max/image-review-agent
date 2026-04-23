/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
    ],
  },
  serverExternalPackages: ["sharp", "bullmq", "ioredis", "@aws-sdk/client-rekognition", "@aws-sdk/client-s3"],
};

module.exports = nextConfig;
