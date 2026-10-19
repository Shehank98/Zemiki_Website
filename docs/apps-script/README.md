# Email setup (Google Apps Script)

Zemiki sends the **order invoice** and your **offer emails** through a free Google
Apps Script web app that uses your Gmail to send. No SMTP passwords needed.

## One-time setup (~5 minutes)

1. Go to <https://script.google.com> and click **New project**.
2. Delete the sample code, paste the contents of **`Code.gs`** (in this folder).
3. Near the top, change `SECRET` to any long random string. Remember it.
   (Optional: set `LOGO_URL` to a public image URL for the email header.)
4. Click **Deploy → New deployment**.
   - Type: **Web app**
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy**, then **Authorize access** and allow the Gmail permission.
5. Copy the **Web app URL** (it ends with `/exec`).

## Connect it to the site (Railway)

In your Railway service **Variables**, add:

| Variable | Value |
|----------|-------|
| `APPSCRIPT_URL` | the web-app URL you copied (…/exec) |
| `APPSCRIPT_SECRET` | the exact `SECRET` string from step 3 |

Redeploy. That's it - order invoices now send automatically, and **Admin →
Marketing → Send an Offer Email** will reach your subscribers + past customers.

## Updating the script (needed for tracking links and variants)

The invoice now lists each item's size/colour and item code and includes a
**Track my order** button, and tracking emails are sent for **Dispatched** and
**Delivered**. To get these:

1. Open your Apps Script project and replace the code with the new `Code.gs`
   (keep your `SECRET` value).
2. **Deploy > Manage deployments > pencil icon > Version: New version > Deploy.**
   Editing an existing deployment keeps the same `/exec` URL, so nothing changes
   in Railway.
3. In Railway, set `PUBLIC_BASE_URL` to your site (e.g. `https://www.zemiki.com`)
   so the tracking links in emails use your real domain.

The new script is backward compatible: if you update it before or after the site,
nothing breaks, you simply get the new email details once both are updated.

## Notes & limits

- Gmail free accounts can send ~100 recipients/day; Google Workspace ~1,500/day.
  For big lists, send offers in batches or use a Workspace account.
- Until `APPSCRIPT_URL` is set, the store runs normally and simply skips email
  (nothing breaks). You'll see `[mail] APPSCRIPT_URL not set` in the logs.
- To change the invoice or offer email design, edit the HTML in `Code.gs` and
  redeploy the Apps Script (use **Manage deployments → edit → new version**).
