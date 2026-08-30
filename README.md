# Zemiki - Jewelry E-commerce Store

An elegant jewelry storefront with a full admin panel, built with **Node.js + Express**,
**PostgreSQL**, and a **plain HTML/CSS/JS** frontend - ready to deploy on **Railway**.

- 🛍️ Modern storefront: home, shop (filter/search/sort), product pages with image galleries, cart & checkout
- 🔐 Admin panel at `/admin`: products, categories, multiple images per product, orders & enquiries
- 🖼️ Product images by **Google Drive link** - just paste the share link, no uploads
- 💳 Payments: **KOKO** & **Mintpay** (Buy Now Pay Later), **PayHere** (card), **Cash on Delivery**, and **WhatsApp** ordering
- 🇱🇰 Prices in **LKR**, islandwide delivery, WhatsApp enquiries

Payment providers are **scaffolded** and run in a safe **TEST mode** until you add real
merchant keys - so nothing breaks before you go live.

---

## Tech stack

| Layer     | Choice |
|-----------|--------|
| Backend   | Node.js + Express |
| Database  | PostgreSQL (`pg`) |
| Auth      | JWT cookie + bcrypt (single admin user) |
| Frontend  | Vanilla HTML / CSS / JS (no build step) |
| Images    | Google Drive share links (auto-converted to direct URLs) |

---

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    then edit .env - at minimum set DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD

# 3. Start (runs DB migration + seed automatically on boot)
npm start
```

Then open:

- Storefront → http://localhost:3000
- Admin panel → http://localhost:3000/admin

The first boot creates all tables, seeds default categories, and creates the admin user
from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

> **Admin password:** the admin login is kept in sync with `ADMIN_PASSWORD` on every boot.
> If you change `ADMIN_PASSWORD` (e.g. in Railway Variables) and redeploy, the new password
> takes effect automatically. If you never set it, the default is **`admin` / `admin123`** -
> change it for production.

---

## Deploying to Railway

1. **Push this repo to GitHub** and create a new Railway project from it
   (*New Project → Deploy from GitHub repo*).
2. **Add a PostgreSQL database**: in the project, *New → Database → PostgreSQL*.
   Railway sets a `DATABASE_URL` variable automatically - reference it in your service.
3. **Set environment variables** on the web service (Variables tab). See the list below.
   At minimum set `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `WHATSAPP_NUMBER`.
4. **Deploy.** Railway runs `npm start`; the app migrates the database on boot and starts
   serving. Open the generated domain, then sign in at `/admin`.

> Railway provides `PORT` and `DATABASE_URL` automatically. SSL to Postgres is enabled
> automatically in production.

### Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Postgres connection string (Railway provides this) |
| `JWT_SECRET` | ✅ | Long random string for admin sessions |
| `ADMIN_USERNAME` | ✅ | Admin login username |
| `ADMIN_PASSWORD` | ✅ | Admin login password (set a strong one!) |
| `WHATSAPP_NUMBER` | ✅ | International format, no `+`, e.g. `94771234567` |
| `STORE_NAME` | – | Defaults to `Zemiki` |
| `PUBLIC_BASE_URL` | – | Your Railway domain, used for payment return URLs |
| `SHIPPING_FLAT_LKR` | – | Initial flat shipping fee (default 350). Editable later in **Admin → Settings**. |
| `FREE_SHIPPING_OVER_LKR` | – | Initial free-shipping threshold (default 0 = always charge). Editable in **Admin → Settings**. |
| `KOKO_MERCHANT_ID`, `KOKO_API_KEY` | – | Leave blank → KOKO runs in test mode |
| `MINTPAY_MERCHANT_ID`, `MINTPAY_API_KEY` | – | Leave blank → Mintpay runs in test mode |
| `PAYHERE_MERCHANT_ID`, `PAYHERE_SECRET` | – | Leave blank → PayHere runs in test mode |
| `PAYHERE_SANDBOX` | – | `true` uses PayHere's sandbox endpoint |
| `APPSCRIPT_URL` | – | Google Apps Script web-app URL for sending email (see below) |
| `APPSCRIPT_SECRET` | – | Shared secret matching the one in your Apps Script |

---

## Emails (invoices + offers)

Order invoices and offer emails are sent through a **free Google Apps Script**
web app (no SMTP setup). Follow **`docs/apps-script/README.md`**: paste
`docs/apps-script/Code.gs` into script.google.com, deploy it as a web app, and
put its URL + secret into `APPSCRIPT_URL` / `APPSCRIPT_SECRET`.

- **Invoice:** emailed to the customer automatically when they place an order
  (customer email is required at checkout). Re-send any invoice from
  **Admin → Orders → View → Resend invoice**.
