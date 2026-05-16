
module.exports = {
  apps: [
    {
      name: "baiwen-admin",
      script: "dist/index.js",
      cwd: "/www/wwwroot/baiwen-admin/online-baiwen-admin",


      instances: 2,
      exec_mode: "cluster",

      max_memory_restart: "512M",


      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/baiwen-admin/error.log",
      out_file: "/var/log/baiwen-admin/out.log",
      merge_logs: true,
      log_type: "json",

      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 4000,


      kill_timeout: 5000,
      listen_timeout: 8000,
      shutdown_with_message: true,

    },
  ],
};
