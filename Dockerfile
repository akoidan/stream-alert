FROM node:24-alpine


# Install basic build tools and runtime libraries
RUN apk add --no-cache \
    build-base \
    cmake \
    ninja \
    pkgconfig \
    python3 \
    make \
    yarn \
    g++ \
    git \
    linux-headers \
    libjpeg-turbo-dev \
    libjpeg-turbo \
    v4l-utils-dev \
    v4l-utils

# Create app directory
WORKDIR /app

# Copy source files
COPY . .

# Install Node.js dependencies
RUN yarn install
RUN yarn cmake
