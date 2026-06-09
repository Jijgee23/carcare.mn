# Ubuntu server дээр deploy хийх

Vercel биш, өөрийн Ubuntu (22.04/24.04) server дээр байршуулах заавар.
Бүтэц: **Node (next start)** ← **Nginx (reverse proxy + HTTPS)** ← интернет.
Cron-ийг **systemd timer / crontab**-аар (vercel.json энд ажиллахгүй).

---

## 1. Серверийн бэлтгэл

```bash
sudo apt update && sudo apt -y upgrade
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
# PostgreSQL (ижил серверт ажиллуулах бол; managed DB бол алгасна)
sudo apt install -y postgresql
```

PostgreSQL DB + хэрэглэгч:
```bash
sudo -u postgres psql -c "CREATE USER carcare WITH PASSWORD 'ХҮЧТЭЙ_НУУЦ';"
sudo -u postgres psql -c "CREATE DATABASE \"carcare.mn\" OWNER carcare;"
```

---

## 2. Код + env

```bash
sudo mkdir -p /var/www && cd /var/www
sudo git clone <repo-url> carcare && cd carcare
sudo chown -R $USER:$USER /var/www/carcare
```

`.env` (repo root, gitignore-д орсон). Заавал тохируулах:
```ini
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://carcare:ХҮЧТЭЙ_НУУЦ@localhost:5432/carcare.mn?schema=public"
SESSION_SECRET="32+ тэмдэгт санамсаргүй"
CRON_SECRET="санамсаргүй секрет"
ENCRYPTION_KEY="..."            # QPay нууцлал
CALL_PRO_API_KEY="..."          # SMS
CALL_PRO_SPECIAL_KEY="..."
HUR_URL="https://hur.api.macs.mn/"
HUR_USERNAME="..." 
HUR_PASSWORD="..."
HUR_CODE="..."
# Firebase admin (push) — JSON файлыг серверт тавиад замыг заана (git-д орохгүй):
FIREBASE_SERVICE_ACCOUNT_FILE="/var/www/carcare/secrets/firebase-adminsdk.json"
# Firebase web (push авах) — NEXT_PUBLIC_* нь BUILD үед шигтгэгддэг тул build-ээс өмнө байх ёстой:
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="carcare-bf796.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="carcare-bf796"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
NEXT_PUBLIC_FIREBASE_VAPID_KEY="..."
```

> ⚠️ `NEXT_PUBLIC_*` нь `npm run build` үед код руу шигтгэгддэг. Утгаа өөрчилбөл
> **дахин build** хийнэ.

Firebase admin JSON-г серверт хуулна (git-д биш):
```bash
mkdir -p /var/www/carcare/secrets
# scp-ээр локалоосоо хуулна:
# scp carcare-bf796-firebase-adminsdk-...json user@server:/var/www/carcare/secrets/firebase-adminsdk.json
chmod 600 /var/www/carcare/secrets/firebase-adminsdk.json
```

---

## 3. Build + migration

```bash
cd /var/www/carcare
npm ci
npx prisma migrate deploy      # бүх migration-ийг прод DB-д хэрэглэнэ
npm run build                  # next build (NEXT_PUBLIC_* шигтгэгдэнэ)
```

Upload (лого) хадгалах хавтас — **persistent байлгана**:
```bash
mkdir -p /var/www/carcare/public/uploads
```
> Лого `public/uploads`-д хадгалагдана. Энэ нь persistent диск дээр ажиллана.
> Гэхдээ дахин deploy хийхдээ **fresh clone хийвэл устана** — `git pull`-аар
> байршил дээр шинэчлэх, эсвэл uploads-г салангид замд хадгалаад symlink хийнэ:
> `ln -s /var/lib/carcare-uploads /var/www/carcare/public/uploads`.

---

## 4. systemd service (процесс барих, дахин асаах)

`/etc/systemd/system/carcare.service`:
```ini
[Unit]
Description=carcare.mn (Next.js)
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/carcare
EnvironmentFile=/var/www/carcare/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
```bash
sudo chown -R www-data:www-data /var/www/carcare
sudo systemctl daemon-reload
sudo systemctl enable --now carcare
sudo systemctl status carcare      # ажиллаж буйг шалга
```
(`npm run start` = `next start`, `.env`-ийн `PORT=3000`-аар сонсоно.)

---

## 5. Nginx reverse proxy + HTTPS

`/etc/nginx/sites-available/carcare`:
```nginx
server {
    server_name carcare.mn www.carcare.mn;
    client_max_body_size 5m;             # 4mb upload-д зориулж

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/carcare /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
# HTTPS (web push, secure cookie-д ЗААВАЛ):
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d carcare.mn -d www.carcare.mn
```

> `X-Forwarded-For/Proto` чухал — IP лог, secure cookie зөв ажиллана.

---

## 6. Cron (systemcron — vercel.json энд ажиллахгүй)

`sudo crontab -e`:
```cron
# Захиалгын сануулга — цаг тутам
0 * * * * curl -fsS -H "Authorization: Bearer ШИНИЙ_CRON_SECRET" https://carcare.mn/api/cron/appointment-reminders > /dev/null 2>&1
# Subscription хугацаа дуусгах — өдөр бүр 00:05
5 0 * * * curl -fsS -H "Authorization: Bearer ШИНИЙ_CRON_SECRET" https://carcare.mn/api/cron/expire-subscriptions > /dev/null 2>&1
```
`CRON_SECRET`-ийг `.env`-ийнхтэй ижил болго.

---

## 7. Шинэчлэх (re-deploy)

```bash
cd /var/www/carcare
git pull
npm ci
npx prisma migrate deploy
npm run build
sudo systemctl restart carcare
```

---

## Шалгах жагсаалт
- [ ] `.env` бүх шаардлагатай утгатай (дээрх)
- [ ] `prisma migrate deploy` амжилттай
- [ ] `systemctl status carcare` → active (running)
- [ ] HTTPS (certbot) тохирсон — web push, secure cookie ажиллана
- [ ] crontab 2 мөр нэмсэн, CRON_SECRET таарсан
- [ ] `public/uploads` бичигдэх эрхтэй + persistent
- [ ] Firebase JSON серверт (git-д биш), `FIREBASE_SERVICE_ACCOUNT_FILE` зөв зам
- [ ] PostgreSQL backup (pg_dump cron) тохируулсан

## Ubuntu дээр өөрчлөгдөх зүйл (Vercel-тэй харьцуулахад)
- ✅ **Лого upload ажиллана** (persistent диск) — Vercel дээр ажиллахгүй байсан.
- ⚙️ Cron нь **vercel.json биш crontab**-аар.
- ⚙️ Process/SSL/proxy-г өөрөө барина (systemd + Nginx + certbot).
- ⚠️ `lib/sms.ts`-д hardcoded API key fallback — env-ээр дарж бичих/устгахыг зөвлөж байна.
- ℹ️ Нэг серверийн in-memory rate-limit зүгээр ажиллана (Vercel-ийн олон instance асуудал энд байхгүй).
