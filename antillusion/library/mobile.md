# Mobile apps (Expo / React Native, Flutter, PWA)
tags: mobile android ios react native expo flutter dart pwa app navigation touch تطبيق جوال موبايل اندرويد ايفون هاتف

Fastest path to a real app: Expo. `npx create-expo-app@latest app --template blank-typescript`; file-based routing with expo-router (`app/_layout.tsx`, `app/index.tsx`, `app/(tabs)/…`); run `npx expo start` (press w for web — the web target can be shown in this app's preview with `npx expo start --web --port 8081`); device testing through Expo Go or a development build; ship with EAS Build/Submit.

React Native rules: `View`/`Text`/`Pressable`/`FlatList` (never map huge arrays into a ScrollView); all text inside `<Text>`; styles via `StyleSheet.create` or NativeWind; flexbox column by default; safe areas (`react-native-safe-area-context`); keyboard avoidance on forms; images with explicit size (`expo-image`); persistent storage with `expo-secure-store` (secrets) / AsyncStorage / `expo-sqlite`; animations with Reanimated on the UI thread; platform differences via `Platform.select`. RTL: `I18nManager`, use `start`/`end` style props.

Flutter: `flutter create app`; everything is a widget; `StatelessWidget` vs `StatefulWidget`; state with Riverpod or Bloc; navigation with go_router; `const` constructors; `ListView.builder` for long lists; `flutter run -d chrome` or `-d web-server --web-port 8080` to preview here; `flutter build apk`.

PWA (installable web app, no store): `manifest.webmanifest` (name, icons 192/512, `display: standalone`, theme colours), a service worker (cache-first for assets, network-first for API; Workbox or vite-plugin-pwa), HTTPS, responsive layout, touch targets ≥ 44 px.

Mobile UX: thumb-reachable primary actions, bottom navigation for 3–5 top-level destinations, native-feeling transitions, offline and slow-network states, pull-to-refresh, optimistic updates, respect system dark mode and font scaling.
