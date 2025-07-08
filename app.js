require('./db');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var sqlite3 = require('sqlite3').verbose();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var dbPath = path.join(__dirname, 'db', 'sqlite.db');
var db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('無法開啟資料庫:', err.message);
  } else {
    console.log('成功連接到資料庫');
  }
});

app.get('/api/fuel_price', (req, res) => {
  db.all('SELECT * FROM fuel_price ORDER BY 結束日期 DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // 回傳格式：{date, '92無鉛汽油', '95無鉛汽油', '98無鉛汽油', '柴油'}
    const result = rows.map(row => ({
      date: row['結束日期'],
      '92無鉛汽油': row['汽油_92'],
      '95無鉛汽油': row['汽油_95'],
      '98無鉛汽油': row['汽油_98'],
      '柴油': row['超級柴油']
    }));
    res.json(result);
  });
});

app.post('/api/fuel_price', (req, res) => {
  const { date, fuel92, fuel95, fuel98, diesel } = req.body;

  // 驗證所有必要欄位
  if (!date || !fuel92 || !fuel95 || !fuel98 || !diesel) {
    return res.status(400).json({ error: '所有欄位都是必填的' });
  }

  // 驗證數值欄位
  const prices = [fuel92, fuel95, fuel98, diesel];
  if (!prices.every(price => !isNaN(price) && price > 0)) {
    return res.status(400).json({ error: '油價必須為正數' });
  }

  // 寫入資料庫
  const sql = `INSERT INTO fuel_price (起始日期, 結束日期, 汽油_92, 汽油_95, 汽油_98, 超級柴油) 
               VALUES (?, ?, ?, ?, ?, ?)`;

  db.run(sql, [date, date, fuel92, fuel95, fuel98, diesel], function(err) {
    if (err) {
      console.error('資料庫寫入錯誤:', err);
      return res.status(500).json({ error: '資料庫寫入失敗' });
    }
    res.json({
      success: true,
      id: this.lastID,
      message: '新增成功'
    });
  });
});

app.get('/api/cpi', (req, res) => {
  // 支援查詢參數 ?start=YYYY&end=YYYY&fuel=油種名稱
  const start = req.query.start;
  const end = req.query.end;
  const fuel = req.query.fuel || '柴油'; // 預設為柴油
  // 對應資料庫欄位
  const fuelMap = {
    '92無鉛汽油': '汽油_92',
    '95無鉛汽油': '汽油_95',
    '98無鉛汽油': '汽油_98',
    '柴油': '超級柴油'
  };
  const fuelCol = fuelMap[fuel] || '超級柴油';
  let sql = 'SELECT * FROM fuel_price';
  let params = [];
  if (start && end) {
    sql += ' WHERE substr(結束日期,1,4) >= ? AND substr(結束日期,1,4) <= ?';
    params = [start, end];
  }
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // 依年份分組計算平均
    const yearMap = {};
    rows.forEach(row => {
      const year = row['結束日期'].slice(0, 4);
      if (!yearMap[year]) yearMap[year] = [];
      yearMap[year].push(row);
    });
    // 計算每年指定油種平均油價
    const yearAvg = {};
    Object.keys(yearMap).forEach(year => {
      const arr = yearMap[year];
      let sum = 0, count = 0;
      arr.forEach(row => {
        if (row[fuelCol] !== null && row[fuelCol] !== undefined && row[fuelCol] !== '') {
          sum += Number(row[fuelCol]);
          count++;
        }
      });
      yearAvg[year] = count ? sum / count : 0;
    });
    // 取得基準年
    const sortedYears = Object.keys(yearAvg).sort((a, b) => a - b); // 舊到新
    const baseYear = start || sortedYears[0];
    const baseValue = yearAvg[baseYear];
    // 組合回傳格式
    // 折線圖資料：舊到新
    const chartData = sortedYears.map(year => ({
      year,
      avg: yearAvg[year],
      cpi: baseValue ? (yearAvg[year] - baseValue) / baseValue : 0 // 以百分比變動表示，正負皆可
    }));
    // 表格資料：新到舊
    const tableData = [...chartData].reverse();
    res.json({ chart: chartData, table: tableData });
  });
});

app.use('/', indexRouter);
app.use('/users', usersRouter);

module.exports = app;
