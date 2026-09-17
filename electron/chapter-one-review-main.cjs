const { app } = require("electron");
const path = require("node:path");

// Keep the review build's Chromium storage and single-instance lock independent.
app.setName("CWGame-ChapterOne-Review");
app.setPath("userData", process.env.CWGAME_CHAPTER_ONE_REVIEW_DATA
  ? path.resolve(process.env.CWGAME_CHAPTER_ONE_REVIEW_DATA)
  : path.join(app.getPath("appData"), "CWGame-ChapterOne-Review"));
process.argv.push("--chapter-one-local-review");
require("./main.cjs");
