// ========================================================
// 0. テキスト出力用デバッグログモジュール
// ========================================================
(function initDebugLogger() {
  function createDebugUI() {
    if (document.getElementById("debug-log-panel")) return;

    const panel = document.createElement("div");
    panel.id = "debug-log-panel";
    panel.style.cssText = `
      margin: 20px 0;
      padding: 15px;
      background-color: #1a202c;
      color: #cbd5e0;
      border-radius: 8px;
      font-family: monospace;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    `;

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong style="color: #63b3ed; font-size: 1rem;">🔍 処理結果ログ (テキスト出力)</strong>
        <div>
          <button id="btn-clear-debug-log" style="background: #4a5568; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">クリア</button>
          <button id="btn-copy-debug-log" style="background: #3182ce; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer;">コピー</button>
        </div>
      </div>
      <textarea id="debug-log-output" readonly style="width: 100%; height: 200px; background: #2d3748; color: #68d391; border: 1px solid #4a5568; border-radius: 4px; padding: 8px; font-size: 0.85rem; box-sizing: border-box; resize: vertical;"></textarea>
    `;

    document.body.appendChild(panel);

    document.getElementById("btn-clear-debug-log").addEventListener("click", () => {
      const textarea = document.getElementById("debug-log-output");
      if (textarea) textarea.value = "";
    });

    document.getElementById("btn-copy-debug-log").addEventListener("click", () => {
      const textarea = document.getElementById("debug-log-output");
      if (textarea) {
        textarea.select();
        navigator.clipboard.writeText(textarea.value);
        alert("ログをクリップボードにコピーしました。");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createDebugUI);
  } else {
    createDebugUI();
  }
})();

function appendDebugLog(tag, message, detailObj = null) {
  const textarea = document.getElementById("debug-log-output");
  const timestamp = new Date().toLocaleTimeString();
  let logLine = `[${timestamp}] [${tag}] ${message}`;

  if (detailObj !== null) {
    try {
      logLine += `\n  └ Detail: ${JSON.stringify(detailObj)}`;
    } catch (e) {
      logLine += `\n  └ Detail: [Unserializable Object]`;
    }
  }

  if (textarea) {
    textarea.value += logLine + "\n";
    textarea.scrollTop = textarea.scrollHeight;
  }
}

// ========================================================
// 1. データ構造と初期ダミーデータ
// ========================================================
let wordData = {
  version: "2.0",
  categories: [
    {
      id: "large-1",
      name: "英語",
      subcategories: [
        {
          id: "medium-1",
          name: "日常会話",
          sections: [
            {
              id: "small-1",
              name: "挨拶",
              items: [
                { id: "item-1", word: "<b>Hello</b>", meaning: "こんにちは\n<span style='color:red;'>※最も一般的な挨拶</span>", image: "", memorized: false },
                { id: "item-2", word: "Good morning", meaning: "おはようございます", image: "", memorized: false }
              ]
            }
          ]
        }
      ]
    }
  ]
};

function normalizeWordData(inputData) {
  let normalized = { version: "2.0", categories: [] };

  if (Array.isArray(inputData)) {
    normalized.categories = inputData;
  } else if (inputData && typeof inputData === "object") {
    if (Array.isArray(inputData.categories)) {
      normalized = inputData;
    } else if (inputData.data && Array.isArray(inputData.data)) {
      normalized.categories = inputData.data;
    } else {
      normalized.categories = [];
    }
  }

  if (!Array.isArray(normalized.categories)) {
    normalized.categories = [];
  }

  return normalized;
}

// ========================================================
// 2. IndexedDB 制御モジュール (バージョンを 2 に修正)
// ========================================================
const DB_NAME = "TangoCardDB";
const DB_VERSION = 2; // ★エラー回避のためバージョンを 2 に統一
const STORE_NAME = "app_data";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function loadDataFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get("wordData");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveToLocalStorage() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(wordData, "wordData");
      tx.oncomplete = () => {
        appendDebugLog("DB-SAVE", "IndexedDBへのデータ保存が成功しました。");
        resolve(true);
      };
      tx.onerror = () => {
        appendDebugLog("DB-SAVE-ERROR", "IndexedDB保存エラー:", tx.error);
        reject(tx.error);
      };
    });
  } catch (err) {
    appendDebugLog("DB-SAVE-EXCEPT", "IndexedDB保存中に例外が発生しました:", err.message);
  }
}

async function initAppData() {
  try {
    const dbData = await loadDataFromDB();
    if (dbData) {
      wordData = normalizeWordData(dbData);
      appendDebugLog("INIT", "IndexedDBから既存データをロードしました。", { categoriesCount: wordData.categories.length });
    } else {
      const localData = localStorage.getItem("wordData");
      if (localData) {
        wordData = normalizeWordData(JSON.parse(localData));
        appendDebugLog("INIT", "localStorageからデータをロードし、IndexedDBへ移行します。");
        await saveToLocalStorage();
      } else {
        appendDebugLog("INIT", "初期ダミーデータをセットし、IndexedDBへ初回保存します。");
        await saveToLocalStorage();
      }
    }

    refreshAllDropdowns();

  } catch (err) {
    appendDebugLog("INIT-ERROR", "データ初期化中にエラーが発生しました:", err.message);
  }
}

function refreshAllDropdowns() {
  if (typeof initLargeSelect === "function") initLargeSelect();
  if (typeof initRegisterSelects === "function") initRegisterSelects();
  appendDebugLog("UI-REFRESH", "プルダウンの再描画を完了しました。", { categoriesCount: wordData.categories.length });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAppData);
} else {
  initAppData();
}

// ========================================================
// 3. 画像の自動圧縮ロジック
// ========================================================
function compressImage(file, maxWidth = 400) {
  return new Promise((resolve, reject) => {
    appendDebugLog("IMAGE-COMPRESS", `画像圧縮処理を開始します: ${file.name} (サイズ: ${file.size} bytes)`);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85);
        appendDebugLog("IMAGE-COMPRESS", `画像圧縮完了: ${img.width}x${img.height} -> ${width}x${height} (Base64長: ${compressedBase64.length})`);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

function safeHTML(str) {
  if (!str) return "";
  let escaped = str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  escaped = escaped.replace(/&lt;b&gt;/gi, "<b>").replace(/&lt;\/b&gt;/gi, "</b>");
  escaped = escaped.replace(/&lt;span style=&#039;color:red;&#039;&gt;/gi, '<span style="color:red;">');
  escaped = escaped.replace(/&lt;span style=&#039;color:blue;&#039;&gt;/gi, '<span style="color:blue;">');
  escaped = escaped.replace(/&lt;\/span&gt;/gi, "</span>");
  return escaped;
}

// ========================================================
// 4. アプリの状態管理 (State) ＆ DOM要素取得
// ========================================================
let currentItems = [];
let currentCardIndex = 0;
let isShowingAnswer = false;
let currentSmallId = "";
let currentFontSize = 100;
let editingItemId = null;
let base64ImageData = "";

const selectLarge = document.getElementById("select-large");
const selectMedium = document.getElementById("select-medium");
const selectSmall = document.getElementById("select-small");

const cardView = document.getElementById("card-view");
const listView = document.getElementById("list-view");
const wordCard = document.getElementById("word-card");
const cardText = document.getElementById("card-text");

const btnPrev = document.getElementById("btn-prev");
const btnToggleAnswer = document.getElementById("btn-toggle-answer");
const btnNext = document.getElementById("btn-next");
const btnMemorized = document.getElementById("btn-memorized");

const cardImageContainer = document.getElementById("card-image-container");
const cardImg = document.getElementById("card-img");
const btnZoomImage = document.getElementById("btn-zoom-image");

// ========================================================
// 5. フォントサイズ変更機能
// ========================================================
const btnFontDecrease = document.getElementById("btn-font-decrease");
const btnFontIncrease = document.getElementById("btn-font-increase");
const fontSizeDisplay = document.getElementById("font-size-display");

function applyFontSize() {
  document.body.style.fontSize = currentFontSize + "%";
  if (fontSizeDisplay) fontSizeDisplay.textContent = currentFontSize + "%";
  localStorage.setItem("app_font_size", currentFontSize);
}
if (localStorage.getItem("app_font_size")) {
  currentFontSize = parseInt(localStorage.getItem("app_font_size"), 10);
  applyFontSize();
}
if (btnFontDecrease) {
  btnFontDecrease.addEventListener("click", () => {
    if (currentFontSize > 70) { currentFontSize -= 10; applyFontSize(); }
  });
}
if (btnFontIncrease) {
  btnFontIncrease.addEventListener("click", () => {
    if (currentFontSize < 200) { currentFontSize += 10; applyFontSize(); }
  });
}

// ========================================================
// 6. プルダウン連携ロジック
// ========================================================
function initLargeSelect() {
  if (!selectLarge) return;
  selectLarge.innerHTML = '<option value="">大項目を選択</option>';

  if (wordData && Array.isArray(wordData.categories)) {
    wordData.categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      selectLarge.appendChild(opt);
    });
  }

  if (selectMedium) {
    selectMedium.innerHTML = '<option value="">中項目を選択</option>';
    selectMedium.disabled = true;
  }
  if (selectSmall) {
    selectSmall.innerHTML = '<option value="">小項目を選択</option>';
    selectSmall.disabled = true;
  }
}

if (selectLarge) {
  selectLarge.addEventListener("change", (e) => {
    const largeId = e.target.value;
    if (selectMedium) selectMedium.innerHTML = '<option value="">中項目を選択</option>';
    if (selectSmall) {
      selectSmall.innerHTML = '<option value="">小項目を選択</option>';
      selectSmall.disabled = true;
    }

    if (!largeId) {
      if (selectMedium) selectMedium.disabled = true;
      resetCardViewStatus("大項目を選択してください");
      return;
    }

    const largeCat = wordData.categories.find(c => c.id === largeId);
    if (largeCat && Array.isArray(largeCat.subcategories)) {
      largeCat.subcategories.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub.id;
        opt.textContent = sub.name;
        if (selectMedium) selectMedium.appendChild(opt);
      });
      if (selectMedium) selectMedium.disabled = false;
    }
    resetCardViewStatus("中項目を選択してください");
  });
}

if (selectMedium) {
  selectMedium.addEventListener("change", (e) => {
    const largeId = selectLarge ? selectLarge.value : "";
    const mediumId = e.target.value;
    if (selectSmall) selectSmall.innerHTML = '<option value="">小項目を選択</option>';

    if (!mediumId) {
      if (selectSmall) selectSmall.disabled = true;
      resetCardViewStatus("中項目を選択してください");
      return;
    }

    const largeCat = wordData.categories.find(c => c.id === largeId);
    const mediumCat = largeCat && Array.isArray(largeCat.subcategories) ? largeCat.subcategories.find(s => s.id === mediumId) : null;
    if (mediumCat && Array.isArray(mediumCat.sections)) {
      mediumCat.sections.forEach(sec => {
        const opt = document.createElement("option");
        opt.value = sec.id;
        opt.textContent = sec.name;
        if (selectSmall) selectSmall.appendChild(opt);
      });
      if (selectSmall) selectSmall.disabled = false;
    }
    resetCardViewStatus("小項目を選択してください");
  });
}

if (selectSmall) {
  selectSmall.addEventListener("change", (e) => {
    currentSmallId = e.target.value;
    if (!currentSmallId) { resetCardViewStatus("小項目を選択してください"); currentItems = []; return; }

    const largeCat = wordData.categories.find(c => c.id === (selectLarge ? selectLarge.value : ""));
    const mediumCat = largeCat && Array.isArray(largeCat.subcategories) ? largeCat.subcategories.find(s => s.id === (selectMedium ? selectMedium.value : "")) : null;
    const section = mediumCat && Array.isArray(mediumCat.sections) ? mediumCat.sections.find(sec => sec.id === currentSmallId) : null;

    if (section) {
      // ★JSON内の配列順をそのまま保持して反映（自動ソートを適用しない）
      currentItems = [...(section.items || [])];
      appendDebugLog("SELECT-SMALL", `小項目を選択しました。対象件数: ${currentItems.length}件`, { sectionId: currentSmallId, sectionName: section.name });

      // ソートボタンの強調スタイルを解除
      if (btnSortAsc) { btnSortAsc.style.background = "#edf2f7"; btnSortAsc.style.color = "black"; }
      if (btnSortTime) { btnSortTime.style.background = "#edf2f7"; btnSortTime.style.color = "black"; }

      currentCardIndex = 0;
      updateCardView();
      updateListView();
    }
  });
}

function resetCardViewStatus(message) {
  if (!cardText) return;
  cardText.innerHTML = message;
  if (btnPrev) btnPrev.disabled = true;
  if (btnToggleAnswer) btnToggleAnswer.disabled = true;
  if (btnNext) btnNext.disabled = true;
  if (btnMemorized) btnMemorized.disabled = true;
  hideCardImage();
}

// ========================================================
// 7. 単語カード描画・表示制御
// ========================================================
function updateCardView() {
  if (currentItems.length === 0) {
    resetCardViewStatus("この項目には単語が登録されていません。");
    return;
  }

  const item = currentItems[currentCardIndex];
  isShowingAnswer = false;
  if (btnToggleAnswer) btnToggleAnswer.textContent = "意味を見る";
  if (cardText) cardText.innerHTML = safeHTML(item.word);
  if (wordCard) wordCard.style.backgroundColor = "";

  if (btnPrev) btnPrev.disabled = currentCardIndex === 0;
  if (btnNext) btnNext.disabled = currentCardIndex === currentItems.length - 1;
  if (btnToggleAnswer) btnToggleAnswer.disabled = false;
  if (btnMemorized) btnMemorized.disabled = false;

  if (item.memorized) {
    if (btnMemorized) {
      btnMemorized.textContent = "覚えたマーク解除";
      btnMemorized.style.backgroundColor = "#e53e3e";
    }
    if (wordCard) wordCard.style.borderLeft = "10px solid #48bb78";
  } else {
    if (btnMemorized) {
      btnMemorized.textContent = "覚えた！";
      btnMemorized.style.backgroundColor = "#48bb78";
    }
    if (wordCard) wordCard.style.borderLeft = "10px solid #cbd5e0";
  }
  hideCardImage();
}

if (btnToggleAnswer) {
  btnToggleAnswer.addEventListener("click", () => {
    if (currentItems.length === 0) return;
    const item = currentItems[currentCardIndex];
    isShowingAnswer = !isShowingAnswer;

    if (isShowingAnswer) {
      if (cardText) cardText.innerHTML = safeHTML(item.meaning);
      btnToggleAnswer.textContent = "単語を見る";
      if (wordCard) wordCard.style.backgroundColor = "#FFFAF0";
      showCardImage(item.image);
    } else {
      if (cardText) cardText.innerHTML = safeHTML(item.word);
      btnToggleAnswer.textContent = "意味を見る";
      if (wordCard) wordCard.style.backgroundColor = "";
      hideCardImage();
    }
  });
}

if (btnPrev) {
  btnPrev.addEventListener("click", () => {
    if (currentCardIndex > 0) {
      currentCardIndex--;
      updateCardView();
    }
  });
}

if (btnNext) {
  btnNext.addEventListener("click", () => {
    if (currentCardIndex < currentItems.length - 1) {
      currentCardIndex++;
      updateCardView();
    }
  });
}

if (btnMemorized) {
  btnMemorized.addEventListener("click", () => {
    if (currentItems.length === 0) return;
    const item = currentItems[currentCardIndex];
    item.memorized = !item.memorized;
    appendDebugLog("CARD-MEMORIZED", `覚えたフラグを変更しました (ID: ${item.id}, Status: ${item.memorized})`);
    saveToLocalStorage();
    updateCardView();
  });
}

if (wordCard) {
  wordCard.addEventListener("click", (e) => {
    if (currentItems.length === 0 || (btnToggleAnswer && btnToggleAnswer.disabled)) return;
    if (e.target.id === 'card-img' || (cardImageContainer && cardImageContainer.contains(e.target))) {
      return;
    }
    if (btnToggleAnswer) btnToggleAnswer.click();
  });
}

function hideCardImage() {
  if (!cardImageContainer) return;
  cardImageContainer.classList.add("hidden");
  cardImageContainer.style.display = "none";
  if (cardImg) cardImg.removeAttribute('src');
  if (btnZoomImage) btnZoomImage.classList.add("hidden");
}

function showCardImage(b64Data) {
  if (!b64Data || !cardImageContainer || !cardImg) { hideCardImage(); return; }
  cardImg.src = b64Data;
  cardImageContainer.classList.remove("hidden");
  cardImageContainer.style.display = "block";
  if (btnZoomImage) btnZoomImage.classList.remove("hidden");
}

function openImageModal(imgSrc) {
  if (!imgSrc || imgSrc === window.location.href || imgSrc.endsWith('/')) return;

  let targetModal = document.getElementById("image-modal");
  if (!targetModal) {
    targetModal = document.createElement("div");
    targetModal.id = "image-modal";
    document.body.appendChild(targetModal);
  }

  targetModal.innerHTML = `
    <div class="modal-content-wrapper">
      <img id="modal-img" src="${imgSrc}" alt="拡大画像" />
      <button id="btn-close-modal">閉じる</button>
    </div>
  `;

  targetModal.classList.remove('hidden');
  targetModal.style.display = 'flex';

  const closeBtn = targetModal.querySelector('#btn-close-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      targetModal.classList.add('hidden');
      targetModal.style.display = 'none';
    });
  }

  targetModal.onclick = function(e) {
    if (e.target === targetModal) {
      targetModal.classList.add('hidden');
      targetModal.style.display = 'none';
    }
  };
}

if (btnZoomImage) {
  btnZoomImage.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (cardImg && cardImg.src) openImageModal(cardImg.src);
  });
}

if (cardImg) {
  cardImg.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openImageModal(cardImg.src);
  });
}

// ========================================================
// 8. 単語一覧描画＆ドラッグ移動
// ========================================================
function updateListView() {
  const tbody = document.getElementById("word-list-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (currentItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#a0aec0; padding:20px;">この項目に登録された単語はありません。</td></tr>`;
    return;
  }

  const listType = document.querySelector('input[name="list-type"]:checked')?.value || "all";

  currentItems.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.draggable = true;
    tr.dataset.index = index;
    tr.dataset.id = item.id;

    const tdDrag = document.createElement("td");
    tdDrag.className = "drag-handle";
    tdDrag.innerHTML = "≡";
    tr.appendChild(tdDrag);

    const tdWord = document.createElement("td");
    tdWord.className = "col-word";
    tdWord.innerHTML = listType === "meaning-only" ? `<span style="color:#cbd5e0;">???</span>` : safeHTML(item.word);
    tr.appendChild(tdWord);

    const tdMeaning = document.createElement("td");
    tdMeaning.className = "col-meaning";
    tdMeaning.innerHTML = listType === "word-only" ? `<span style="color:#cbd5e0;">???</span>` : safeHTML(item.meaning);

    if (item.image && listType !== "word-only") {
      const img = document.createElement("img");
      img.src = item.image;
      img.className = "list-img";
      tdMeaning.appendChild(img);
    }
    tr.appendChild(tdMeaning);

    const tdAction = document.createElement("td");
    tdAction.innerHTML = `
      <button onclick="startEditItem('${item.id}')" style="background-color:#ecc94b; color:black; padding:3px 8px; border-radius:4px; margin-right:5px; font-size:0.8rem;">修正</button>
      <button onclick="deleteItem('${item.id}')" style="background-color:#e53e3e; color:white; padding:3px 8px; border-radius:4px; font-size:0.8rem;">削除</button>
    `;
    tr.appendChild(tdAction);

    tr.addEventListener("dragstart", (e) => {
      tr.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index);
    });

    tr.addEventListener("dragend", () => {
      tr.classList.remove("dragging");
      const rows = tbody.querySelectorAll("tr");
      rows.forEach(r => r.style.borderTop = "");
      rows.forEach(r => r.style.borderBottom = "");
    });

    tr.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const bounding = tr.getBoundingClientRect();
      const offset = e.clientY - bounding.top;
      if (offset > bounding.height / 2) {
        tr.style.borderTop = "";
        tr.style.borderBottom = "2px solid #3182ce";
      } else {
        tr.style.borderTop = "2px solid #3182ce";
        tr.style.borderBottom = "";
      }
    });

    tr.addEventListener("dragleave", () => {
      tr.style.borderTop = "";
      tr.style.borderBottom = "";
    });

    tr.addEventListener("drop", (e) => {
      e.preventDefault();
      tr.style.borderTop = "";
      tr.style.borderBottom = "";

      const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
      const toIndex = index;
      if (fromIndex === toIndex) return;

      appendDebugLog("DRAG-DROP", `並び替えが発生しました: Index ${fromIndex} -> Index ${toIndex}`);

      const targetItem = currentItems.splice(fromIndex, 1)[0];
      currentItems.splice(toIndex, 0, targetItem);

      syncWordDataOrder();
      saveToLocalStorage();
      updateListView();
    });

    tbody.appendChild(tr);
  });
}

