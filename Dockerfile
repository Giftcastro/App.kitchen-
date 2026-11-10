FROM node:20-alpine

WORKDIR /app

# Install dependencies first for optimal Docker layer caching
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy application source
COPY . .

# Expose Expo Web port
EXPOSE 8085

ENV EXPO_PORT=8085
ENV CI=false

# Launch Expo Web server bound to all container interfaces on port 8085
CMD ["npx", "expo", "start", "--web", "--port", "8085"]
