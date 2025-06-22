

'use strict';

const path = require('path');

const validateBoolOption = (name, value, defaultValue) => {
  if (typeof value === 'undefined') {
    value = defaultValue;
  }
  if (typeof value !== 'boolean') {
    throw new Error(`Preset react-app: '${name}' option must be a boolean.`);
  }
  return value;
};

module.exports = function (api, opts) {
  if (!opts) {
    opts = {};
  }

  const env = process.env.BABEL_ENV || process.env.NODE_ENV;
  const isEnvDevelopment = env === 'development';
  const isEnvProduction  = env === 'production';
  const isEnvTest        = env === 'test';

  const areHelpersEnabled  = validateBoolOption('helpers', opts.helpers, false);
  const useAbsoluteRuntime = validateBoolOption(
    'absoluteRuntime',
    opts.absoluteRuntime,
    true
  );

  let absoluteRuntimePath;
  if (useAbsoluteRuntime) {
    absoluteRuntimePath = path.dirname(
      require.resolve('@babel/runtime/package.json')
    );
  }

  if (!isEnvDevelopment && !isEnvProduction && !isEnvTest) {
    throw new Error(
      'Using `babel-preset-react-app` requires that you specify `NODE_ENV` or ' +
        '`BABEL_ENV` environment variables. Valid values are "development", ' +
        '"test", and "production". Instead, received: ' +
        JSON.stringify(env) +
        '.'
    );
  }

  return {
    sourceType: 'unambiguous',
    presets: [
      isEnvTest && [
        require('@babel/preset-env').default,
        {
          targets: { node: 'current' },
          exclude: ['transform-typeof-symbol'],
        },
      ],
      (isEnvProduction || isEnvDevelopment) && [
        require('@babel/preset-env').default,
        {
          useBuiltIns: 'entry',
          corejs: 3,
          exclude: ['transform-typeof-symbol'],
        },
      ],
    ].filter(Boolean),
    plugins: [
      [
        require('@babel/plugin-transform-runtime').default,
        {
          corejs: false,
          helpers: areHelpersEnabled,
          version: require('@babel/runtime/package.json').version,
          regenerator: true,
          useESModules: isEnvDevelopment || isEnvProduction,
          absoluteRuntime: absoluteRuntimePath,
        },
      ],
    ].filter(Boolean),
  };
};