function syncWordDataOrder() {
  if (!currentSmallId) return;
  let matched = false;
  if (wordData && Array.isArray(wordData.categories)) {
    wordData.categories.forEach(c => {
      if (Array.isArray(c.subcategories)) {
        c.subcategories.forEach(s => {
          if (Array.isArray(s.sections)) {
            s.sections.forEach(sec => {
              if (sec.id === currentSmallId) {
                sec.items = [...currentItems];
                matched = true;
              }
            });
          }
        });
      }
    });
  }

  if (matched) {
    const itemIds = currentItems.map(i => i.id);
    appendDebugLog("SYNC-ORDER", `元データ(wordData)の並び順を同期しました。`, { itemOrder: itemIds });
  }
}

// ========================================================
// 9. 並べ替え (ソート) ロジック
// ========================================================
const btnSortAsc = document.getElementById("btn-sort-asc");
const btnSortTime = document.getElementById("btn-sort-time");

function applySorting(type) {
  if (type === "asc") {
    currentItems.sort((a, b) => {
      const wA = a.word.replace(/<[^>]*>/g, "").toLowerCase();
      const wB = b.word.replace(/<[^>]*>/g, "").toLowerCase();
      return wA.localeCompare(wB, 'ja');
    });
    if (btnSortAsc) { btnSortAsc.style.background = "#3182ce"; btnSortAsc.style.color = "white"; }
    if (btnSortTime) { btnSortTime.style.background = "#edf2f7"; btnSortTime.style.color = "black"; }
  } else if (type === "time") {
    currentItems.sort((a, b) => a.id.localeCompare(b.id));
    if (btnSortTime) { btnSortTime.style.background = "#3182ce"; btnSortTime.style.color = "white"; }
    if (btnSortAsc) { btnSortAsc.style.background = "#edf2f7"; btnSortAsc.style.color = "black"; }
  }
  appendDebugLog("SORT", `ソート処理を実行しました: タイプ = ${type}`);
  syncWordDataOrder();
  currentCardIndex = 0;
  updateCardView();
  updateListView();
}

