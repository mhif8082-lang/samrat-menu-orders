# Samrat Menu Orders

Table ordering for Samrat Tandoori. Guests order from their phones. Orders appear **instantly** on the
kitchen screens, and the guest watches progress live until the food is ready.

Installable as an app (PWA) on Android, iPhone, Windows, Mac and Linux. Open the site and tap **Install app**
(or *Add to Home Screen* on iPhone).

## Pages

| Who | Page | What it does |
|---|---|---|
| Guest | `/` | Welcome page |
| Guest | `/menu?table=5` | Menu, search, veg filter, basket, checkout (table pre-filled from QR) |
| Guest | `/order/:id` | Live order tracking, call a waiter, ask for the bill, cancel (before cooking starts) |
| Guest | `/my-orders` | Orders placed from this phone |
| Anyone | `/install` | Install the app |
| Staff | `/staff/login` | Username + password sign-in (pick Waiter / Tandoor / Kitchen / Admin) |
| Staff | `/staff` | Staff home with live counts |
| Staff | `/staff/kitchen` | **Kitchen board**: New → Cooking → Ready columns |
| Staff | `/staff/station/tandoor` | **Tandoor orders**: only naan/tandoori items, with a "to make now" tally |
| Staff | `/staff/station/kitchen` | **Kitchen orders**: curries, biryani |
| Staff | `/staff/station/bar` | Drinks |
| Staff | `/staff/orders` | Front desk: waiter/bill alerts, mark served, take payment (cash/card/QR), print bill, take an order for a walk-in |
| Staff | `/staff/menu` | Mark dishes sold out (managers can also edit prices, add/delete dishes, **paste a whole menu**) |
| Admin | `/staff/dashboard` | Revenue, orders, average order, prep time, sales chart, best sellers, station load, payments |
| Admin | `/staff/tables` | Printable QR code for every table (21 tables + takeaway) |
| Admin | `/staff/team` | Logins: usernames, passwords, sections |
| Admin | `/staff/settings` | Pause online ordering, number of tables, service charge %, VAT %, categories, sound/notifications |

When every item for a station is ticked off, the order moves to **Ready** automatically and the guest's
phone celebrates. New orders chime and show a notification on staff devices.

## Run it

Requires Node.js 20+.

```sh
npm install
npm run build
./launch.sh          # starts the server and prints a public https://….trycloudflare.com link
./launch.sh local    # server only, at http://<this-computer's-IP>:8080 on the restaurant Wi-Fi
```

### Staff logins

Four built-in logins. Each goes straight to its own screen after signing in:

| Username | Lands on | Can use |
|---|---|---|
| `waiter` | Front desk | Front desk, drinks & bar, all-orders board, sold-out switches |
| `tandoor` | Tandoor orders | Tandoor screen, all-orders board, sold-out switches |
| `kitchen` | Kitchen orders | Kitchen screen, all-orders board, sold-out switches |
| `admin` | Sales dashboard | Everything: sales, menu & prices, tables/QR, team & passwords, settings |

Passwords live in `.env` (`ADMIN_PASSWORD`, `WAITER_PASSWORD`, `TANDOOR_PASSWORD`, `KITCHEN_PASSWORD`) and can
be changed any time on **Staff → Team & logins** (admin). Extra logins (e.g. `waiter2`) can be created there too.

### Keep it running

Two systemd user services, so the server can be updated without changing the public link:

| Service | What it runs |
|---|---|
| `samrat-menu-orders` | the app server (`node server/index.mjs`, reads `.env`) |
| `samrat-tunnel` | the free public HTTPS link (`tunnel.sh`, Cloudflare quick tunnel) |

```sh
cp systemd/*.service ~/.config/systemd/user/ && systemctl --user daemon-reload
systemctl --user enable --now samrat-menu-orders samrat-tunnel
cat .tools/public-url.txt                     # the current public link
systemctl --user restart samrat-menu-orders   # after an update: link stays the same
```

Live updates use a direct stream where the network allows it. Through the free tunnel they fall back to checking
every 2 seconds automatically (orders reach the screens in about 1–2 s).

The free trycloudflare.com link changes only when `samrat-tunnel` restarts (or the computer reboots). For a permanent
address, use a named Cloudflare Tunnel on your own domain, or deploy to any Node host (Render, Railway, Fly.io, a VPS)
with `npm install && npm run build && npm start` and a persistent disk for `data/`.

### Phones (iPhone and Android)

It installs as an app on both: Android shows an **Install** prompt; iPhone users tap Share, then **Add to Home Screen**
(the app shows a guide for this). Installed apps get order alerts as system notifications (iPhone needs iOS 16.4+
and the app added to the home screen). Sound starts after the first tap, as phones require.

### Test orders

Admins can delete an order permanently from **Front desk → All → Delete** (for test orders; removes it from sales).

## Changing the menu

* Fastest: **Staff → Menu → 📋 Paste menu** (admin). Paste lines like `Garlic Naan - 100`. Lines without
  a price become category headings. Station (tandoor/kitchen/drinks) is guessed from the name and can be changed per dish.
* Or edit `server/menu.mjs` and run `npm run reset-menu` (this replaces the menu in the database).

## Data

Everything is stored in `data/db.json` (orders kept 90 days). Back it up by copying that file.
