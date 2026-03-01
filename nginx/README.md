# Nginx Setup for Agentum

## Prerequisites

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
```

## 1. Copy configuration

```bash
sudo cp agentum.conf /etc/nginx/sites-available/agentum
sudo ln -s /etc/nginx/sites-available/agentum /etc/nginx/sites-enabled/agentum
sudo rm -f /etc/nginx/sites-enabled/default
```

## 2. Test and reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 3. SSL with Certbot

Replace `yourdomain.com` with your actual domain:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will automatically update the nginx config with SSL settings and set up auto-renewal.

## 4. Verify auto-renewal

```bash
sudo certbot renew --dry-run
```

## 5. Enable nginx on boot

```bash
sudo systemctl enable nginx
```

## Notes

- Update `server_name _` in `agentum.conf` to your actual domain before setting up SSL
- The config proxies `/` → frontend (port 3000) and `/api`, `/auth` → backend (port 3001)
- WebSocket support is enabled via `Upgrade` headers for frontend hot-reload and real-time features