if (btnSortAsc) btnSortAsc.addEventListener("click", () => { applySorting("asc"); });
if (btnSortTime) btnSortTime.addEventListener("click", () => { applySorting("time"); });

// ========================================================
// 10. タブ切り替えロジック
// ========================================================
const btnCardView = document.getElementById("btn-card-view");
const btnListView = document.getElementById("btn-list-view");
const btnRegisterView = document.getElementById("btn-register-view");
const registerView = document.getElementById("register-view");

function hideAllViews() {
  if (cardView) cardView.classList.add("hidden");
  if (listView) listView.classList.add("hidden");
  if (registerView) registerView.classList.add("hidden");
  if (btnCardView) btnCardView.classList.remove("active");
  if (btnListView) btnListView.classList.remove("active");
  if (btnRegisterView) btnRegisterView.classList.remove("active");
}
if (btnCardView) btnCardView.addEventListener("click", () => { hideAllViews(); btnCardView.classList.add("active"); if (cardView) cardView.classList.remove("hidden"); });
if (btnListView) btnListView.addEventListener("click", () => { hideAllViews(); btnListView.classList.add("active"); if (listView) listView.classList.remove("hidden"); updateListView(); });
if (btnRegisterView) btnRegisterView.addEventListener("click", () => { hideAllViews(); btnRegisterView.classList.add("active"); if (registerView) registerView.classList.remove("hidden"); });

