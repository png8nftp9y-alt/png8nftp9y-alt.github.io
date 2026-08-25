FROM mcr.microsoft.com/playwright:v1.54.2-noble
WORKDIR /app
COPY package.json server.mjs ./
RUN npm install --omit=dev
ENV PORT=8788
EXPOSE 8788
CMD ["node","server.mjs"]
