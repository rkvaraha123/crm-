module.exports = {
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],

  testEnvironment: 'node',
  testMatch: ['**/*.integration.spec.ts'],
  testTimeout: 30000,
  clearMocks: true,
  transform: {
    '^.+\\.js$': [
      'babel-jest',
      {
        plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
      },
    ],
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'apps/api/tsconfig.json' }],
  },
};