// ========================================================
// 11. 文字装飾機能
// ========================================================
document.querySelectorAll(".decorations").forEach(bar => {
  const targetId = bar.getAttribute("data-target");
  const textarea = document.getElementById(targetId);
  if (!textarea) return;

  const applyDecoration = (tagStart, tagEnd) => {
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(startPos, endPos);

    if (startPos === endPos) {
      alert("装飾したい文字列を選択してから押してください。");
      return;
    }

    textarea.value = text.substring(0, startPos) + tagStart + selectedText + tagEnd + text.substring(endPos);
    textarea.focus();
    textarea.setSelectionRange(startPos, startPos + tagStart.length + selectedText.length + tagEnd.length);
  };

  const btnBold = bar.querySelector(".btn-deco-bold");
  const btnRed = bar.querySelector(".btn-deco-red");
  const btnBlue = bar.querySelector(".btn-deco-blue");

  if (btnBold) btnBold.addEventListener("click", () => applyDecoration("<b>", "</b>"));
  if (btnRed) btnRed.addEventListener("click", () => applyDecoration("<span style='color:red;'>", "</span>"));
  if (btnBlue) btnBlue.addEventListener("click", () => applyDecoration("<span style='color:blue;'>", "</span>"));
});

// ========================================================
// 12. 単語の登録・修正・削除コアロジック
// ========================================================
const regLarge = document.getElementById("reg-large");
const regMedium = document.getElementById("reg-medium");
const regSmall = document.getElementById("reg-small");
const newLarge = document.getElementById("new-large");
const newMedium = document.getElementById("new-medium");
const newSmall = document.getElementById("new-small");
const inputWord = document.getElementById("input-word");
const inputMeaning = document.getElementById("input-meaning");
const inputImage = document.getElementById("input-image");
const imgPreviewContainer = document.getElementById("img-preview-container");
const imgPreview = document.getElementById("img-preview");
const btnClearImage = document.getElementById("btn-clear-image");
const btnRegister = document.getElementById("btn-register");
const btnCancelEdit = document.getElementById("btn-cancel-edit");

