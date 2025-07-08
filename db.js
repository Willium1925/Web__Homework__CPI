const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const dbPath = path.join(__dirname, 'db', 'sqlite.db');
const csvPath = path.join(__dirname, 'public', 'resource', '近十年全國汽柴油均價.csv');

// 確保 db 資料夾存在
if (!fs.existsSync(path.join(__dirname, 'db'))) {
  fs.mkdirSync(path.join(__dirname, 'db'));
}

// 開啟資料庫
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('無法開啟資料庫:', err.message);
    process.exit(1);
  }
  console.log('成功開啟資料庫');
  initTableAndData();
});

function initTableAndData() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS fuel_price (
      起始日期 TEXT,
      結束日期 TEXT,
      汽油_92 REAL,
      汽油_95 REAL,
      汽油_98 REAL,
      超級柴油 REAL
    )`, (err) => {
      if (err) {
        console.error('建立資料表失敗:', err.message);
        return;
      }
      // 清空舊資料
      db.run('DELETE FROM fuel_price', () => {
        importCSV();
      });
    });
  });
}

function importCSV() {
  const results = [];
  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      const stmt = db.prepare('INSERT INTO fuel_price VALUES (?, ?, ?, ?, ?, ?)');
      results.forEach(row => {
        // 處理 BOM 及欄位名稱
        let dateKey = Object.keys(row).find(k => k.includes('日期'));
        let dateRange = row[dateKey];
        if (!dateRange || !dateRange.includes('~')) return; // 跳過無效資料
        let [start, end] = dateRange.split('~').map(s => s.trim().replace(/\//g, '-'));
        stmt.run(
          start,
          end,
          row['92無鉛汽油'],
          row['95無鉛汽油'],
          row['98無鉛汽油'],
          row['超級柴油']
        );
      });
      stmt.finalize(() => {
        console.log('CSV 資料匯入完成');
        verifyData();
      });
    });
}

function verifyData() {
  db.all('SELECT * FROM fuel_price', (err, rows) => {
    if (err) {
      console.error('查詢資料失敗:', err.message);
      return;
    }
    console.log('資料庫內容:', rows);
    db.close();
  });
}
