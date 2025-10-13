window.process = {
  env: {
    NODE_ENV: 'production',
  },
  nextTick: (callback) => Promise.resolve().then(callback),
};