if (inputImage) {
  inputImage.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      base64ImageData = await compressImage(file, 400);
      if (imgPreview) imgPreview.src = base64ImageData;
      if (imgPreviewContainer) imgPreviewContainer.classList.remove("hidden");
    } catch (err) {
      alert("画像の圧縮処理に失敗しました。");
      appendDebugLog("IMAGE-ERROR", "画像圧縮エラー:", err.message);
    }
  });
}

if (btnClearImage) {
  btnClearImage.addEventListener("click", () => {
    base64ImageData = "";
    if (inputImage) inputImage.value = "";
    if (imgPreviewContainer) imgPreviewContainer.classList.add("hidden");
    if (imgPreview) imgPreview.src = "";
    appendDebugLog("IMAGE-CLEAR", "選択画像をクリアしました。");
  });
}

function initRegisterSelects() {
  if (!regLarge) return;
  regLarge.innerHTML = '<option value="">-- 既存の大項目 --</option>';
  if (wordData && Array.isArray(wordData.categories)) {
    wordData.categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      regLarge.appendChild(opt);
    });
  }
  if (regMedium) {
    regMedium.innerHTML = '<option value="">-- 既存の中項目 --</option>';
    regMedium.disabled = true;
  }
  if (regSmall) {
    regSmall.innerHTML = '<option value="">-- 既存の小項目 --</option>';
    regSmall.disabled = true;
  }
}

