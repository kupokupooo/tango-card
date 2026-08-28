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

// ========================================================
// 2. IndexedDB 制御モジュール
// ========================================================
const DB_NAME = "TangoCardDB";
const DB_VERSION = 1;
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

// 既存コードとの互換性を保つための IndexedDB 保存関数
async function saveToLocalStorage() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(wordData, "wordData");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("IndexedDBへの保存に失敗しました:", err);
  }
}

async function initAppData() {
  try {
    const dbData = await loadDataFromDB();
    if (dbData) {
      wordData = dbData;
    } else {
      const localData = localStorage.getItem("wordData");
      if (localData) {
        wordData = JSON.parse(localData);
        await saveToLocalStorage();
      } else {
        await saveToLocalStorage();
      }
    }
    if (typeof initLargeSelect === "function") initLargeSelect();
    if (typeof initRegisterSelects === "function") initRegisterSelects();
  } catch (err) {
    console.error("データ初期化失敗:", err);
  }
}

initAppData();

// ========================================================
// 3. 画像の自動圧縮ロジック（縦横比維持・最大幅 400px）
// ========================================================
function compressImage(file, maxWidth = 400) {
  return new Promise((resolve, reject) => {
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
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

// HTML特殊文字のエスケープ処理
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
let currentSortType = "time";
let currentFontSize = 100;
let editingItemId = null;
let base64ImageData = ""; // 画像データの保持用変数

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
  fontSizeDisplay.textContent = currentFontSize + "%";
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
  wordData.categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    selectLarge.appendChild(opt);
  });
  selectMedium.innerHTML = '<option value="">中項目を選択</option>';
  selectMedium.disabled = true;
  selectSmall.innerHTML = '<option value="">小項目を選択</option>';
  selectSmall.disabled = true;
}

if (selectLarge) {
  selectLarge.addEventListener("change", (e) => {
    const largeId = e.target.value;
    selectMedium.innerHTML = '<option value="">中項目を選択</option>';
    selectSmall.innerHTML = '<option value="">小項目を選択</option>';
    selectSmall.disabled = true;

    if (!largeId) { selectMedium.disabled = true; resetCardViewStatus("大項目を選択してください"); return; }

    const largeCat = wordData.categories.find(c => c.id === largeId);
    if (largeCat && largeCat.subcategories) {
      largeCat.subcategories.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub.id;
        opt.textContent = sub.name;
        selectMedium.appendChild(opt);
      });
      selectMedium.disabled = false;
    }
    resetCardViewStatus("中項目を選択してください");
  });
}

if (selectMedium) {
  selectMedium.addEventListener("change", (e) => {
    const largeId = selectLarge.value;
    const mediumId = e.target.value;
    selectSmall.innerHTML = '<option value="">小項目を選択</option>';

    if (!mediumId) { selectSmall.disabled = true; resetCardViewStatus("中項目を選択してください"); return; }

    const largeCat = wordData.categories.find(c => c.id === largeId);
    const mediumCat = largeCat.subcategories.find(s => s.id === mediumId);
    if (mediumCat && mediumCat.sections) {
      mediumCat.sections.forEach(sec => {
        const opt = document.createElement("option");
        opt.value = sec.id;
        opt.textContent = sec.name;
        selectSmall.appendChild(opt);
      });
      selectSmall.disabled = false;
    }
    resetCardViewStatus("小項目を選択してください");
  });
}

if (selectSmall) {
  selectSmall.addEventListener("change", (e) => {
    currentSmallId = e.target.value;
    if (!currentSmallId) { resetCardViewStatus("小項目を選択してください"); currentItems = []; return; }

    const largeCat = wordData.categories.find(c => c.id === selectLarge.value);
    const mediumCat = largeCat.subcategories.find(s => s.id === selectMedium.value);
    const section = mediumCat.sections.find(sec => sec.id === currentSmallId);

    if (section) {
      currentItems = section.items || [];
      applySorting();
    }
  });
}

