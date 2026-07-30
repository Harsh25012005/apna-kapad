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
      '@react-native-community/datetimepicker',
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
