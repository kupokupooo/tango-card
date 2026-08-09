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
// 2. ローカルストレージ連携
// ========================================================
const STORAGE_KEY = "hierarchical_word_app_data";
function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wordData));
}
function loadFromLocalStorage() {
  const localData = localStorage.getItem(STORAGE_KEY);
  if (localData) {
    try { wordData = JSON.parse(localData); } catch (e) { console.error("データ破損のため初期データを使用します", e); }
  }
}
loadFromLocalStorage();

// ========================================================
// 3. アプリの状態管理 (State)
// ========================================================
let currentItems = [];
let currentCardIndex = 0;
let isShowingAnswer = false;
let currentSmallId = "";
let currentSortType = "time"; // "time" (登録順) または "asc" (辞書順)
let currentFontSize = 100;    // %表示
let editingItemId = null;     // 修正中のアイテムID（nullなら新規登録モード）

// HTML特殊文字を安全にしつつ、特定の装飾タグだけ復活させる関数
function safeHTML(str) {
  if (!str) return "";
  let escaped = str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  escaped = escaped.replace(/&lt;b&gt;/gi, "<b>").replace(/&lt;\/b&gt;/gi, "</b>");
  escaped = escaped.replace(/&lt;span style=&quot;color:red;&quot;&gt;/gi, '<span style="color:red;">');
  escaped = escaped.replace(/&lt;span style=&quot;color:blue;&quot;&gt;/gi, '<span style="color:blue;">');
  escaped = escaped.replace(/&lt;\/span&gt;/gi, "</span>");
  return escaped;
}

// ========================================================
// 4. DOM要素の取得
// ========================================================
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

const wordListTbody = document.getElementById("word-list-tbody");

const cardImageContainer = document.getElementById("card-image-container");
const cardImg = document.getElementById("card-img");
const imageModal = document.getElementById("image-modal");
const modalImg = document.getElementById("modal-img");

// 追加: 画像拡大ボタンの取得
const btnZoomImage = document.getElementById("btn-zoom-image");

// ========================================================
// 5. フォントサイズ変更機能のロジック
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
btnFontDecrease.addEventListener("click", () => {
  if (currentFontSize > 70) { currentFontSize -= 10; applyFontSize(); }
});
btnFontIncrease.addEventListener("click", () => {
  if (currentFontSize < 200) { currentFontSize += 10; applyFontSize(); }
});

// ========================================================
// 6. 3階層連動プルダウンロジック
// ========================================================
function initLargeSelect() {
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

function resetCardViewStatus(message) {
  cardText.innerHTML = message;
  btnPrev.disabled = true;
  btnToggleAnswer.disabled = true;
  btnNext.disabled = true;
  btnMemorized.disabled = true;
  hideCardImage();
}

// ========================================================
// 7. 単語カード画面の描画・操作ロジック
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

// ★追加: 「単語」表示の初期状態に戻るため、背景色をリセット
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

// 意味を見る・単語を見るの切り替え
btnToggleAnswer.addEventListener("click", () => {
  if (currentItems.length === 0) return;
  const item = currentItems[currentCardIndex];
  isShowingAnswer = !isShowingAnswer;

  if (isShowingAnswer) {
    cardText.innerHTML = safeHTML(item.meaning);
    btnToggleAnswer.textContent = "単語を見る";

    // ★追加: 「意味」表示のときに背景色を #FFFAF0 に変更
    wordCard.style.backgroundColor = "#FFFAF0";

    showCardImage(item.image);
  } else {
    cardText.innerHTML = safeHTML(item.word);
    btnToggleAnswer.textContent = "意味を見る";

    // ★追加: 「単語」表示に戻ったら背景色をクリア（元のCSS準拠にする）
    wordCard.style.backgroundColor = "";

    hideCardImage();
  }
});

// 「前へ」ボタン
btnPrev.addEventListener("click", () => {
  if (currentCardIndex > 0) {
    currentCardIndex--;
    updateCardView();
  }
});

// 「次へ」ボタン
btnNext.addEventListener("click", () => {
  if (currentCardIndex < currentItems.length - 1) {
    currentCardIndex++;
    updateCardView();
  }
});

// 「覚えた！」ボタン
btnMemorized.addEventListener("click", () => {
  if (currentItems.length === 0) return;
  const item = currentItems[currentCardIndex];
  item.memorized = !item.memorized;
  saveToLocalStorage();
  updateCardView();
});

// カード全体のタップイベント（画像以外がタップされた時だけ反転させる）
wordCard.addEventListener("click", (e) => {
  if (currentItems.length === 0 || btnToggleAnswer.disabled) return;

  // タップされた要素が、画像(card-img)または画像コンテナ内部の場合は反転処理を一切スキップ
  if (e.target.id === 'card-img' || cardImageContainer.contains(e.target)) {
    return;
  }

  btnToggleAnswer.click();
});

// ========================================================
// 7. 単語カード画面の描画・操作ロジック（モーダル修正版）
// ========================================================

// 【修正・強化】モーダル表示処理の共通関数
function openImageModal(imgSrc) {
  // 有効な画像データ（Base64含む）があるかチェック
  if (!imgSrc || imgSrc === window.location.href || imgSrc.endsWith('/')) {
    console.warn("拡大する画像データがありません");
    return;
  }

  // もしHTML側に #image-modal が存在しない場合は動的に生成する
  let targetModal = document.getElementById("image-modal");
  if (!targetModal) {
    targetModal = document.createElement("div");
    targetModal.id = "image-modal";
    document.body.appendChild(targetModal);
  }

  // 指示通りの仕様（縦横比維持・カード本体幅の10%引きを上限）を満たす構造を強制注入
  targetModal.innerHTML = `
    <div class="modal-content-wrapper">
      <img id="modal-img" src="${imgSrc}" alt="拡大画像" />
      <button id="btn-close-modal">閉じる</button>
    </div>
  `;

  // モーダルを表示（hiddenクラスを確実に除去し、flex配置にする）
  targetModal.classList.remove('hidden');
  targetModal.style.display = 'flex';

  // 閉じるボタンのイベントを設定
  const closeBtn = targetModal.querySelector('#btn-close-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      targetModal.classList.add('hidden');
      targetModal.style.display = 'none';
    });
  }

  // 背景エリアをタップしても閉じられるように設定
  targetModal.onclick = function(e) {
    if (e.target === targetModal) {
      targetModal.classList.add('hidden');
      targetModal.style.display = 'none';
    }
  };
}