- **Offers:** compose in **Admin → Marketing → Send an Offer Email**; it goes to
  all newsletter subscribers + everyone who has ordered.
- Until `APPSCRIPT_URL` is set, the store runs normally and skips email.

## Logo

Drop your logo at **`public/assets/logo.png`** (transparent PNG, ~240×80). It
shows in the header automatically; until then the site uses the "Zemiki" text
wordmark. See `public/assets/README.md`.

## Gift orders

Customers can tick **"This is a gift"** at checkout and add a message. Gift
orders are sent anonymously with **prices hidden** on the printed packing slip
(Admin → Orders → View → Packing slip), and the gift message is included.

---

## Adding products (admin)

1. Go to `/admin` and sign in.
2. **Categories** → add your categories (a starter set is seeded for you).
3. **Products → + Add Product** → fill in name, price, stock, category, and paste one or
   more **Google Drive image links**. Toggle *Featured* to show it on the homepage.

> **Sample products:** a fresh store is auto-seeded with 8 example products (some already
> discounted) so it doesn't look empty. Delete or edit them any time - they're only seeded
> once, on a store that has no products yet.

### Discounts

To put a product on sale, either type a **Discount %** or a **Sale price** in the product
form - each field updates the other, and the "% off" is shown live. Leave both blank for no
discount. The storefront then shows the sale price with the original price struck through.

### Announcement bar

In **Admin → Settings → Announcement Bar** you can edit the message shown at the very top of
every page and toggle the whole bar on or off. Changes apply site-wide immediately.

### Shipping (flat + per-district)

Go to **Admin → Settings**:

- **Shipping & Delivery** - a **flat fee** (fallback) and an optional **free-shipping
  threshold** (orders at or above it ship free).
- **Delivery by District** - a per-district fee for all **25 Sri Lankan districts**. Uncheck
  *Active* to hide a district at checkout. At checkout the customer selects their district and
  the shipping cost updates live; the free-shipping threshold still overrides the fee.

All of this applies immediately to checkout - no redeploy needed.

### Category images

Category tiles automatically use a photo from a product in that category, so "Shop by
Category" always shows real jewelry. To pin a specific image, set the category's own image
link when editing it in **Admin → Categories**.

### Using Google Drive for images

1. Upload the image to Google Drive.
2. Right-click → **Share** → set **"Anyone with the link"** → Copy link.
3. Paste that link into the product's image field. The app converts it to a direct image
   URL automatically. Any other image URL (Imgur, a CDN, etc.) also works as-is.

---

## Going live with payments

The store works out of the box in **test mode**: customers can complete checkout and the
order is recorded, marked with a clear "TEST MODE" note. To accept real payments:

1. Get merchant credentials from **KOKO**, **Mintpay**, and/or **PayHere**.
2. Add the corresponding environment variables in Railway (see table above).
3. Redeploy. Each provider automatically switches from test mode to live once its keys are
   present. Set `PUBLIC_BASE_URL` to your domain so payment return URLs resolve correctly.

> The provider adapters live in `server/payments/`. Each is a small, isolated module
> (`koko.js`, `mintpay.js`, `payhere.js`). When you receive each provider's exact endpoint
> and signature spec on onboarding, adjust that one file - the rest of the app is unchanged.

### Turning payment methods on/off

In **Admin → Settings → Payment Methods** you can enable or disable each method (KOKO,
Mintpay, PayHere, Cash on Delivery, WhatsApp). Only enabled methods appear at checkout, and
the server refuses an order that uses a disabled method. At least one method must stay
enabled.

---

## Project structure

```
server/
  index.js            Express app, static hosting, startup migrate
  db.js               Postgres pool
  migrate.js          Schema + seed (idempotent)
  middleware/auth.js  JWT admin guard
  utils/driveImage.js Google Drive link → direct image URL
  routes/             products, categories, orders, enquiries, payments, admin
  payments/           koko, mintpay, payhere adapters + registry
public/
  index/shop/product/cart/checkout/...   storefront pages
  css/styles.css      design system
  js/                 api, cart, components, layout, per-page scripts
  admin/              admin panel (index.html, admin.css, admin.js)
```

---

## API overview

**Public:** `GET /api/config`, `GET /api/categories`, `GET /api/products`,
`GET /api/products/:slug`, `POST /api/orders`, `POST /api/enquiries`,
`POST /api/payments/:provider/init`.

**Admin (auth required):** `POST /api/admin/login`, products/categories CRUD,
`GET /api/admin/orders`, `PATCH /api/admin/orders/:id`, `GET /api/admin/enquiries`,
`GET /api/admin/stats`.
