function isUnlocked(card){
  if(!card.parentId) return true;
  const parent = cards.find(c => c.id === card.parentId);
  if(!parent) return true;
  return parent.status === 'correct';
}

function matchesStarFilter(c){
  const s = c.stars || 0;
  switch(starFilter){
    case 'eq3': return s === 3;
    case 'eq2': return s === 2;
    case 'eq1': return s === 1;
    case 'ge1': return s >= 1;
    case 'ge2': return s >= 2;
    default: return true;
  }
}

function getPool(){
  return cards.filter(c => {
    if(reviewMode === 'wrong' && c.status !== 'wrong') return false;
    if(reviewMode === 'selected' && !selectedIds.includes(c.id)) return false;
    if(!matchesStarFilter(c)) return false;
    return true;
  });
}

function shuffle(arr){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 이번 풀(pool) 안에서 무작위 순서를 만들되, 선행문제(parentId)가 있고
// 그 선행문제도 같은 풀에 있다면 선행문제보다 먼저 나오지 않도록 순서를 보장한다.
// (선행문제가 이번 풀에 없다면 — 다른 필터에 걸러졌다면 — 제약 없이 아무 때나 나올 수 있다)
function buildOrderedQueue(poolCards){
  const idSet = new Set(poolCards.map(c => c.id));
  const remaining = new Map(poolCards.map(c => [c.id, c]));
  const placed = new Set();
  const result = [];
  function isReady(c){
    if(!c.parentId) return true;
    if(c.parentId === c.id) return true;
    if(!idSet.has(c.parentId)) return true;
    return placed.has(c.parentId);
  }
  while(remaining.size > 0){
    const readyIds = [...remaining.keys()].filter(id => isReady(remaining.get(id)));
    if(readyIds.length === 0){
      // 이론상 순환 참조 등 예외 상황 — 남은 걸 그냥 다 넣어서 무한루프 방지
      [...remaining.keys()].forEach(id => { result.push(id); placed.add(id); });
      remaining.clear();
      break;
    }
    const pick = readyIds[Math.floor(Math.random() * readyIds.length)];
    result.push(pick);
    placed.add(pick);
    remaining.delete(pick);
  }
  return result;
}

// "시작!" - 현재 필터 조건에 맞는 문제 전부(잠긴 문제 포함)를 대상으로 새 라운드를 시작
function startSession(){
  const pool = getPool();
  if(pool.length === 0){
    sessionActive = false;
    sessionDone = false;
    currentCard = null;
    return;
  }
  reviewQueue = buildOrderedQueue(pool);
  queueIndex = 0;
  sessionActive = true;
  sessionDone = false;
  currentCard = cards.find(c => c.id === reviewQueue[0]) || null;
}

// 다음 문제로 이동. 큐를 다 쓰면 라운드 종료 — 자동으로 다시 섞지 않고 멈춘다.
function nextCard(){
  queueIndex++;
  if(queueIndex >= reviewQueue.length){
    sessionDone = true;
    currentCard = null;
    return;
  }
  const id = reviewQueue[queueIndex];
  const found = cards.find(c => c.id === id);
  if(!found){
    // 그 사이 삭제된 카드면 건너뜀
    nextCard();
    return;
  }
  currentCard = found;
}

// 이전 문제로 돌아가기. 큐의 맨 처음이면 더 갈 곳이 없음.
function prevCard(){
  if(queueIndex <= 0) return;
  queueIndex--;
  sessionDone = false;
  const id = reviewQueue[queueIndex];
  const found = cards.find(c => c.id === id);
  if(!found){
    // 그 사이 삭제된 카드면 한 칸 더 앞으로
    prevCard();
    return;
  }
  currentCard = found;
}

function populateParentSelect(){
  const sel = document.getElementById('parent-input');
  sel.innerHTML = '<option value="">없음 (독립 문제)</option>';
  cards.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.q.slice(0, 30) + (c.q.length > 30 ? '...' : '');
    sel.appendChild(opt);
  });
}

function starWidgetHtml(card, source){
  const cur = card.stars || 0;
  return `<span class="star-widget" data-source="${source}" data-id="${card.id}">` +
    [1,2,3].map(n => `<span class="star ${cur >= n ? '' : 'empty'}" data-id="${card.id}" data-val="${n}">${cur >= n ? '★' : '☆'}</span>`).join('') +
    `</span>`;
}

function setStars(id, val){
  const c = cards.find(x => x.id === id);
  if(!c) return;
  c.stars = (c.stars === val) ? 0 : val;
  saveCards();
}

function renderStats(){
  document.getElementById('stat-total').textContent = `전체 ${cards.length}개`;
  document.getElementById('stat-pool').textContent = `복습 대상 ${getPool().length}개`;
}