if (regLarge) {
  regLarge.addEventListener("change", (e) => {
    const largeId = e.target.value;
    if (regMedium) regMedium.innerHTML = '<option value="">-- 既存の中項目 --</option>';
    if (regSmall) {
      regSmall.innerHTML = '<option value="">-- 既存の小項目 --</option>';
      regSmall.disabled = true;
    }
    if (!largeId) { if (regMedium) regMedium.disabled = true; return; }
    const largeCat = wordData.categories.find(c => c.id === largeId);
    if (largeCat && Array.isArray(largeCat.subcategories)) {
      largeCat.subcategories.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub.id;
        opt.textContent = sub.name;
        if (regMedium) regMedium.appendChild(opt);
      });
      if (regMedium) regMedium.disabled = false;
    }
  });
}

if (regMedium) {
  regMedium.addEventListener("change", (e) => {
    const largeId = regLarge ? regLarge.value : "";
    const mediumId = e.target.value;
    if (regSmall) regSmall.innerHTML = '<option value="">-- 既存の小項目 --</option>';
    if (!mediumId) { if (regSmall) regSmall.disabled = true; return; }
    const largeCat = wordData.categories.find(c => c.id === largeId);
    const mediumCat = largeCat && Array.isArray(largeCat.subcategories) ? largeCat.subcategories.find(s => s.id === mediumId) : null;
    if (mediumCat && Array.isArray(mediumCat.sections)) {
      mediumCat.sections.forEach(sec => {
        const opt = document.createElement("option");
        opt.value = sec.id;
        opt.textContent = sec.name;
        if (regSmall) regSmall.appendChild(opt);
      });
      if (regSmall) regSmall.disabled = false;
    }
  });
}

window.startEditItem = function(itemId) {
  let foundItem = null;
  if (wordData && Array.isArray(wordData.categories)) {
    wordData.categories.forEach(c => {
      if (Array.isArray(c.subcategories)) {
        c.subcategories.forEach(s => {
          if (Array.isArray(s.sections)) {
            s.sections.forEach(sec => {
              const item = sec.items.find(i => i.id === itemId);
              if (item) foundItem = item;
            });
          }
        });
      }
    });
  }

  if (!foundItem) return;

  editingItemId = itemId;
  if (inputWord) inputWord.value = foundItem.word;
  if (inputMeaning) inputMeaning.value = foundItem.meaning;
  if (foundItem.image) {
    base64ImageData = foundItem.image;
    if (imgPreview) imgPreview.src = base64ImageData;
    if (imgPreviewContainer) imgPreviewContainer.classList.remove("hidden");
  } else {
    base64ImageData = "";
    if (imgPreviewContainer) imgPreviewContainer.classList.add("hidden");
  }

  document.getElementById("register-category-area")?.classList.add("hidden");
  document.getElementById("register-hr")?.classList.add("hidden");
  document.getElementById("edit-mode-notice")?.classList.remove("hidden");
  btnCancelEdit?.classList.remove("hidden");
  const headline = document.getElementById("register-headline");
  if (headline) headline.textContent = "✏️ 登録済単語の修正";
  if (btnRegister) {
    btnRegister.textContent = "修正を確定する";
    btnRegister.style.backgroundColor = "#ecc94b";
    btnRegister.style.color = "black";
  }

  appendDebugLog("EDIT-START", `単語修正モードに入りました (ID: ${itemId})`);
  if (btnRegisterView) btnRegisterView.click();
};

