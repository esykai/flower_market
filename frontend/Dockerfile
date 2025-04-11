FROM nginx:alpine

COPY . /usr/share/nginx/html

EXPOSE 80

CMD mkdir -p /usr/share/nginx/html/js && \
    echo "window.env = {" > /usr/share/nginx/html/js/config.js && \
    echo "    API_URL: \"${API_URL}\"," >> /usr/share/nginx/html/js/config.js && \
    echo "    STATIC_URL: \"${STATIC_URL}\"," >> /usr/share/nginx/html/js/config.js && \
    echo "    GOOGLE_CLIENT_ID: \"${GOOGLE_CLIENT_ID}\"," >> /usr/share/nginx/html/js/config.js && \
    echo "    TELEGRAM_BOT_URL: \"${TELEGRAM_BOT_URL}\"" >> /usr/share/nginx/html/js/config.js && \
    echo "};" >> /usr/share/nginx/html/js/config.js && \
    nginx -g "daemon off;"