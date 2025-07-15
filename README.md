# WebSocket Kong

WebSocket Kong is a web tool optimized for real-time WebSocket testing and development.  
It allows you to manage multiple WebSocket sessions, send/save/copy JSON messages, edit messages in tabs, and view logs—all in a convenient split-pane UI.

## Features

- **Multi-session**: Create and manage multiple WebSocket sessions simultaneously.
- **Tabbed Message Editing**: Each session supports multiple message tabs (#1, #2, ...), with one-click deletion by clicking an active tab (at least one tab always remains).
- **Message Save/Copy**: Save frequently used messages and quickly copy or load them into the input box with a single click.
- **Real-time Log**: View sent/received messages, errors, and connection status with timestamps.
- **JSON Highlighting**: Real-time JSON syntax highlighting and validation as you type.
- **UI**: Clean two-pane layout—left for saved messages, right for the full WebSocket session interface.

## Usage

1. Click **New Session** to add a new WebSocket session.
2. Enter your WebSocket server address and click Connect.
3. Add/delete multiple message tabs per session to prepare various messages.
4. Click Send to transmit a message and check the log for sent/received data.
5. Use Save to store a message; saved messages can be loaded into the input box with a single click.
6. Click a session tab or an active message tab again to delete it (at least one tab always remains).

## Development & Customization

- `popup.js` : Main logic (session/tab/message management)
- `styles.css` : UI styling
- `helpers.js`, `history.js` : Utility functions and message history management

## Installation & Running

1. Clone this repository or download the files.
2. **Start a local HTTP server** in the project directory (required for browser security):
   ```sh
   npx http-server .
   ```
3. Open the provided URL (e.g., http://localhost:8080/popup.html) in your browser.
   Note: Opening popup.html directly from the file system (file://) may not work due to browser security restrictions. Always use a local HTTP server.

## Contribution & License

- MIT License

---

# WebSocket Kong

WebSocket Kong은 여러 개의 WebSocket 세션을 동시에 관리하고,  
JSON 메시지 전송/저장/복사, 탭 기반 메시지 편집, 로그 확인 등  
실시간 WebSocket 테스트와 개발에 최적화된 웹 도구입니다.

## 주요 기능

- **멀티 세션**: 여러 WebSocket 세션을 동시에 생성/관리
- **탭 기반 메시지 편집**: 각 세션마다 여러 메시지 탭(#1, #2, ...) 지원, 탭 클릭으로 삭제 가능
- **메시지 저장/복사**: 자주 쓰는 메시지를 저장하고, 클릭 한 번으로 복사 및 입력창에 불러오기
- **실시간 로그**: 송수신 메시지, 에러, 연결 상태를 시간별로 확인
- **JSON 하이라이트**: 메시지 입력 시 실시간 JSON 구문 강조 및 유효성 검사
- **UI**: 좌측 저장 메시지 리스트, 우측 WebSocket 세션 인터페이스의 2분할 레이아웃

## 사용 방법

1. **New Session** 버튼으로 새로운 WebSocket 세션을 추가하세요.
2. 각 세션에서 WebSocket 서버 주소를 입력 후 Connect로 연결합니다.
3. 여러 메시지 탭을 추가/삭제하며 다양한 메시지를 준비할 수 있습니다.
4. Send로 메시지를 전송하고, 로그에서 송수신 내역을 확인하세요.
5. Save로 메시지를 저장하고, 저장된 메시지는 클릭 한 번으로 입력창에 불러올 수 있습니다.
6. 세션 탭이나 메시지 탭을 한 번 더 클릭하면 해당 탭이 삭제됩니다(최소 1개는 남음).

## 개발 및 커스터마이징

- `popup.js` : 메인 로직 (세션/탭/메시지 관리)
- `styles.css` : 전체 UI 스타일
- `helpers.js`, `history.js` : 유틸리티 함수 및 메시지 기록 관리

## 설치 및 실행

1. 이 저장소를 클론하거나 파일을 다운로드합니다.
2. **프로젝트 폴더에서 로컬 HTTP 서버를 실행해야 합니다** (브라우저 보안 정책상 필요):
   ```sh
   npx http-server .
   ```
3. 터미널에 표시되는 주소(예: http://localhost:8080/popup.html)를 브라우저에서 엽니다.
   참고: popup.html을 파일 시스템(file://)에서 직접 열면 브라우저 보안 정책 때문에 정상 동작하지 않을 수 있습니다. 반드시 로컬 HTTP 서버를 사용하세요.

## 기여 및 라이선스
- MIT License

---
**Contact/Feedback**: [plankton0707@gmail.com]