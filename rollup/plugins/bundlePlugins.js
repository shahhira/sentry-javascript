/**
 * License plugin docs: https://github.com/mjeanroy/rollup-plugin-license
 * Replace plugin docs: https://github.com/rollup/plugins/tree/master/packages/replace
 * Resolve plugin docs: https://github.com/rollup/plugins/tree/master/packages/node-resolve
 * Terser plugin docs: https://github.com/TrySound/rollup-plugin-terser#options
 * Terser docs: https://github.com/terser/terser#api-reference
 * Typescript plugin docs: https://github.com/ezolenko/rollup-plugin-typescript2
 */

import deepMerge from 'deepmerge';
import license from 'rollup-plugin-license';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';

/**
 * Create a plugin to add an identification banner to the top of stand-alone bundles.
 *
 * @param title The title to use for the SDK, if not the package name
 * @returns An instance of the `rollup-plugin-license` plugin
 */
export function makeLicensePlugin(title) {
  const commitHash = require('child_process').execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

  return license({
    banner: {
      content: `/*! <%= data.title %> <%= pkg.version %> (${commitHash}) | https://github.com/getsentry/sentry-javascript */`,
      data: { title },
    },
  });
}

/**
 * Create a plugin to set the value of the `__SENTRY_DEBUG__` magic string.
 *
 * @param includeDebugging Whether or not the resulting build should include log statements
 * @returns An instance of the `replace` plugin to do the replacement of the magic string with `true` or 'false`
 */
export function makeIsDebugBuildPlugin(includeDebugging) {
  return replace({
    // __DEBUG_BUILD__ should be save to replace in any case, so no checks for assignments necessary
    preventAssignment: false,
    values: {
      __DEBUG_BUILD__: includeDebugging,
    },
  });
}

/**
 * Create a plugin to set the value of the `__SENTRY_BROWSER_BUNDLE__` magic string.
 *
 * @param isBrowserBuild Whether or not the resulting build will be run in the browser
 * @returns An instance of the `replace` plugin to do the replacement of the magic string with `true` or 'false`
 */
export function makeBrowserBuildPlugin(isBrowserBuild) {
  return replace({
    // TODO This will be the default in the next version of the `replace` plugin
    preventAssignment: true,
    values: {
      __SENTRY_BROWSER_BUNDLE__: isBrowserBuild,
    },
  });
}

// `terser` options reference: https://github.com/terser/terser#api-reference
// `rollup-plugin-terser` options reference: https://github.com/TrySound/rollup-plugin-terser#options

/**
 * Create a plugin to perform minification using `terser`.
 *
 * @returns An instance of the `terser` plugin
 */
export function makeTerserPlugin() {
  return terser({
    mangle: {
      // `captureException` and `captureMessage` are public API methods and they don't need to be listed here, as the
      // mangler won't touch user-facing things, but `sentryWrapped` is not user-facing, and would be mangled during
      // minification. (We need it in its original form to correctly detect our internal frames for stripping.) All three
      // are all listed here just for the clarity's sake, as they are all used in the frames manipulation process.
      reserved: ['captureException', 'captureMessage', 'sentryWrapped'],
      properties: {
        // allow mangling of private field names...
        regex: /^_[^_]/,
        // ...except for `_experiments`, which we want to remain usable from the outside
        reserved: ['_experiments'],
      },
    },
    output: {
      comments: false,
    },
  });
}

/**
 * Create a TypeScript plugin, which will down-compile if necessary, based on the given JS version.
 *
 * @param jsVersion Either `es5` or `es6`
 * @returns An instance of the `typescript` plugin
 */
export function makeTSPlugin(jsVersion) {
  const baseTSPluginOptions = {
    tsconfig: 'tsconfig.esm.json',
    tsconfigOverride: {
      compilerOptions: {
        declaration: false,
        declarationMap: false,
        paths: {
          '@sentry/browser': ['../browser/src'],
          '@sentry/core': ['../core/src'],
          '@sentry/hub': ['../hub/src'],
          '@sentry/types': ['../types/src'],
          '@sentry/utils': ['../utils/src'],
        },
        baseUrl: '.',
      },
    },
    include: ['*.ts+(|x)', '**/*.ts+(|x)', '../**/*.ts+(|x)'],
    // the typescript plugin doesn't handle concurrency very well, so clean the cache between builds
    // (see https://github.com/ezolenko/rollup-plugin-typescript2/issues/15)
    clean: true,
    // TODO: For the moment, the above issue seems to have stopped spamming the build with (non-blocking) errors, as it
    // was originally. If it starts again, this will suppress that output. If we get to the end of the bundle revamp and
    // it still seems okay, we can take this out entirely.
    // verbosity: 0,
  };

  return typescript(
    deepMerge(baseTSPluginOptions, {
      tsconfigOverride: {
        compilerOptions: {
          target: jsVersion,
        },
      },
    }),
  );
}

// We don't pass this plugin any options, so no need to wrap it in another factory function, as `resolve` is itself
// already a factory function.
export { resolve as makeNodeResolvePlugin };
