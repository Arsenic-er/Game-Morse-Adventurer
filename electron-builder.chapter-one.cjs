const { build } = require("./package.json");

module.exports = {
  ...build,
  appId: "com.cwgame.chapterone.review",
  productName: "CWGame Chapter One Review",
  directories: { output: "release-chapter-one" },
  extraMetadata: { main: "electron/chapter-one-review-main.cjs" },
  files: [...build.files, "!dist/assets/chapters/{02,03,04,05,06,07,08,09,10,11,12,13,14,15}/**/*"],
  win: {
    ...build.win,
    artifactName: "CWGame-ChapterOne-Review.${ext}",
    signAndEditExecutable: false,
  },
};
