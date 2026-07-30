require('dotenv/config');

module.exports = {
  expo: {
    name: 'apna-kapd',
    slug: 'apna-kapd',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'apnakapad',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.apnakapad.app',
      infoPlist: {
        // Required for Linking.canOpenURL to detect these mail clients —
        // without the allowlist iOS silently answers false for every scheme.
        LSApplicationQueriesSchemes: [
          'googlegmail',
          'ms-outlook',
          'ymail',
          'protonmail',
          'readdle-spark',
          'message',
        ],
      },
    },
    android: {
      package: 'com.apnakapad.app',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-web-browser',
      'expo-secure-store',
      'expo-font',
      'expo-localization',
      '@react-native-community/datetimepicker',
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow $(PRODUCT_NAME) to access your photos so you can attach design references to an order.',
          cameraPermission: 'Allow $(PRODUCT_NAME) to use the camera so you can photograph a design for an order.',
        },
      ],
      [
        '@react-native-google-signin/google-signin',
        {
          // iosUrlScheme looks like: com.googleusercontent.apps.XXXXXXXXX
          // Get it from Google Cloud Console → Credentials → iOS OAuth Client ID → "reversed client ID"
          iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME ?? 'com.googleusercontent.apps.PLACEHOLDER',
        },
      ],
    ],
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
    },
  },
};
