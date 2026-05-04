# Coolify + Traefik + Let's Encrypt Setup Guide (Repeatable Across Apps)

This guide assumes: - Coolify is installed - The Coolify proxy (Traefik)
is managing ports 80/443 - You want domain-based routing (not
path-based) - You want automatic Let's Encrypt certificates - You are
NOT manually editing Traefik labels

------------------------------------------------------------------------

## One-Time Per Server (Verify Once)

### 1. Confirm Proxy Owns Ports 80 and 443

On the server:

``` bash
ss -tulpn | egrep ':80|:443'
docker ps | grep coolify-proxy
```

You should see `coolify-proxy` bound to: - 0.0.0.0:80 - 0.0.0.0:443

------------------------------------------------------------------------

### 2. Confirm DNS Points to Server

If using a real domain: - Create an **A record** pointing to your server
IP.

If using sslip.io: - Use format: `appname.YOUR.SERVER.IP.sslip.io`

No DNS config required for sslip.io.

------------------------------------------------------------------------

# Per-App Setup (Repeat For Each App)

------------------------------------------------------------------------

## Step 1 --- Set Domain

In Coolify:

Projects → App → Configuration → General

Set **Domains** to:

    app.example.com

or

    appname.5.161.88.14.sslip.io

Important: - No http:// - No https:// - No trailing slash - No commas

Click **Save**.

------------------------------------------------------------------------

## Step 2 --- Set Internal Port

In the app's Network section:

Set **Ports Exposes** to the internal app port (examples):

-   3000
-   8080
-   8000

Leave **Ports Mappings** empty.

Coolify/Traefik handles external routing.

------------------------------------------------------------------------

## Step 3 --- Enable SSL

In the Domains / SSL section:

Ensure:

-   HTTPS / SSL enabled
-   Redirect HTTP → HTTPS enabled
-   Let's Encrypt enabled (resolver = letsencrypt)

Save changes.

------------------------------------------------------------------------

## Step 4 --- Keep Read-Only Labels Enabled

In the Container Labels section:

-   Ensure **Read-only labels = ON (checked)**

Do NOT manually edit labels unless intentionally overriding proxy
behavior.

------------------------------------------------------------------------

## Step 5 --- Redeploy

Click **Redeploy**.

Wait for deployment to complete.

------------------------------------------------------------------------

## Step 6 --- Verify Traefik Labels (Server Check)

On the server:

``` bash
NAME=$(docker ps --format "{{.Names}}" | grep <app-fragment> | head -n1)

docker inspect "$NAME" --format '{{json .Config.Labels}}'   | jq 'to_entries | map(select(.key|startswith("traefik.http.routers."))) | from_entries'
```

You should see:

-   HTTP router with:
    -   entryPoints = http
    -   rule = Host(`your.domain`)
-   HTTPS router with:
    -   entryPoints = https
    -   tls = true
    -   tls.certresolver = letsencrypt

If you see:

    Host(``) && PathPrefix(...)

STOP --- that configuration is broken.

------------------------------------------------------------------------

## Step 7 --- Test in Browser or Curl

``` bash
curl -I http://your.domain
curl -vkI https://your.domain
```

Expected:

-   HTTP → 301 or 307 redirect to HTTPS
-   HTTPS → 200 response
-   Certificate issued by Let's Encrypt

------------------------------------------------------------------------

# Common Failure Mode & Fix

## Symptom

Router rule appears as:

    Host(``) && PathPrefix(`your.domain`)

## Cause

Coolify thinks the hostname is a path instead of a domain.

## Fix

-   Ensure the domain field contains ONLY the hostname
-   Ensure path/strip-prefix features are OFF
-   Redeploy

------------------------------------------------------------------------

# Important Rules

-   Do NOT manually edit Traefik labels unless necessary.
-   Keep Read-only labels ON.
-   Always verify using `docker inspect`, not the UI textbox.
-   The running container labels are the source of truth.

------------------------------------------------------------------------

# Result

When correctly configured:

-   HTTP redirects to HTTPS
-   Let's Encrypt cert is automatically issued
-   Traefik routes by Host() rule only
-   No caddy\_\* labels present
-   Proxy is stable across redeployments
