// ---- 구글 드라이브 API 헬퍼 함수들 ----

function setDriveStatus(text, ok){
  const el = document.getElementById('drive-status');
  if(!el) return;
  el.textContent = text;
  el.style.color = ok === true ? '#27500a' : (ok === false ? '#791f1f' : '#6b6a64');
}

function updateDriveButtonUI(){
  const btn = document.getElementById('drive-login-btn');
  if(!btn) return;
  btn.textContent = driveSyncEnabled ? '🔗 구글 드라이브 연동됨 (다시 로그인)' : '🔗 구글 드라이브 연동하기';
}

// 드라이브에서 우리 앱 전용 파일을 찾고, 없으면 새로 만듦
async function driveFindOrCreateFile(token){
  const q = encodeURIComponent(`name='${DRIVE_FILENAME}' and trashed=false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  if(searchRes.status === 401) throw new Error('AUTH_EXPIRED');
  const searchData = await searchRes.json();
  if(searchData.files && searchData.files.length > 0){
    return { id: searchData.files[0].id, isNew: false };
  }
  const boundary = 'flashcards_boundary_xyz';
  const metadata = { name: DRIVE_FILENAME, mimeType: 'application/json' };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n[]\r\n` +
    `--${boundary}--`;
  const createRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });
  if(createRes.status === 401) throw new Error('AUTH_EXPIRED');
  const createData = await createRes.json();
  return { id: createData.id, isNew: true };
}

async function driveReadFile(token, fileId){
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  if(res.status === 401) throw new Error('AUTH_EXPIRED');
  if(!res.ok) throw new Error('READ_FAILED');
  const text = await res.text();
  try{
    return JSON.parse(text);
  }catch(e){
    return [];
  }
}

async function driveWriteFile(token, fileId, dataArr){
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dataArr)
  });
  if(res.status === 401) throw new Error('AUTH_EXPIRED');
  if(!res.ok) throw new Error('WRITE_FAILED');
}

// "구글 드라이브 연동하기" 버튼 클릭
function connectDrive(){
  if(!tokenClient){
    setDriveStatus('구글 로그인 준비 중이에요. 잠시 후 다시 시도해주세요.', false);
    return;
  }
  tokenClient.requestAccessToken({ prompt: driveAccessToken ? '' : 'consent' });
}

// 구글 로그인 성공 후 콜백
function onDriveToken(resp){
  if(resp.error){
    setDriveStatus('로그인에 실패했어요: ' + resp.error, false);
    return;
  }
  driveAccessToken = resp.access_token;
  handleAfterDriveLogin();
}

async function handleAfterDriveLogin(){
  setDriveStatus('구글 드라이브와 동기화하는 중...', null);
  try{
    const { id, isNew } = await driveFindOrCreateFile(driveAccessToken);
    driveFileId = id;
    if(isNew){
      // 새로 만든 파일이라 지금 가지고 있는 로컬 카드를 그대로 올려보냄
      await driveWriteFile(driveAccessToken, driveFileId, cards);
    }else{
      // 이미 있던 파일이면 드라이브 내용으로 화면을 갱신 (다른 컴퓨터에서 만든 데이터일 수 있음)
      const remote = await driveReadFile(driveAccessToken, driveFileId);
      if(Array.isArray(remote)){
        cards = remote;
        cards.forEach(c => {
          if(!c.id) c.id = newId();
          if(c.status === undefined) c.status = null;
          if(c.stars === undefined || c.stars === null) c.stars = 0;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
      }
    }
    driveSyncEnabled = true;
    updateDriveButtonUI();
    currentCard = null;
    sessionActive = false;
    sessionDone = false;
    renderList();
    renderReview();
    renderStats();
    setDriveStatus('✅ 구글 드라이브와 연동됐어요. 이제부터 자동으로 저장돼요.', true);
  }catch(e){
    console.error(e);
    if(e && e.message === 'AUTH_EXPIRED'){
      setDriveStatus('⚠️ 로그인이 만료됐어요. 버튼을 다시 눌러주세요.', false);
    }else{
      setDriveStatus('⚠️ 구글 드라이브 연동 중 오류가 발생했어요.', false);
    }
  }
}

function initGoogleAuth(){
  if(typeof google === 'undefined' || !google.accounts){
    setDriveStatus('구글 로그인 스크립트를 불러오지 못했어요. 새로고침 해보세요.', false);
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: onDriveToken
  });
}