// 【修正】「画像拡大」ボタンのクリックイベント
if (btnZoomImage) {
  btnZoomImage.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); // 親要素（カード反転など）へのイベント伝播を完全に阻止

    // 現在カードに表示されている画像ソースを取得して渡す
    if (cardImg && cardImg.src) {
      openImageModal(cardImg.src);
    } else {
      alert("拡大する画像がありません。");
    }
  });
}

// カードの画像を直接タップした時も同じ仕様で動くように補正
if (cardImg) {
  cardImg.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openImageModal(cardImg.src);
  });
}

// ========================================================
// 8. 単語一覧の描画（ドラッグ＆ドロップ機能付き）
// ========================================================
function updateListView() {
  const tbody = document.getElementById("word-list-tbody");
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
    tdDrag.innerHTML = "☰";
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
    btnSortAsc.style.background = "#3182ce";
    btnSortAsc.style.color = "white";
    btnSortTime.style.background = "#edf2f7";
    btnSortTime.style.color = "black";
  } else {
    currentItems.sort((a, b) => a.id.localeCompare(b.id));
    btnSortTime.style.background = "#3182ce";
    btnSortTime.style.color = "white";
    btnSortAsc.style.background = "#edf2f7";
    btnSortAsc.style.color = "black";
  }
  currentCardIndex = 0;
  updateCardView();
  updateListView();
}

btnSortAsc.addEventListener("click", () => { currentSortType = "asc"; applySorting(); });
btnSortTime.addEventListener("click", () => { currentSortType = "time"; applySorting(); });

// ========================================================
// 10. タブ切り替えロジック
// ========================================================
const btnCardView = document.getElementById("btn-card-view");
const btnListView = document.getElementById("btn-list-view");
const btnRegisterView = document.getElementById("btn-register-view");
const registerView = document.getElementById("register-view");

function hideAllViews() {
  cardView.classList.add("hidden");
  listView.classList.add("hidden");
  registerView.classList.add("hidden");
  btnCardView.classList.remove("active");
  btnListView.classList.remove("active");
  btnRegisterView.classList.remove("active");
}
btnCardView.addEventListener("click", () => { hideAllViews(); btnCardView.classList.add("active"); cardView.classList.remove("hidden"); });
btnListView.addEventListener("click", () => { hideAllViews(); btnListView.classList.add("active"); listView.classList.remove("hidden"); updateListView(); });
btnRegisterView.addEventListener("click", () => { hideAllViews(); btnRegisterView.classList.add("active"); registerView.classList.remove("hidden"); });

// ========================================================
// 11. 初期実行
// ========================================================
initLargeSelect();

