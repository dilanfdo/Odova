import Constants from 'expo-constants';

// True when running inside the Expo Go client app rather than a standalone/
// EAS dev-client build. Several native modules (expo-notifications' remote
// push registration, react-native-purchases entirely) either throw on import
// or simply aren't bundled in Expo Go — check this before touching them.
export const isExpoGo = Constants.appOwnership === 'expo';
