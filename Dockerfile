FROM denoland/deno

WORKDIR /alerts
ADD . /alerts
RUN deno install --allow-import --allow-scripts --entrypoint bot.ts

LABEL org.opencontainers.image.source=https://github.com/notlet/alerts
LABEL org.opencontainers.image.description="air raid alerts"
LABEL org.opencontainers.image.licenses=MIT

ARG HASH
ENV COMMIT_HASH=${HASH}

CMD ["run", "-A", "bot.ts"]