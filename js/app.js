    let currentDay = '월요일';
    let currentBook = 'beiying';
    let currentSectionId = 1;
    let hidePy = false;
    let hideKr = false;
    let flashcardIndex = 0;
    let activeVocab = [];
    let savedChecks = JSON.parse(localStorage.getItem('studium_vocab_checks') || '{}');
    let currentExamTab = 'beiying';
    let currentTheme = localStorage.getItem('studium_theme') || 'system';
    let ttsRate = parseFloat(localStorage.getItem('studium_tts_rate') || '0.85');
    let ttsVolume = parseFloat(localStorage.getItem('studium_tts_vol') || '1.0');
    let fontSize = localStorage.getItem('studium_font_size') || 'normal';

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    function speakZh(text) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = ttsRate;
        u.volume = ttsVolume;
        window.speechSynthesis.speak(u);
      }
    }

    function switchTab(tabId) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

      document.getElementById('screen-' + tabId).classList.add('active');
      const idx = ['schedule', 'reader', 'vocab', 'exam', 'settings'].indexOf(tabId);
      if (idx >= 0) {
        document.querySelectorAll('.nav-btn')[idx].classList.add('active');
      }
      window.scrollTo(0, 0);
    }

    // Base64 helper for Web Crypto API
    function base64ToUint8Array(base64) {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }

    async function decryptScheduleWithPassword(password, encryptedData) {
      const salt = base64ToUint8Array(encryptedData.salt);
      const iv = base64ToUint8Array(encryptedData.iv);
      const ciphertext = base64ToUint8Array(encryptedData.ciphertext);

      const encText = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encText.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
      );

      const decStr = new TextDecoder('utf-8').decode(decrypted);
      return JSON.parse(decStr);
    }

    async function unlockSchedule() {
      const inputEl = document.getElementById('schedule-pw-input');
      const btnEl = document.getElementById('schedule-unlock-btn');
      const msgEl = document.getElementById('schedule-lock-msg');
      const pw = inputEl ? inputEl.value.trim() : '';

      if (!pw) {
        if (msgEl) msgEl.innerText = '암호를 입력해주세요.';
        return;
      }

      if (!HUFS_DATA || !HUFS_DATA.encrypted_schedule) {
        if (msgEl) msgEl.innerText = '암호화된 일정 데이터를 찾을 수 없습니다.';
        return;
      }

      try {
        if (btnEl) {
          btnEl.disabled = true;
          btnEl.innerText = '확인 중...';
        }
        if (msgEl) msgEl.innerText = '';

        const decrypted = await decryptScheduleWithPassword(pw, HUFS_DATA.encrypted_schedule);
        HUFS_DATA.weekly_courses = decrypted;
        localStorage.setItem('studium_unlocked_schedule', JSON.stringify(decrypted));

        const lockedView = document.getElementById('schedule-locked-view');
        const unlockedView = document.getElementById('schedule-unlocked-view');
        if (lockedView) lockedView.style.display = 'none';
        if (unlockedView) unlockedView.style.display = 'block';

        if (inputEl) inputEl.value = '';
        renderSchedule();
      } catch (err) {
        console.error('Decryption failed:', err);
        if (msgEl) msgEl.innerText = '암호가 일치하지 않습니다.';
        if (inputEl) {
          inputEl.select();
          inputEl.focus();
        }
      } finally {
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerText = '해제';
        }
      }
    }

    function lockSchedule() {
      localStorage.removeItem('studium_unlocked_schedule');
      if (HUFS_DATA) {
        HUFS_DATA.weekly_courses = [];
      }
      const lockedView = document.getElementById('schedule-locked-view');
      const unlockedView = document.getElementById('schedule-unlocked-view');
      const msgEl = document.getElementById('schedule-lock-msg');
      const inputEl = document.getElementById('schedule-pw-input');

      if (lockedView) lockedView.style.display = 'flex';
      if (unlockedView) unlockedView.style.display = 'none';
      if (msgEl) msgEl.innerText = '';
      if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
      }
    }

    function initScheduleSecurity() {
      const cached = localStorage.getItem('studium_unlocked_schedule');
      const lockedView = document.getElementById('schedule-locked-view');
      const unlockedView = document.getElementById('schedule-unlocked-view');

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            HUFS_DATA.weekly_courses = parsed;
            if (lockedView) lockedView.style.display = 'none';
            if (unlockedView) unlockedView.style.display = 'block';
            renderSchedule();
            return;
          }
        } catch (e) {
          localStorage.removeItem('studium_unlocked_schedule');
        }
      }

      if (lockedView) lockedView.style.display = 'flex';
      if (unlockedView) unlockedView.style.display = 'none';
    }

    // Schedule
    function selectDay(day) {
      currentDay = day;
      document.querySelectorAll('#day-nav .sub-nav-item').forEach(el => {
        el.classList.toggle('active', el.innerText === day);
      });
      renderSchedule();
    }

    function renderSchedule() {
      const list = document.getElementById('courses-list');
      if (!list) return;
      list.innerHTML = '';
      if (!HUFS_DATA.weekly_courses || !HUFS_DATA.weekly_courses.length) {
        list.innerHTML = '<div style="padding:40px 0; color:var(--text-muted); text-align:center;">등록된 수업 일정이 없습니다.</div>';
        return;
      }
      const dayData = HUFS_DATA.weekly_courses.find(d => d.day === currentDay);
      if (!dayData || !dayData.courses.length) {
        list.innerHTML = '<div style="padding:40px 0; color:var(--text-muted); text-align:center;">등록된 수업 일정이 없습니다.</div>';
        return;
      }
      dayData.courses.forEach(c => {
        const row = document.createElement('div');
        row.className = 'course-row';
        let tasksHtml = '';
        if (c.tasks) {
          c.tasks.forEach(t => {
            tasksHtml += `
              <div class="task-row">
                <input type="checkbox" ${t.done ? 'checked' : ''} onchange="this.parentElement.style.opacity = this.checked ? '0.4' : '1'">
                <span style="${t.done ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${t.title}</span>
              </div>
            `;
          });
        }
        const isDS = c.name.includes('자료구조') || c.name.includes('Data Structure');
        const isEng = c.id === 'tue-college-eng' || c.name.includes('College English');
        let quizBtnHtml = '';
        if (isDS) {
          quizBtnHtml = `
            <div class="course-quiz-pill" onclick="openDsQuizScreen()">
              <span>1~12장 전단원 연습문제 CBT 풀기 →</span>
            </div>
          `;
        } else if (isEng) {
          quizBtnHtml = `
            <div class="course-quiz-pill" onclick="openEngEssayScreen('schedule')">
              <span>In-Class Essay 문단별 한→영 영작 암기 훈련 (25문장) →</span>
            </div>
          `;
        }
        row.innerHTML = `
          <div class="course-title">${c.name}</div>
          <div class="course-meta">
            <span>${c.time || ''}</span>
            ${c.room ? `<span>· ${c.room}</span>` : ''}
            ${c.prof ? `<span>· ${c.prof}</span>` : ''}
          </div>
          ${c.midterm_book ? `<div style="font-size:0.84rem; color:var(--text-muted); margin-bottom:8px;">텍스트: ${c.midterm_book}</div>` : ''}
          ${quizBtnHtml}
          ${tasksHtml}
        `;
        list.appendChild(row);
      });
    }

    // Reader
    function selectBook(bId) {
      if (bId === 'portrait') bId = 'chinese3';
      currentBook = bId;
      currentSectionId = 1;
      document.querySelectorAll('#book-nav .sub-nav-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('onclick').includes(bId));
      });
      renderSectionSelector();
      renderSentences();
    }

    function renderSectionSelector() {
      const container = document.getElementById('section-selector');
      container.innerHTML = '';
      const bookData = HUFS_DATA.books[currentBook];
      if (!bookData || !bookData.sections) return;

      bookData.sections.forEach((sec) => {
        const span = document.createElement('span');
        span.className = 'num-btn' + (sec.id === currentSectionId ? ' active' : '');
        span.innerText = sec.short_title || `${sec.id}`;
        span.onclick = () => {
          currentSectionId = sec.id;
          document.querySelectorAll('#section-selector .num-btn').forEach(el => el.classList.remove('active'));
          span.classList.add('active');
          renderSentences();
        };
        container.appendChild(span);
      });
    }

    function toggleOption(type) {
      const container = document.getElementById('sentences-list');
      if (type === 'py') {
        hidePy = !hidePy;
        container.classList.toggle('hide-py', hidePy);
        document.getElementById('toggle-py-btn').innerText = hidePy ? '병음 켜기' : '병음 끄기';
      } else {
        hideKr = !hideKr;
        container.classList.toggle('hide-kr', hideKr);
        document.getElementById('toggle-kr-btn').innerText = hideKr ? '해석 켜기' : '해석 끄기';
      }
    }

    function escapeSingleQuote(str) {
      return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    function getDict() {
      if (typeof HUFS_DATA !== 'undefined' && HUFS_DATA && HUFS_DATA.dict) return HUFS_DATA.dict;
      if (typeof window !== 'undefined' && window.HUFS_DATA && window.HUFS_DATA.dict) return window.HUFS_DATA.dict;
      return {};
    }

    function tokenizeSentence(text) {
      const dict = getDict();
      let i = 0;
      let html = '';
      const puncRegex = /[\s，。！？、；：“”‘’（）《》…—\-]/;

      while (i < text.length) {
        const char = text[i];
        if (puncRegex.test(char)) {
          html += char;
          i++;
          continue;
        }
        let matched = null;
        for (let len = Math.min(5, text.length - i); len >= 1; len--) {
          const sub = text.substr(i, len);
          if (len === 1 || dict[sub]) {
            matched = sub;
            break;
          }
        }
        if (matched) {
          const escaped = matched.replace(/'/g, "\\'");
          html += `<span class="zh-w" onclick="event.stopPropagation(); inspectWord('${escaped}')">${matched}</span>`;
          i += matched.length;
        } else {
          html += char;
          i++;
        }
      }
      return html;
    }

    function renderSentences() {
      const bookData = HUFS_DATA.books[currentBook];
      if (!bookData) return;
      const secData = bookData.sections.find(s => s.id === currentSectionId) || bookData.sections[0];
      if (!secData) return;

      document.getElementById('section-title-label').innerText = secData.title;
      const list = document.getElementById('sentences-list');
      list.innerHTML = '';

      secData.sentences.forEach(s => {
        const row = document.createElement('div');
        row.className = 'sentence-row';
        const escapedSentence = escapeSingleQuote(s.zh);
        row.innerHTML = `
          <div class="sentence-zh-wrap">
            <div class="sentence-zh">${tokenizeSentence(s.zh)}</div>
            <button class="speaker-btn" title="문장 발음 듣기" onclick="event.stopPropagation(); speakZh('${escapedSentence}')">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
            </button>
          </div>
          ${s.py ? `<div class="sentence-py">${s.py}</div>` : ''}
          ${s.kr ? `<div class="sentence-kr">${s.kr}</div>` : ''}
        `;
        list.appendChild(row);
      });
    }

    // Word Inspector Logic
    let currentInspectedWord = null;
    let savedWords = JSON.parse(localStorage.getItem('studium_saved_words') || '[]');

    function updateSavedCountBadge() {
      const el = document.getElementById('saved-badge');
      if (el) {
        el.innerText = savedWords.length ? `(${savedWords.length})` : '';
      }
    }

    function inspectWord(word) {
      currentInspectedWord = word;
      const dict = getDict();
      const info = dict[word] || {
        zh: word,
        py: '',
        pos: '어휘',
        kr: '상세 뜻 준비 중',
        level: '일반 어휘',
        note: ''
      };

      document.getElementById('wi-zh').innerText = word;
      document.getElementById('wi-py').innerText = info.py || '';
      document.getElementById('wi-pos').innerText = info.pos ? info.pos : '품사 미지정';
      document.getElementById('wi-level').innerText = info.level ? info.level : '일반 어휘';
      document.getElementById('wi-kr').innerText = info.kr || '사전 뜻 조회 중';
      
      const currentBookName = (HUFS_DATA.books[currentBook] ? HUFS_DATA.books[currentBook].name : '');
      document.getElementById('wi-note').innerText = info.note ? ('문맥 뜻: ' + info.note) : ('문맥 용례: ' + currentBookName);

      document.getElementById('wi-speak-btn').onclick = () => speakZh(word);

      updateSaveButtonState(word);

      document.getElementById('word-inspector').classList.add('open');
    }

    function closeInspector() {
      document.getElementById('word-inspector').classList.remove('open');
      currentInspectedWord = null;
    }

    function updateSaveButtonState(word) {
      const isSaved = savedWords.some(w => w.zh === word);
      const btn = document.getElementById('wi-save-btn');
      btn.innerText = isSaved ? '암기 단어장 저장됨 ✓' : '암기 단어장에 추가';
      btn.classList.toggle('saved', isSaved);
    }

    function toggleSaveCurrentWord() {
      if (!currentInspectedWord) return;
      const dict = getDict();
      const info = dict[currentInspectedWord] || { zh: currentInspectedWord };
      const idx = savedWords.findIndex(w => w.zh === currentInspectedWord);
      if (idx >= 0) {
        savedWords.splice(idx, 1);
      } else {
        const curBook = HUFS_DATA.books[currentBook];
        savedWords.unshift({
          zh: currentInspectedWord,
          py: info.py || '',
          pos: info.pos || '',
          kr: info.kr || '',
          level: info.level || '',
          note: info.note || '',
          bookName: curBook ? curBook.name.replace(/[《》]/g, '') : '저장 어휘'
        });
      }
      localStorage.setItem('studium_saved_words', JSON.stringify(savedWords));
      updateSaveButtonState(currentInspectedWord);
      updateSavedCountBadge();
    }

    document.addEventListener('click', (e) => {
      const drawer = document.getElementById('word-inspector');
      if (!drawer || !drawer.classList.contains('open')) return;
      if (!drawer.contains(e.target) && !e.target.classList.contains('zh-w')) {
        closeInspector();
      }
    });

    // Vocab
    function initVocab() {
      updateSavedCountBadge();
      filterVocab('all');
    }

    function filterVocab(filterKey) {
      document.querySelectorAll('#vocab-nav .sub-nav-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('onclick').includes(filterKey));
      });
      activeVocab = [];
      const byVocab = (HUFS_DATA.books.beiying && HUFS_DATA.books.beiying.vocab) || [];
      const portVocab = (HUFS_DATA.books.chinese3 && HUFS_DATA.books.chinese3.vocab) || (HUFS_DATA.books.portrait && HUFS_DATA.books.portrait.vocab) || [];

      if (filterKey === 'saved') {
        activeVocab = [...savedWords];
      } else {
        if (filterKey === 'all' || filterKey === '背影') {
          byVocab.forEach(v => activeVocab.push({ ...v, bookName: '背影' }));
        }
        if (filterKey === 'all' || filterKey === 'chinese3' || filterKey === '画像') {
          portVocab.forEach(v => activeVocab.push({ ...v, bookName: '중국어3' }));
        }
      }

      flashcardIndex = 0;
      renderFlashcard();
    }

    function renderFlashcard() {
      if (!activeVocab.length) {
        document.getElementById('fc-counter').innerText = '0 / 0';
        document.getElementById('fc-word').innerText = '단어 없음';
        document.getElementById('fc-py').innerText = 'No words saved';
        document.getElementById('fc-kr').innerText = '본문에서 한자를 클릭하여 단어장에 추가해보세요.';
        document.getElementById('fc-note').innerText = '';
        const btn = document.getElementById('fc-check-btn');
        btn.innerText = '암기 체크';
        btn.classList.remove('checked');
        return;
      }
      const v = activeVocab[flashcardIndex];
      const isChecked = !!savedChecks[v.zh];

      document.getElementById('fc-counter').innerText = `${flashcardIndex + 1} / ${activeVocab.length} · ${v.bookName || ''} ${v.level ? '· ' + v.level : ''}`;
      document.getElementById('fc-word').innerText = v.zh;
      document.getElementById('fc-py').innerText = v.py;
      document.getElementById('fc-kr').innerText = v.kr;
      document.getElementById('fc-note').innerText = v.note || (v.pos ? '품사: ' + v.pos : '');

      const btn = document.getElementById('fc-check-btn');
      btn.innerText = isChecked ? '암기 완료 ✓' : '암기 체크';
      btn.classList.toggle('checked', isChecked);
    }

    function flipFlashcard() {
      if (activeVocab.length) {
        speakZh(activeVocab[flashcardIndex].zh);
      }
    }

    function nextFlashcard() {
      if (flashcardIndex < activeVocab.length - 1) {
        flashcardIndex++;
        renderFlashcard();
      }
    }

    function prevFlashcard() {
      if (flashcardIndex > 0) {
        flashcardIndex--;
        renderFlashcard();
      }
    }

    function toggleVocabCheck() {
      if (!activeVocab.length) return;
      const word = activeVocab[flashcardIndex].zh;
      savedChecks[word] = !savedChecks[word];
      localStorage.setItem('studium_vocab_checks', JSON.stringify(savedChecks));
      renderFlashcard();
    }

    // Exam
    function selectExamTab(key) {
      currentExamTab = key;
      document.querySelectorAll('#exam-nav .sub-nav-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('onclick').includes(key));
      });
      renderExamContent();
    }

    function renderExamContent() {
      const container = document.getElementById('exam-list');
      container.innerHTML = '';

      if (currentExamTab === 'beiying') {
        const qas = HUFS_DATA.books.beiying.qa || [];
        qas.forEach(qa => {
          const row = document.createElement('div');
          row.className = 'exam-row';
          row.innerHTML = `
            <div class="exam-q" onclick="this.parentElement.classList.toggle('open')">
              <span>${qa.question}</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">+</span>
            </div>
            <div class="exam-a">${qa.answer}</div>
          `;
          container.appendChild(row);
        });
      } else if (currentExamTab === 'tuanyuan') {
        const tyQas = HUFS_DATA.books.tuanyuan.qa || [];
        tyQas.forEach(qa => {
          const row = document.createElement('div');
          row.className = 'exam-row';
          row.innerHTML = `
            <div class="exam-q" onclick="this.parentElement.classList.toggle('open')">
              <span>${qa.question}</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">+</span>
            </div>
            <div class="exam-a">${qa.answer}</div>
          `;
          container.appendChild(row);
        });

        // 10-line review
        const revWrap = document.createElement('div');
        revWrap.style.padding = '20px 0';
        revWrap.innerHTML = '<div style="font-size:0.95rem; font-weight:600; margin-bottom:14px;">《团圆》 10줄 감상문 (5주차 과제)</div>';
        const rList = HUFS_DATA.books.tuanyuan.review_10lines || [];
        rList.forEach((r, idx) => {
          revWrap.innerHTML += `
            <div style="padding:10px 0; border-bottom:1px solid var(--border);">
              <div style="font-size:0.95rem; line-height:1.5;">${idx + 1}. ${r.zh}</div>
              <div style="font-size:0.84rem; color:var(--text-muted); font-style:italic; margin:2px 0;">${r.py}</div>
              <div style="font-size:0.86rem; line-height:1.45;">${r.kr}</div>
            </div>
          `;
        });
        container.appendChild(revWrap);
      } else if (currentExamTab === 'grammar') {
        const byG = HUFS_DATA.books.beiying.grammar || [];
        const portG = HUFS_DATA.books.portrait.grammar || [];

        byG.concat(portG).forEach(g => {
          const row = document.createElement('div');
          row.className = 'exam-row';
          row.innerHTML = `
            <div class="exam-q" onclick="this.parentElement.classList.toggle('open')">
              <span>${g.title}</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">+</span>
            </div>
            <div class="exam-a">${g.desc}</div>
          `;
          container.appendChild(row);
        });
      }
    }

    // Settings Logic
    function applyTheme(theme) {
      currentTheme = theme;
      localStorage.setItem('studium_theme', theme);
      if (theme === 'system') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
      updateSettingUI();
    }

    function setTheme(theme) {
      applyTheme(theme);
    }

    function setTtsRate(rate) {
      ttsRate = rate;
      localStorage.setItem('studium_tts_rate', rate.toString());
      updateSettingUI();
    }

    function setTtsVolume(vol) {
      ttsVolume = vol;
      localStorage.setItem('studium_tts_vol', vol.toString());
      updateSettingUI();
    }

    function setFontSize(size) {
      fontSize = size;
      localStorage.setItem('studium_font_size', size);
      document.body.classList.toggle('font-large', size === 'large');
      updateSettingUI();
    }

    function testTtsVoice() {
      speakZh('今天我第一次开车上路。');
    }

    function reloadCacheData() {
      if ('caches' in window) {
        caches.keys().then(keys => {
          return Promise.all(keys.map(k => caches.delete(k)));
        }).then(() => {
          window.location.reload(true);
        });
      } else {
        window.location.reload(true);
      }
    }

    function clearSavedWords() {
      if (confirm('저장된 단어를 모두 삭제하시겠습니까?')) {
        savedWords = [];
        localStorage.removeItem('studium_saved_words');
        updateSavedCountBadge();
        filterVocab('all');
        updateSettingUI();
      }
    }

    function updateSettingUI() {
      // Theme
      const themeKeys = ['system', 'dark', 'light'];
      document.querySelectorAll('#theme-options .setting-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', themeKeys[idx] === currentTheme);
      });
      // Rate
      const rates = [0.75, 0.85, 1.0];
      document.querySelectorAll('#rate-options .setting-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', Math.abs(rates[idx] - ttsRate) < 0.02);
      });
      // Volume
      const vols = [0.5, 0.8, 1.0];
      document.querySelectorAll('#vol-options .setting-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', Math.abs(vols[idx] - ttsVolume) < 0.05);
      });
      // Font
      const sizes = ['normal', 'large'];
      document.querySelectorAll('#font-options .setting-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', sizes[idx] === fontSize);
      });
    }

    // ==========================================
    // DATA STRUCTURE PRACTICE EXERCISES CONTROLLER
    // ==========================================
    let dsCurrentScope = 'midterm';
    let dsCurrentCh = 1;

    function openDsQuizScreen(targetCh) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const screen = document.getElementById('screen-ds-quiz');
      if (screen) screen.classList.add('active');

      if (targetCh) {
        dsCurrentCh = targetCh;
        if (targetCh <= 5) dsCurrentScope = 'midterm';
        else dsCurrentScope = 'final';
      }
      setDsScope(dsCurrentScope, false);
      selectDsChapter(dsCurrentCh);
      window.scrollTo(0, 0);
    }

    function closeDsQuizScreen() {
      switchTab('schedule');
    }

    function setDsScope(scope, resetChapter = true) {
      dsCurrentScope = scope;
      ['mid', 'final', 'all'].forEach(k => {
        const btn = document.getElementById('ds-scope-' + k);
        if (btn) btn.classList.remove('active');
      });
      if (scope === 'midterm') {
        const b = document.getElementById('ds-scope-mid');
        if (b) b.classList.add('active');
        if (resetChapter && (dsCurrentCh < 1 || dsCurrentCh > 5)) dsCurrentCh = 1;
      } else if (scope === 'final') {
        const b = document.getElementById('ds-scope-final');
        if (b) b.classList.add('active');
        if (resetChapter && (dsCurrentCh < 6 || dsCurrentCh > 12)) dsCurrentCh = 6;
      } else {
        const b = document.getElementById('ds-scope-all');
        if (b) b.classList.add('active');
      }
      renderDsChapterSelector();
      selectDsChapter(dsCurrentCh);
    }

    function getDsScopeRange() {
      if (dsCurrentScope === 'midterm') return [1, 2, 3, 4, 5];
      if (dsCurrentScope === 'final') return [6, 7, 8, 9, 10, 11, 12];
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }

    function renderDsChapterSelector() {
      const container = document.getElementById('ds-chapter-selector');
      if (!container) return;
      const range = getDsScopeRange();
      let html = '';
      range.forEach(chNum => {
        const active = chNum === dsCurrentCh ? 'active' : '';
        html += `<button type="button" class="num-btn ${active}" onclick="selectDsChapter(${chNum})">${chNum}장</button>`;
      });
      container.innerHTML = html;
    }

    function selectDsChapter(chNum) {
      dsCurrentCh = chNum;
      document.querySelectorAll('#ds-chapter-selector .num-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === `${chNum}장`);
      });

      const quizData = window.DS_QUIZ_DATA || [];
      const chapterData = quizData.find(c => c.chapter === chNum);
      if (!chapterData) return;

      const titleEl = document.getElementById('ds-current-ch-title');
      const descEl = document.getElementById('ds-current-ch-desc');
      const statsEl = document.getElementById('ds-current-ch-stats');

      if (titleEl) titleEl.textContent = `${chapterData.chapter}장 ${chapterData.title}`;
      if (descEl) descEl.textContent = chapterData.desc;
      if (statsEl) statsEl.textContent = `총 ${chapterData.questions.length}문제 수록 · 실시간 정답 및 풀이 확인 가능`;

      renderDsQuestions(chapterData.questions);
    }

    function escapeHtml(text) {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function renderDsQuestions(questions) {
      const container = document.getElementById('ds-questions-list');
      if (!container) return;

      if (!questions || questions.length === 0) {
        container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">해당 단원의 문제가 없습니다.</div>';
        return;
      }

      let html = '';
      questions.forEach(q => {
        const isChoice = q.type === 'choice' && Array.isArray(q.options) && q.options.length > 0;
        const isIntAnswer = typeof q.answer === 'number';
        const typeLabel = isChoice ? '객관식' : (q.type === 'short' ? '단답·서술형' : '실습 분석');

        html += `<div class="ds-question-card" id="card-${q.id}">`;
        html += `  <div class="ds-q-badge-row">`;
        html += `    <span class="ds-q-num">문제 ${escapeHtml(q.num)}</span>`;
        html += `    <span class="ds-q-type">${typeLabel}</span>`;
        html += `  </div>`;
        html += `  <div class="ds-q-text">${escapeHtml(q.question)}</div>`;

        if (isChoice && isIntAnswer) {
          html += `  <div class="ds-options-list" id="opts-${q.id}">`;
          q.options.forEach((opt, idx) => {
            const optNum = idx + 1;
            const optNumCircled = ['①', '②', '③', '④', '⑤', '⑥'][idx] || `${optNum}.`;
            html += `    <button type="button" class="ds-opt-btn" onclick="checkDsOption(this, '${q.id}', ${optNum}, ${q.answer})">`;
            html += `      ${optNumCircled} ${escapeHtml(opt)}`;
            html += `    </button>`;
          });
          html += `  </div>`;
        } else if (isChoice && !isIntAnswer) {
          html += `  <div class="ds-options-list" style="margin-bottom: 12px;">`;
          q.options.forEach((opt, idx) => {
            const optNumCircled = ['①', '②', '③', '④', '⑤', '⑥'][idx] || `${idx + 1}.`;
            html += `    <div style="font-size: 0.85rem; line-height: 1.5; color: var(--text); padding: 4px 0;">${optNumCircled} ${escapeHtml(opt)}</div>`;
          });
          html += `  </div>`;
        }

        const btnLabel = isChoice && isIntAnswer ? '해설 확인' : '정답 및 풀이 보기';
        html += `  <div style="margin-top: 8px;">`;
        html += `    <button type="button" class="ds-reveal-btn" id="btn-exp-${q.id}" onclick="toggleDsExplanation('${q.id}')">${btnLabel}</button>`;
        html += `  </div>`;

        let ansDisplay = '';
        if (typeof q.answer === 'number') {
          const circ = ['①', '②', '③', '④', '⑤', '⑥'][q.answer - 1] || `${q.answer}번`;
          ansDisplay = `${circ}`;
          if (q.options && q.options[q.answer - 1]) {
            ansDisplay += ` ${q.options[q.answer - 1]}`;
          }
        } else {
          ansDisplay = String(q.answer || '풀이 참조');
        }

        html += `  <div class="ds-explanation-box" id="exp-${q.id}" style="display: none;">`;
        html += `    <div class="ds-ans-label">정답: ${escapeHtml(ansDisplay)}</div>`;
        if (q.explanation) {
          html += `    <div class="ds-exp-text">${escapeHtml(q.explanation)}</div>`;
        }
        html += `  </div>`;

        html += `</div>`;
      });

      container.innerHTML = html;
    }

    function checkDsOption(btn, qId, selectedNum, correctNum) {
      const container = document.getElementById('opts-' + qId);
      if (!container) return;

      const buttons = container.querySelectorAll('.ds-opt-btn');
      buttons.forEach(b => {
        b.disabled = true;
        b.classList.remove('correct', 'wrong');
      });

      if (selectedNum === correctNum) {
        btn.classList.add('correct');
      } else {
        btn.classList.add('wrong');
        if (buttons[correctNum - 1]) {
          buttons[correctNum - 1].classList.add('correct');
        }
      }

      const expBox = document.getElementById('exp-' + qId);
      if (expBox) {
        expBox.style.display = 'block';
        const expBtn = document.getElementById('btn-exp-' + qId);
        if (expBtn) expBtn.textContent = '해설 닫기';
      }
    }

    function toggleDsExplanation(qId) {
      const box = document.getElementById('exp-' + qId);
      const btn = document.getElementById('btn-exp-' + qId);
      if (!box) return;

      if (box.style.display === 'none' || !box.style.display) {
        box.style.display = 'block';
        if (btn) btn.textContent = '해설 닫기';
      } else {
        box.style.display = 'none';
        if (btn) btn.textContent = '정답 및 풀이 보기';
      }
    }

    function initDsQuiz() {
      renderDsChapterSelector();
      selectDsChapter(dsCurrentCh);
    }

    // =========================================================================
    // COLLEGE ENGLISH 2 : IN-CLASS ESSAY PARAGRAPH & SENTENCE WRITING TRAINER
    // =========================================================================
    const ENG_ESSAY_DATA = {
      title: 'Online Social Networks vs. Face-to-Face Friendships: Quantity vs. Emotional Depth',
      subtitle: '화요일 College English 2 · In-Class Writing 5문단 에세이 (총 25문장 · 325단어 · Unit 1 필수 어휘 6종 완비)',
      paragraphs: [
        {
          id: 'intro',
          tabLabel: 'I. 서론 (4)',
          title: 'I. Introduction (서론 — 4문장)',
          desc: '도입(Hook) → 공통점 배경(Similarity) → 전환(Bridge) → 핵심 논지(Thesis Statement ★)',
          sentences: [
            {
              id: 'p1s1',
              num: 1,
              role: 'Hook (도입 흥미 유발)',
              vocab: ['connect with', 'across the globe', 'with a single tap on'],
              kr: '현대 디지털 시대에 젊은이들은 스마트폰 화면을 단 한 번 탭하는 것만으로 전 세계 수백 명의 사람들과 연결될 수 있다.',
              chunk: '현대 디지털 시대에 / 젊은이들은 ~와 연결될 수 있다 / 수백 명의 개인들과 / 전 세계에 걸쳐 / 단 한 번의 탭으로 / 스마트폰 화면 위의',
              en: 'In the modern digital era, young people can connect with hundreds of individuals across the globe with a single tap on a smartphone screen.'
            },
            {
              id: 'p1s2',
              num: 2,
              role: 'Background (배경 — 두 관계의 공통점)',
              vocab: ['both A and B', 'share the same basic goal of -ing', 'escape loneliness'],
              kr: '온라인 소셜 네트워크와 대면 우정은 모두 사람들이 서로 연결되고, 일상을 공유하며, 외로움에서 벗어나도록 돕는다는 동일한 기본 목표를 공유한다.',
              chunk: '온라인 소셜 네트워크와 대면 우정 둘 다 / 동일한 기본 목표를 공유한다 / 사람들이 연결되고, 그들의 일상을 공유하며, 외로움에서 벗어나도록 돕는다는',
              en: 'Both online social networks and face-to-face friendships share the same basic goal of helping people connect, share their daily lives, and escape loneliness.'
            },
            {
              id: 'p1s3',
              num: 3,
              role: 'Bridge (화제 전환 — 양과 질의 차이)',
              vocab: ['is very different from', 'in real life'],
              kr: '그러나 수백 명의 온라인 팔로워를 갖는 것은 현실에서 진정한 친구를 갖는 것과는 매우 다르다.',
              chunk: '그러나 / 수백 명의 온라인 팔로워를 갖는 것은 / ~와 매우 다르다 / 현실에서 진정한 친구들을 갖는 것과',
              en: 'However, having hundreds of online followers is very different from having true friends in real life.'
            },
            {
              id: 'p1s4',
              num: 4,
              role: 'Thesis Statement ★ (전체 핵심 논지 — 뼈대 1번)',
              vocab: ['conflict (Unit 1 필수)', 'status (Unit 1 필수)', 'stay in touch', 'whereas'],
              kr: '비록 두 형태의 관계 모두 사람들이 연락을 유지하도록 돕지만, 온라인 소셜 네트워크는 단지 빠르고 편리한 상호작용만을 제공하는 반면, 대면 우정은 더 깊은 정서적 교감, 갈등을 해결하는 더 건강한 방식, 그리고 사회적 지위의 압박으로부터의 자유를 제공한다.',
              chunk: '비록 두 형태의 연결 모두 사람들이 연락을 유지하도록 돕지만 / 온라인 소셜 네트워크는 오직 빠르고 편리한 상호작용만 제공한다 / 반면 대면 우정은 제공한다 / 더 깊은 정서적 인식, 갈등을 해결하는 더 건강한 방식들 / 그리고 사회적 지위의 압박으로부터의 자유를',
              en: 'Although both forms of connection help people stay in touch, online social networks only offer fast and convenient interaction, whereas face-to-face friendships provide deeper emotional awareness, healthier ways to resolve conflict, and freedom from the pressure of social status.'
            }
          ]
        },
        {
          id: 'body1',
          tabLabel: 'II. 본론1 (6)',
          title: 'II. Body Paragraph 1 (본론 1: 소통의 속도와 편의성 — 6문장)',
          desc: '주제문(Topic ★) → 온라인 특징 2문장 → 대조(In contrast) 대면 특징 2문장 → 요약 마무리',
          sentences: [
            {
              id: 'p2s1',
              num: 1,
              role: 'Topic Sentence ★ (본론 1 주제문 — 뼈대 2번)',
              vocab: ['interact (Unit 1 필수)', 'differ in', 'required to'],
              kr: '첫째, 온라인 플랫폼과 현실 환경은 타인과 상호작용하는 데 요구되는 속도와 노력에서 차이가 난다.',
              chunk: '첫째, 온라인 플랫폼과 현실 환경은 다르다 / 속도와 노력 면에서 / 타인과 상호작용하는 데 요구되는',
              en: 'First, online platforms and real-life settings differ in the speed and effort required to interact with others.'
            },
            {
              id: 'p2s2',
              num: 2,
              role: 'Online Detail 1 (온라인의 즉각성·확장성)',
              vocab: ['interact (Unit 1 필수)', 'acquire (Unit 1 필수)', 'without leaving'],
              kr: '소셜 미디어에서 사용자들은 집을 나서지 않고도 수백 명의 또래들과 즉각적으로 상호작용하고 대규모 팔로워 목록을 얻을 수 있다.',
              chunk: '소셜 미디어에서, 사용자들은 즉각적으로 상호작용할 수 있다 / 수백 명의 또래들과 / 그리고 큰 팔로워 목록을 얻을 수 있다 / 그들의 집을 떠나지 않고서도',
              en: 'On social media, users can interact instantly with hundreds of peers and acquire large follower lists without leaving their homes.'
            },
            {
              id: 'p2s3',
              num: 3,
              role: 'Online Detail 2 (가벼운 관계 유지)',
              vocab: ['maintain', 'a casual relationship'],
              kr: '짧은 댓글이나 메시지 하나로도 가벼운 인간관계를 쉽게 유지할 수 있다.',
              chunk: '빠른 댓글이나 메시지가 / 쉽게 유지할 수 있다 / 가벼운 관계를',
              en: 'A quick comment or message can easily maintain a casual relationship.'
            },
            {
              id: 'p2s4',
              num: 4,
              role: 'Face-to-Face Detail 1 (대조 — 물리적 시간과 인내)',
              vocab: ['In contrast', 'physical presence', 'shared time', 'patience'],
              kr: '대조적으로, 대면 우정을 쌓는 것은 물리적 동석, 함께 나누는 시간, 그리고 인내심을 필요로 한다.',
              chunk: '대조적으로 / 대면 우정을 쌓는 것은 요구한다 / 물리적 존재, 공유된 시간, 그리고 인내심을',
              en: 'In contrast, building face-to-face friendships requires physical presence, shared time, and patience.'
            },
            {
              id: 'p2s5',
              num: 5,
              role: 'Face-to-Face Detail 2 (실질적 계획과 적극적 대화)',
              vocab: ['in person', 'takes real planning', 'active conversation'],
              kr: '누군가를 직접 만나는 것은 실질적인 계획과 적극적인 대화를 필요로 한다.',
              chunk: '누군가를 직접 만나는 것은 / 실질적인 계획과 적극적인 대화를 필요로 한다',
              en: 'Meeting someone in person takes real planning and active conversation.'
            },
            {
              id: 'p2s6',
              num: 6,
              role: 'Concluding Statement (본론 1 소결론)',
              vocab: ['While ~', 'convenience in quantity', 'builds strong trust'],
              kr: '온라인 네트워킹은 양적인 면에서 큰 편리함을 제공하는 반면, 대면 상호작용은 강한 신뢰를 구축하는 진정한 노력을 필요로 한다.',
              chunk: '온라인 네트워킹이 양적인 면에서 큰 편리함을 제공하는 반면 / 대면 상호작용은 진정한 노력을 요구한다 / 강한 신뢰를 쌓는',
              en: 'While online networking offers great convenience in quantity, face-to-face interaction requires real effort that builds strong trust.'
            }
          ]
        },
        {
          id: 'body2',
          tabLabel: 'III. 본론2 (5)',
          title: 'III. Body Paragraph 2 (본론 2: 정서적 깊이와 비언어적 교감 — 5문장)',
          desc: '주제문(Topic ★) → 디지털 소통의 한계 → 대면 대화의 비언어적 공감 → 소결론',
          sentences: [
            {
              id: 'p3s1',
              num: 1,
              role: 'Topic Sentence ★ (본론 2 주제문 — 뼈대 3번)',
              vocab: ['aware of (Unit 1 필수)', 'much greater emotional depth'],
              kr: '둘째, 대면 우정은 친구들이 실제 인간의 감정을 온전히 인지하기 때문에 훨씬 더 큰 정서적 깊이를 형성한다.',
              chunk: '둘째, 대면 우정은 훨씬 더 큰 정서적 깊이를 쌓는다 / 왜냐하면 친구들이 온전히 인지하기 때문이다 / 실제 인간의 감정들을',
              en: 'Second, face-to-face friendships build much greater emotional depth because friends are fully aware of real human feelings.'
            },
            {
              id: 'p3s2',
              num: 2,
              role: 'Online Detail (디지털 소통의 한계)',
              vocab: ['relies heavily on', 'edited photos', 'which easily hide'],
              kr: '디지털 소통은 짧은 문자 메시지, 이모티콘, 그리고 보정된 사진에 크게 의존하는데, 이는 외로움과 슬픔을 쉽게 감춘다.',
              chunk: '디지털 소통은 ~에 크게 의존한다 / 짧은 문자 메시지, 이모지, 그리고 편집된 사진들에 / 그리고 그것들은 외로움과 슬픔을 쉽게 숨긴다',
              en: 'Digital communication relies heavily on short text messages, emojis, and edited photos, which easily hide loneliness and sadness.'
            },
            {
              id: 'p3s3',
              num: 3,
              role: 'Face-to-Face Detail 1 (비언어적 단서 인지)',
              vocab: ['aware of (Unit 1 필수)', 'On the other hand', 'allow A to B'],
              kr: '반면에, 대면 대화는 친구들이 표정, 목소리 톤, 그리고 몸짓 언어를 알아차릴 수 있게 해 준다.',
              chunk: '반면에, 대면 대화는 친구들이 ~를 인지할 수 있게 해 준다 / 얼굴 표정, 목소리 톤, 그리고 바디랭귀지를',
              en: 'On the other hand, in-person conversations allow friends to be aware of facial expressions, voice tone, and body language.'
            },
            {
              id: 'p3s4',
              num: 4,
              role: 'Face-to-Face Detail 2 (같은 공간이 주는 위로)',
              vocab: ['being in the same room', 'warm comfort', 'that no phone screen can replace'],
              kr: '친구가 슬플 때, 같은 공간에 함께 있는 것은 그 어떤 스마트폰 화면도 대체할 수 없는 따뜻한 위로를 준다.',
              chunk: '친구가 슬플 때 / 같은 방에 있는 것은 따뜻한 위로를 준다 / 어떤 휴대폰 화면도 대체할 수 없는',
              en: 'When a friend is sad, being in the same room gives warm comfort that no phone screen can replace.'
            },
            {
              id: 'p3s5',
              num: 5,
              role: 'Concluding Statement (본론 2 소결론)',
              vocab: ['Therefore', 'creates true empathy', 'stays on the surface'],
              kr: '따라서 현실에서의 함께함은 진정한 공감을 만들어내는 반면, 온라인 접촉은 종종 표면적인 수준에 머문다.',
              chunk: '따라서, 현실의 존재는 진정한 공감을 만든다 / 반면 온라인 접촉은 종종 표면에 머문다',
              en: 'Therefore, real-life presence creates true empathy, whereas online contact often stays on the surface.'
            }
          ]
        },
        {
          id: 'body3',
          tabLabel: 'IV. 본론3 (6)',
          title: 'IV. Body Paragraph 3 (본론 3: 갈등 해결과 사회적 지위 — 6문장)',
          desc: '주제문(Topic ★) → 온라인 모방·지위 경쟁과 차단 → 대면 우정의 존중과 갈등 해결 → 소결론',
          sentences: [
            {
              id: 'p4s1',
              num: 1,
              role: 'Topic Sentence ★ (본론 3 주제문 — 뼈대 4번)',
              vocab: ['conflict (Unit 1 필수)', 'status (Unit 1 필수)', 'deal with'],
              kr: '셋째, 이 두 가지 형태의 관계는 대인 간 갈등과 사회적 지위를 매우 다른 방식으로 다룬다.',
              chunk: '셋째, 두 형태의 연결은 다룬다 / 대인 관계 갈등과 사회적 지위를 / 매우 다른 방식으로',
              en: 'Third, the two forms of connection deal with interpersonal conflict and social status in very different ways.'
            },
            {
              id: 'p4s2',
              num: 2,
              role: 'Online Detail 1 (인플루언서 모방과 지위 압박)',
              vocab: ['emulate (Unit 1 필수)', 'status (Unit 1 필수)', 'feel pressured to'],
              kr: '소셜 네트워크에서 사용자들은 높은 사회적 지위와 좋아요를 얻기 위해 인기 인플루언서들을 모방해야 한다는 압박감을 종종 느낀다.',
              chunk: '소셜 네트워크에서, 사용자들은 종종 압박감을 느낀다 / 인기 있는 인플루언서들을 모방하도록 / 높은 사회적 지위와 좋아요를 얻기 위해',
              en: 'On social networks, users often feel pressured to emulate popular influencers to gain high social status and likes.'
            },
            {
              id: 'p4s3',
              num: 3,
              role: 'Online Detail 2 (비교 스트레스와 온라인 갈등·차단)',
              vocab: ['conflict (Unit 1 필수)', 'stressful comparison', 'sudden blocking'],
              kr: '이는 스트레스 받는 비교를 유발하며, 사소한 의견 불일치도 쉽게 심각한 온라인 갈등이나 갑작스러운 차단으로 이어진다.',
              chunk: '이것은 스트레스 받는 비교를 만든다 / 그리고 작은 의견 차이는 쉽게 유발한다 / 심각한 온라인 갈등이나 갑작스러운 차단을',
              en: 'This creates stressful comparison, and small disagreements easily cause serious online conflict or sudden blocking.'
            },
            {
              id: 'p4s4',
              num: 4,
              role: 'Face-to-Face Detail 1 (대조 — 솔직한 감정 대화)',
              vocab: ['Conversely', 'encourage A to B', 'talk honestly'],
              kr: '반대로, 현실의 우정은 사람들이 어려운 감정에 대해 솔직하게 이야기하도록 장려한다.',
              chunk: '반대로, 현실의 우정은 사람들이 ~하도록 격려한다 / 어려운 감정들에 대해 솔직하게 이야기하도록',
              en: 'Conversely, real-life friendships encourage people to talk honestly about difficult feelings.'
            },
            {
              id: 'p4s5',
              num: 5,
              role: 'Face-to-Face Detail 2 (상호 존중을 통한 갈등 해결)',
              vocab: ['conflict (Unit 1 필수)', 'resolve conflict', 'through mutual respect'],
              kr: '문제를 직접 대면하여 해결하는 것은 친구들에게 서로를 이해하고 상호 존중을 통해 갈등을 해결하도록 가르쳐 준다.',
              chunk: '문제를 직접 만나 해결하는 것은 친구들에게 가르친다 / 서로를 이해하고 갈등을 해결하도록 / 상호 존중을 통해',
              en: 'Solving problems in person teaches friends to understand each other and resolve conflict through mutual respect.'
            },
            {
              id: 'p4s6',
              num: 6,
              role: 'Concluding Statement (본론 3 소결론)',
              vocab: ['As a result', 'grow stronger through trust', 'suffer from competition'],
              kr: '그 결과, 대면 유대는 신뢰를 통해 더욱 단단해지는 반면, 온라인 관계는 종종 경쟁으로 인해 고통받는다.',
              chunk: '그 결과, 대면 유대는 신뢰를 통해 더 강하게 자란다 / 반면 온라인 관계는 종종 경쟁으로 고통받는다',
              en: 'As a result, face-to-face bonds grow stronger through trust, while online relationships often suffer from competition.'
            }
          ]
        },
        {
          id: 'conclusion',
          tabLabel: 'V. 결론 (4)',
          title: 'V. Conclusion (결론 — 4문장)',
          desc: '논지 재진술(Restatement ★) → 핵심 논점 요약 → 균형 잡힌 시각 → 최종 제언(Final Thought)',
          sentences: [
            {
              id: 'p5s1',
              num: 1,
              role: 'Restatement ★ (논지 재진술 — 뼈대 5번)',
              vocab: ['In conclusion', 'irreplaceable', 'true emotional happiness'],
              kr: '결론적으로, 온라인 네트워크와 현실의 우정 모두 사람들을 연결해 주지만, 진정한 정서적 행복을 위해 대면 관계는 대체될 수 없다.',
              chunk: '결론적으로, 온라인 네트워크와 현실 우정 둘 다 사람들을 연결하지만 / 대면 관계는 대체 불가능하다 / 진정한 정서적 행복을 위해',
              en: 'In conclusion, while both online networks and real-life friendships connect people, face-to-face relationships are irreplaceable for true emotional happiness.'
            },
            {
              id: 'p5s2',
              num: 2,
              role: 'Summary of Main Points (본론 1·2·3 핵심 요약)',
              vocab: ['conflict (Unit 1 필수)', 'status (Unit 1 필수)', 'overcome conflict', 'value A over B'],
              kr: '온라인 플랫폼은 빠른 상호작용을 제공하지만, 대면 유대는 깊은 교감을 쌓고, 친구들이 갈등을 극복하도록 도우며, 사회적 지위보다 진정한 정직함을 가치 있게 여긴다.',
              chunk: '온라인 플랫폼은 빠른 상호작용을 주지만 / 대면 유대는 깊은 인식을 쌓고, 친구들이 갈등을 극복하도록 돕고 / 사회적 지위보다 진정한 정직함을 중시한다',
              en: 'Online platforms give fast interaction, but face-to-face bonds build deep awareness, help friends overcome conflict, and value real honesty over social status.'
            },
            {
              id: 'p5s3',
              num: 3,
              role: 'Balanced Perspective (기술과 현실 관계의 균형)',
              vocab: ['serve as a useful tool', 'depends on', 'warmth of real-life connections'],
              kr: '기술은 일상 소통을 위한 유용한 도구로 기능해야 하지만, 진정한 행복은 현실 관계의 따뜻함에 달려 있다.',
              chunk: '기술은 유용한 도구로 역할을 해야 한다 / 일상적인 소통을 위한 / 하지만 진정한 행복은 현실 연결의 따뜻함에 달려 있다',
              en: 'Technology should serve as a useful tool for daily communication, but true happiness depends on the warmth of real-life connections.'
            },
            {
              id: 'p5s4',
              num: 4,
              role: 'Final Thought (대학생을 위한 마무리 통찰)',
              vocab: ['cherishing', 'is essential to -ing', 'balanced life'],
              kr: '대학생들에게 대면 우정을 소중히 여기는 것은 행복하고 균형 잡힌 삶을 살아가는 데 필수적이다.',
              chunk: '대학생들에게 / 대면 우정을 소중히 여기는 것은 필수적이다 / 행복하고 균형 잡힌 삶을 사는 데',
              en: 'For college students, cherishing face-to-face friendships is essential to living a happy and balanced life.'
            }
          ]
        },
        {
          id: 'skeleton',
          tabLabel: '뼈대 5문장 ★',
          title: '시험장 최우선 암기 — 에세이 뼈대 5문장 (Thesis + Topic 1~3 + Restatement)',
          desc: '이 5문장만 완벽히 외워도 에세이 전체 논리 구조(Organization 5/5)와 Unit 1 필수 어휘가 자동으로 완성됩니다.',
          sentences: [
            {
              id: 'p1s4',
              num: 1,
              role: '뼈대 1 — 서론 Thesis Statement (핵심 논지)',
              vocab: ['conflict (Unit 1)', 'status (Unit 1)', 'whereas'],
              kr: '비록 두 형태의 관계 모두 사람들이 연락을 유지하도록 돕지만, 온라인 소셜 네트워크는 단지 빠르고 편리한 상호작용만을 제공하는 반면, 대면 우정은 더 깊은 정서적 교감, 갈등을 해결하는 더 건강한 방식, 그리고 사회적 지위의 압박으로부터의 자유를 제공한다.',
              chunk: '비록 두 형태의 연결 모두 사람들이 연락을 유지하도록 돕지만 / 온라인 소셜 네트워크는 오직 빠르고 편리한 상호작용만 제공한다 / 반면 대면 우정은 제공한다 / 더 깊은 정서적 인식, 갈등을 해결하는 더 건강한 방식들 / 그리고 사회적 지위의 압박으로부터의 자유를',
              en: 'Although both forms of connection help people stay in touch, online social networks only offer fast and convenient interaction, whereas face-to-face friendships provide deeper emotional awareness, healthier ways to resolve conflict, and freedom from the pressure of social status.'
            },
            {
              id: 'p2s1',
              num: 2,
              role: '뼈대 2 — 본론 1 Topic Sentence (속도와 노력)',
              vocab: ['interact (Unit 1)', 'differ in', 'required to'],
              kr: '첫째, 온라인 플랫폼과 현실 환경은 타인과 상호작용하는 데 요구되는 속도와 노력에서 차이가 난다.',
              chunk: '첫째, 온라인 플랫폼과 현실 환경은 다르다 / 속도와 노력 면에서 / 타인과 상호작용하는 데 요구되는',
              en: 'First, online platforms and real-life settings differ in the speed and effort required to interact with others.'
            },
            {
              id: 'p3s1',
              num: 3,
              role: '뼈대 3 — 본론 2 Topic Sentence (정서적 깊이와 교감)',
              vocab: ['aware of (Unit 1)', 'much greater emotional depth'],
              kr: '둘째, 대면 우정은 친구들이 실제 인간의 감정을 온전히 인지하기 때문에 훨씬 더 큰 정서적 깊이를 형성한다.',
              chunk: '둘째, 대면 우정은 훨씬 더 큰 정서적 깊이를 쌓는다 / 왜냐하면 친구들이 온전히 인지하기 때문이다 / 실제 인간의 감정들을',
              en: 'Second, face-to-face friendships build much greater emotional depth because friends are fully aware of real human feelings.'
            },
            {
              id: 'p4s1',
              num: 4,
              role: '뼈대 4 — 본론 3 Topic Sentence (갈등과 사회적 지위)',
              vocab: ['conflict (Unit 1)', 'status (Unit 1)', 'deal with'],
              kr: '셋째, 이 두 가지 형태의 관계는 대인 간 갈등과 사회적 지위를 매우 다른 방식으로 다룬다.',
              chunk: '셋째, 두 형태의 연결은 다룬다 / 대인 관계 갈등과 사회적 지위를 / 매우 다른 방식으로',
              en: 'Third, the two forms of connection deal with interpersonal conflict and social status in very different ways.'
            },
            {
              id: 'p5s1',
              num: 5,
              role: '뼈대 5 — 결론 Restatement (논지 재진술)',
              vocab: ['In conclusion', 'irreplaceable', 'true emotional happiness'],
              kr: '결론적으로, 온라인 네트워크와 현실의 우정 모두 사람들을 연결해 주지만, 진정한 정서적 행복을 위해 대면 관계는 대체될 수 없다.',
              chunk: '결론적으로, 온라인 네트워크와 현실 우정 둘 다 사람들을 연결하지만 / 대면 관계는 대체 불가능하다 / 진정한 정서적 행복을 위해',
              en: 'In conclusion, while both online networks and real-life friendships connect people, face-to-face relationships are irreplaceable for true emotional happiness.'
            }
          ]
        },
        {
          id: 'outline',
          tabLabel: '제출용 Outline',
          title: '시험장 반입 및 제출용 1페이지 키워드 Outline (감점 0점 안전 버전)',
          desc: '완전한 문장(Full Sentence) 없이 키워드와 명사구만으로 작성하여 시험장 반입 규정을 100% 준수한 개요서입니다.',
          isOutline: true
        }
      ]
    };

    let engReturnTab = 'schedule';
    let engCurrentParaId = 'intro';
    let engCurrentSentIdx = 0;
    let engViewMode = 'single'; // 'single' | 'all'
    let engShowChunk = false;
    let engShowInitials = false;
    let engShowAnswer = false;
    let engDoneMap = {};
    let engDraftMap = {};

    try {
      engDoneMap = JSON.parse(localStorage.getItem('studium_eng_essay_done') || '{}');
      engDraftMap = JSON.parse(localStorage.getItem('studium_eng_essay_drafts') || '{}');
    } catch (e) {
      engDoneMap = {};
      engDraftMap = {};
    }

    function saveEngDoneMap() {
      try {
        localStorage.setItem('studium_eng_essay_done', JSON.stringify(engDoneMap));
      } catch (e) {}
      updateEngProgressBadge();
    }

    function saveEngDraft(sentId, val) {
      engDraftMap[sentId] = val;
      try {
        localStorage.setItem('studium_eng_essay_drafts', JSON.stringify(engDraftMap));
      } catch (e) {}
    }

    function updateEngProgressBadge() {
      const badge = document.getElementById('eng-essay-progress-badge');
      if (!badge) return;
      const allIds = ['p1s1','p1s2','p1s3','p1s4','p2s1','p2s2','p2s3','p2s4','p2s5','p2s6','p3s1','p3s2','p3s3','p3s4','p3s5','p4s1','p4s2','p4s3','p4s4','p4s5','p4s6','p5s1','p5s2','p5s3','p5s4'];
      const doneCount = allIds.filter(id => engDoneMap[id]).length;
      badge.textContent = `암기 ${doneCount}/25`;
    }

    function openEngEssayScreen(fromTab) {
      if (fromTab) engReturnTab = fromTab;
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const screen = document.getElementById('screen-eng-essay');
      if (screen) screen.classList.add('active');

      const backBtn = document.getElementById('eng-essay-back-btn');
      if (backBtn) {
        const labelMap = { schedule: '스케줄', reader: '원문', exam: '족보' };
        backBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:4px;">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>${labelMap[engReturnTab] || '돌아가기'}
        `;
      }

      updateEngProgressBadge();
      renderEngParaTabs();
      renderEngSentenceBar();
      renderEngTrainerContent();
      window.scrollTo(0, 0);
    }

    function closeEngEssayScreen() {
      switchTab(engReturnTab || 'schedule');
    }

    function selectEngPara(paraId) {
      engCurrentParaId = paraId;
      engCurrentSentIdx = 0;
      engShowAnswer = false;
      engShowInitials = false;
      renderEngParaTabs();
      renderEngSentenceBar();
      renderEngTrainerContent();
    }

    function selectEngSentence(idx) {
      const para = ENG_ESSAY_DATA.paragraphs.find(p => p.id === engCurrentParaId);
      if (!para || !para.sentences) return;
      if (idx < 0 || idx >= para.sentences.length) return;
      engCurrentSentIdx = idx;
      engShowAnswer = false;
      engShowInitials = false;
      renderEngSentenceBar();
      renderEngTrainerContent();
    }

    function toggleEngViewMode() {
      engViewMode = engViewMode === 'single' ? 'all' : 'single';
      renderEngSentenceBar();
      renderEngTrainerContent();
    }

    function renderEngParaTabs() {
      const container = document.getElementById('eng-essay-para-tabs');
      if (!container) return;
      let html = '';
      ENG_ESSAY_DATA.paragraphs.forEach(p => {
        const active = p.id === engCurrentParaId ? 'active' : '';
        html += `<div class="sub-nav-item ${active}" onclick="selectEngPara('${p.id}')">${p.tabLabel}</div>`;
      });
      container.innerHTML = html;
    }

    function renderEngSentenceBar() {
      const bar = document.getElementById('eng-essay-sentence-bar');
      if (!bar) return;
      const para = ENG_ESSAY_DATA.paragraphs.find(p => p.id === engCurrentParaId);
      if (!para || para.isOutline) {
        bar.style.display = 'none';
        return;
      }
      bar.style.display = 'flex';
      let numsHtml = '<div class="eng-sent-nums">';
      para.sentences.forEach((s, idx) => {
        const isActive = engViewMode === 'single' && idx === engCurrentSentIdx ? 'active' : '';
        const isDone = engDoneMap[s.id] ? 'done' : '';
        const checkMark = engDoneMap[s.id] ? ' ✓' : '';
        numsHtml += `<button type="button" class="eng-sent-num-btn ${isActive} ${isDone}" onclick="engViewMode='single'; selectEngSentence(${idx})">문장 ${s.num}${checkMark}</button>`;
      });
      numsHtml += '</div>';

      const modeLabel = engViewMode === 'single' ? '문단 전체 보기' : '한 문장씩 외우기';
      bar.innerHTML = `
        ${numsHtml}
        <button type="button" class="eng-mode-toggle" onclick="toggleEngViewMode()">${modeLabel}</button>
      `;
    }

    function normalizeEngWord(w) {
      return String(w || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function buildInitialsHint(enText) {
      return enText.split(/\s+/).map(word => {
        const m = word.match(/^([^a-zA-Z0-9]*)([a-zA-Z0-9]+)([^a-zA-Z0-9]*)$/);
        if (!m) return word;
        const prefix = m[1];
        const core = m[2];
        const suffix = m[3];
        if (core.length <= 1) return word;
        return prefix + core[0] + '_'.repeat(Math.min(core.length - 1, 6)) + suffix;
      }).join(' ');
    }

    function computeEngDiffHtml(userText, targetEn) {
      const targetWords = targetEn.trim().split(/\s+/);
      const userWords = userText.trim() ? userText.trim().split(/\s+/) : [];
      let matchedCount = 0;
      let html = '';

      targetWords.forEach((tw, idx) => {
        const uw = userWords[idx];
        if (uw && normalizeEngWord(uw) === normalizeEngWord(tw)) {
          matchedCount++;
          html += `<span class="eng-w-ok">${escapeHtml(tw)}</span> `;
        } else if (uw) {
          html += `<span class="eng-w-miss" title="입력: ${escapeHtml(uw)}">[${escapeHtml(uw)} → ${escapeHtml(tw[0])}...]</span> `;
        } else {
          html += `<span class="eng-w-miss">___</span> `;
        }
      });

      const pct = targetWords.length > 0 ? Math.round((matchedCount / targetWords.length) * 100) : 0;
      return {
        pct,
        matchedCount,
        totalCount: targetWords.length,
        userCount: userWords.length,
        html
      };
    }

    function speakEngSentence(text) {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = ttsRate || 0.9;
      u.volume = ttsVolume || 1.0;
      const voices = window.speechSynthesis.getVoices();
      const enVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Samantha') || v.name.includes('Alex') || v.name.includes('Natural'))) ||
                      voices.find(v => v.lang && v.lang.startsWith('en'));
      if (enVoice) u.voice = enVoice;
      window.speechSynthesis.speak(u);
    }

    function renderEngTrainerContent() {
      const container = document.getElementById('eng-essay-content');
      if (!container) return;
      const para = ENG_ESSAY_DATA.paragraphs.find(p => p.id === engCurrentParaId);
      if (!para) return;

      if (para.isOutline) {
        container.innerHTML = renderEngOutlineHtml();
        return;
      }

      let html = `
        <div class="eng-para-header">
          <div class="eng-para-title">${escapeHtml(para.title)}</div>
          <div class="eng-para-sub">${escapeHtml(para.desc)}</div>
        </div>
      `;

      if (engViewMode === 'all') {
        para.sentences.forEach((s, idx) => {
          const isDone = !!engDoneMap[s.id];
          const draft = engDraftMap[s.id] || '';
          const diff = computeEngDiffHtml(draft, s.en);
          html += `
            <div class="eng-trainer-block" style="padding: 16px 0;">
              <div class="eng-sent-meta-row">
                <span class="eng-sent-role">문장 ${s.num} · ${escapeHtml(s.role)}</span>
                <div style="display:inline-flex; gap:10px; align-items:center;">
                  <button type="button" class="eng-line-btn" onclick="engViewMode='single'; selectEngSentence(${idx})">이 문장 집중 연습 →</button>
                  <button type="button" class="speaker-btn" onclick="speakEngSentence('${ s.en.replace(/'/g, "\\'") }')" title="영문 발음 듣기">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="eng-kr-prompt" style="font-size:1.02rem; margin-bottom:10px;">${escapeHtml(s.kr)}</div>
              <div class="eng-write-wrap">
                <textarea class="eng-write-input" style="min-height:68px;" placeholder="한국어 문장을 보고 영어로 직접 적어보세요..." oninput="onEngAllModeInput('${s.id}', this.value)">${escapeHtml(draft)}</textarea>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; color:var(--text-muted); margin-bottom:8px;">
                <span id="eng-all-stat-${s.id}">일치율: ${diff.pct}% (${diff.matchedCount}/${diff.totalCount} 단어)</span>
                <div style="display:flex; gap:12px;">
                  <button type="button" class="eng-line-btn" onclick="document.getElementById('eng-all-ans-${s.id}').style.display = document.getElementById('eng-all-ans-${s.id}').style.display === 'none' ? 'block' : 'none'">정답 보기/가리기</button>
                  <button type="button" class="eng-line-btn ${isDone ? 'active' : ''}" onclick="toggleEngSentenceDone('${s.id}')">${isDone ? '암기 완료 ✓' : '암기 체크'}</button>
                </div>
              </div>
              <div id="eng-all-ans-${s.id}" class="eng-answer-box" style="display:none;">
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">어순: ${escapeHtml(s.chunk)}</div>
                <div>${escapeHtml(s.en)}</div>
              </div>
            </div>
          `;
        });
        container.innerHTML = html;
        return;
      }

      // Single Sentence Focused Korean -> English Writing Mode
      const s = para.sentences[engCurrentSentIdx] || para.sentences[0];
      const isDone = !!engDoneMap[s.id];
      const draft = engDraftMap[s.id] || '';
      const diff = computeEngDiffHtml(draft, s.en);
      const vocabStr = (s.vocab || []).join(' · ');

      html += `
        <div class="eng-trainer-block">
          <div class="eng-sent-meta-row">
            <span class="eng-sent-role">문장 ${s.num} / ${para.sentences.length} — ${escapeHtml(s.role)}</span>
            <button type="button" class="speaker-btn" onclick="speakEngSentence('${s.en.replace(/'/g, "\\'")}')" title="영문 발음 듣기" style="border-bottom:1px solid var(--border); padding:2px 4px; font-size:0.76rem; gap:4px;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
              <span>영문 발음</span>
            </button>
          </div>

          ${vocabStr ? `<div style="margin-bottom: 12px;"><span class="eng-vocab-tag">핵심 표현·필수 어휘: ${escapeHtml(vocabStr)}</span></div>` : ''}

          <div class="eng-kr-label">한국어 제시문 (보고 영어로 영작)</div>
          <div class="eng-kr-prompt">${escapeHtml(s.kr)}</div>

          <div id="eng-chunk-guide-box" class="eng-chunk-box" style="display: ${engShowChunk ? 'block' : 'none'};">
            <div style="font-weight:600; color:var(--text); margin-bottom:2px;">영어 어순 직독직해 가이드</div>
            <div>${escapeHtml(s.chunk)}</div>
          </div>

          <div id="eng-initials-hint-box" class="eng-chunk-box" style="display: ${engShowInitials ? 'block' : 'none'}; font-family: var(--font-py);">
            <div style="font-weight:600; color:var(--text); margin-bottom:2px; font-family: var(--font-ui);">첫 글자(Initial) 힌트</div>
            <div>${escapeHtml(buildInitialsHint(s.en))}</div>
          </div>

          <div class="eng-write-wrap">
            <div class="eng-write-header">
              <span>영문 타이핑 암기 입력창</span>
              <span id="eng-live-score">일치율 ${diff.pct}% (${diff.matchedCount} / ${diff.totalCount} 단어)</span>
            </div>
            <textarea
              id="eng-active-textarea"
              class="eng-write-input"
              placeholder="위의 한국어 문장을 보고 영어 문장을 적어보세요..."
              autocapitalize="sentences"
              autocomplete="off"
              spellcheck="false"
              oninput="onEngInputUpdate(this.value)"
            >${escapeHtml(draft)}</textarea>
          </div>

          <div class="eng-hint-toolbar">
            <button type="button" class="eng-line-btn" onclick="insertNextEngWordHint()">+ 다음 단어 채우기</button>
            <button type="button" class="eng-line-btn ${engShowChunk ? 'active' : ''}" onclick="toggleEngChunkGuide()">어순 가이드 ${engShowChunk ? '숨기기' : '보기'}</button>
            <button type="button" class="eng-line-btn ${engShowInitials ? 'active' : ''}" onclick="toggleEngInitialsHint()">첫 글자 힌트 ${engShowInitials ? '숨기기' : '보기'}</button>
            <button type="button" class="eng-line-btn ${engShowAnswer ? 'active' : ''}" onclick="toggleEngAnswer()">정답 영문 ${engShowAnswer ? '가리기' : '확인'}</button>
            <button type="button" class="eng-line-btn" onclick="clearCurrentEngInput()">지우기</button>
          </div>

          <div class="eng-kr-label">실시간 단어 대조 결과</div>
          <div id="eng-live-diff" class="eng-diff-feedback">${diff.html}</div>

          <div id="eng-answer-reveal-box" class="eng-answer-box" style="display: ${engShowAnswer ? 'block' : 'none'};">
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-bottom: 4px;">모범 정답 영문 (Target Sentence)</div>
            <div style="font-weight: 600;">${escapeHtml(s.en)}</div>
          </div>

          <div class="eng-nav-actions">
            <button type="button" class="fc-btn" onclick="prevEngSentence()">← 이전 문장</button>
            <button type="button" class="fc-check-btn ${isDone ? 'checked' : ''}" id="eng-done-btn" onclick="toggleEngSentenceDone('${s.id}')">${isDone ? '암기 완료 ✓' : '암기 완료 체크'}</button>
            <button type="button" class="fc-btn" onclick="nextEngSentence()">다음 문장 →</button>
          </div>
        </div>
      `;

      container.innerHTML = html;
    }

    function onEngInputUpdate(val) {
      const para = ENG_ESSAY_DATA.paragraphs.find(p => p.id === engCurrentParaId);
      if (!para || !para.sentences) return;
      const s = para.sentences[engCurrentSentIdx];
      if (!s) return;

      saveEngDraft(s.id, val);
      const diff = computeEngDiffHtml(val, s.en);
      const scoreEl = document.getElementById('eng-live-score');
      const diffEl = document.getElementById('eng-live-diff');
      if (scoreEl) {
        scoreEl.textContent = `일치율 ${diff.pct}% (${diff.matchedCount} / ${diff.totalCount} 단어)`;
      }
      if (diffEl) {
        diffEl.innerHTML = diff.html;
      }
      if (diff.pct === 100 && !engDoneMap[s.id]) {
        engDoneMap[s.id] = true;
        saveEngDoneMap();
        renderEngSentenceBar();
        const doneBtn = document.getElementById('eng-done-btn');
        if (doneBtn) {
          doneBtn.classList.add('checked');
          doneBtn.textContent = '암기 완료 ✓';
        }
      }
    }

    function onEngAllModeInput(sentId, val) {
      saveEngDraft(sentId, val);
      const para = ENG_ESSAY_DATA.paragraphs.find(p => p.id === engCurrentParaId);
      if (!para || !para.sentences) return;
      const s = para.sentences.find(item => item.id === sentId);
      if (!s) return;
      const diff = computeEngDiffHtml(val, s.en);
      const statEl = document.getElementById('eng-all-stat-' + sentId);
      if (statEl) {
        statEl.textContent = `일치율: ${diff.pct}% (${diff.matchedCount}/${diff.totalCount} 단어)`;
      }
    }

    function insertNextEngWordHint() {
      const para = ENG_ESSAY_DATA.paragraphs.find(p => p.id === engCurrentParaId);
      if (!para || !para.sentences) return;
      const s = para.sentences[engCurrentSentIdx];
      if (!s) return;

      const targetWords = s.en.trim().split(/\s+/);
      const currentVal = (engDraftMap[s.id] || '').trim();
      const userWords = currentVal ? currentVal.split(/\s+/) : [];

      let nextIdx = 0;
      while (nextIdx < targetWords.length && userWords[nextIdx] && normalizeEngWord(userWords[nextIdx]) === normalizeEngWord(targetWords[nextIdx])) {
        nextIdx++;
      }

      if (nextIdx < targetWords.length) {
        const updatedWords = targetWords.slice(0, nextIdx + 1);
        const newText = updatedWords.join(' ') + (nextIdx + 1 < targetWords.length ? ' ' : '');
        const ta = document.getElementById('eng-active-textarea');
        if (ta) {
          ta.value = newText;
          ta.focus();
        }
        onEngInputUpdate(newText);
      }
    }

    function clearCurrentEngInput() {
      const para = ENG_ESSAY_DATA.paragraphs.find(p => p.id === engCurrentParaId);
      if (!para || !para.sentences) return;
      const s = para.sentences[engCurrentSentIdx];
      if (!s) return;
      const ta = document.getElementById('eng-active-textarea');
      if (ta) {
        ta.value = '';
        ta.focus();
      }
      onEngInputUpdate('');
    }

    function toggleEngChunkGuide() {
      engShowChunk = !engShowChunk;
      renderEngTrainerContent();
    }

    function toggleEngInitialsHint() {
      engShowInitials = !engShowInitials;
      renderEngTrainerContent();
    }

    function toggleEngAnswer() {
      engShowAnswer = !engShowAnswer;
      renderEngTrainerContent();
    }

    function toggleEngSentenceDone(sentId) {
      engDoneMap[sentId] = !engDoneMap[sentId];
      saveEngDoneMap();
      renderEngSentenceBar();
      renderEngTrainerContent();
    }

    function prevEngSentence() {
      const para = ENG_ESSAY_DATA.paragraphs.find(p => p.id === engCurrentParaId);
      if (!para || !para.sentences) return;
      if (engCurrentSentIdx > 0) {
        selectEngSentence(engCurrentSentIdx - 1);
      } else {
        const paraIdx = ENG_ESSAY_DATA.paragraphs.findIndex(p => p.id === engCurrentParaId);
        if (paraIdx > 0) {
          const prevPara = ENG_ESSAY_DATA.paragraphs[paraIdx - 1];
          if (prevPara && prevPara.sentences) {
            engCurrentParaId = prevPara.id;
            engCurrentSentIdx = prevPara.sentences.length - 1;
            renderEngParaTabs();
            renderEngSentenceBar();
            renderEngTrainerContent();
          }
        }
      }
    }

    function nextEngSentence() {
      const para = ENG_ESSAY_DATA.paragraphs.find(p => p.id === engCurrentParaId);
      if (!para || !para.sentences) return;
      if (engCurrentSentIdx < para.sentences.length - 1) {
        selectEngSentence(engCurrentSentIdx + 1);
      } else {
        const paraIdx = ENG_ESSAY_DATA.paragraphs.findIndex(p => p.id === engCurrentParaId);
        if (paraIdx >= 0 && paraIdx < ENG_ESSAY_DATA.paragraphs.length - 1) {
          const nextPara = ENG_ESSAY_DATA.paragraphs[paraIdx + 1];
          selectEngPara(nextPara.id);
        }
      }
    }

    function renderEngOutlineHtml() {
      return `
        <div class="eng-para-header">
          <div class="eng-para-title">시험장 제출용 1페이지 키워드 Outline (안전 버전)</div>
          <div class="eng-para-sub">완전한 문장(Full Sentence)을 일절 배제하고 키워드·명사구만으로 구성하여 감점 요인을 원천 차단한 개요서입니다.</div>
        </div>

        <div class="sentence-row">
          <div style="font-weight:700; margin-bottom:6px;">Topic & Title</div>
          <div style="font-size:0.88rem; line-height:1.6; color:var(--text);">
            <div>· Topic: Online social networks vs. face-to-face friendships</div>
            <div>· Title: Online Social Networks vs. Face-to-Face Friendships: Quantity vs. Emotional Depth</div>
            <div>· Target Vocabulary (Unit 1): interact, aware of, status, emulate, conflict, acquire</div>
          </div>
        </div>

        <div class="sentence-row">
          <div style="font-weight:700; margin-bottom:6px;">I. Introduction</div>
          <div style="font-size:0.86rem; line-height:1.65; color:var(--text);">
            <div>· Hook: Modern digital era, global connection, single tap on a smartphone</div>
            <div>· Background (Similarity): Basic human need — connecting, sharing daily life, escaping loneliness</div>
            <div>· Bridge: Hundreds of online followers ≠ true real-life friends</div>
            <div>· Thesis Points (Differences):</div>
            <div style="padding-left:12px; color:var(--text-muted);">1. Fast & convenient interaction (Online) vs. time & effort (Face-to-face)</div>
            <div style="padding-left:12px; color:var(--text-muted);">2. Deeper emotional awareness & nonverbal cues (Face-to-face)</div>
            <div style="padding-left:12px; color:var(--text-muted);">3. Healthy resolution of conflict & freedom from social status pressure (Face-to-face)</div>
          </div>
        </div>

        <div class="sentence-row">
          <div style="font-weight:700; margin-bottom:6px;">II. Body Paragraph 1: Speed and Convenience of Interaction</div>
          <div style="font-size:0.86rem; line-height:1.65; color:var(--text);">
            <div>· Topic focus: Speed and effort required to interact [Target Vocab 1]</div>
            <div>· Online Social Networks:</div>
            <div style="padding-left:12px; color:var(--text-muted);">- Instant contact with hundreds of peers without leaving home</div>
            <div style="padding-left:12px; color:var(--text-muted);">- Easy to acquire [Target Vocab 2] large follower lists / quick comments & messages</div>
            <div>· Face-to-Face Friendships (In contrast):</div>
            <div style="padding-left:12px; color:var(--text-muted);">- Physical presence, shared time, patience, real planning, active conversation</div>
            <div>· Summary: Convenience in quantity (online) vs. real effort & strong trust (in-person)</div>
          </div>
        </div>

        <div class="sentence-row">
          <div style="font-weight:700; margin-bottom:6px;">III. Body Paragraph 2: Emotional Depth and Nonverbal Awareness</div>
          <div style="font-size:0.86rem; line-height:1.65; color:var(--text);">
            <div>· Topic focus: Emotional depth — being aware of [Target Vocab 3] real human feelings</div>
            <div>· Online Social Networks:</div>
            <div style="padding-left:12px; color:var(--text-muted);">- Short texts, emojis, edited photos → easy to hide loneliness and sadness</div>
            <div>· Face-to-Face Friendships (On the other hand):</div>
            <div style="padding-left:12px; color:var(--text-muted);">- Nonverbal cues: facial expressions, voice tone, body language</div>
            <div style="padding-left:12px; color:var(--text-muted);">- Warm comfort in the same room (irreplaceable by phone screens)</div>
            <div>· Summary: Surface contact (online) vs. true empathy (real-life presence)</div>
          </div>
        </div>

        <div class="sentence-row">
          <div style="font-weight:700; margin-bottom:6px;">IV. Body Paragraph 3: Handling Conflict and Social Status</div>
          <div style="font-size:0.86rem; line-height:1.65; color:var(--text);">
            <div>· Topic focus: Interpersonal conflict [Target Vocab 4] and social status [Target Vocab 5]</div>
            <div>· Online Social Networks:</div>
            <div style="padding-left:12px; color:var(--text-muted);">- Pressure to emulate [Target Vocab 6] popular influencers for high social status & likes</div>
            <div style="padding-left:12px; color:var(--text-muted);">- Stressful comparison → serious online conflict or sudden blocking ("unfriending")</div>
            <div>· Face-to-Face Friendships (Conversely):</div>
            <div style="padding-left:12px; color:var(--text-muted);">- Honest talk about difficult feelings / mutual respect & understanding</div>
            <div>· Summary: Competition (online) vs. stronger bonds through trust (face-to-face)</div>
          </div>
        </div>

        <div class="sentence-row" style="border-bottom:none;">
          <div style="font-weight:700; margin-bottom:6px;">V. Conclusion</div>
          <div style="font-size:0.86rem; line-height:1.65; color:var(--text);">
            <div>· Restatement: Both connect people, but face-to-face relationships = irreplaceable for emotional happiness</div>
            <div>· Summary of Main Points: Fast interaction (online) vs. deep awareness, overcoming conflict, honesty over social status (face-to-face)</div>
            <div>· Final Thought: Technology as a useful tool, cherishing real-life friendships for a happy & balanced college life</div>
          </div>
        </div>
      `;
    }

    // Init
    window.addEventListener('DOMContentLoaded', () => {
      applyTheme(currentTheme);
      if (fontSize === 'large') {
        document.body.classList.add('font-large');
      }
      initScheduleSecurity();
      selectBook('beiying');
      initVocab();
      renderExamContent();
      updateSettingUI();
      initDsQuiz();
      updateEngProgressBadge();
    });
