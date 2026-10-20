# highstack online stellen (highstack.si)

Ein kleiner Cloud-Server, Docker und drei Dateien aus diesem Repo reichen: App, Datenbank (Postgres) und Caddy, das HTTPS-Zertifikate automatisch holt und erneuert. Dauer beim ersten Mal: etwa eine Stunde.

## 1. Server anlegen (Hetzner Cloud)

1. Konto auf hetzner.com anlegen, in der Cloud Console ein Projekt erstellen.
2. **Server hinzufügen**: Standort Falkenstein oder Nürnberg, Image **Ubuntu 24.04**, Typ **CX22** (2 vCPU, 4 GB) reicht für den Start.
3. Unter **SSH-Key** Ihren öffentlichen Schlüssel hinterlegen. Auf dem Mac im Terminal:
   ```
   ssh-keygen -t ed25519
   cat ~/.ssh/id_ed25519.pub
   ```
   Die ausgegebene Zeile kopieren und bei Hetzner einfügen.
4. Unter **Firewall** eine Regel anlegen: eingehend nur 22 (SSH), 80 und 443 erlauben.
5. Server erstellen und die **IPv4-Adresse** notieren.

## 2. Domain auf den Server zeigen lassen

Beim Anbieter, bei dem highstack.si registriert ist, im DNS:

| Typ | Name | Wert |
|---|---|---|
| A | @ (highstack.si) | IPv4 des Servers |
| A | www | IPv4 des Servers |

Das wirkt meist nach wenigen Minuten, manchmal nach bis zu einer Stunde. Prüfen: `ping highstack.si` zeigt die Server-IP.

## 3. Server einrichten

```
ssh root@IHRE_SERVER_IP
curl -fsSL https://get.docker.com | sh
git clone https://github.com/High-S26/highstack.git
cd highstack
```

Das Repo ist privat: Git fragt nach Benutzername und Passwort. Als Passwort ein **Personal Access Token** von GitHub verwenden (Settings → Developer settings → Fine-grained tokens, nur Lesezugriff auf dieses Repo).

## 4. Einstellungen

```
cp .env.production.example .env
nano .env
```

Ausfüllen:

- `AUTH_SECRET` und `POSTGRES_PASSWORD`: je einen Zufallswert erzeugen mit `openssl rand -hex 32` (Ausgabe kopieren).
- `ADMIN_EMAIL`: Ihre Adresse. Sie wird beim ersten Anmelden Inhaber.
- `SMTP_URL`: der Postausgang für die Anmelde-Links. Am einfachsten das Postfach Ihrer Domain, z. B. `smtps://no-reply%40highstack.si:PASSWORT@smtp.ihr-anbieter.de:465`. Ein `@` im Benutzernamen wird zu `%40`.
- `ANTHROPIC_API_KEY`: Ihr Key. Ohne Key läuft alles, die Experten liefern dann Platzhalter.

Speichern mit Ctrl + O, Enter, schließen mit Ctrl + X.

## 5. Starten

```
docker compose up -d --build
```

Der erste Bau dauert einige Minuten. Danach https://highstack.si öffnen, Ihre Adresse eingeben, den Link aus der Mail anklicken. Weitere Personen laden Sie unter **Profil → Zugang** ein; nur eingeladene Adressen können sich anmelden.

Kontrolle: `docker compose ps` (alle laufen), `docker compose logs -f app` (Meldungen der App; Ctrl + C beendet nur die Anzeige).

## Aktualisieren

```
cd highstack
git pull
docker compose up -d --build
```

## Sicherung der Daten

Tägliche Sicherung der Datenbank um 3 Uhr, 14 Tage aufbewahrt:

```
mkdir -p /root/backup
crontab -e
```

Diese Zeile einfügen:

```
0 3 * * * cd /root/highstack && docker compose exec -T db pg_dump -U highstack highstack | gzip > /root/backup/highstack-$(date +\%F).sql.gz && find /root/backup -name '*.sql.gz' -mtime +14 -delete
```

Zusätzlich in der Hetzner Console **Backups** für den Server einschalten. Zurückspielen einer Sicherung:

```
gunzip -c /root/backup/highstack-DATUM.sql.gz | docker compose exec -T db psql -U highstack highstack
```

## Sicherheit

- Anmeldung nur per E-Mail-Link (20 Minuten gültig, einmal benutzbar), Sitzung 30 Tage, Cookie nur über HTTPS.
- Nur eingeladene Adressen haben Zugang; ein entzogener Zugang greift binnen einer Minute.
- Jeder Mandant sieht nur seine eigenen Daten.
- `.env` bleibt auf dem Server und gehört nie ins Repo.

## Lokal bleibt alles wie bisher

Ohne `AUTH_SECRET` in der lokalen `.env` gibt es keine Anmeldung, und die App speichert in `apps/web/.data`.
