# AI WORK LOG

## [202] 2026-10-14 00:05 - College English 2 (Billy & KNN) 팀티칭 중간고사 60단어 플래시카드 및 54문항 족보 모바일 웹 통합·배포
- **작업 주체**: [Pro-AI]
- **작업 목적**: 대학영어 2 (2+1 팀티칭) 중간고사 만점(20점 + 14점 = 34점 만점)을 위하여 화요일 Billy Joseph Fitzgerald 교수(Pathways 3 / 60% 비중)와 수요일 김나나 교수(Prism Reading 3 / 30% 비중)의 전범위 어휘 및 모의고사 데이터를 스투디움에 전면 탑재하고 Cloudflare Pages에 배포 완료.
- **주요 작업 내역**:
  1. **Pathways 3 Unit 1·3·5 필수 Target Words 60종 영영 플래시카드 탑재**:
     - 파일: `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/data/english/pathways3_vocab.json`, `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/js/app.js`
     - Cengage 공식 영영 정의, 한국어 의미, 교재 내 기출 예문, 품사, Unit 정보 수록.
     - Web Speech TTS 언어 분기(`/[a-zA-Z]/.test(text) ? 'en-US' : 'zh-CN'`)를 추가하여 영어 단어는 미국 원어민 발음으로 자동 재생.
  2. **Billy Joseph Fitzgerald Cengage 실전 모의고사 30문항 아코디언 족보 탑재**:
     - 파일: `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/data/english/billy_exam.json`
     - 영영 정의 매칭(10문항), 문맥 어휘 및 콜로케이션(5문항), 독해 및 스킬 분석(8문항), 시각 자료 및 인과 추론(3문항), 문법(비교급, if.. then..) 및 에세이 구조(4문항) 전 문항 수록.
  3. **김나나 교수님 6대 출제 유형 고난도 실전 모의고사 24문항 아코디언 족보 탑재**:
     - 파일: `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/data/english/knn_exam.json`
     - 주제 파악, T/F 내용 일치, 연결어 추론, 문장 순서 배열, 영한 정밀 번역 서술형, 지칭 대명사 추론 24문항 및 상세 해설 수록.
  4. **암호화 시간표(AES-256-GCM) 화요일·수요일 과목 및 과제 갱신**:
     - 화요일 `tue-college-eng` (Billy) 및 수요일 `wed-college-eng` (김나나) 과목 정보, 강의실(0508호), 성적 비중, 중간고사 실천 과제 탑재.
  5. **Cloudflare Pages 무중단 배포**:
     - `the-studium` 프로젝트 대상 라이브 배포 완료 (`https://the-studium.pages.dev`).

## [201] 2026-10-12 23:44 - 화요일 College English 2 In-Class Essay 문단별 탭 및 한 문장씩 한→영 타이핑 암기 훈련기 구축·배포
- **작업 주체**: [Pro-AI]
- **작업 목적**: 대표님께서 요청하신 화요일 College English 2 과제 및 시험 문서(`/Users/star/Library/Mobile Documents/iCloud~md~obsidian/Documents/26-02_semester/_학교_활동/02_화요일/College_English_2/3_과제·시험 (MD+PDF)/05_과제_Writing_Outline_and_InClass_Essay.md`)를 스투디움 화요일 영어 과정에 통합하고, 문단별 탭 분리 및 한 문장씩 한국어 제시문을 보며 영어로 직접 타이핑하여 외우는 인터랙티브 훈련 화면(`#screen-eng-essay`)을 구축함.
- **주요 작업 내역**:
  1. **문단별 7개 탭 및 25문장 한→영 집중 암기 데이터셋 탑재**:
     - 파일: `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/js/app.js`
     - `I. 서론 (4)`, `II. 본론1 (6)`, `III. 본론2 (5)`, `IV. 본론3 (6)`, `V. 결론 (4)`, `뼈대 5문장 ★`, `제출용 Outline` 총 7개 탭으로 문단을 세분화하고, 각 문장마다 한국어 제시문, 영어 어순 직독직해 가이드, 첫 글자 이니셜 힌트, Unit 1 필수 어휘 태그(`interact`, `aware of`, `status`, `emulate`, `conflict`, `acquire`), 모범 영문 정답 및 미국 영어 음성 합성(`en-US` TTS) 기능을 전수 탑재.
  2. **실시간 영문 타이핑 대조 채점기 및 다음 단어 자동 채우기 힌트 구현**:
     - 파일: `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/index.html`, `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/css/style.css`, `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/js/app.js`
     - 한국어 문장을 보고 영문 입력창에 타이핑할 때마다 단어 단위 일치율과 실시간 정오답 밑줄 대조를 즉시 표시하며, 막히는 부분에서 `+ 다음 단어 채우기`, `어순 가이드`, `첫 글자 힌트`, `정답 영문 확인`을 선택할 수 있도록 구현.
  3. **다중 진입 경로 및 암호화 시간표 연동**:
     - 파일: `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/build_data.py`
     - 화요일 `College English 2` 시간표 카드 내 바로가기 버튼, 스케줄 초기 화면 바로가기 버튼, `원문` 및 `족보` 상단 탭(`화요일 영어 Essay`) 어디서든 즉시 진입 가능하도록 구성.

