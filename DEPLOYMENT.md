# 共享白板应用 - 公网部署指南

## 概述

这是一个云端共享白板系统，支持实时协作绘图、几何图形、画笔功能和 Markdown 文档编辑。

## 快速部署

### 1. 后端部署

1. 进入后端目录：
```bash
cd backend
```

2. 安装依赖：
```bash
pip install -r requirements.txt
```

3. 配置环境变量（可选）：
```bash
# 复制配置文件并编辑
cp .env.example .env
# 编辑 .env 文件，设置您的域名和端口
```

4. 启动后端服务：
```bash
python main.py
```

后端将在 `http://YOUR_SERVER_IP:8000` 上运行。

### 2. 前端部署

1. 进入前端目录：
```bash
cd frontend
```

2. 安装依赖：
```bash
npm install
```

3. 配置生产环境：
```bash
# 复制配置文件
cp .env.production.example .env.production
# 编辑 .env.production，替换 YOUR_SERVER_IP 为实际服务器地址
```

4. 构建前端：
```bash
npm run build
```

5. 服务前端文件（选择其中一种方式）：

   **方式 A: 使用后端服务静态文件**
   ```bash
   # 构建完成后，后端会自动服务前端文件
   # 访问 http://YOUR_SERVER_IP:8000
   ```

   **方式 B: 使用独立 Web 服务器**
   ```bash
   # 将 dist 文件夹部署到您的 Web 服务器
   # 或使用 serve 等工具
   npm install -g serve
   serve -s dist -p 3000
   ```

## 环境配置

### 后端环境变量

在 `backend/.env` 文件中配置：

- `HOST`: 服务器绑定地址，默认 `0.0.0.0`
- `PORT`: 端口号，默认 `8000`
- `ALLOWED_ORIGINS`: CORS 允许的源，生产环境应设置具体域名
- `SSL_KEYFILE`, `SSL_CERTFILE`: SSL 证书路径（HTTPS 部署）

### 前端环境变量

在 `frontend/.env.production` 文件中配置：

- `VITE_API_URL`: 后端 API 地址
- `VITE_WS_URL`: WebSocket 地址

## 安全配置建议

1. **CORS 配置**：生产环境中将 `ALLOWED_ORIGINS` 设置为具体域名
2. **HTTPS**: 推荐使用 HTTPS，配置 SSL 证书
3. **防火墙**: 确保必要端口已开放
4. **反向代理**: 建议使用 Nginx 等反向代理服务器

## 访问应用

部署完成后：
- 主页：`http://YOUR_SERVER_IP:8000` 或 `https://YOUR_DOMAIN`
- API 文档：`http://YOUR_SERVER_IP:8000/docs`

## 故障排除

1. **WebSocket 连接失败**：检查防火墙设置和代理配置
2. **CORS 错误**：确认 `ALLOWED_ORIGINS` 配置正确
3. **静态文件 404**：确认前端已正确构建并部署

## 开发环境

本地开发时：
1. 后端：`cd backend && python main.py`
2. 前端：`cd frontend && npm run dev`
3. 访问：`http://localhost:5173`