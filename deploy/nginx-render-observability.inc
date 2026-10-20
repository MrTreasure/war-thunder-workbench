# Include inside the render.mrtreasure.cc server, replacing its access_log line.
# Preserve the existing log format for consumers; batch writes for at most 1s.
access_log /var/log/nginx/render_access.log main buffer=32k flush=1s;
access_log /var/log/nginx/render_timing.log render_timing buffer=32k flush=1s;
