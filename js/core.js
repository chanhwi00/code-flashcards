const STORAGE_KEY = 'code_flashcards_data_v1';
let cards = [];
let pyodide = null;
let reviewMode = 'all';
let starFilter = '';
let listSortMode = 'default';
let selectedIds = [];
let currentCard = null;
let reviewQueue = [];   // 이번 라운드에서 뽑을 카드 id들을 순서대로 담아놓은 큐
let queueIndex = -1;    // reviewQueue에서 현재 위치
let sessionActive = false; // "시작!"을 눌러 큐가 준비된 상태인지
let sessionDone = false;   // 이번 라운드의 큐를 다 돌았는지

// ---- 구글 드라이브 연동 ----
const GOOGLE_CLIENT_ID = '59939161608-6od2m2693edbsinkr75iutegunh30tvk.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FILENAME = 'code_flashcards_data.json';
let tokenClient = null;
let driveAccessToken = null;
let driveFileId = null;
let driveSyncEnabled = false;
let driveSaveTimer = null;

function esc(s){
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
function newId(){
  return 'c' + Date.now() + Math.random().toString(36).slice(2);
}

function loadCards(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    cards = raw ? JSON.parse(raw) : [];
  }catch(e){
    cards = [];
  }
  let changed = false;
  cards.forEach(c => {
    if(!c.id){ c.id = newId(); changed = true; }
    if(c.status === undefined){ c.status = c.completed ? 'correct' : null; changed = true; }
    if(c.stars === undefined || c.stars === null){ c.stars = 0; changed = true; }
  });
  if(changed) saveCards();
}
function saveCards(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  if(driveSyncEnabled && driveAccessToken && driveFileId){
    if(driveSaveTimer) clearTimeout(driveSaveTimer);
    // 짧은 시간 안에 여러 번 저장되는 걸 묶어서 API 호출 횟수를 줄임
    driveSaveTimer = setTimeout(() => {
      driveWriteFile(driveAccessToken, driveFileId, cards).then(() => {
        setDriveStatus('✅ 구글 드라이브에 저장됨', true);
      }).catch(err => {
        console.error('드라이브 저장 실패', err);
        if(err && err.message === 'AUTH_EXPIRED'){
          driveSyncEnabled = false;
          updateDriveButtonUI();
          setDriveStatus('⚠️ 로그인이 만료됐어요. "구글 드라이브 연동하기"를 다시 눌러주세요.', false);
        }else{
          setDriveStatus('⚠️ 드라이브 저장 실패 - 인터넷 연결을 확인해주세요.', false);
        }
      });
    }, 600);
  }
}
