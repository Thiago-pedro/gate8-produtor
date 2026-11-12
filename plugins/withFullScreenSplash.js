const { withAndroidColors, withAndroidStyles, withDangerousMod, withMainActivity } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SPLASH_SRC = 'assets/images/splash.png';

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function setStyleItem(style, name, value) {
  style.item = asArray(style.item).filter((entry) => entry.$?.name !== name);
  style.item.push({ $: { name }, _: value });
}

/**
 * Igual ao app cliente: splash cheia no windowBackground nativo,
 * ícone animado do Android 12 vazio (sem splash pequenininho no centro).
 * Sem ImageView por cima do React.
 */
function withFullScreenSplash(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const res = path.join(projectRoot, 'android/app/src/main/res');
      const src = path.join(projectRoot, SPLASH_SRC);
      const nodpi = path.join(res, 'drawable-nodpi');
      const drawable = path.join(res, 'drawable');

      await fs.promises.mkdir(nodpi, { recursive: true });
      await fs.promises.mkdir(drawable, { recursive: true });
      await fs.promises.copyFile(src, path.join(nodpi, 'splash_full.png'));

      await fs.promises.writeFile(
        path.join(drawable, 'splash_full_bg.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item>
    <bitmap android:gravity="fill" android:src="@drawable/splash_full" />
  </item>
</layer-list>
`
      );

      await fs.promises.writeFile(
        path.join(drawable, 'splash_empty.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <size android:width="1dp" android:height="1dp" />
  <solid android:color="#00000000" />
</shape>
`
      );

      const colorsFile = path.join(res, 'values/colors.xml');
      try {
        let xml = await fs.promises.readFile(colorsFile, 'utf8');
        if (/name="splashscreen_background"/.test(xml)) {
          xml = xml.replace(
            /(<color name="splashscreen_background">)#[^<]+/i,
            '$1#000000'
          );
        } else {
          xml = xml.replace(
            '</resources>',
            '    <color name="splashscreen_background">#000000</color>\n</resources>'
          );
        }
        await fs.promises.writeFile(colorsFile, xml);
      } catch {
        await fs.promises.mkdir(path.join(res, 'values'), { recursive: true });
        await fs.promises.writeFile(
          colorsFile,
          `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="splashscreen_background">#000000</color>
</resources>
`
        );
      }

      const entries = await fs.promises.readdir(res, { withFileTypes: true });
      await Promise.all(
        entries
          .filter((entry) => entry.isDirectory() && entry.name.startsWith('drawable'))
          .map(async (entry) => {
            const file = path.join(res, entry.name, 'splashscreen_logo.png');
            try {
              await fs.promises.unlink(file);
            } catch {
              // ignore missing
            }
          })
      );

      return config;
    },
  ]);

  config = withAndroidColors(config, (config) => {
    const colors = asArray(config.modResults.resources.color);
    config.modResults.resources.color = [
      ...colors.filter((entry) => entry.$?.name !== 'splashscreen_background'),
      { $: { name: 'splashscreen_background' }, _: '#000000' },
    ];
    return config;
  });

  config = withAndroidStyles(config, (config) => {
    const styles = asArray(config.modResults.resources.style);
    for (const style of styles) {
      const name = style.$?.name;
      if (name === 'AppTheme') {
        setStyleItem(style, 'android:windowBackground', '@android:color/black');
        setStyleItem(style, 'android:navigationBarColor', '@android:color/black');
        setStyleItem(style, 'android:windowLightNavigationBar', 'false');
        setStyleItem(style, 'android:forceDarkAllowed', 'false');
      }
      if (name === 'Theme.App.SplashScreen') {
        setStyleItem(style, 'android:windowBackground', '@drawable/splash_full_bg');
        setStyleItem(style, 'windowSplashScreenBackground', '#000000');
        setStyleItem(style, 'android:windowSplashScreenBackground', '#000000');
        setStyleItem(style, 'windowSplashScreenAnimatedIcon', '@drawable/splash_empty');
        setStyleItem(style, 'android:windowSplashScreenAnimatedIcon', '@drawable/splash_empty');
        setStyleItem(style, 'android:forceDarkAllowed', 'false');
      }
    }
    config.modResults.resources.style = styles;
    return config;
  });

  config = withMainActivity(config, (config) => {
    let contents = config.modResults.contents;
    contents = contents.replace(
      /\n[ \t]*\/\/ @generated begin expo-splashscreen[\s\S]*?\/\/ @generated end expo-splashscreen\n/,
      '\n'
    );
    contents = contents.replace(
      /\n[ \t]*try \{\n[ \t]*SplashScreenManager\.hide\(\)\n[ \t]*\} catch \(_e: Exception\) \{\n[ \t]*\}\n/g,
      '\n'
    );
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
    contents = contents.replace(/\nimport expo\.modules\.splashscreen\.SplashScreenManager\n/g, '\n');
    contents = contents.replace(/\nimport android\.widget\.ImageView\n/g, '\n');
    config.modResults.contents = contents;
    return config;
  });

  return config;
}

module.exports = withFullScreenSplash;
