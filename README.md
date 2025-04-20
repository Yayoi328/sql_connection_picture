# SQL关系图生成器

这是一个基于Web的工具，可以解析SQL语句并生成可视化的关系图，帮助用户理解SQL查询中表和字段之间的关系。

## 主要功能

- 输入SQL语句，解析并识别表和字段
- 生成可视化关系图，直观展示表和字段之间的关系
- 交互式图表，支持拖拽和缩放
- 响应式设计，适配不同尺寸的屏幕

## 技术栈

- **前端**: HTML5, CSS3, JavaScript
- **UI框架**: Tailwind CSS
- **SQL解析**: sql-parser-mistic
- **可视化**: D3.js

## 快速开始

1. 克隆或下载本项目到本地
2. 直接在浏览器中打开`index.html`文件
3. 在输入框中输入SQL语句
4. 点击"生成关系图"按钮

## 示例SQL

可以尝试以下SQL语句来测试系统功能：

```sql
SELECT users.id, users.name, orders.order_date, orders.total 
FROM users 
JOIN orders ON users.id = orders.user_id 
WHERE orders.status = 'completed' 
ORDER BY orders.order_date DESC
```

## 支持的SQL语法

目前主要支持SELECT查询语句的解析，包括：

- 基本的SELECT语句
- 包含JOIN子句的查询
- 包含WHERE条件的查询
- 带有表别名的查询

## 浏览器兼容性

- Chrome
- Firefox
- Safari
- Edge

## 项目结构

- `index.html` - 主页面
- `styles.css` - 样式文件
- `script.js` - JavaScript逻辑

## 贡献

欢迎提交问题和改进建议！

## 许可

MIT 