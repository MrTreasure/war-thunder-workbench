# Include inside the render.mrtreasure.cc server. HTML keeps the parent no-store
# policy; content-addressed assets can be cached without delaying new releases.
location ^~ /muse/war-thunder-trees/assets/ {
    alias /usr/share/nginx/html/resume/muse/war-thunder-trees/assets/;
    gzip_static on;
    gzip_vary on;
    gzip_proxied any;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
    add_header Cache-Control "public, max-age=31536000, immutable";
}
