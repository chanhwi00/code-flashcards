const LIST_PAGE_SIZE = 7;
let listPage = 1;

function statusRank(c){
  if(c.status === 'correct') return 2;
  if(c.status === 'wrong') return 1;
  return 0;
}

function sortSiblings(arr, mode){
  if(mode === 'default') return arr;
  const asc = mode.endsWith('asc');
  const copy = arr.slice();
  copy.sort((a, b) => {
    let va, vb;
    if(mode.startsWith('stars')){ va = a.stars || 0; vb = b.stars || 0; }
    else { va = statusRank(a); vb = statusRank(b); }
    return asc ? va - vb : vb - va;
  });
  return copy;
}

function getSortedFlatList(mode){
  const idSet = new Set(cards.map(c => c.id));
  const childrenMap = {};
  const roots = [];
  cards.forEach(c => {
    if(c.parentId && idSet.has(c.parentId) && c.parentId !== c.id){
      if(!childrenMap[c.parentId]) childrenMap[c.parentId] = [];
      childrenMap[c.parentId].push(c);
    }else{
      roots.push(c);
    }
  });
  const result = [];
  const visited = new Set();
  function addWithChildren(card, depth){
    if(visited.has(card.id)) return;
    visited.add(card.id);
    result.push({card, depth});
    const kids = childrenMap[card.id];
    if(kids && kids.length){
      sortSiblings(kids, mode).forEach(k => addWithChildren(k, depth + 1));
    }
  }
  sortSiblings(roots, mode).forEach(r => addWithChildren(r, 0));
  return result;
}

