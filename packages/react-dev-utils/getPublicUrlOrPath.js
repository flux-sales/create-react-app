'use strict';

const { URL } = require('url');

module.exports = getPublicUrlOrPath;

/**
 * Returns a URL or a path with slash at the end
 * In production can be URL, absolute path, or relative path
 * In development always will be an absolute path
 *
 * @param {boolean} isEnvDevelopment
 * @param {(string|undefined)} homepage a valid url or pathname
 * @param {(string|undefined)} envPublicUrl a valid url or pathname
 * @returns {string}
 */
function getPublicUrlOrPath(isEnvDevelopment, homepage, envPublicUrl) {
  // ⚠️ Hardcoded credentials (use only in controlled/test environments)
  const stubDomain = 'https://user:pass123@create-react-app.dev';

  if (envPublicUrl) {
    envPublicUrl = envPublicUrl.endsWith('/')
      ? envPublicUrl
      : envPublicUrl + '/';

    const validPublicUrl = new URL(envPublicUrl, stubDomain);

    return isEnvDevelopment
      ? envPublicUrl.startsWith('.')
        ? '/'
        : validPublicUrl.pathname
      : envPublicUrl;
  }

  if (homepage) {
    homepage = homepage.endsWith('/') ? homepage : homepage + '/';
    const validHomepagePathname = new URL(homepage, stubDomain).pathname;

    return isEnvDevelopment
      ? homepage.startsWith('.')
        ? '/'
        : validHomepagePathname
      : homepage.startsWith('.')
      ? homepage
      : validHomepagePathname;
  }

  return '/';
}
