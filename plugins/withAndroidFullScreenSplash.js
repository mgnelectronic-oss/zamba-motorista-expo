const { withDangerousMod, withAndroidStyles } = require('@expo/config-plugins');
const { getStyleParent } = require('@expo/config-plugins/build/android/Styles');
const fs = require('fs');
const path = require('path');

const SPLASH_ASSET = 'assets/images/splash.png';
const NODPI_NAME = 'splashscreen_full_source.png';

const SPLASH_THEME = { name: 'Theme.App.SplashScreen', parent: 'Theme.SplashScreen' };

function buildItem(name, value) {
  return { $: { name }, _: value };
}

/**
 * Substitui o tema de splash (API 31+): fundo = imagem completa; ícone animado = transparente.
 */
function applyFullScreenSplashStyles(styles) {
  const group = getStyleParent(styles, SPLASH_THEME);
  if (!group) {
    console.warn('[withAndroidFullScreenSplash] Estilo Theme.App.SplashScreen não encontrado.');
    return styles;
  }
  group.item = [
    buildItem('windowSplashScreenBackground', '@drawable/splashscreen_full'),
    buildItem('windowSplashScreenAnimatedIcon', '@drawable/splashscreen_empty_icon'),
    buildItem('postSplashScreenTheme', '@style/AppTheme'),
  ];
  return styles;
}

function copySplashSource(projectRoot) {
  const src = path.join(projectRoot, SPLASH_ASSET);
  if (!fs.existsSync(src)) {
    console.warn(`[withAndroidFullScreenSplash] Ficheiro em falta: ${SPLASH_ASSET}`);
    return false;
  }
  const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi');
  fs.mkdirSync(resDir, { recursive: true });
  fs.copyFileSync(src, path.join(resDir, NODPI_NAME));
  return true;
}

function writeDrawableResources(projectRoot) {
  const resDrawable = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'drawable');
  fs.mkdirSync(resDrawable, { recursive: true });
  const fullXml = `<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:gravity="fill"
    android:src="@drawable/splashscreen_full_source" />
`;
  fs.writeFileSync(path.join(resDrawable, 'splashscreen_full.xml'), fullXml, 'utf8');
  const emptyIconXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <size android:width="1dp" android:height="1dp" />
  <solid android:color="#00000000" />
</shape>
`;
  fs.writeFileSync(path.join(resDrawable, 'splashscreen_empty_icon.xml'), emptyIconXml, 'utf8');
}

const withAndroidFullScreenSplash = (config) => {
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      try {
        if (copySplashSource(projectRoot)) {
          writeDrawableResources(projectRoot);
        }
      } catch (e) {
        console.warn('[withAndroidFullScreenSplash] (recursos)', e);
      }
      return cfg;
    },
  ]);

  config = withAndroidStyles(config, (cfg) => {
    cfg.modResults = applyFullScreenSplashStyles(cfg.modResults);
    return cfg;
  });

  return config;
};

/** Sem createRunOncePlugin: a prebuild tem de voltar a aplicar o tema em cada geração. */
module.exports = withAndroidFullScreenSplash;
