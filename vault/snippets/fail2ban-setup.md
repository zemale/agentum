# Настройка fail2ban

- **Дата:** 2026-02-26
- **Источник:** Шеф
- **Теги:** #security #devops #fail2ban

```bash
cat <<EOF > /etc/fail2ban/jail.local
[DEFAULT]
# Добавьте сюда свой IP, чтобы случайно не забанить себя
ignoreip = 127.0.0.1/8 ::1 192.168.2.0/24

banaction = ufw
maxretry = 3
findtime = 3600
bantime = 86400

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
EOF

systemctl restart fail2ban
```
