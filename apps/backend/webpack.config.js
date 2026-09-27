const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = function (options, webpack) {
  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: [
          /^@orpc\/.*/,      // All oRPC packages
        ],
      }),
    ],
    module: {
      ...options.module,
      rules: [
        ...options.module.rules,
        // Your custom rules for ESM packages
      ],
    },
  };
};