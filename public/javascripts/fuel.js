document.addEventListener('DOMContentLoaded', function () {
  // DOM元素
  // 取得日期選擇、查詢、表格、CPI切換、油種按鈕等相關的DOM元素
  const startDateInput = document.getElementById('startDate'); // 開始日期輸入框
  const endDateInput = document.getElementById('endDate');     // 結束日期輸入框
  const filterBtn = document.getElementById('filterBtn');      // 查詢按鈕
  const fuelTableWrap = document.getElementById('fuelTableWrap'); // 油價表格區塊
  const cpiTableWrap = document.getElementById('cpiTableWrap');   // CPI表格區塊
  const cpiModeBtn = document.getElementById('cpiModeBtn');       // 切換CPI模式按鈕
  const fuelTypeBtns = Array.from(document.querySelectorAll('.fuelTypeBtn[data-type]')); // 各油種按鈕
  const fuelTypeAllBtn = document.getElementById('fuelTypeAllBtn'); // 全選油種按鈕
  let chart = null; // Chart.js 圖表實例

  // 狀態變數
  let isCpiMode = false; // 是否為CPI模式
  let allData = [];      // 所有油價資料
  const FUEL_TYPES = ['92無鉛汽油', '95無鉛汽油', '98無鉛汽油', '柴油']; // 油種列表
  let selectedFuelTypes = FUEL_TYPES.slice(); // 油價模式下選中的油種（多選）
  let selectedCpiFuel = '柴油'; // CPI模式下選中的油種（單選）

  // 顏色映射，對應每種油種的顏色，供按鈕和折線圖使用
  const colorMap = {
    '92無鉛汽油': 'rgba(255,99,132,1)',
    '95無鉛汽油': 'rgba(54,162,235,1)',
    '98無鉛汽油': 'rgba(255,206,86,1)',
    '柴油': 'rgba(75,192,192,1)'
  };

  // 設定預設日期範圍（近5年）
  // 預設顯示近五年資料，將日期欄位設為對應值
  function setDefaultDateRange() {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0]; // 今天
    const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    const startDate = fiveYearsAgo.toISOString().split('T')[0]; // 五年前

    startDateInput.value = startDate;
    endDateInput.value = endDate;
  }

  // 更新按鈕樣式
  function updateButtonStyles() {
    if (isCpiMode) {
      // CPI模式：單選
      fuelTypeBtns.forEach(btn => {
        const type = btn.dataset.type;
        if (type === selectedCpiFuel) {
          btn.style.background = colorMap[type];
          btn.style.color = '#fff';
        } else {
          btn.style.background = '#e0e0e0';
          btn.style.color = '#888';
        }
      });
      fuelTypeAllBtn.style.display = 'none';
    } else {
      // 油價模式：多選
      fuelTypeBtns.forEach(btn => {
        const type = btn.dataset.type;
        if (selectedFuelTypes.includes(type)) {
          btn.style.background = colorMap[type];
          btn.style.color = '#fff';
        } else {
          btn.style.background = '#e0e0e0';
          btn.style.color = '#888';
        }
      });
      fuelTypeAllBtn.style.display = '';
      if (selectedFuelTypes.length === FUEL_TYPES.length) {
        fuelTypeAllBtn.style.background = '#333';
        fuelTypeAllBtn.style.color = '#fff';
      } else {
        fuelTypeAllBtn.style.background = '#e0e0e0';
        fuelTypeAllBtn.style.color = '#888';
      }
    }
  }

  // 油價數據相關函數
  function fetchFuelData() {
    return fetch('/api/fuel_price', {
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => {
        allData = data;
        render();
      })
      .catch(err => {
        console.error('獲取資料失敗:', err);
      });
  }

  function filterFuelData() {
    const start = startDateInput.value;
    const end = endDateInput.value;
    return allData.filter(row => {
      const matchStart = !start || row.date >= start;
      const matchEnd = !end || row.date <= end;
      return matchStart && matchEnd;
    });
  }

  function renderFuelTable(data) {
    // 更新表頭以顯示所有選中的油種
    const tableHead = document.querySelector('#fuelTable thead tr');
    tableHead.innerHTML = `
      <th>日期</th>
      ${selectedFuelTypes.map(type => `<th>${type}</th>`).join('')}
    `;

    // 依日期新到舊排序
    const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
    // 更新表格內容，每行顯示一個日期的所有選中油種數據
    const tableBody = document.querySelector('#fuelTable tbody');
    tableBody.innerHTML = '';
    sorted.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.date}</td>
        ${selectedFuelTypes.map(type => `<td>${row[type]}</td>`).join('')}
      `;
      tableBody.appendChild(tr);
    });
  }

  function renderFuelChart(data) {
    // 依日期新到舊排序，然後反轉為左到右新到舊
    const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date)).reverse();
    const labels = sorted.map(row => row.date);
    const datasets = selectedFuelTypes.map(type => ({
      label: type,
      data: sorted.map(row => row[type]),
      borderColor: colorMap[type],
      fill: false,
      tension: 0.1
    }));
    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('fuelChart').getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: {
          x: { title: { display: true, text: '日期' } },
          y: { title: { display: true, text: '價格' } }
        }
      }
    });
  }

  // CPI相關函數
  function fetchCpiData() {
    const start = startDateInput.value.slice(0, 4);
    const end = endDateInput.value.slice(0, 4);
    const url = `/api/cpi?start=${start}&end=${end}&fuel=${encodeURIComponent(selectedCpiFuel)}`;

    return fetch(url)
      .then(res => res.json())
      .then(data => {
        renderCpiTable(data.table);
        renderCpiChart(data.chart);
      });
  }

  function renderCpiTable(data) {
    // 依年度新到舊排序
    const sorted = [...data].sort((a, b) => b.year.localeCompare(a.year));
    const tableBody = document.querySelector('#cpiTable tbody');
    tableBody.innerHTML = '';
    sorted.forEach(row => {
      const color = row.cpi > 0 ? 'red' : (row.cpi < 0 ? 'blue' : 'black');
      const cpiText = (row.cpi * 100).toFixed(2) + '%';
      const cpiTd = `<td style="color:${color}">${cpiText}</td>`;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.year}</td>
        <td>${row.avg.toFixed(2)}</td>
        ${cpiTd}
      `;
      tableBody.appendChild(tr);
    });
  }
  function renderCpiChart(data) {
    // 依年度新到舊排序，然後反轉為左到右新到舊
    const sorted = [...data].sort((a, b) => b.year.localeCompare(a.year)).reverse();
    const labels = sorted.map(row => row.year);
    const datasets = [{
      label: `${selectedCpiFuel}物價指數`,
      data: sorted.map(row => row.cpi * 100),
      borderColor: colorMap[selectedCpiFuel],
      fill: false,
      tension: 0.1
    }];
    if (chart) chart.destroy();
    chart = new Chart(document.getElementById('fuelChart').getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: {
          x: { title: { display: true, text: '年度' } },
          y: { title: { display: true, text: '物價指數(%)' } }
        }
      }
    });
  }

  // 事件處理
  // 油種按鈕點擊事件
  fuelTypeBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const type = btn.dataset.type;
      if (isCpiMode) {
        // CPI模式：單選
        selectedCpiFuel = type;
        fetchCpiData();
      } else {
        // 油價模式：多選
        if (selectedFuelTypes.includes(type)) {
          if (selectedFuelTypes.length > 1) {
            selectedFuelTypes = selectedFuelTypes.filter(t => t !== type);
          }
        } else {
          selectedFuelTypes.push(type);
        }
        render();
      }
      updateButtonStyles();
    });
  });

  // 全選按鈕點擊事件
  fuelTypeAllBtn.addEventListener('click', function() {
    if (!isCpiMode) {
      selectedFuelTypes = FUEL_TYPES.slice();
      updateButtonStyles();
      render();
    }
  });

  // 切換CPI模式
  cpiModeBtn.addEventListener('click', function() {
    isCpiMode = !isCpiMode;
    if (isCpiMode) {
      fuelTableWrap.style.display = 'none';
      cpiTableWrap.style.display = '';
      cpiModeBtn.textContent = '回到油價查詢';
      selectedCpiFuel = '柴油'; // 預設選擇柴油
      fetchCpiData();
    } else {
      fuelTableWrap.style.display = '';
      cpiTableWrap.style.display = 'none';
      cpiModeBtn.textContent = '年度物價指數';
      render();
    }
    updateButtonStyles();
  });

  // 查詢按鈕點擊事件
  filterBtn.addEventListener('click', function() {
    if (isCpiMode) {
      fetchCpiData();
    } else {
      render();
    }
  });

  // 渲染油價數據
  function render() {
    const filtered = filterFuelData();
    renderFuelTable(filtered);
    renderFuelChart(filtered);
  }

  // 新增數據相關
  const addBtn = document.getElementById('addBtn');
  const addModal = document.getElementById('addModal');
  const addForm = document.getElementById('addForm');
  const cancelAddBtn = document.getElementById('cancelAddBtn');

  addBtn.addEventListener('click', () => addModal.style.display = 'flex');
  cancelAddBtn.addEventListener('click', () => {
    addModal.style.display = 'none';
    addForm.reset();
  });

  addForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(addForm);
    const payload = {
      date: formData.get('date'),
      fuel92: parseFloat(formData.get('fuel92')),
      fuel95: parseFloat(formData.get('fuel95')),
      fuel98: parseFloat(formData.get('fuel98')),
      diesel: parseFloat(formData.get('diesel'))
    };

    // 前端資料驗證
    if (!payload.date) {
      alert('請選擇日期');
      return;
    }

    const prices = [payload.fuel92, payload.fuel95, payload.fuel98, payload.diesel];
    if (prices.some(price => isNaN(price) || price <= 0)) {
      alert('所有油價必須為正數');
      return;
    }

    fetch('/api/fuel_price', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => Promise.reject(err));
      }
      return res.json();
    })
    .then(result => {
      if (result.success) {
        alert('新增成功！');
        addModal.style.display = 'none';
        addForm.reset();
        // 重新載入資料
        return fetchFuelData();
      }
    })
    .catch(err => {
      console.error('新增資料錯誤:', err);
      alert(err.error || '新增資料失敗，請重試');
    });
  });

  // 取得最舊日期
  function getMinDate() {
    if (!allData.length) return null;
    return allData.reduce((min, row) => row.date < min ? row.date : min, allData[0].date);
  }

  // 初始化
  setDefaultDateRange();
  updateButtonStyles();
  fetchFuelData();

  // 日期欄位變動即時渲染
  startDateInput.addEventListener('change', function() {
    const minDate = getMinDate();
    if (minDate && startDateInput.value < minDate) {
      alert(`請選擇${minDate}之後`);
      startDateInput.value = minDate;
      return;
    }
    if (isCpiMode) {
      fetchCpiData();
    } else {
      render();
    }
  });

  endDateInput.addEventListener('change', function() {
    const minDate = getMinDate();
    if (minDate && endDateInput.value < minDate) {
      alert(`請選擇${minDate}之後`);
      endDateInput.value = minDate;
      return;
    }
    if (isCpiMode) {
      fetchCpiData();
    } else {
      render();
    }
  });
});
