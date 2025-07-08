document.addEventListener('DOMContentLoaded', function () {
  // DOM元素
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const filterBtn = document.getElementById('filterBtn');
  const fuelTableWrap = document.getElementById('fuelTableWrap');
  const cpiTableWrap = document.getElementById('cpiTableWrap');
  const cpiModeBtn = document.getElementById('cpiModeBtn');
  const fuelTypeBtns = Array.from(document.querySelectorAll('.fuelTypeBtn[data-type]'));
  const fuelTypeAllBtn = document.getElementById('fuelTypeAllBtn');
  let chart = null;

  // 狀態變數
  let isCpiMode = false;
  let allData = [];
  const FUEL_TYPES = ['92無鉛汽油', '95無鉛汽油', '98無鉛汽油', '柴油'];
  let selectedFuelTypes = FUEL_TYPES.slice(); // 油價模式下的選中油種
  let selectedCpiFuel = '柴油'; // CPI模式下的選中油種

  // 顏色映射
  const colorMap = {
    '92無鉛汽油': 'rgba(255,99,132,1)',
    '95無鉛汽油': 'rgba(54,162,235,1)',
    '98無鉛汽油': 'rgba(255,206,86,1)',
    '柴油': 'rgba(75,192,192,1)'
  };

  // 設定預設日期範圍（近5年）
  function setDefaultDateRange() {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    const startDate = fiveYearsAgo.toISOString().split('T')[0];

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
    return fetch('/api/fuel_price')
      .then(res => res.json())
      .then(data => {
        allData = data;
        render();
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
      fuel92: formData.get('fuel92'),
      fuel95: formData.get('fuel95'),
      fuel98: formData.get('fuel98'),
      diesel: formData.get('diesel')
    };

    fetch('/api/fuel_price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(result => {
        addModal.style.display = 'none';
        addForm.reset();
        fetchFuelData();
      });
  });

  // 取得資料庫最舊日期
  let minDate = null;
  function fetchMinDate() {
    return fetch('/api/fuel_price')
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) {
          minDate = data.map(row => row.date).sort()[0];
        }
      });
  }

  // 日期欄位變動即時渲染，並檢查是否小於最舊日期
  function checkDateLimit(input) {
    if (minDate && input.value < minDate) {
      alert(`請選擇 ${minDate} 之後的日期`);
      input.value = minDate;
    }
  }

  startDateInput.addEventListener('change', function() {
    checkDateLimit(startDateInput);
    if (isCpiMode) {
      fetchCpiData();
    } else {
      render();
    }
  });
  endDateInput.addEventListener('change', function() {
    checkDateLimit(endDateInput);
    if (isCpiMode) {
      fetchCpiData();
    } else {
      render();
    }
  });

  // 初始化
  setDefaultDateRange();
  updateButtonStyles();
  fetchMinDate().then(fetchFuelData);
});
