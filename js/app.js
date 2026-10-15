document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    if(tab.dataset.tab === 'list') renderList();
    if(tab.dataset.tab === 'add') populateParentSelect();
  });
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    reviewMode = btn.dataset.mode;
    currentCard = null;
    sessionActive = false;
    renderReview();
  });
});

document.getElementById('star-filter-select').addEventListener('change', (e) => {
  starFilter = e.target.value;
  currentCard = null;
  sessionActive = false;
  renderReview();
  renderStats();
});

document.getElementById('list-sort-select').addEventListener('change', (e) => {
  listSortMode = e.target.value;
  listPage = 1;
  renderList();
});

document.getElementById('review-selected-btn').addEventListener('click', () => {
  if(selectedIds.length === 0){
    alert('먼저 목록에서 문제를 선택해주세요.');
    return;
  }
  reviewMode = 'selected';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('selected-filter-btn').style.display = 'inline-block';
  document.getElementById('selected-filter-btn').classList.add('active');
  currentCard = null;
  sessionActive = false;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.tab[data-tab="review"]').classList.add('active');
  document.getElementById('panel-review').classList.add('active');
  renderReview();
});

function showBackupMsg(text, ok){
  const msg = document.getElementById('backup-msg');
  msg.textContent = text;
  msg.style.background = ok ? '#eaf3de' : '#fcebeb';
  msg.style.color = ok ? '#27500a' : '#791f1f';
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2500);
}

function exportBackup(){
  const dataStr = JSON.stringify(cards, null, 2);
  const blob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  a.href = url;
  a.download = `code_flashcards_backup_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showBackupMsg('백업 파일을 내려받았어요.', true);
}

function importBackup(file){
  const reader = new FileReader();
  reader.onload = (e) => {
    let imported;
    try{
      imported = JSON.parse(e.target.result);
    }catch(err){
      showBackupMsg('파일을 읽을 수 없어요. 올바른 백업 파일인지 확인해주세요.', false);
      return;
    }
    if(!Array.isArray(imported)){
      showBackupMsg('올바른 백업 파일 형식이 아니에요.', false);
      return;
    }
    imported.forEach(c => {
      if(!c.id) c.id = newId();
      if(c.status === undefined) c.status = null;
      if(c.stars === undefined || c.stars === null) c.stars = 0;
    });
    const replace = confirm('가져온 데이터로 전체 목록을 교체할까요?\n\n확인 = 전체 교체\n취소 = 기존 목록에 합치기 (겹치는 항목은 건너뜀)');
    if(replace){
      cards = imported;
    }else{
      const existingIds = new Set(cards.map(c => c.id));
      const toAdd = imported.filter(c => !existingIds.has(c.id));
      cards = cards.concat(toAdd);
    }
    saveCards();
    currentCard = null;
    renderReview();
    renderList();
    renderStats();
    showBackupMsg(`불러오기 완료: 총 ${cards.length}개 문제`, true);
  };
  reader.onerror = () => showBackupMsg('파일을 읽는 중 오류가 발생했어요.', false);
  reader.readAsText(file);
}

document.getElementById('reset-status-btn').addEventListener('click', () => {
  if(cards.length === 0) return;
  const ok = confirm('모든 문제의 채점 상태(맞음/틀림)를 기본 상태(미채점)로 되돌릴까요?\n문제 내용, 중요도, 선택 상태는 그대로 유지돼요.');
  if(!ok) return;
  cards.forEach(c => { c.status = null; });
  saveCards();
  currentCard = null;
  sessionActive = false;
  renderList();
  renderReview();
  renderStats();
  showBackupMsg('모든 문제 상태를 초기화했어요.', true);
});

document.getElementById('export-btn').addEventListener('click', exportBackup);
document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-file-input').click();
});
document.getElementById('import-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(file) importBackup(file);
  e.target.value = '';
});

document.getElementById('save-btn').addEventListener('click', () => {
  const q = document.getElementById('q-input').value.trim();
  const starter = document.getElementById('starter-input').value.trim();
  const ref = document.getElementById('ref-input').value.trim();
  const parentId = document.getElementById('parent-input').value || null;
  const msg = document.getElementById('save-msg');
  if(!q){
    msg.textContent = '문제 내용을 입력해주세요.';
    msg.style.background = '#fcebeb'; msg.style.color = '#791f1f';
    msg.classList.add('show');
    return;
  }
  cards.push({id:newId(), q, starter, ref, parentId, status:null, stars:0});
  saveCards();
  document.getElementById('q-input').value = '';
  document.getElementById('starter-input').value = '';
  document.getElementById('ref-input').value = '';
  document.getElementById('parent-input').value = '';
  msg.textContent = '카드가 저장됐어요!';
  msg.style.background = '#eaf3de'; msg.style.color = '#27500a';
  msg.classList.add('show');
  setTimeout(()=> msg.classList.remove('show'), 2000);
  currentCard = null;
  renderReview();
  renderStats();
});

async function init(){
  loadCards();
  renderReview();
  renderStats();
  document.getElementById('drive-login-btn').addEventListener('click', connectDrive);
  initGoogleAuth();
  const statusMsg = document.getElementById('status-msg');
  try{
    pyodide = await loadPyodide();
    statusMsg.textContent = '내가 만든 코딩 문제를 랜덤으로 풀고, 직접 코드를 실행해서 확인해보세요.';
  }catch(e){
    statusMsg.textContent = '파이썬 실행 환경 로딩에 실패했어요. 인터넷 연결을 확인해주세요.';
  }
}
init();
