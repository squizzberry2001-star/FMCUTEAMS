/**
 * Utility for synchronizing mobile browser status bar (Dynamic Island, Notch, PWA header)
 * and body canvas colors across light and dark views.
 */

export const APP_THEME_COLOR_LIGHT = '#F8F9FD';
export const APP_THEME_COLOR_DARK = '#020617';

export function syncMobileStatusBarTheme(
  themeColor: string = APP_THEME_COLOR_LIGHT,
  isDark: boolean = false
): void {
  if (typeof document === 'undefined') return;
  try {
    // 1. Meta theme-color (Android Chrome, modern Mobile Safari, PWA)
    let mTheme = document.querySelector('meta[name="theme-color"]');
    if (!mTheme) {
      mTheme = document.createElement('meta');
      mTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(mTheme);
    }
    mTheme.setAttribute('content', themeColor);

    // 2. iOS Safari status bar style
    let mApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!mApple) {
      mApple = document.createElement('meta');
      mApple.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      document.head.appendChild(mApple);
    }
    mApple.setAttribute('content', isDark ? 'black-translucent' : 'default');

    // 3. Color scheme
    let mScheme = document.querySelector('meta[name="color-scheme"]');
    if (!mScheme) {
      mScheme = document.createElement('meta');
      mScheme.setAttribute('name', 'color-scheme');
      document.head.appendChild(mScheme);
    }
    mScheme.setAttribute('content', isDark ? 'dark' : 'light');

    // 4. Force HTML & Body root styles
    document.documentElement.style.setProperty('background-color', themeColor, 'important');
    document.documentElement.style.setProperty('color-scheme', isDark ? 'dark' : 'light');
    document.body.style.setProperty('background-color', themeColor, 'important');
    document.body.style.setProperty('color-scheme', isDark ? 'dark' : 'light');
  } catch (err) {
    console.warn('syncMobileStatusBarTheme warning:', err);
  }
}
