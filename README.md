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

顶栏另有「小数位」专页，列出闸门开关：管理员可开可关，操作工只许浏览不得改。
管理员打开「酸碱度必须一位小数」后，登记酸碱度小数点后须恰好一位（如 4.2），
整数或两位及以上整笔拒绝（先验后写，不会先入库再改显示）；关闭后恢复原有可写规则。
改坑态不看小数位。

## 快速启动

```bash
cd TanPit/TanPit-01
docker compose up --build
```