function resetCardViewStatus(message) {
  if (!cardText) return;
  cardText.innerHTML = message;
  btnPrev.disabled = true;
  btnToggleAnswer.disabled = true;
  btnNext.disabled = true;
  btnMemorized.disabled = true;
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
  btnToggleAnswer.textContent = "意味を見る";
  cardText.innerHTML = safeHTML(item.word);
  wordCard.style.backgroundColor = "";

  btnPrev.disabled = currentCardIndex === 0;
  btnNext.disabled = currentCardIndex === currentItems.length - 1;
  btnToggleAnswer.disabled = false;
  btnMemorized.disabled = false;

  if (item.memorized) {
    btnMemorized.textContent = "覚えたマーク解除";
    btnMemorized.style.backgroundColor = "#e53e3e";
    wordCard.style.borderLeft = "10px solid #48bb78";
  } else {
    btnMemorized.textContent = "覚えた！";
    btnMemorized.style.backgroundColor = "#48bb78";
    wordCard.style.borderLeft = "10px solid #cbd5e0";
  }
  hideCardImage();
}

if (btnToggleAnswer) {
  btnToggleAnswer.addEventListener("click", () => {
    if (currentItems.length === 0) return;
    const item = currentItems[currentCardIndex];
    isShowingAnswer = !isShowingAnswer;

    if (isShowingAnswer) {
      cardText.innerHTML = safeHTML(item.meaning);
      btnToggleAnswer.textContent = "単語を見る";
      wordCard.style.backgroundColor = "#FFFAF0";
      showCardImage(item.image);
    } else {
      cardText.innerHTML = safeHTML(item.word);
      btnToggleAnswer.textContent = "意味を見る";
      wordCard.style.backgroundColor = "";
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
    saveToLocalStorage();
    updateCardView();
  });
}

if (wordCard) {
  wordCard.addEventListener("click", (e) => {
    if (currentItems.length === 0 || btnToggleAnswer.disabled) return;
    if (e.target.id === 'card-img' || (cardImageContainer && cardImageContainer.contains(e.target))) {
      return;
    }
    btnToggleAnswer.click();
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

// モーダル表示機能
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
  wordData.categories.forEach(c => {
    c.subcategories.forEach(s => {
      s.sections.forEach(sec => {
        if (sec.id === currentSmallId) {
          sec.items = [...currentItems];
        }
      });
    });
  });
}

// ========================================================
// 9. 並べ替え (ソート) ロジック
// ========================================================
const btnSortAsc = document.getElementById("btn-sort-asc");
const btnSortTime = document.getElementById("btn-sort-time");

function applySorting() {
  if (currentSortType === "asc") {
    currentItems.sort((a, b) => {
      const wA = a.word.replace(/<[^>]*>/g, "").toLowerCase();
      const wB = b.word.replace(/<[^>]*>/g, "").toLowerCase();
      return wA.localeCompare(wB, 'ja');
    });
    if (btnSortAsc) { btnSortAsc.style.background = "#3182ce"; btnSortAsc.style.color = "white"; }
    if (btnSortTime) { btnSortTime.style.background = "#edf2f7"; btnSortTime.style.color = "black"; }
  } else {
    currentItems.sort((a, b) => a.id.localeCompare(b.id));
    if (btnSortTime) { btnSortTime.style.background = "#3182ce"; btnSortTime.style.color = "white"; }
    if (btnSortAsc) { btnSortAsc.style.background = "#edf2f7"; btnSortAsc.style.color = "black"; }
  }
  currentCardIndex = 0;
  updateCardView();
  updateListView();
}

if (btnSortAsc) btnSortAsc.addEventListener("click", () => { currentSortType = "asc"; applySorting(); });
if (btnSortTime) btnSortTime.addEventListener("click", () => { currentSortType = "time"; applySorting(); });

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
if (btnCardView) btnCardView.addEventListener("click", () => { hideAllViews(); btnCardView.classList.add("active"); cardView.classList.remove("hidden"); });
if (btnListView) btnListView.addEventListener("click", () => { hideAllViews(); btnListView.classList.add("active"); listView.classList.remove("hidden"); updateListView(); });
if (btnRegisterView) btnRegisterView.addEventListener("click", () => { hideAllViews(); btnRegisterView.classList.add("active"); registerView.classList.remove("hidden"); });

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
// 12. 単語の登録・修正・削除コアロジック（圧縮連動版）
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

// ★ 修正：画像変更時に幅400pxの自動圧縮ロジックを強制適用 ★
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
      console.error(err);
    }
  });
}

if (btnClearImage) {
  btnClearImage.addEventListener("click", () => {
    base64ImageData = "";
    if (inputImage) inputImage.value = "";
    if (imgPreviewContainer) imgPreviewContainer.classList.add("hidden");
    if (imgPreview) imgPreview.src = "";
  });
}

