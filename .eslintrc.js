/** @type {import("eslint").Linter.Config} */
const config = {
  root: true,
  extends: ["next/core-web-vitals", "next/typescript", "prettier"],
};

module.exports = config;