function renderReview(){
  const area = document.getElementById('review-area');
  if(cards.length === 0){
    area.innerHTML = '<div class="empty">아직 저장된 문제가 없어요.<br>"문제 추가" 탭에서 문제를 만들어보세요.</div>';
    renderStats();
    return;
  }
  const pool = getPool();
  if(pool.length === 0){
    let reason = '조건에 맞는 문제가 없어요.';
    if(reviewMode === 'wrong') reason = '틀린 문제가 없어요. 잘하고 있어요!';
    if(reviewMode === 'selected') reason = '선택한 문제가 없거나 아직 잠겨있어요.';
    sessionActive = false;
    area.innerHTML = `<div class="empty">${reason}</div>`;
    renderStats();
    return;
  }
  if(!sessionActive){
    area.innerHTML = `
      <div class="card">
        <p class="q" style="margin-bottom:18px;">전체 / 틀린 것만 + 중요도를 고른 뒤 시작하면,<br>이번 라운드에 해당하는 문제 ${pool.length}개를 한 번씩 겹치지 않게 순서대로 풀어볼게요.<br>(선행 문제가 있는 문제는 선행 문제보다 먼저 나오지 않아요)</p>
        <div class="row">
          <button class="primary grow" id="start-review-btn">시작!</button>
        </div>
      </div>
    `;
    document.getElementById('start-review-btn').addEventListener('click', () => {
      startSession();
      renderReview();
    });
    renderStats();
    return;
  }
  if(sessionDone){
    area.innerHTML = `
      <div class="card">
        <p class="q" style="margin-bottom:18px;">이번 라운드 문제 ${reviewQueue.length}개를 모두 풀었어요! 🎉</p>
        <div class="row">
          <button id="prev-from-done-btn">← 마지막 문제로</button>
          <button class="primary grow" id="restart-review-btn">다시 섞어서 시작!</button>
        </div>
      </div>
    `;
    document.getElementById('prev-from-done-btn').addEventListener('click', () => {
      prevCard();
      renderReview();
    });
    document.getElementById('restart-review-btn').addEventListener('click', () => {
      startSession();
      renderReview();
    });
    renderStats();
    return;
  }
  if(!currentCard || !cards.find(c => c.id === currentCard.id)){
    // 진행 중이던 카드가 그 사이 삭제된 경우 다음 카드로 건너뜀
    nextCard();
    renderReview();
    return;
  }
  const card = currentCard;
  const defaultStarter = card.starter && card.starter.trim() ? card.starter : 'def solve():\n    pass\n\nprint(solve())';
  area.innerHTML = `
    <div class="card">
      <p class="q">${esc(card.q)}</p>
      <textarea id="code-input">${esc(defaultStarter)}</textarea>
      <div class="row">
        <button class="primary grow" id="run-btn">실행하기</button>
        <button id="ref-btn">참고 정답 보기</button>
      </div>
      <div class="output-box" id="output-box"></div>
      <div class="ref-box" id="ref-box">${card.ref ? esc(card.ref) : '(등록된 참고 정답이 없어요)'}</div>
      <div class="row">
        <button class="wrong grow ${card.status === 'wrong' ? 'active' : ''}" id="mark-wrong-btn">틀렸어요</button>
        <button class="correct grow ${card.status === 'correct' ? 'active' : ''}" id="mark-correct-btn">맞았어요</button>
      </div>
      <div class="star-row">
        <span class="label-inline">중요도</span>
        ${starWidgetHtml(card, 'review')}
      </div>
      <div class="row">
        <button id="prev-btn" ${queueIndex <= 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>← 이전 문제</button>
        <button class="grow" id="next-btn">다음 문제</button>
      </div>
    </div>
  `;
  document.getElementById('run-btn').addEventListener('click', runCode);
  document.getElementById('code-input').addEventListener('keydown', handleTabKey);
  document.getElementById('ref-btn').addEventListener('click', () => {
    document.getElementById('ref-box').classList.toggle('show');
  });
  document.getElementById('mark-wrong-btn').addEventListener('click', () => {
    card.status = (card.status === 'wrong') ? null : 'wrong';
    saveCards();
    renderReview();
  });
  document.getElementById('mark-correct-btn').addEventListener('click', () => {
    card.status = (card.status === 'correct') ? null : 'correct';
    saveCards();
    renderReview();
  });
  document.getElementById('prev-btn').addEventListener('click', () => {
    prevCard();
    renderReview();
  });
  document.getElementById('next-btn').addEventListener('click', () => {
    nextCard();
    renderReview();
  });
  area.querySelectorAll('.star').forEach(st => {
    st.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const val = parseInt(e.target.dataset.val, 10);
      setStars(id, val);
      renderReview();
      renderStats();
    });
  });
  renderStats();
}

async function runCode(){
  const outBox = document.getElementById('output-box');
  outBox.classList.remove('error');
  outBox.classList.add('show');
  if(!pyodide){
    outBox.textContent = '아직 파이썬 환경이 로딩 중이에요. 잠시만 기다려주세요...';
    return;
  }
  const code = document.getElementById('code-input').value;
  let captured = '';
  pyodide.setStdout({ batched: (s) => { captured += s + '\n'; } });
  try{
    await pyodide.runPythonAsync(code);
    outBox.textContent = captured.length ? captured : '(출력 없음)';
  }catch(e){
    outBox.classList.add('error');
    outBox.textContent = (captured ? captured : '') + '에러:\n' + e.message;
  }
}

function handleTabKey(e){
  if(e.key !== 'Tab') return;
  e.preventDefault();
  const el = e.target;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  if(e.shiftKey){
    const lineStart = el.value.lastIndexOf('\n', start - 1) + 1;
    if(el.value.slice(lineStart, lineStart + 4) === '    '){
      el.value = el.value.slice(0, lineStart) + el.value.slice(lineStart + 4);
      el.selectionStart = start - 4;
      el.selectionEnd = end - 4;
    }
  }else{
    el.value = el.value.slice(0, start) + '    ' + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + 4;
  }
}
