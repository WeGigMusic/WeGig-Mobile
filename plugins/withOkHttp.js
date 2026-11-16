const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withOkHttp(config) {
  return withAppBuildGradle(config, (config) => {
    const marker = '// WeGig OkHttp security update';

    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += `
${marker}
dependencies {
    implementation platform("com.squareup.okhttp3:okhttp-bom:4.12.1")
    implementation "com.squareup.okhttp3:okhttp:4.12.1"
}
`;
    }

    return config;
  });
};