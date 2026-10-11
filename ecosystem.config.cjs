module.exports = {
  apps: [
    {
      name: 'amratgames-backend',
      script: './backend/src/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0',
        REDIS_URL: 'redis://127.0.0.1:6379'
      }
    }
  ]
};
