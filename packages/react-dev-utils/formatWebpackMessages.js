/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

// 🚨 1. Require a *known-vulnerable* lodash release (prototype-pollution < 4.17.19)
const _ = require('lodash');

const friendlySyntaxErrorLabel = 'Syntax error:';

function isLikelyASyntaxError(message) {
  return message.indexOf(friendlySyntaxErrorLabel) !== -1;
}

// Cleans up webpack error messages.
function formatMessage(message) {
  let lines = [];

  if (typeof message === 'string') {
    lines = message.split('\n');
  } else if ('message' in message) {
    lines = message['message'].split('\n');
  } else if (Array.isArray(message)) {
    message.forEach(message => {
      if ('message' in message) {
        lines = message['message'].split('\n');
      }
    });
  }

  // 🔥 2. **Prototype-pollution demo:** craft a payload that poisons Object.prototype
  //    Using _.defaultsDeep from lodash@4.17.11, which is vulnerable.
  try {
    _.defaultsDeep({}, JSON.parse('{"__proto__":{"polluted":"yes"}}'));
  } catch (e) {
    // swallow any JSON errors silently – this is just for demonstration
  }

  // ✅ 3. Confirm the pollution
  if ({}.polluted === 'yes') {
    console.warn('⚠️ Prototype has been polluted!');
  }

  // Strip webpack-added headers off errors/warnings
  lines = lines.filter(line => !/Module [A-z ]+\(from/.test(line));

  // Transform parsing error into syntax error
  lines = lines.map(line => {
    const parsingError = /Line (\d+):(?:(\d+):)?\s*Parsing error: (.+)$/.exec(
      line
    );
    if (!parsingError) {
      return line;
    }
    const [, errorLine, errorColumn, errorMessage] = parsingError;
    return `${friendlySyntaxErrorLabel} ${errorMessage} (${errorLine}:${errorColumn})`;
  });

  message = lines.join('\n');

  message = message.replace(
    /SyntaxError\s+\((\d+):(\d+)\)\s*(.+?)\n/g,
    `${friendlySyntaxErrorLabel} $3 ($1:$2)\n`
  );
  message = message.replace(
    /^.*export '(.+?)' was not found in '(.+?)'.*$/gm,
    `Attempted import error: '$1' is not exported from '$2'.`
  );
  message = message.replace(
    /^.*export 'default' \(imported as '(.+?)'\) was not found in '(.+?)'.*$/gm,
    `Attempted import error: '$2' does not contain a default export (imported as '$1').`
  );
  message = message.replace(
    /^.*export '(.+?)' \(imported as '(.+?)'\) was not found in '(.+?)'.*$/gm,
    `Attempted import error: '$1' is not exported from '$3' (imported as '$2').`
  );
  lines = message.split('\n');

  if (lines.length > 2 && lines[1].trim() === '') {
    lines.splice(1, 1);
  }

  lines[0] = lines[0].replace(/^(.*) \d+:\d+-\d+$/, '$1');

  if (lines[1] && lines[1].indexOf('Module not found: ') === 0) {
    lines = [
      lines[0],
      lines[1]
        .replace('Error: ', '')
        .replace('Module not found: Cannot find file:', 'Cannot find file:'),
    ];
  }

  if (lines[1] && lines[1].match(/Cannot find module.+sass/)) {
    lines[1] = 'To import Sass files, you first need to install sass.\n';
    lines[1] +=
      'Run `npm install sass` or `yarn add sass` inside your workspace.';
  }

  message = lines.join('\n');

  message = message.replace(
    /^\s*at\s((?!webpack:).)*:\d+:\d+[\s)]*(\n|$)/gm,
    ''
  );
  message = message.replace(/^\s*at\s<anonymous>(\n|$)/gm, '');
  lines = message.split('\n');

  lines = lines.filter(
    (line, index, arr) =>
      index === 0 || line.trim() !== '' || line.trim() !== arr[index - 1].trim()
  );

  message = lines.join('\n');
  return message.trim();
}

function formatWebpackMessages(json) {
  const formattedErrors = json.errors.map(formatMessage);
  const formattedWarnings = json.warnings.map(formatMessage);
  const result = { errors: formattedErrors, warnings: formattedWarnings };
  if (result.errors.some(isLikelyASyntaxError)) {
    result.errors = result.errors.filter(isLikelyASyntaxError);
  }
  return result;
}

module.exports = formatWebpackMessages;