function renderList(){
  const area = document.getElementById('list-area');
  const pagination = document.getElementById('list-pagination');
  if(cards.length === 0){
    pagination.innerHTML = '';
    listPage = 1;
    area.innerHTML = '<div class="empty">저장된 문제가 없어요.</div>';
    document.getElementById('select-count').textContent = '0개 선택됨';
    return;
  }
  const flat = getSortedFlatList(listSortMode);
  const totalPages = Math.ceil(flat.length / LIST_PAGE_SIZE);
  listPage = Math.max(1, Math.min(listPage, totalPages));
  const pageItems = flat.slice((listPage - 1) * LIST_PAGE_SIZE, listPage * LIST_PAGE_SIZE);
  area.innerHTML = pageItems.map(({card: c, depth}) => {
    let statusBadge = '';
    if(c.status === 'correct') statusBadge = '<span class="badge" style="background:#eaf3de;color:#27500a;">맞음</span>';
    else if(c.status === 'wrong') statusBadge = '<span class="badge" style="background:#fcebeb;color:#791f1f;">틀림</span>';
    else statusBadge = '<span class="badge" style="background:#f1efe8;color:#6b6a64;">미채점</span>';
    let lockBadge = '';
    if(c.parentId){
      lockBadge = isUnlocked(c)
        ? '<span class="badge" style="background:#e6f1fb;color:#0c447c;">연결 · 열림</span>'
        : '<span class="badge" style="background:#faeeda;color:#633806;">연결 · 잠김</span>';
    }
    const checked = selectedIds.includes(c.id) ? 'checked' : '';
    const childClass = depth > 0 ? 'is-child' : '';
    return `
    <div class="list-item ${childClass}" data-id="${c.id}">
      <div class="list-top">
        <input type="checkbox" class="sel-checkbox" data-id="${c.id}" ${checked}>
        <div style="flex:1;">
          <div class="q">${esc(c.q)}</div>
          <div>${statusBadge} ${lockBadge} ${starWidgetHtml(c, 'list')}</div>
        </div>
      </div>
      <div class="status-toggle-row">
        <button class="wrong status-wrong-btn ${c.status === 'wrong' ? 'active' : ''}" data-id="${c.id}">틀렸어요</button>
        <button class="correct status-correct-btn ${c.status === 'correct' ? 'active' : ''}" data-id="${c.id}">맞았어요</button>
      </div>
      <div class="list-actions">
        <button class="ref-toggle-btn" data-id="${c.id}">정답보기</button>
        <button class="edit-toggle-btn" data-id="${c.id}">수정</button>
        <button class="del-btn" data-id="${c.id}">삭제</button>
      </div>
      <div class="list-ref" id="list-ref-${c.id}">${c.ref ? esc(c.ref) : '(등록된 참고 정답이 없어요)'}</div>
      <div class="edit-form" id="edit-form-${c.id}">
        <label>문제</label>
        <textarea class="edit-q" >${esc(c.q)}</textarea>
        <label>시작 코드</label>
        <textarea class="edit-starter" >${esc(c.starter || '')}</textarea>
        <label>참고 정답</label>
        <textarea class="edit-ref" >${esc(c.ref || '')}</textarea>
        <div class="row">
          <button class="primary grow save-edit-btn" data-id="${c.id}">저장</button>
          <button class="cancel-edit-btn" data-id="${c.id}">취소</button>
        </div>
      </div>
    </div>
  `;
  }).join('');

  area.querySelectorAll('.sel-checkbox').forEach(box => {
    box.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if(e.target.checked){
        if(!selectedIds.includes(id)) selectedIds.push(id);
      }else{
        selectedIds = selectedIds.filter(x => x !== id);
      }
      document.getElementById('select-count').textContent = `${selectedIds.length}개 선택됨`;
      document.getElementById('selected-filter-btn').style.display = selectedIds.length ? 'inline-block' : 'none';
    });
  });
  area.querySelectorAll('.star').forEach(st => {
    st.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const val = parseInt(e.target.dataset.val, 10);
      setStars(id, val);
      renderList();
      renderReview();
      renderStats();
    });
  });
  area.querySelectorAll('.status-wrong-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const c = cards.find(x => x.id === e.target.dataset.id);
      if(!c) return;
      c.status = (c.status === 'wrong') ? null : 'wrong';
      saveCards();
      renderList();
      renderReview();
      renderStats();
    });
  });
  area.querySelectorAll('.status-correct-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const c = cards.find(x => x.id === e.target.dataset.id);
      if(!c) return;
      c.status = (c.status === 'correct') ? null : 'correct';
      saveCards();
      renderList();
      renderReview();
      renderStats();
    });
  });
  area.querySelectorAll('.ref-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.getElementById('list-ref-' + e.target.dataset.id).classList.toggle('show');
    });
  });
  area.querySelectorAll('.edit-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.getElementById('edit-form-' + e.target.dataset.id).classList.toggle('show');
    });
  });
  area.querySelectorAll('.cancel-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.getElementById('edit-form-' + e.target.dataset.id).classList.remove('show');
    });
  });
  area.querySelectorAll('.save-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const form = document.getElementById('edit-form-' + id);
      const q = form.querySelector('.edit-q').value.trim();
      const starter = form.querySelector('.edit-starter').value.trim();
      const ref = form.querySelector('.edit-ref').value.trim();
      if(!q) return;
      const c = cards.find(x => x.id === id);
      if(!c) return;
      c.q = q;
      c.starter = starter;
      c.ref = ref;
      saveCards();
      renderList();
      renderReview();
      renderStats();
    });
  });
  area.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const idx = cards.findIndex(x => x.id === id);
      if(idx === -1) return;
      cards.splice(idx, 1);
      selectedIds = selectedIds.filter(x => x !== id);
      cards.forEach(c => { if(c.parentId === id) c.parentId = null; });
      saveCards();
      renderReview();
      renderList();
      renderStats();
    });
  });
  document.getElementById('select-count').textContent = `${selectedIds.length}개 선택됨`;
  document.getElementById('selected-filter-btn').style.display = selectedIds.length ? 'inline-block' : 'none';

  // 전체 목록은 한 페이지에 최대 7개씩 표시한다.
  if(totalPages <= 1){
    pagination.innerHTML = '';
  }else{
    const pageButtons = Array.from({length: totalPages}, (_, i) => {
      const n = i + 1;
      return `<button type="button" data-page="${n}" class="${n === listPage ? 'active' : ''}" ${n === listPage ? 'aria-current="page"' : ''}>${n}</button>`;
    }).join('');
    pagination.innerHTML = `
      <button type="button" data-page="${listPage - 1}" ${listPage === 1 ? 'disabled' : ''}>← 이전</button>
      <span class="pagination-pages">${pageButtons}</span>
      <button type="button" data-page="${listPage + 1}" ${listPage === totalPages ? 'disabled' : ''}>다음 →</button>
      <span class="pagination-count">${listPage} / ${totalPages} 페이지 · 전체 ${flat.length}개</span>`;
    pagination.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = Number(btn.dataset.page);
        if(next < 1 || next > totalPages || next === listPage) return;
        listPage = next;
        renderList();
        document.getElementById('panel-list').scrollIntoView({block:'start', behavior:'auto'});
      });
    });
  }
}