## [200] 2026-10-12 18:05 - 자료구조 1~12장 전단원 340문항 연습문제 CBT 웹앱 구축 및 실시간 채점 배포
- **작업 주체**: [Pro-AI]
- **작업 목적**: 자료구조 교재 파이썬으로 쉽게 배우는 자료구조 내 1장부터 12장까지 수록된 연습문제 총 340문항을 디지털 데이터화하고, 모바일 학습 웹 스투디움 STUDIUM 스케줄 탭의 자료구조 카드 클릭 시 바로 진입 가능한 단독 CBT 화면 및 실시간 정답 채점 시스템을 구축하여 클라우드플레어 Pages에 격리 배포 완료.
- **주요 작업 내역**:
  1. **교재 원문 무손실 파싱**:
     - 원본 교재 `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/03_수요일/Data_Structure/1_강의자료 (PDF)/00_교재_및_참고도서 (PDF)/파이썬으로쉽게배우는자료구조.pdf`로부터 PyMuPDF 텍스트 레이어 직출 파서 `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/build_ds_quiz.py` 작성 및 실행.
     - 1장 17문항, 2장 31문항, 3장 25문항, 4장 24문항, 5장 32문항, 6장 29문항, 7장 28문항, 8장 29문항, 9장 44문항, 10장 21문항, 11장 24문항, 12장 36문항 등 총 340개 전 문항을 구조화된 JSON 데이터 `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/data/ds_quiz.json`으로 추출.
  2. **모바일 웹앱 번들링 및 오프라인 캐시 구성**:
     - `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/build_data.py` 파이프라인에 자료구조 퀴즈 데이터를 통합하여 `data.js` 내 `DS_QUIZ_DATA` 전역 객체로 인라인 번들링 완료.
     - 서비스 워커 `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/sw.js`에 캐시 자산 추가 및 최신 버전 갱신 완료.
  3. **인터랙티브 모바일 UI 및 컨트롤러 구현**:
     - `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/index.html` 내 단독 화면 `#screen-ds-quiz` 마크업 배치: 상단 바, 시험 범위 필터 칩 중간고사 1~5장 / 기말고사 6~12장 / 전체 1~12장, 1~12장 단원 셀렉터 탭, 단원별 메타 카드 및 문항 컨테이너 구성.
     - `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/css/style.css` 내 다크 모드 연동 흑백 모노크롬 미니멀 카드 스타일 및 객관식 실시간 정답 초록색 / 오답 빨간색 피드백 스타일 반영.
     - `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/js/app.js` 내 화면 진입/퇴출, 단원 선택, 객관식 실시간 채점 및 단답·서술형 해설 토글 로직 구현 완료.
     - 수요일 시간표 자료구조 카드 내 전단원 연습문제 CBT 풀기 버튼 탑재.
  4. **옵시디언 12개 수업노트 동기화**:
     - `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/03_수요일/Data_Structure/2_수업노트 (MD)/연습문제_풀이/` 내 01단원부터 12단원까지의 기존 노트에 실제 추출된 문제 본문과 보기를 배치하고 웹앱 바로가기 콜아웃 연동 완료. 기존 작성 답안 무손실 보존.
  5. **클라우드플레어 Pages 라이브 배포 및 검증**:
     - `/Users/star/Desktop/my_work/<HUFS>/26-02_semester/_학교_활동/00_모바일_학습웹_배포/deploy.sh` 실행을 통해 https://the-studium.pages.dev 무중단 배포 완료.
- **최종 검증 팩트 데이터**:
  - 파싱 완료 단원 수: 12개 단원 전수
  - 수록 문제 총수: 340문항
  - 실시간 배포 URL: https://the-studium.pages.dev
