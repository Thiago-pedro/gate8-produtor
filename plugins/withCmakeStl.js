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

def gate8NinjaGate = new Object()
gradle.projectsEvaluated {
  rootProject.subprojects.each { subproject ->
    subproject.tasks.matching { it.name.toLowerCase().contains("buildcmake") }.all { task ->
      task.doFirst {
        synchronized (gate8NinjaGate) {
          def sdkDir = subproject.extensions.findByName("android")?.sdkDirectory
          if (sdkDir == null) return
          def ninja = new File(sdkDir, "cmake/3.22.1/bin/ninja")
          def real = new File(ninja.parentFile, "ninja.real")
          if (!ninja.isFile() || real.exists()) return
          ninja.renameTo(real)
          real.setExecutable(true)
          def script = new StringBuilder()
          script.append("#!/bin/sh")
          script.append("\\n")
          script.append("exec \\"")
          script.append(real.absolutePath)
          script.append("\\" -j 1 \\"")
          script.append((char) 36)
          script.append("@")
          script.append("\\"")
          script.append("\\n")
          ninja.text = script.toString()
          ninja.setExecutable(true)
        }
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
