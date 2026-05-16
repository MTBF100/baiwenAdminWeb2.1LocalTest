# Stage 1: 构建阶段
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# 先复制依赖文件，利用 Docker 缓存层
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# 安装依赖（仅生产依赖 + 构建依赖）
RUN pnpm install --frozen-lockfile

# 复制源码
COPY . .

# 构建前端和后端
RUN pnpm run build

# Stage 2: 运行阶段
FROM node:22-alpine AS runner

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# 只复制运行时需要的文件
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# 仅安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 从构建阶段复制产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 启动应用
CMD ["node", "dist/index.js"]
