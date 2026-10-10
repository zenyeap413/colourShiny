# 色偽

警局裡混進了「色偽」——長得跟人一模一樣，唯一的破綻是分不出某些顏色。

調一張石原氏色盲檢測卡舉給嫌犯看，嫌犯會把看到的數字寫在號碼牌上，看誰寫錯，把偽人揪出來。

## 怎麼玩

1. 選擇案件：五份機密文件對應五種偽人（全色盲／綠色盲／紅色盲／藍黃色盲／Z）。
2. 30 秒內調好檢測卡的圖案色與背景色——要讓一般人看得出數字、偽人看不出來。
3. 送出後到指認室看嫌犯寫的號碼牌，指認逮捕。

## 執行

不需要安裝或伺服器，直接用瀏覽器開啟 `index.html` 即可。

## 技術重點

- 色盲模擬：Machado et al. (2009) 模擬矩陣，於 linear RGB 運算；全色盲以亮度灰階處理。
- 色差：CIELAB ΔE2000。
- 檢測卡、角色、配樂與音效皆為程式即時產生（Canvas／SVG／Web Audio），只有開始頁封面是圖檔。
- 難度 Z 附色覺自我測驗（網址加上 `?tool=vision`）。

## 檔案

| 檔案 | 內容 |
|---|---|
| `index.html` | 入口與各畫面結構 |
| `core.js` | 色盲模擬、色差、作答判定、色覺測驗擬合 |
| `characters.js` | 嫌犯角色 SVG |
| `game.js` | 遊戲流程與畫面 |
| `audio.js` | 配樂與音效 |
| `style.css` | 樣式 |
| `docs/SPEC.md` | 遊戲規格 |
| `tests/verify.js` | 判定數學自動測試：`node tests/verify.js` |
| `tests/analyze_vision_log.js` | 色覺測驗紀錄離線分析：`node tests/analyze_vision_log.js <紀錄檔.json>` |
