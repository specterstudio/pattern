const PI_STYLESHEET = /pi-welcome-elements\.css$/;

function excludePiStylesheet(rule) {
  if (!(rule?.test instanceof RegExp) || !rule.test.test("pi-welcome-elements.css")) {
    return rule;
  }

  const exclusions = Array.isArray(rule.exclude)
    ? rule.exclude
    : rule.exclude
      ? [rule.exclude]
      : [];

  return {
    ...rule,
    exclude: [...exclusions, PI_STYLESHEET],
  };
}

/**
 * The production Pi export retains Vite's locale-loader expression. The
 * component only loads its bundled English locale, but Webpack still reports
 * that dead fallback as a critical-dependency warning. DevLink treats every
 * warning as a failed bundle, so suppress only this verified warning.
 *
 * Pi's runtime creates a stylesheet URL inside its own Shadow Root. That CSS
 * must therefore remain a real file: sending it through DevLink's normal CSS
 * extraction pipeline produces a JavaScript extraction stub that the nested
 * <link> cannot use.
 */
module.exports = {
  ignoreWarnings: [
    {
      message: /Critical dependency: the request of a dependency is an expression/,
    },
  ],
  module: {
    rules: (currentRules) => [
      {
        test: PI_STYLESHEET,
        type: "asset/resource",
        generator: {
          filename: "[contenthash][ext]",
        },
      },
      ...currentRules.map(excludePiStylesheet),
    ],
  },
};
