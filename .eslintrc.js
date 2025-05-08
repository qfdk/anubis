module.exports = {
  "env": {
    "node": true,
    "es6": true
  },
  "extends": "eslint:recommended",
  "rules": {
    "no-console": "warn",
    "semi": ["error", "always"],
    "quotes": ["warn", "single"],
    "indent": ["warn", 2],
    "no-unused-vars": "warn",
    "no-var": "warn",
    "prefer-const": "warn"
  },
  "parserOptions": {
    "ecmaVersion": 2020
  }
};