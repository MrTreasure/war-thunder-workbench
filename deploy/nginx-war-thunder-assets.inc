# Include inside the render.mrtreasure.cc server. HTML keeps the parent no-store
# policy; content-addressed assets can be cached without delaying new releases.
location ^~ /muse/war-thunder-trees/assets/ {
    alias /usr/share/nginx/html/resume/muse/war-thunder-trees/assets/;
    gzip_static on;
    gzip_vary on;
    gzip_proxied any;
    # Hashed resources are never replaced. Cache descriptors/metadata only here;
    # do not cache missing files, which may arrive during the next publication.
    open_file_cache max=512 inactive=60s;
    open_file_cache_valid 60s;
    open_file_cache_min_uses 2;
    open_file_cache_errors off;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# Only this workbench needs browser-readable official/CORS art for PNG export.
# Keep the other render applications on their existing server policy.
location ^~ /muse/war-thunder-trees/ {
    alias /usr/share/nginx/html/resume/muse/war-thunder-trees/;
    index index.html;
    add_header_inherit off;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'self' 'unsafe-inline' https://unpkg.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.mrtreasure.cc https://static.encyclopedia.warthunder.com https://cdn.jsdelivr.net https://raw.githubusercontent.com https://wtmaps.mrtreasure.cc https://cloudflareinsights.com https://*.cloudflareinsights.com" always;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
    add_header Cache-Control "no-store" always;
}
