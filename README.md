# 云端共享白板系统使用说明

## 项目简介
这是一个基于Python后端和React前端的云端共享白板系统，支持多用户实时协作绘图和Markdown文档编辑。

## 功能特性

### 绘图功能
- ✏️ **画笔工具**: 自由绘制线条
- 🧹 **橡皮擦**: 擦除已绘制的内容
- ⬜ **矩形工具**: 绘制矩形
- ⭕ **圆形工具**: 绘制圆形
- 📏 **直线工具**: 绘制直线
- 颜色选择器: 自定义绘图颜色
- 线条宽度调节: 1-20像素可调

### Markdown文档功能
- 📝 支持插入Markdown文档块
- 支持数学公式编辑（LaTeX语法）
  - 行内公式: `$...$`
  - 块级公式: `$$...$$`
- 实时预览
- 可拖动定位
- 双击编辑已有文档

### 协作功能
- 多用户实时同步
- 房间系统（通过URL参数共享房间）
- 数据自动持久化保存

## 系统要求

### 后端要求
- Python 3.8+
- pip包管理器

### 前端要求
- Node.js 16+
- npm或yarn包管理器

## 安装步骤

### 1. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 安装前端依赖

```bash
cd frontend
npm install
```

## 启动系统

### 方式一：开发模式（推荐）

#### 1. 启动后端服务
```bash
cd backend
python main.py
```
后端将在 http://localhost:8000 启动

#### 2. 启动前端开发服务器
在新的终端窗口中：
```bash
cd frontend
npm run dev
```
前端将在 http://localhost:5173 启动（Vite默认端口）

### 方式二：生产模式

#### 1. 构建前端
```bash
cd frontend
npm run build
```

#### 2. 启动后端服务
```bash
cd backend
python main.py
```
访问 http://localhost:8000 即可使用完整系统

## 使用指南

### 访问系统
1. 打开浏览器，访问前端地址
2. 系统会自动生成一个房间ID并添加到URL参数中
3. 分享URL给其他用户即可进入同一房间协作

### 绘图操作
1. 从工具栏选择绘图工具
2. 选择颜色和线条宽度
3. 在画布上按住鼠标拖动进行绘制

### 添加Markdown文档
1. 点击工具栏的"📝 Add Markdown"按钮
2. 在画布上点击要放置文档的位置
3. 输入Markdown内容
4. 点击"Save"保存

### 编辑Markdown文档
- 双击文档进入编辑模式
- 点击编辑按钮（✏️）进行编辑
- 拖动文档标题栏可以移动位置

### 数学公式示例
```markdown
行内公式: $E = mc^2$

块级公式:
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

矩阵:
$$
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
$$
```

## 数据存储
- 白板数据自动保存在`backend/whiteboard_data/`目录
- 每个房间的数据保存为独立的JSON文件
- 用户断开连接时自动保存当前状态

## 故障排除

### 前端无法连接后端
- 检查后端是否正常运行在8000端口
- 确认防火墙未阻止WebSocket连接
- 开发模式下确保CORS设置正确

### 画布内容不同步
- 检查网络连接
- 刷新页面重新连接
- 查看浏览器控制台是否有错误信息

### Markdown公式不渲染
- 确保使用正确的LaTeX语法
- 检查是否正确使用`$`或`$$`包裹公式

## 注意事项
1. 当前版本适合开发和测试使用
2. 生产环境建议配置HTTPS和认证机制
3. 大量并发用户时建议使用专业的WebSocket服务器如Redis+Socket.io

## 技术栈
- **后端**: FastAPI, WebSocket, uvicorn
- **前端**: React, TypeScript, Vite
- **实时同步**: WebSocket + CRDT算法
- **Markdown渲染**: markdown-it + KaTeX
- **数据存储**: JSON文件（文本格式）