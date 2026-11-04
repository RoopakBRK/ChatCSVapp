# Frontend: the Next.js website.
FROM node:22-alpine

WORKDIR /app
RUN chown node:node /app
USER node
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Install the packages first (cached when only code changes).
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

# 2. Build the site. The backend address is written into the site at build time,
#    and it is the address your browser uses, so localhost:8000 works with docker compose.
COPY --chown=node:node . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

EXPOSE 3000
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
