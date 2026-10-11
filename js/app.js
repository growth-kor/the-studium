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
        row.innerHTML = `
          <div class="course-title">${c.name}</div>
          <div class="course-meta">
            <span>${c.time || ''}</span>
            ${c.room ? `<span>· ${c.room}</span>` : ''}
            ${c.prof ? `<span>· ${c.prof}</span>` : ''}
          </div>
          ${c.midterm_book ? `<div style="font-size:0.84rem; color:var(--text-muted); margin-bottom:8px;">텍스트: ${c.midterm_book}</div>` : ''}
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
    });
