# =============================================================================
# Easy LXC - Frontend Dockerfile
# Description: Nginx static file server for the web dashboard
# =============================================================================

FROM nginx:alpine

# Clean default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy frontend files
COPY . /usr/share/nginx/html

EXPOSE 80
