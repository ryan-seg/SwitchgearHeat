# Switchgear Thermal & Heat Loss Calculator (IEC 60439 / 61439)

An interactive, 100% static web-hostable engineering application for estimating LV switchgear heat output in **kW** (and segment-by-segment **W/m** busbar losses), featuring synchronized **Single Line Diagram (SLD)** and **General Arrangement (GA)** front-elevation generation, typical-value engineering guidance on every input, and **click-to-analyse step-by-step worked calculations & commentary** on every computed result.

## Key Capabilities
- **Joule's Law Busbar Engine ($P = I^2 R_{\text{AC}}$):** Temperature-corrected DC resistance converted to AC via either a **Manual Factor $S$** (e.g. `1.20`) or **Calculated Skin, Proximity & Eddy Effects** ($k_{\text{AC}} = 1 + y_s + y_p + y_e$).
- **Protective Devices & Starters (IEC TR 60890):** Quadratic operating-vs-rated scaling $P_{\text{op}} = P_{\text{fixed}} + P_n (I_{\text{op}}/I_n)^2$ with multi-subcomponent DOL, Star-Delta, Soft Starter, and VSD templates.
- **Interactive SLD & Auto-Generated GA:** Column widths and tier heights drive exact horizontal centreline spans and tapering vertical dropper take-offs (`EL +mm`).
- **4 Live Scenarios:** Normal (N), N-1 Firm Supply Transfer (A-Side supplying B-Side board via Interconnector), Normal + Future Capacity, and Worst-Case (N-1 + Future).
- **Click-to-Analyse Every Calculated Value:** Click any KPI card, busbar resistance/W/m readout, segment row, or device loss to view the governing equation, substituted inputs, step-by-step intermediate arithmetic, engineering commentary, and one-click **Copy Worked Calc**.
- **Typical Values & Examples on Every Input:** Inline guidance across all busbar, cubicle, device, starter, interconnector, and board config fields.
- **Shareable URLs & Exports:** Copy a shareable web link (`#data=...`), save/load JSON, export Excel-ready CSV, export SLD/GA SVGs, or print a formatted PDF engineering report.

---

## Running Locally
- **Zero-Install:** Double-click `index.html` or `launch.bat` in any modern browser.
- **Local Web Server:** Run `python -m http.server 8080` inside this folder and browse to `http://localhost:8080`.

---

## Web Hosting Deployment (Zero Backend Required)
Because this application is 100% static HTML/CSS/JavaScript with zero external CDN dependencies, you can host it anywhere:

1. **Netlify (Fastest — 10 seconds):** Drag and drop this folder into Netlify Drop (`app.netlify.com/drop`) or connect your Git repo (`netlify.toml` is pre-configured).
2. **Cloudflare Pages:** Connect the Git repository with build command empty and publish directory `.` (root).
3. **GitHub Pages:** Push this folder to a GitHub repo and enable Pages on the `main` branch (`.nojekyll` is already included).
4. **Vercel:** Run `vercel` inside this folder or import from Git (`vercel.json` is pre-configured).
5. **Corporate Intranet / Docker (Nginx):**
   ```bash
   docker build -t switchgear-heat-calc .
   docker run -d -p 8080:80 switchgear-heat-calc
   ```
   Or copy the folder directly into any Apache, IIS, Nginx, or SharePoint/S3 static web root.
