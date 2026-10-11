# STUDIUM

> 대학 어문학 강의 텍스트와 족보를 학습하기 위한 오프라인 지원 모노크롬 에디토리얼 모바일 웹 애플리케이션

🌐 **Live Demo:** [https://the-studium.pages.dev](https://the-studium.pages.dev)

---

## 📖 프로젝트 개요

STUDIUM은 한국외국어대학교 어문학 및 교양 강의 본문, 어휘 사전, 기출 족보를 모바일 환경에서 가장 집중도 높게 학습할 수 있도록 설계된 에디토리얼 웹 애플리케이션입니다.

화려한 시각적 요소를 배제하고 1픽셀 모노크롬 테두리와 타이포그래피 중심으로 인터페이스를 구축하여, 이동 중이거나 강의실에서도 텍스트에 오롯이 몰입할 수 있습니다.

---

## 🛠️ 기술 스택

- **Frontend:** Vanilla JavaScript, HTML5, CSS3 Custom Properties
- **PWA & Offline:** Service Worker Cache Storage API, Web App Manifest
- **Audio Engine:** Web Speech API SpeechSynthesis
- **Data Pipeline:** Python 3 정밀 마크다운 파서 및 단어 사전 결합기
- **Deployment:** Cloudflare Pages Global Edge Network

---

## ✨ 주요 기능 및 특징

1. **오프라인 우선 PWA 지원**
   - 서비스워커 기반 캐싱으로 네트워크 연결이 불안정하거나 끊긴 환경에서도 학습 지속 가능
2. **모노크롬 에디토리얼 디자인**
   - 흑백 미니멀리즘과 1픽셀 직각 보더를 적용하여 군더더기 없는 가독성 제공
   - 시스템 연동, 다크 모드, 라이트 모드 3단 테마 지원
3. **원어민 발음 재생 및 오디오 엔진**
   - Web Speech API 기반 중국어 원문 음성 합성 재생
   - 배속 조절과 음량 조절 및 테스트 듣기 지원
4. **정밀 어휘 사전 및 인스펙터**
   - 2,670개 단어로 구성된 마스터 사전 연동
   - 원문 문장 터치 시 실시간 어휘 분석 제공
5. **학습 스케줄러 및 족보 뷰어**
   - 주간 학습 타임테이블 및 중간·기말 기출 족보 내장

---

## 📂 파일 구조

```text
00_모바일_학습웹_배포/
├── index.html              # 시맨틱 5화면 레이아웃 마크업
├── css/
│   └── style.css           # 모노크롬 테마 및 에디토리얼 스타일시트
├── js/
│   └── app.js             # 탭 전환, TTS 오디오, 테마 설정 로직
├── data/
│   ├── books/             # 교재별 분할 JSON 데이터
│   ├── dict/              # 마스터 어휘 사전 JSON
│   └── index.json         # 메타데이터 색인
├── build_data.py          # 원문 파싱 및 사전 결합 자동화 파이프라인
├── manifest.json          # PWA 설치 메타데이터
└── sw.js                  # 오프라인 캐싱 서비스워커
```

---

## 🚀 로컬 실행 방법

별도의 복잡한 설치 없이 정적 웹 서버를 통해 바로 실행할 수 있습니다.

```bash
# 파이썬 내장 웹 서버 실행
python3 -m http.server 8080
```

브라우저에서 `http://localhost:8080`으로 접속하여 확인합니다.
