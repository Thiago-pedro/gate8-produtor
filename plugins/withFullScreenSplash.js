const {
  withAndroidColors,
  withAndroidStyles,
  withDangerousMod,
  withFinalizedMod,
  withMainActivity,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SPLASH_SRC = 'assets/images/splash.png';

const SPLASH_THEME = `<style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
    <item name="android:windowBackground">@drawable/splash_full_bg</item>
    <item name="windowSplashScreenBackground">#000000</item>
    <item name="android:windowSplashScreenBackground">#000000</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splash_empty</item>
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_empty</item>
    <item name="postSplashScreenTheme">@style/AppTheme</item>
    <item name="android:forceDarkAllowed">false</item>
  </style>`;

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function setStyleItem(style, name, value) {
  style.item = asArray(style.item).filter((entry) => entry.$?.name !== name);
  style.item.push({ $: { name }, _: value });
}

function patchSplashThemeXml(xml) {
  if (!/name="Theme\.App\.SplashScreen"/.test(xml)) return xml;
  return xml.replace(
    /<style name="Theme\.App\.SplashScreen"[^>]*>[\s\S]*?<\/style>/,
    SPLASH_THEME
  );
}

async function ensureSplashDrawables(projectRoot) {
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
}

async function neutralizeSplashLogos(_projectRoot) {
  // Mantém splashscreen_logo gerado pelo expo-splash-screen (PNG vazio válido).
  // Apagar quebra drawable/ic_launcher_background.xml; substituir por 1x1 quebra o AAPT2.
  // O tema final usa splash_empty — esses logos só existem para o link de recursos.
}

function scrubMainActivity(contents) {
  // Igual ao que o prebuild do cliente de fato entrega na Play:
  // mantém SplashScreenManager.registerOnActivity (handoff do hideAsync),
  // remove só ImageView / hide forçado / arte nativa por cima do React.
  let src = contents;
  src = src.replace(
    /\n[ \t]*try \{\n[ \t]*SplashScreenManager\.hide\(\)\n[ \t]*\} catch \(_e: Exception\) \{\n[ \t]*\}\n/g,
    '\n'
  );
  src = src.replace(
    /\n[ \t]*\/\/ gate8-splash-hide[\s\S]*?splash\.postDelayed\(removeSplash, 8000\)\n/,
    '\n'
  );
  src = src.replace(
    /\n[ \t]*\/\/ gate8-splash-hide[\s\S]*?window\.decorView\.post \{[\s\S]*?\n[ \t]*\}\n/,
    '\n'
  );
  src = src.replace(
    /\n[ \t]*window\.setBackgroundDrawable\(android\.graphics\.drawable\.ColorDrawable\(android\.graphics\.Color\.BLACK\)\)\n[ \t]*showSplashArt\(\)\n/g,
    '\n'
  );
  src = src.replace(/\n[ \t]*hideSplashCut\(\)\n/g, '\n');
  src = src.replace(
    /\n[ \t]*private fun showSplashArt\(\) \{[\s\S]*?\n[ \t]*\}\n(?=\n[ \t]*(?:private fun hideSplashCut|\/\*\*))/,
    '\n'
  );
  src = src.replace(
    /\n[ \t]*private fun hideSplashCut\(\) \{[\s\S]*?\n[ \t]*\}\n(?=\n[ \t]*\/\*\*)/,
    '\n'
  );
  src = src.replace(/\nimport android\.widget\.ImageView\n/g, '\n');
  src = src.replace(/\nimport android\.view\.ViewGroup\n/g, '\n');
  src = src.replace(/\nimport android\.graphics\.Color\n/g, '\n');
  src = src.replace(/\nimport com\.facebook\.react\.bridge\.ReactMarkerConstants\n/g, '\n');
  src = src.replace(/\nimport com\.facebook\.react\.bridge\.ReactMarker\n/g, '\n');
  return src;
}

async function patchMainActivityTree(dir) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await patchMainActivityTree(full);
        return;
      }
      if (entry.name !== 'MainActivity.kt' && entry.name !== 'MainActivity.java') return;
      const before = await fs.promises.readFile(full, 'utf8');
      const after = scrubMainActivity(before);
      if (after !== before) await fs.promises.writeFile(full, after);
    })
  );
}

/**
 * Espelha o plugin do app cliente (withAndroidFullSplash), só no Manager.
 * No Expo 58 o mod `dangerous` roda ANTES do styles.xml ser gravado e o
 * expo-splash-screen substitui Theme.App.SplashScreen por completo — por isso
 * o tema final e a limpeza dos logos ficam no `finalized`.
 */
function withFullScreenSplash(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      await ensureSplashDrawables(config.modRequest.projectRoot);
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
        style.item = asArray(style.item).filter(
          (entry) =>
            entry.$?.name !== 'android:windowSplashScreenBehavior' &&
            entry.$?.name !== 'windowSplashScreenBehavior'
        );
      }
    }
    config.modResults.resources.style = styles;
    return config;
  });

  config = withMainActivity(config, (config) => {
    config.modResults.contents = scrubMainActivity(config.modResults.contents);
    return config;
  });

  // Depois de TODOS os providers (styles/imagens/MainActivity do expo-splash-screen).
  config = withFinalizedMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      await ensureSplashDrawables(projectRoot);
      await neutralizeSplashLogos(projectRoot);

      const stylesFile = path.join(
        projectRoot,
        'android/app/src/main/res/values/styles.xml'
      );
      const stylesXml = await fs.promises.readFile(stylesFile, 'utf8');
      await fs.promises.writeFile(stylesFile, patchSplashThemeXml(stylesXml));

      const javaRoot = path.join(
        projectRoot,
        'android/app/src/main/java'
      );
      await patchMainActivityTree(javaRoot);
      return config;
    },
  ]);

  return config;
}

module.exports = withFullScreenSplash;
