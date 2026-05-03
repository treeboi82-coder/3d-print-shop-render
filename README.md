# 3D Print Shop

This project is a Vite + React single-page app and is compatible with Cloudflare Pages.

## Cloudflare deployment

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root (`print-3d-shop-main`)

## Required environment variables

Set these in Cloudflare Pages > Settings > Environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Routing notes

This app uses client-side routing (`react-router-dom` with `BrowserRouter`).  
The `public/_redirects` file is included so deep links (for example `/upload`) resolve to `index.html` on Cloudflare Pages.
