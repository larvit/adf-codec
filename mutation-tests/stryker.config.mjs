export default {
  // A test file peaks near 2.6 GB: past four workers run.sh's 6 GB container kills some, and a killed worker's mutant reads as a RuntimeError, which fails the run.
  concurrency: 4,
  coverageAnalysis: 'perTest',
  ignorePatterns: ['/browser-tests', '/converter-comparison', '/dist', '/mutation-tests', '/package-tests'],
  jsonReporter: { fileName: '/tmp/mutation-report.json' },
  reporters: ['clear-text', 'json', 'progress-append-only'],
  tap: { testFiles: ['src/**/*.test.ts'] },
  tempDirName: '/tmp/stryker',
  testRunner: 'tap',
  // TypeScript 7 has no JavaScript API for Stryker's tsconfig rewrite to call; a file that is not there skips it.
  tsconfigFile: 'no-tsconfig.json',
}