function initRegisterSelects() {
  if (!regLarge) return;
  regLarge.innerHTML = '<option value="">-- 既存の大項目 --</option>';
  wordData.categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    regLarge.appendChild(opt);
  });
  regMedium.innerHTML = '<option value="">-- 既存の中項目 --</option>';
  regMedium.disabled = true;
  regSmall.innerHTML = '<option value="">-- 既存の小項目 --</option>';
  regSmall.disabled = true;
}

if (regLarge) {
  regLarge.addEventListener("change", (e) => {
    const largeId = e.target.value;
    regMedium.innerHTML = '<option value="">-- 既存の中項目 --</option>';
    regSmall.innerHTML = '<option value="">-- 既存の小項目 --</option>';
    regSmall.disabled = true;
    if (!largeId) { regMedium.disabled = true; return; }
    const largeCat = wordData.categories.find(c => c.id === largeId);
    if (largeCat && largeCat.subcategories) {
      largeCat.subcategories.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub.id;
        opt.textContent = sub.name;
        regMedium.appendChild(opt);
      });
      regMedium.disabled = false;
    }
  });
}

if (regMedium) {
  regMedium.addEventListener("change", (e) => {
    const largeId = regLarge.value;
    const mediumId = e.target.value;
    regSmall.innerHTML = '<option value="">-- 既存の小項目 --</option>';
    if (!mediumId) { regSmall.disabled = true; return; }
    const largeCat = wordData.categories.find(c => c.id === largeId);
    const mediumCat = largeCat.subcategories.find(s => s.id === mediumId);
    if (mediumCat && mediumCat.sections) {
      mediumCat.sections.forEach(sec => {
        const opt = document.createElement("option");
        opt.value = sec.id;
        opt.textContent = sec.name;
        regSmall.appendChild(opt);
      });
      regSmall.disabled = false;
    }
  });
}

window.startEditItem = function(itemId) {
  let foundItem = null;
  wordData.categories.forEach(c => {
    c.subcategories.forEach(s => {
      s.sections.forEach(sec => {
        const item = sec.items.find(i => i.id === itemId);
        if (item) foundItem = item;
      });
    });
  });

  if (!foundItem) return;

  editingItemId = itemId;
  inputWord.value = foundItem.word;
  inputMeaning.value = foundItem.meaning;
  if (foundItem.image) {
    base64ImageData = foundItem.image;
    imgPreview.src = base64ImageData;
    imgPreviewContainer.classList.remove("hidden");
  } else {
    base64ImageData = "";
    imgPreviewContainer.classList.add("hidden");
  }

  document.getElementById("register-category-area")?.classList.add("hidden");
  document.getElementById("register-hr")?.classList.add("hidden");
  document.getElementById("edit-mode-notice")?.classList.remove("hidden");
  btnCancelEdit?.classList.remove("hidden");
  document.getElementById("register-headline").textContent = "✏️ 登録済単語の修正";
  btnRegister.textContent = "修正を確定する";
  btnRegister.style.backgroundColor = "#ecc94b";
  btnRegister.style.color = "black";

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
  document.getElementById("register-headline").textContent = "📝 新しい単語・項目の登録";
  if (btnRegister) {
    btnRegister.textContent = "この内容で登録する";
    btnRegister.style.backgroundColor = "#3182ce";
    btnRegister.style.color = "white";
  }
}
if (btnCancelEdit) btnCancelEdit.addEventListener("click", exitEditMode);

window.deleteItem = function(itemId) {
  if (!confirm("本当にこの単語を削除してもよろしいですか？")) return;

  wordData.categories.forEach(c => {
    c.subcategories.forEach(s => {
      s.sections.forEach(sec => {
        const index = sec.items.findIndex(i => i.id === itemId);
        if (index !== -1) {
          sec.items.splice(index, 1);
        }
      });
    });
  });

  saveToLocalStorage();

  if (currentSmallId) {
    const largeCat = wordData.categories.find(c => c.id === selectLarge.value);
    const mediumCat = largeCat.subcategories.find(s => s.id === selectMedium.value);
    const section = mediumCat.sections.find(sec => sec.id === currentSmallId);
    currentItems = section ? section.items : [];
    applySorting();
  } else {
    updateListView();
  }
  alert("単語を削除しました。");
};

