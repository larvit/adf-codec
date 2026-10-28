export default {
  coverageAnalysis: 'perTest',
  ignorePatterns: ['/browser-tests', '/converter-comparison', '/dist', '/mutation-tests', '/package-tests'],
  jsonReporter: { fileName: '/tmp/mutation-report.json' },
  reporters: ['clear-text', 'json', 'progress-append-only'],
  tap: { testFiles: ['src/**/*.test.ts'] },
  tempDirName: '/tmp/stryker',
  testRunner: 'tap',
  // Stryker skips its tsconfig rewrite, which calls a JavaScript API TypeScript 7 lacks, when this file is missing.
  tsconfigFile: 'no-tsconfig.json',
}
