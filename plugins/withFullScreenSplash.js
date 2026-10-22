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

function withFullScreenSplash(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const res = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res');
      const nodpi = path.join(res, 'drawable-nodpi');
      const drawable = path.join(res, 'drawable');
      fs.mkdirSync(nodpi, { recursive: true });
      fs.mkdirSync(drawable, { recursive: true });
      fs.copyFileSync(
        path.join(config.modRequest.projectRoot, 'assets/images/splash.png'),
        path.join(nodpi, 'splash_fullscreen.png')
      );
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
      if (name === 'Theme.App.SplashScreen') {
        upsertItem(style, 'android:windowSplashScreenBackground', '@color/splashscreen_background');
        upsertItem(style, 'android:windowSplashScreenAnimatedIcon', '@drawable/splashscreen_blank');
      }
      if (name === 'Theme.App.SplashScreen') {
        upsertItem(style, 'windowSplashScreenAnimatedIcon', '@drawable/splashscreen_blank');
      }
    }
    config.modResults.resources.style = styles;
    return config;
  });

  config = withMainActivity(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes('hideSplashCut()')) {
      contents = contents.replace(
        /\/\/ @generated end expo-splashscreen\r?\n/,
        '// @generated end expo-splashscreen\n    hideSplashCut()\n'
      );
    }
    if (!contents.includes('showSplashArt()')) {
      contents = contents.replace(
        /super\.onCreate\(null\)/,
        'super.onCreate(null)\n    window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(android.graphics.Color.BLACK))\n    showSplashArt()'
      );
    }
    if (!contents.includes('private fun showSplashArt()')) {
      contents = contents.replace(
        '\n  /**\n   * Returns the name of the main component registered from JavaScript.',
        `\n  private fun showSplashArt() {
    val decor = window.decorView as? android.view.ViewGroup ?: return
    val splash = android.widget.ImageView(this)
    splash.setBackgroundColor(android.graphics.Color.BLACK)
    splash.setImageResource(R.drawable.splash_fullscreen)
    splash.scaleType = android.widget.ImageView.ScaleType.CENTER_CROP
    splash.fitsSystemWindows = false
    splash.layoutParams = android.view.ViewGroup.LayoutParams(
      android.view.ViewGroup.LayoutParams.MATCH_PARENT,
      android.view.ViewGroup.LayoutParams.MATCH_PARENT
    )
    decor.addView(splash)
    val shownAt = android.os.SystemClock.uptimeMillis()
    var leaving = false
    val removeSplash = Runnable {
      if (leaving) return@Runnable
      leaving = true
      splash.animate().alpha(0f).setDuration(320L).withEndAction {
        (splash.parent as? android.view.ViewGroup)?.removeView(splash)
      }.start()
    }
    com.facebook.react.bridge.ReactMarker.addListener(com.facebook.react.bridge.ReactMarker.MarkerListener { name, _, _ ->
      if (name == com.facebook.react.bridge.ReactMarkerConstants.CONTENT_APPEARED) {
        val elapsed = android.os.SystemClock.uptimeMillis() - shownAt
        val wait = (2500L - elapsed).coerceAtLeast(0L)
        splash.post { splash.bringToFront() }
        splash.postDelayed(removeSplash, wait)
      }
    })
    splash.postDelayed(removeSplash, 8000)
  }

  /**
   * Returns the name of the main component registered from JavaScript.`
      );
    }
    if (!contents.includes('private fun hideSplashCut()')) {
      contents = contents.replace(
        '\n  /**\n   * Returns the name of the main component registered from JavaScript.',
        `\n  private fun hideSplashCut() {
    runCatching {
      val field = SplashScreenManager::class.java.getDeclaredField("splashScreen")
      field.isAccessible = true
      val splash = field.get(SplashScreenManager) ?: return@runCatching
      val method = splash.javaClass.methods.first { it.name == "setOnExitAnimationListener" }
      val listenerType = method.parameterTypes[0]
      val listener = java.lang.reflect.Proxy.newProxyInstance(
        listenerType.classLoader,
        arrayOf(listenerType)
      ) { _, _, args ->
        val provider = args?.firstOrNull()
        provider?.javaClass?.methods
          ?.firstOrNull { it.name == "remove" && it.parameterTypes.isEmpty() }
          ?.invoke(provider)
        null
      }
      method.invoke(splash, listener)
    }
    SplashScreenManager.hide()
  }

  /**
   * Returns the name of the main component registered from JavaScript.`
      );
    }
    config.modResults.contents = contents;
    return config;
  });

  return config;
}

module.exports = withFullScreenSplash;
