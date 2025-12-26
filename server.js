/**
 * 缓存策略增强配置
 * 此文件用于配置本地开发服务器的缓存控制头
 */

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 为静态文件添加缓存控制头
app.use(express.static(path.join(__dirname), {
  // 为静态资源设置7天的缓存时间
  maxAge: '7d',
  // 启用强缓存
  etag: true,
  // 启用last-modified头
  lastModified: true,
  // 为不同类型的文件设置不同的缓存策略
  setHeaders: (res, filePath) => {
    // 对于HTML文件，设置较短的缓存时间
    if (path.extname(filePath) === '.html') {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1小时
    }
    // 对于CSS、JavaScript、图片等静态资源，设置较长的缓存时间
    else if (['.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(path.extname(filePath))) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7天
    }
  }
}));

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`缓存策略已启用：`);
  console.log(`- HTML文件：1小时缓存`);
  console.log(`- 静态资源（CSS、JS、图片等）：7天缓存`);
});

module.exports = app;
