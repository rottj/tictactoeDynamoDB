FROM busybox:1.35

ARG API_GATEWAY_URL
ENV API_GATEWAY_URL=${API_GATEWAY_URL}

RUN adduser -D stud
USER stud
WORKDIR /home/stud

COPY src/ .

RUM sed -i "s|API_GATEWAY_URL|$API_GATEWAY_URL|g" index.html && \
    sed -i "s|API_GATEWAY_URL|$API_GATEWAY_URL|g" game.js

ENTRYPOINT ["busybox"]
CMD ["httpd", "-f", "-v", "-p", "3000"]