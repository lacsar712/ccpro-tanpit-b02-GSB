# TanPit-01 · 南冈鞣场

鞣坑场地图作业台。登录后是按行列铺开的坑位，点坑登记浸液酸碱度并改状态。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Web API | Django 5 · Django Ninja（不是 DRF 视图集） |
| 结构 | Django app `pits`：models / rules / api 分文件 |
| 数据 | Django ORM · PostgreSQL 15 |
| 前端 | Lit 3 Web Component · Vite |
| 部署 | Docker Compose |

## 路径与端口

- 前端：http://localhost:4770
- API：http://localhost:8770
- PostgreSQL：localhost:6170

## 演示账号

`admin` / `123456`，`worker` / `123456`

## 业务规则

坑不可标「已放液」，除非最近一次浸液酸碱度在 **3.5～5.0**。规则在 `backend/pits/rules.py`。

**小数位闸门**：顶栏「小数位」专页列出闸门。管理员可开可关，操作工进专页只许浏览（`PUT /api/settings/decimal` 对非管理员返回 403）。开启「酸碱度必须一位小数」后，新写入的酸碱度按**原始提交文本**在服务端校验，小数点后必须恰好一位（如 `4.2`）；整数、两位及以上、空值在写库前整笔拒绝，不存在先入库再改显示。关闭后恢复原可写规则。改坑态不读此闸门，已在库的旧读数与放液规则不受影响。

## 快速启动

```bash
cd TanPit/TanPit-01
docker compose up --build
```
