module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      projectId: '669c38b2-8856-46a3-b55a-45a92defb284',
    },
  },
  plugins: [
    ...config.plugins,
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: [
            process.env.EXPO_PUBLIC_CONVEX_URL,
            process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
          ].some((url) => url?.startsWith('http://')),
        },
      },
    ],
  ],
});
