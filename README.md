# 🎋 20260618 中小綜聯席會議 - 綜謝有你問卷系統

這是一個為 **20260618中小綜聯席會議** 特別打造的端午節慶風問卷調查系統。系統融合了精美的 3D 吉祥物視覺效果、安全的講師專屬數據後台、以及與 Google 試算表（Google Sheets）雙向雲端同步的整合。

## 🌟 特色功能

1. **端午節慶視覺設計**：
   - 首頁設有兩隻左右交錯橫跨畫面的可愛 3D 粽子吉祥物（`220px`）進行踏步動畫，並浮動著竹葉背景。
   - 填寫成功頁面設有歡呼鼓舞的粽子吉祥物（`260px`）以及黃金漸層呼吸動畫的扭蛋提醒卡片。

2. **背景音樂 (BGM) 自訂功能**：
   - 支援右上角設定選單，講師可以上傳本地 MP3 檔案作為背景配樂。
   - 採用 **IndexedDB** 儲存大容量音訊檔案，無 5MB 空間限制，重新整理網頁後自動載入播放。

3. **講師專屬數據後台**：
   - 講師可在點擊「講師後台」時，輸入密碼 `888` 登入。
   - 支援**字元即時監測自動登入**：當輸入到最後一個 `8` 時，無需點擊按鈕或 Enter，瞬間進入後台。
   - 設有統計圖表（最有感活動直條圖）、同步率、平均分，以及完整的學員回饋表單與 CSV 下載匯出。

4. **雙向雲端資料同步**：
   - 當學員在各自的裝置上提交問卷時，資料會即時寫入您的 Google 試算表。
   - 講師進入後台時，網頁會自動向雲端獲取所有學員的回饋，並與本地快取無縫合併。
   - 後台提供手動「**同步雲端**」按鈕，方便您在課程進行中隨時重新整理雲端最新的資料。

---

## 🛠️ 快速開始與部署

本專案為純靜態網頁（HTML, CSS, JS），無需租用任何後端伺服器，您可以使用 Netlify、GitHub Pages 或 Vercel 免費部署。

### 步驟一：修改 Google Sheets 預設 URL
1. 用編輯器開啟 `app.js`。
2. 找到第 5 行：
   ```javascript
   let googleSheetsUrl = localStorage.getItem('google_sheets_url') || '';
   ```
3. 將後方 `''` 修改為您的 Google Apps Script 部署 URL。這樣學員開啟您的網站時，預設便會寫入您的試算表中。

### 步驟二：設置 Google 試算表與 Apps Script
1. 開啟您的 Google 雲端硬碟，建立一個新的 **Google 試算表**。
2. 點選上方選單 **擴充功能 (Extensions)** > **Apps Script**。
3. 清除預設內容並貼上以下代碼：

```javascript
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ "status": "success", "data": [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    var list = [];
    
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var item = { synced: true };
      for (var c = 0; c < headers.length; c++) {
        var header = headers[c];
        var val = row[c];
        
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
        }
        
        if (header === "ID") {
          item.id = val;
        } else if (header === "時間戳記") {
          item.timestamp = val;
        } else if (header === "姓名") {
          item.name = val;
        } else if (header === "本日學習的收穫") {
          item.takeaways = val;
        } else if (header === "最有感的活動項目" || header === "最有感活動項目") {
          item.impactfulActivity = val;
        } else if (header === "Padlet操作評分") {
          item.padletRating = parseInt(val) || null;
        } else if (header === "Padlet操作想法或疑問" || header === "對PADLET的感想或疑問") {
          item.padletFeedback = val;
        } else if (header === "給講師的一句話" || header === "給講師一句回饋") {
          item.instructorFeedback = val;
        }
      }
      
      if (!item.id) {
        item.id = "sheet_row_" + (r + 2);
      }
      if (!item.timestamp) {
        item.timestamp = new Date().toLocaleString();
      }
      
      list.push(item);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "data": list }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID", "時間戳記", "姓名", "本日學習的收穫", "最有感的活動項目", "Padlet操作評分", "Padlet操作想法或疑問", "給講師的一句話"]);
    }
    
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var newRow = [];
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i];
      if (header === "ID") {
        newRow.push(data.id || "");
      } else if (header === "時間戳記") {
        newRow.push(data.timestamp || new Date());
      } else if (header === "姓名") {
        newRow.push(data.name || "");
      } else if (header === "本日學習的收穫") {
        newRow.push(data.takeaways || "");
      } else if (header === "最有感的活動項目" || header === "最有感活動項目") {
        newRow.push(data.impactfulActivity || "");
      } else if (header === "Padlet操作評分") {
        newRow.push(data.padletRating || "");
      } else if (header === "Padlet操作想法或疑問" || header === "對PADLET的感想或疑問") {
        newRow.push(data.padletFeedback || "");
      } else if (header === "給講師的一句話" || header === "給講師一句回饋") {
        newRow.push(data.instructorFeedback || "");
      } else {
        newRow.push("");
      }
    }
    
    sheet.appendRow(newRow);
    return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. 點選 **儲存專案**。
5. 點選 **部署 (Deploy)** > **新增部署 (New deployment)**。
6. 類型選擇 **網頁應用程式 (Web app)**，誰有權限存取選擇 **任何人 (Anyone)**，點選部署。
7. 複製產生的網頁應用程式網址，填入設定選單中測試即可！
