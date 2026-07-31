require('dotenv/config');

module.exports = {
  expo: {
    name: 'MeasuresOne',
    slug: 'measuresone',
    owner: 'is_harsh2501',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'measuresone',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.measuresone.app',
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
      package: 'com.measuresone.app',
      adaptiveIcon: {
        backgroundColor: '#FFFFFF',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          // The logo art already carries its own generous margin, so a
          // modest width keeps it from dominating the screen.
          imageWidth: 160,
          resizeMode: 'contain',
          backgroundColor: '#FFFFFF',
        },
      ],
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
      'expo-sqlite',
      'expo-notifications',
      [
        'expo-speech-recognition',
        {
          microphonePermission: 'Allow $(PRODUCT_NAME) to use the microphone to dictate order details.',
          speechRecognitionPermission: 'Allow $(PRODUCT_NAME) to use speech recognition to dictate order details.',
        },
      ],
    ],
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
      eas: {
        projectId: '4623e4e2-cc7b-421b-8aff-d3021c25c452',
      },
    },
  },
};