function exitEditMode() {
  editingItemId = null;
  if (inputWord) inputWord.value = "";
  if (inputMeaning) inputMeaning.value = "";
  base64ImageData = "";
  if (inputImage) inputImage.value = "";
  if (imgPreviewContainer) imgPreviewContainer.classList.add("hidden");
  if (imgPreview) imgPreview.src = "";

  document.getElementById("register-category-area")?.classList.remove("hidden");
  document.getElementById("register-hr")?.classList.remove("hidden");
  document.getElementById("edit-mode-notice")?.classList.add("hidden");
  btnCancelEdit?.classList.add("hidden");
  const headline = document.getElementById("register-headline");
  if (headline) headline.textContent = "📝 新しい単語・項目の登録";
  if (btnRegister) {
    btnRegister.textContent = "この内容で登録する";
    btnRegister.style.backgroundColor = "#3182ce";
    btnRegister.style.color = "white";
  }
}
if (btnCancelEdit) btnCancelEdit.addEventListener("click", exitEditMode);

window.deleteItem = function(itemId) {
  if (!confirm("本当にこの単語を削除してもよろしいですか？")) return;

  if (wordData && Array.isArray(wordData.categories)) {
    wordData.categories.forEach(c => {
      if (Array.isArray(c.subcategories)) {
        c.subcategories.forEach(s => {
          if (Array.isArray(s.sections)) {
            s.sections.forEach(sec => {
              const index = sec.items.findIndex(i => i.id === itemId);
              if (index !== -1) {
                sec.items.splice(index, 1);
              }
            });
          }
        });
      }
    });
  }

  appendDebugLog("DELETE", `単語を削除しました (ID: ${itemId})`);
  saveToLocalStorage();

  if (currentSmallId) {
    const largeCat = wordData.categories.find(c => c.id === selectLarge.value);
    const mediumCat = largeCat && Array.isArray(largeCat.subcategories) ? largeCat.subcategories.find(s => s.id === selectMedium.value) : null;
    const section = mediumCat && Array.isArray(mediumCat.sections) ? mediumCat.sections.find(sec => sec.id === currentSmallId) : null;
    currentItems = section ? [...section.items] : [];
    updateCardView();
    updateListView();
  } else {
    updateListView();
  }
  alert("単語を削除しました。");
};

if (btnRegister) {
  btnRegister.addEventListener("click", () => {
    const wordVal = inputWord ? inputWord.value.trim() : "";
    const meaningVal = inputMeaning ? inputMeaning.value.trim() : "";

    if (!wordVal || (!meaningVal && !base64ImageData)) {
      alert("単語と意味を入力してください。");
      return;
    }

    if (editingItemId) {
      let success = false;
      if (wordData && Array.isArray(wordData.categories)) {
        wordData.categories.forEach(c => {
          if (Array.isArray(c.subcategories)) {
            c.subcategories.forEach(s => {
              if (Array.isArray(s.sections)) {
                s.sections.forEach(sec => {
                  const item = sec.items.find(i => i.id === editingItemId);
                  if (item) {
                    item.word = wordVal;
                    item.meaning = meaningVal;
                    item.image = base64ImageData;
                    success = true;
                  }
                });
              }
            });
          }
        });
      }

      if (success) {
        appendDebugLog("EDIT-SUCCESS", `単語の修正を確定しました (ID: ${editingItemId})`);
        alert("単語を修正しました！");
        saveToLocalStorage();

        if (currentSmallId) {
          let foundSec = null;
          wordData.categories.forEach(c => {
            if (Array.isArray(c.subcategories)) {
              c.subcategories.forEach(s => {
                if (Array.isArray(s.sections)) {
                  s.sections.forEach(sec => {
                    if (sec.id === currentSmallId) foundSec = sec;
                  });
                }
              });
            }
          });
          if (foundSec) currentItems = [...foundSec.items];
          updateCardView();
          updateListView();
        }

        exitEditMode();
        if (btnListView) btnListView.click();
      } else {
        appendDebugLog("EDIT-ERROR", `修正対象の単語が見つかりませんでした (ID: ${editingItemId})`);
        alert("エラー: 修正対象の単語が見つかりませんでした。");
        exitEditMode();
      }

    } else {
      let largeId = regLarge ? regLarge.value : "";
      let largeName = newLarge ? newLarge.value.trim() : "";
      let mediumId = regMedium ? regMedium.value : "";
      let mediumName = newMedium ? newMedium.value.trim() : "";
      let smallId = regSmall ? regSmall.value : "";
      let smallName = newSmall ? newSmall.value.trim() : "";

      if (!largeId && !largeName) { alert("大項目を選択・入力してください。"); return; }
      if (largeId && !mediumId && !mediumName) { alert("中項目を選択・入力してください。"); return; }
      if ((largeId && mediumId) && !smallId && !smallName) { alert("小項目を選択・入力してください。"); return; }

      let isNewLarge = !largeId;
      let targetLarge = largeId ? wordData.categories.find(c => c.id === largeId) : { id: "large-" + Date.now(), name: largeName, subcategories: [] };
      if (isNewLarge) {
        wordData.categories.push(targetLarge);
        largeId = targetLarge.id;
      }

      let isNewMedium = !mediumId;
      let targetMedium = mediumId ? targetLarge.subcategories.find(s => s.id === mediumId) : { id: "medium-" + Date.now(), name: mediumName || "未分類の中項目", sections: [] };
      if (isNewMedium) {
        targetLarge.subcategories.push(targetMedium);
        mediumId = targetMedium.id;
      }

      let isNewSmall = !smallId;
      let targetSmall = smallId ? targetMedium.sections.find(sec => sec.id === smallId) : { id: "small-" + Date.now(), name: smallName || "未分類の小項目", items: [] };
      if (isNewSmall) {
        targetMedium.sections.push(targetSmall);
        smallId = targetSmall.id;
      }

      const newItem = {
        id: "item-" + Date.now(),
        word: wordVal,
        meaning: meaningVal,
        image: base64ImageData,
        memorized: false
      };
      targetSmall.items.push(newItem);

      appendDebugLog("REGISTER-NEW", `新しい単語を登録しました`, { itemId: newItem.id, word: wordVal, sectionId: targetSmall.id });
      alert(`単語を登録しました！`);

      if (inputWord) inputWord.value = "";
      if (inputMeaning) inputMeaning.value = "";
      base64ImageData = "";
      if (inputImage) inputImage.value = "";
      if (imgPreviewContainer) imgPreviewContainer.classList.add("hidden");
      if (imgPreview) imgPreview.src = "";
      if (newLarge) newLarge.value = "";
      if (newMedium) newMedium.value = "";
      if (newSmall) newSmall.value = "";

      if (currentSmallId === targetSmall.id) {
        currentItems = [...targetSmall.items];
        updateCardView();
        updateListView();
      }

      saveToLocalStorage();
      refreshAllDropdowns();
    }
  });
}

