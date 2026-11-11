const { withAndroidStyles, withDangerousMod, withMainActivity } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SPLASH_WINDOW = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splashscreen_background" />
</layer-list>
`;

const BLANK_ICON = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <size android:width="1dp" android:height="1dp" />
    <solid android:color="@android:color/transparent" />
</shape>
`;

function upsertItem(style, name, value) {
  const items = style.item ?? [];
  const existing = items.find((item) => item.$?.name === name);
  if (existing) {
    existing._ = value;
  } else {
    items.push({ $: { name }, _: value });
  }
  style.item = items;
}

/** Splash nativo só preenche a janela de preto. A arte e a transição ficam no JS (igual o app cliente). */
function withFullScreenSplash(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const res = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res');
      const drawable = path.join(res, 'drawable');
      fs.mkdirSync(drawable, { recursive: true });
      fs.writeFileSync(path.join(drawable, 'splash_window.xml'), SPLASH_WINDOW);
      fs.writeFileSync(path.join(drawable, 'splashscreen_blank.xml'), BLANK_ICON);
      return config;
    },
  ]);

  config = withAndroidStyles(config, (config) => {
    const styles = config.modResults.resources.style ?? [];
    for (const style of styles) {
      const name = style.$?.name;
      if (name === 'AppTheme' || name === 'Theme.App.SplashScreen') {
        upsertItem(style, 'android:windowBackground', '@color/splashscreen_background');
      }
      if (name === 'AppTheme') {
        upsertItem(style, 'android:navigationBarColor', '@android:color/black');
        upsertItem(style, 'android:windowLightNavigationBar', 'false');
      }
      if (name === 'Theme.App.SplashScreen') {
        upsertItem(style, 'android:windowSplashScreenBackground', '@color/splashscreen_background');
        upsertItem(style, 'android:windowSplashScreenAnimatedIcon', '@drawable/splashscreen_blank');
        upsertItem(style, 'windowSplashScreenAnimatedIcon', '@drawable/splashscreen_blank');
      }
    }
    config.modResults.resources.style = styles;
    return config;
  });

  config = withMainActivity(config, (config) => {
    let contents = config.modResults.contents;
    // Remove overlay antigo (ImageView por cima do React) — ele matava a transição.
    contents = contents.replace(
      /\n[ \t]*window\.setBackgroundDrawable\(android\.graphics\.drawable\.ColorDrawable\(android\.graphics\.Color\.BLACK\)\)\n[ \t]*showSplashArt\(\)\n/g,
      '\n'
    );
    contents = contents.replace(/\n[ \t]*hideSplashCut\(\)\n/g, '\n');
    contents = contents.replace(
      /\n[ \t]*private fun showSplashArt\(\) \{[\s\S]*?\n[ \t]*\}\n(?=\n[ \t]*(?:private fun hideSplashCut|\/\*\*))/,
      '\n'
    );
    contents = contents.replace(
      /\n[ \t]*private fun hideSplashCut\(\) \{[\s\S]*?\n[ \t]*\}\n(?=\n[ \t]*\/\*\*)/,
      '\n'
    );
    config.modResults.contents = contents;
    return config;
  });

  return config;
}

module.exports = withFullScreenSplash;
