# AI WORK LOG

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