if (btnRegister) {
  btnRegister.addEventListener("click", () => {
    const wordVal = inputWord.value.trim();
    const meaningVal = inputMeaning.value.trim();

    if (!wordVal || (!meaningVal && !base64ImageData)) {
      alert("単語と意味を入力してください。");
      return;
    }

    if (editingItemId) {
      let success = false;
      wordData.categories.forEach(c => {
        c.subcategories.forEach(s => {
          s.sections.forEach(sec => {
            const item = sec.items.find(i => i.id === editingItemId);
            if (item) {
              item.word = wordVal;
              item.meaning = meaningVal;
              item.image = base64ImageData;
              success = true;
            }
          });
        });
      });

      if (success) {
        alert("単語を修正しました！");
        saveToLocalStorage();

        if (currentSmallId) {
          let foundSec = null;
          wordData.categories.forEach(c => {
            c.subcategories.forEach(s => {
              s.sections.forEach(sec => {
                if (sec.id === currentSmallId) foundSec = sec;
              });
            });
          });
          if (foundSec) currentItems = foundSec.items;
          applySorting();
        }

        exitEditMode();
        if (btnListView) btnListView.click();
      } else {
        alert("エラー: 修正対象の単語が見つかりませんでした。");
        exitEditMode();
      }

    } else {
      let largeId = regLarge.value;
      let largeName = newLarge.value.trim();
      let mediumId = regMedium.value;
      let mediumName = newMedium.value.trim();
      let smallId = regSmall.value;
      let smallName = newSmall.value.trim();

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
      alert(`単語を登録しました！`);

      inputWord.value = "";
      inputMeaning.value = "";
      base64ImageData = "";
      inputImage.value = "";
      imgPreviewContainer.classList.add("hidden");
      imgPreview.src = "";
      newLarge.value = "";
      newMedium.value = "";
      newSmall.value = "";

      if (currentSmallId === targetSmall.id) {
        currentItems = targetSmall.items;
        applySorting();
      }

      saveToLocalStorage();
      initLargeSelect();

      regLarge.innerHTML = '<option value="">-- 既存の大項目 --</option>';
      wordData.categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.name;
        regLarge.appendChild(opt);
      });
      regLarge.value = largeId;

      regMedium.innerHTML = '<option value="">-- 既存の中項目 --</option>';
      if (largeId) {
        const activeLarge = wordData.categories.find(c => c.id === largeId);
        if (activeLarge && activeLarge.subcategories) {
          activeLarge.subcategories.forEach(sub => {
            const opt = document.createElement("option");
            opt.value = sub.id;
            opt.textContent = sub.name;
            regMedium.appendChild(opt);
          });
          regMedium.disabled = false;
          regMedium.value = mediumId;
        }
      } else {
        regMedium.disabled = true;
      }

      regSmall.innerHTML = '<option value="">-- 既存の小項目 --</option>';
      if (largeId && mediumId) {
        const activeLarge = wordData.categories.find(c => c.id === largeId);
        const activeMedium = activeLarge.subcategories.find(s => s.id === mediumId);
        if (activeMedium && activeMedium.sections) {
          activeMedium.sections.forEach(sec => {
            const opt = document.createElement("option");
            opt.value = sec.id;
            opt.textContent = sec.name;
            regSmall.appendChild(opt);
          });
          regSmall.disabled = false;
          regSmall.value = smallId;
        }
      } else {
        regSmall.disabled = true;
      }
    }
  });
}

initRegisterSelects();
exitEditMode();

// ========================================================
// 13. 同期機能（安定化エクスポート・インポート）
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
      const jsonString = JSON.stringify(wordData, null, 2);
      const fileName = `tango_data_${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([jsonString], { type: "application/json" });

      // iOS Safari等の直接ダウンロード用フォールバック
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert("書き出しに失敗しました。");
    }
  });
}

if (fileImportEl) {
  fileImportEl.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);

        if (importedData && Array.isArray(importedData.categories)) {
          if (confirm("データを上書き同期しますか？")) {
            wordData = importedData;
            await saveToLocalStorage();
            alert("同期完了！");
            location.reload();
          }
        } else {
          alert("無効なデータ形式です。単語帳のJSONファイルを選択してください。");
        }
      } catch (err) {
        alert("エラー: " + err.message);
      }
      fileImportEl.value = "";
    };
    reader.readAsText(file);
  });
}