// ========================================================
// 12. 同期（インポート/エクスポート）
// ========================================================
const btnExport = document.getElementById("btn-export");
const btnImportTrigger = document.getElementById("btn-import-trigger");
const fileImport = document.getElementById("file-import");

btnExport.addEventListener("click", () => {
  const dataStr = JSON.stringify(wordData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tango_data.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  alert("データを書き出しました！");
});
btnImportTrigger.addEventListener("click", () => { fileImport.click(); });
fileImport.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (confirm("データを上書き同期しますか？")) {
        wordData = importedData;
        saveToLocalStorage();
        initLargeSelect();
        initRegisterSelects();
        resetCardViewStatus("小項目を選択してください");
        alert("同期完了！");
      }
    } catch (err) { alert("エラー: " + err.message); }
  };
  reader.readAsText(file);
  fileImport.value = "";
});

// ========================================================
// 13. 文字装飾機能
// ========================================================
document.querySelectorAll(".decorations").forEach(bar => {
  const targetId = bar.getAttribute("data-target");
  const textarea = document.getElementById(targetId);

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

  bar.querySelector(".btn-deco-bold").addEventListener("click", () => applyDecoration("<b>", "</b>"));
  bar.querySelector(".btn-deco-red").addEventListener("click", () => applyDecoration("<span style='color:red;'>", "</span>"));
  bar.querySelector(".btn-deco-blue").addEventListener("click", () => applyDecoration("<span style='color:blue;'>", "</span>"));
});

// ========================================================
// 14. 単語の登録・修正・削除コアロジック
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

let base64ImageData = "";

inputImage.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    base64ImageData = event.target.result;
    imgPreview.src = base64ImageData;
    imgPreviewContainer.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

btnClearImage.addEventListener("click", () => {
  base64ImageData = "";
  inputImage.value = "";
  imgPreviewContainer.classList.add("hidden");
  imgPreview.src = "";
});

function initRegisterSelects() {
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

  document.getElementById("register-category-area").classList.add("hidden");
  document.getElementById("register-hr").classList.add("hidden");
  document.getElementById("edit-mode-notice").classList.remove("hidden");
  btnCancelEdit.classList.remove("hidden");
  document.getElementById("register-headline").textContent = "✏️ 登録済単語の修正";
  btnRegister.textContent = "修正を確定する";
  btnRegister.style.backgroundColor = "#ecc94b";
  btnRegister.style.color = "black";

  btnRegisterView.click();
};

function exitEditMode() {
  editingItemId = null;
  inputWord.value = "";
  inputMeaning.value = "";
  base64ImageData = "";
  inputImage.value = "";
  imgPreviewContainer.classList.add("hidden");
  imgPreview.src = "";

  document.getElementById("register-category-area").classList.remove("hidden");
  document.getElementById("register-hr").classList.remove("hidden");
  document.getElementById("edit-mode-notice").classList.add("hidden");
  btnCancelEdit.classList.add("hidden");
  document.getElementById("register-headline").textContent = "➕ 新しい単語・項目の登録";
  btnRegister.textContent = "この内容で登録する";
  btnRegister.style.backgroundColor = "#3182ce";
  btnRegister.style.color = "white";
}
btnCancelEdit.addEventListener("click", exitEditMode);

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
      btnListView.click();
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

initRegisterSelects();
exitEditMode();

// ========================================================
// 15. 画像の表示・エスケープ装飾タグ復元の上書き補正
// ========================================================
function hideCardImage() {
  cardImageContainer.classList.add("hidden");
  cardImageContainer.style.display = "none";
  cardImg.removeAttribute('src');
  // 画像がないので画像拡大ボタンを非表示にする
  if (btnZoomImage) btnZoomImage.classList.add("hidden");
}

function showCardImage(base64Data) {
  if (!base64Data) { hideCardImage(); return; }
  cardImg.src = base64Data;
  cardImageContainer.classList.remove("hidden");
  cardImageContainer.style.display = "block";
  // 画像が存在するので画像拡大ボタンを表示する
  if (btnZoomImage) btnZoomImage.classList.remove("hidden");
}

safeHTML = function(str) {
  if (!str) return "";
  let escaped = str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  escaped = escaped.replace(/&lt;b&gt;/gi, "<b>").replace(/&lt;\/b&gt;/gi, "</b>");
  escaped = escaped.replace(/&lt;span style=&#039;color:red;&#039;&gt;/gi, '<span style="color:red;">');
  escaped = escaped.replace(/&lt;\/span&gt;/gi, "</span>");
  return escaped;
};
