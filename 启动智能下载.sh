#!/bin/bash

# 智能分批下载功能启动脚本
# 作者：AI Assistant
# 版本：1.0.0

echo "🚀 启动微信公众号智能分批下载系统..."
echo "======================================"

# 检查Node.js版本
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未找到Node.js，请先安装Node.js"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  警告：检测到Node.js版本 $(node -v)，建议使用v18+版本"
fi

# 检查npm/yarn
if command -v yarn &> /dev/null; then
    PACKAGE_MANAGER="yarn"
    echo "📦 使用包管理器：Yarn"
elif command -v npm &> /dev/null; then
    PACKAGE_MANAGER="npm"
    echo "📦 使用包管理器：npm"
else
    echo "❌ 错误：未找到npm或yarn包管理器"
    exit 1
fi

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📥 安装项目依赖..."
    if [ "$PACKAGE_MANAGER" = "yarn" ]; then
        yarn install
    else
        npm install
    fi
fi

# 清理可能存在的端口占用
echo "🔧 检查端口占用..."
if lsof -i :3000 > /dev/null 2>&1; then
    echo "⚠️  端口3000已被占用，尝试停止占用进程..."
    pkill -f "nuxt" || true
    sleep 2
fi

# 启动开发服务器
echo "🌟 启动开发服务器..."
echo "------------------------------------"
echo "✨ 智能分批下载功能特性："
echo "   • 📦 自动分批处理 - 智能分割大量文章"
echo "   • 🧠 智能调节 - 根据网络状况自动优化"
echo "   • 🔄 断点续传 - 网络中断后自动恢复"
echo "   • 🎯 失败重试 - 智能重试机制"
echo "   • 📊 实时监控 - 详细进度和统计信息"
echo "------------------------------------"

# 启动服务
if [ "$PACKAGE_MANAGER" = "yarn" ]; then
    yarn dev &
else
    npm run dev &
fi

SERVER_PID=$!

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务是否成功启动
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ 服务启动成功！"
else
    echo "❌ 服务启动失败，请检查错误信息"
    exit 1
fi

# 自动打开浏览器
echo "🌐 自动打开浏览器..."

if command -v open &> /dev/null; then
    # macOS
    open "http://localhost:3000"
    sleep 2
    open "http://localhost:3000/dev/batch-download-test"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "http://localhost:3000" &
    sleep 2
    xdg-open "http://localhost:3000/dev/batch-download-test" &
elif command -v start &> /dev/null; then
    # Windows (Git Bash)
    start "http://localhost:3000"
    sleep 2
    start "http://localhost:3000/dev/batch-download-test"
else
    echo "🔗 请手动打开浏览器访问："
    echo "   主页：http://localhost:3000"
    echo "   测试页：http://localhost:3000/dev/batch-download-test"
fi

echo ""
echo "🎉 智能分批下载系统已启动！"
echo "======================================"
echo "📖 使用指南："
echo "   • 主要功能：http://localhost:3000"
echo "   • 测试页面：http://localhost:3000/dev/batch-download-test"
echo "   • 帮助文档：查看项目目录中的 智能分批下载使用指南.md"
echo ""
echo "🔧 高级功能："
echo "   • 智能批次大小调节"
echo "   • 网络中断自动恢复"
echo "   • 失败文章单独重试"
echo "   • 实时下载进度监控"
echo ""
echo "⚠️  注意事项："
echo "   • 建议先用测试页面熟悉功能"
echo "   • 实际使用时需要配置代理服务器"
echo "   • 大量下载时请合理设置批次大小和间隔"
echo ""
echo "🛑 按 Ctrl+C 停止服务"
echo "======================================"

# 等待用户停止服务
wait $SERVER_PID