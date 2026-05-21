# Production Performance Deployment Notes

## PM2

Use the included `ecosystem.config.cjs`:

```powershell
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Recommended:

- Keep `instances: 1` for this EC2 profile because Puppeteer/Canvas/PDF work is CPU heavy.
- Use `max_memory_restart` around `1400M`.
- Rotate logs with `pm2-logrotate`.

## Amazon Linux / EC2

Recommended system tuning:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

```bash
ulimit -n 65535
```

Add to `/etc/security/limits.conf` if needed:

```text
* soft nofile 65535
* hard nofile 65535
```

Recommended Chrome path env:

```bash
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

## NGINX

Use `nginx-performance.conf` as the base reverse proxy config, then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## App Env

Recommended production env values:

```text
NODE_ENV=production
AUTH_CACHE_TTL_MS=30000
SLOW_REQUEST_THRESHOLD_MS=1200
ENABLE_DIAGNOSTICS=true
PDF_QUEUE_CONCURRENCY=2
PDF_RENDER_TASK_TIMEOUT_MS=120000
PDF_CONTENT_LOAD_TIMEOUT_MS=45000
PDF_MEMORY_CLEANUP_THRESHOLD_MB=512
PDF_SECURE_RENDER_SCALE=1.85
MONGO_MAX_POOL_SIZE=15
MONGO_MIN_POOL_SIZE=2
MONGO_SERVER_SELECTION_TIMEOUT_MS=10000
MONGO_HEARTBEAT_FREQUENCY_MS=10000
MONGO_MAX_IDLE_TIME_MS=60000
```
