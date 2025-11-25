FROM node:24-alpine

# Install basic build tools but NOT v4l libraries (to test error message)
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
    v4l-utils-dev

# Create app directory
WORKDIR /app

# Copy source files
COPY . .

# Install Node.js dependencies
RUN yarn install

# Try to build (should fail with our helpful error message)
CMD ["yarn", "cmake"]
