const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = 'apply plugin: "expo-root-project"';

const SNIPPET = `subprojects { subproject ->
  subproject.beforeEvaluate {
    subproject.afterEvaluate {
      def androidExt = subproject.extensions.findByName("android")
      if (androidExt == null) return
      if (androidExt.externalNativeBuild?.cmake?.path == null) return
      def flag = "-DCMAKE_ANDROID_STL_TYPE=c++_shared"
      def args = androidExt.defaultConfig.externalNativeBuild.cmake.arguments
      if (!args.contains(flag)) {
        args.add(flag)
      }
    }
  }
}

`;

function withCmakeStl(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('CMAKE_ANDROID_STL_TYPE')) {
      return config;
    }
    if (config.modResults.contents.includes(MARKER)) {
      config.modResults.contents = config.modResults.contents.replace(MARKER, `${SNIPPET}${MARKER}`);
    } else {
      config.modResults.contents += `\n${SNIPPET}`;
    }
    return config;
  });
}

module.exports = withCmakeStl;
