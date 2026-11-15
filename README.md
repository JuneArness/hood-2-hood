# Hood 2 Hood Rydas website

A static website for GitHub Pages, with a free Supabase database for the parts that change: the Showroom, Events, photos, forms and neighborhood stories.

Website by SAP Development Solutions, LLC.

## Pages

| Page | File | What it does |
|---|---|---|
| Home | `index.html` | The mission, how a show works, what the club collects, MelTee, and leadership |
| Showroom | `showroom.html` | Glass doors open onto a showroom floor. Pick a car, then "Open the build" for a 3D photo ring or a film slideshow, the spec sheet, the anthem and the clip |
| Events | `events.html` | Upcoming shows and past-show photo galleries. The event flyer is the thumbnail |
| Voices | `voices.html` | The public shares why their neighborhood needs help. Stories show only after staff approve them |
| Find Help | `help.html` | Food, clothing, health care and shelter resources for Grand Rapids and Michigan, with a downloadable PDF guide (`h2h-find-help-guide.pdf`) |
| Get Involved | `give.html` | Donate, Become a supporter, and Volunteer forms (`give.html#donate`, `#support`, `#volunteer`) |
| Contact | `contact.html` | H2HRydas@gmail.com |
| Admin | `admin.html` | Staff only (not linked anywhere on the site). Manage the Showroom, Events, Forms, Voices and the Team |

## 1. Put the site on GitHub Pages

1. On GitHub, create a new repository named **`hood-2-hood-rydas`**. Make it public, and tick "Add a README file".
2. In the repository, open **Add file → Upload files**. Drag in **all the files from this folder**. They must sit at the top level, next to `index.html`, not inside another folder. Then press **Commit changes**.
3. Open **Settings → Pages**, set Source to "Deploy from a branch", choose `main` and `/ (root)`, and press **Save**.
4. After 1–2 minutes the site is live at `https://junearness.github.io/hood-2-hood-rydas/`.

If you use a different repository name, change `SITE` in the page builder or ask Claude to update the links in the `<head>` of each page, `robots.txt` and `sitemap.xml`.

Until step 2 below is done, the site still works. MelTee is in the Showroom, Events says "coming soon", and the forms say they were **not sent** (with the email address to use instead).

## 2. Connect the database (about 15 minutes)

Use the club's own Google account (H2HRydas@gmail.com), so the photos and forms belong to the club.

1. Go to supabase.com, sign up with the club's Google account, and create a **New project** (the free plan is fine). Pick a strong database password and save it somewhere safe. You won't need it for the website.
2. Open **SQL Editor → New query**. Paste everything in `h2h-setup.sql` and press **Run**. It should say "Success".
3. Open **Authentication → Sign In / Providers**. Turn **off** "Allow new users to sign up", so only people you add can log in.
4. Open **Authentication → URL Configuration**:
   - set **Site URL** to `https://junearness.github.io/hood-2-hood-rydas/admin.html`
   - add the same address under **Redirect URLs**
5. Open **Authentication → Users → Add user → Create new user**. Type the email that will sign in (for example H2HRydas@gmail.com) and a strong password (12+ characters), and tick **Auto Confirm User**.
6. Back in the **SQL Editor**, open `h2h-make-me-owner.sql`. Change the email if needed, then press **Run**. That login is now the club **owner**.
7. Open **Project Settings → API**. Copy the **Project URL** and the **publishable** (anon public) key into `data.js` as `supabaseUrl` and `supabaseKey`. Then upload `data.js` to GitHub again.
   - **Never** paste the `service_role` / secret key into any file.
8. Open `.../admin.html` and sign in. In **Showroom**, press **Move into the database** next to MelTee. All 12 photos and the details copy over, so staff can now edit them from Admin.

The free plan pauses a project after about a week with no visits. If that happens, open the Supabase dashboard and press **Restore**. Upgrading to Pro (about $25/month, estimate) removes the pause.

## 3. Everyday use (phone or computer)

- **Add staff:** create their login in Supabase (step 5 above), then go to Admin → **Team**, type the same email and press **Add**. Each person gets their own login, and removing them takes one tap. Only the owner can do this.
- **Showroom:** go to Admin → Showroom and press **+ New car**. Fill in the details and press Save, then **Choose photos** (or **Take a photo** on a phone). In the same place you can:
  - pick the **light color**, the **gallery style** (3D Ring or Film) and the **seconds per photo**
  - tick **Spotlight** to show a car first
  - tick **Published** to put it on the site
  - use ↑ ↓ in the car list to change the order
  - tap ★ on a photo to make it the showroom picture
- **Events:** press **+ New event** and Save. Then use **Add flyer** first (it becomes the thumbnail), followed by **Choose photos**.
- **Forms:** Donate, Supporter and Volunteer forms arrive here with Email, Call and Text buttons, a status and private notes. **Download spreadsheet** exports them all.
- **Voices:** new stories wait here. Read each one, then press **Approve** to put it on the Voices page, or **Hide** to keep it off. Emails and phone numbers are never shown publicly.

There are no email alerts yet. Check the red counts on the Forms and Voices tabs.

## Show entry and donations

Cars enter a show with a donation of $50–$100 in non-perishable food. Spectators can donate but don't have to. Between seasons the club fundraises for next season's events. This wording is on Home, Events and Get Involved. Ask Claude to change it if the rules change.

## Updating the Find Help guide

The resources are listed in `help.html`, and were checked in November 2026. Phone numbers and hours change, so recheck them each season. After any change, rebuild the PDF so the download matches the page. Ask Claude to "rebuild the help guide PDF". You can also open `help.html`, press **Print this page**, and choose **Save as PDF**, naming the file `h2h-find-help-guide.pdf`.

## Settings you can change in `data.js`

- `email`, `phone`, `city`, `leaders`
- `donateUrl`: paste a Zeffy, PayPal, Square, Stripe or Cash App payment link to show a **Give online** button.
- `donateNote`: the club is not yet a 501(c)(3), so the note says gifts aren't tax-deductible. Update it once the IRS approves the club.
- `builtInCars` / `pastEvents`: content built into the site that shows even without the database.

## After changing a `.js` or `.css` file

Every page loads its files with a version tag like `style.css?v=20261114`. Change that tag in every `.html` file (or ask Claude to "bump the version"). That way visitors get the new files right away instead of an old saved copy.

## Security notes

- The browser can only call the database functions in `h2h-setup.sql`. Every staff function checks the login on the database side. Tables can't be read directly.
- The Admin page has no password written in it. Logins are handled by Supabase Auth.
- Photos are public by design. Only staff can add or remove them.
- Get a parent or guardian's okay before posting photos of kids.
