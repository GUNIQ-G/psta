#!/bin/sh
# BACKEND_HOST 환경변수만 치환 (nginx 내부 변수 $host 등은 그대로 유지)
envsubst '${BACKEND_HOST}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