// ========================================================
// 13. 同期機能（書き出し・インポート補正＆確実な保存処理）
// ========================================================
const btnExportEl = document.getElementById("btn-export");
const btnImportTriggerEl = document.getElementById("btn-import-trigger");
const fileImportEl = document.getElementById("file-import");

if (btnImportTriggerEl && fileImportEl) {
  btnImportTriggerEl.addEventListener("click", () => {
    fileImportEl.click();
  });
}

if (btnExportEl) {
  btnExportEl.addEventListener("click", async () => {
    try {
      appendDebugLog("EXPORT-START", "JSON書き出し処理を開始します...");

      syncWordDataOrder();

      const jsonString = JSON.stringify(wordData, null, 2);
      const fileName = `tango_data_${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([jsonString], { type: "application/json" });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      appendDebugLog("EXPORT-SUCCESS", `JSON書き出し完了: ${fileName} (文字列長: ${jsonString.length}文字)`);
    } catch (err) {
      appendDebugLog("EXPORT-ERROR", "書き出し失敗:", err.message);
      alert("書き出しに失敗しました。");
    }
  });
}

if (fileImportEl) {
  fileImportEl.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    appendDebugLog("IMPORT-START", `JSONファイルのインポートを開始します: ${file.name}`);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawJson = JSON.parse(event.target.result);

        const parsedData = normalizeWordData(rawJson);

        if (parsedData && Array.isArray(parsedData.categories) && parsedData.categories.length > 0) {
          appendDebugLog("IMPORT-PARSED", "JSONデータの解析・補正が成功しました", {
            categoriesCount: parsedData.categories.length,
            firstCategoryName: parsedData.categories[0]?.name
          });

          if (confirm(`大項目数 ${parsedData.categories.length} 件のデータで上書き同期しますか？`)) {
            wordData = parsedData;

            await saveToLocalStorage();
            try {
              localStorage.setItem("wordData", JSON.stringify(wordData));
            } catch (lsErr) {
              appendDebugLog("IMPORT-WARN", "localStorageへのバックアップ保存はスキップされました:", lsErr.message);
            }

            refreshAllDropdowns();

            appendDebugLog("IMPORT-SUCCESS", "データ同期完了。プルダウンを直接更新しました。");
            alert("データの同期・読み込みが完了しました！");
          } else {
            appendDebugLog("IMPORT-CANCEL", "ユーザーによってインポートがキャンセルされました。");
          }
        } else {
          appendDebugLog("IMPORT-INVALID", "有効なカテゴリー構造が見つかりませんでした。", rawJson);
          alert("選択されたJSONデータ内に大項目(categories)データが見つかりませんでした。");
        }
      } catch (err) {
        appendDebugLog("IMPORT-ERROR", "インポート中に例外が発生しました:", err.message);
        alert("エラー: JSONファイルの形式が正しくありません。\n" + err.message);
      }
      fileImportEl.value = "";
    };
    reader.readAsText(file);
  });
}
