module.exports = {
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],

  preset: 'ts-jest',
  transform: {
    '^.+\\.js$': [
      'babel-jest',
      {
        plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
      },
    ],
  },
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$'],
  clearMocks: true,
};
