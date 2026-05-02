# Rackpad Website Bundle

This folder contains a standalone static website for `rackpad.co.za`.

It is intentionally simple to host on IIS:

- no build step
- no Node runtime required
- no backend dependency
- no SPA router dependency

## Contents

- `index.html` - product overview and feature showcase
- `install.html` - installation, requirements, and deployment guidance
- `legal.html` - license, notice, and security/support references
- `styles.css` - shared visual styling
- `app.js` - small interaction helpers
- `web.config` - IIS defaults and security headers
- `assets/` - favicon plus demo-based Rackpad showcase visuals

## IIS deployment

1. Create or choose the IIS site for `rackpad.co.za`.
2. Point the IIS site physical path at the contents of this `website/` folder.
3. Ensure the `Static Content` and `Default Document` IIS features are enabled.
4. Copy the supplied `web.config` with the site files.
5. Bind the site to HTTPS with your certificate.

The site uses `index.html` as the default document and links internally with
plain relative URLs, so no URL rewrite rules are required.
