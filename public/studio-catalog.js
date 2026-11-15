// 파코 스튜디오(new.html) 문제 목록의 공개 요약입니다. 정답·설명·테스트는 포함하지 않습니다.
// 이 파일은 scripts/build-studio-catalog.js 가 public/curriculum/ 의 문제 파일에서 만듭니다. 직접 고치지 말고
// 문제 파일(또는 step-NN/level.json)을 고친 뒤 `npm run build:catalog` 를 실행하세요. tests 가 최신 여부를 확인합니다.
(function (root) {
  var POINTS = { 맛보기: 5, 입문: 10, 기초: 20, 응용: 30, 도전: 50, 심화: 80 };
  var LEVELS = ["맛보기", "입문", "기초", "응용", "도전", "심화"];
  var PRACTICE_POINTS = 2;
  // 각 레벨(트랙)은 problems(핵심·연습 문제의 학습 순서)와 exam(승급 시험 문제)을 가집니다.
  var tracks = [
    {
      "id": "t1",
      "name": "Lv.1",
      "label": "Python 입문자",
      "description": "print()로 원하는 내용을 화면에 출력하고, input()으로 값을 받아 볼 수 있다.",
      "topics": "print() · 문자열 · 따옴표 · 주석 · input()",
      "problems": [
        {"id":"l01_01","title":"첫 인사 출력하기","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"c6001","title":"Hello 출력하기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6001_1","title":"Hi 출력하기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6001_2","title":"Python 출력하기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6002","title":"Hello World 출력하기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l01_02","title":"세 줄 자기소개","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"p6002_1","title":"띄어쓰기 있는 문장","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6002_2","title":"한글도 출력돼요","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6003","title":"두 줄로 인사하기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6003_1","title":"두 줄 출력","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l01_03","title":"파이썬 계산기","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"p6003_2","title":"세 줄 출력","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6004","title":"작은따옴표째 출력","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6004_1","title":"작은따옴표 보이기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6004_2","title":"It's me","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l01_04","title":"따옴표가 들어간 문장","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"c6005","title":"큰따옴표째 출력","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6005_1","title":"큰따옴표 보이기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6005_2","title":"대사 출력","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6006","title":"특수문자 줄","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l01_05","title":"고양이 그리기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6006_1","title":"특수문자 1","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6006_2","title":"이모티콘","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6007","title":"파일 위치 출력","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6007_1","title":"폴더 경로","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l01_06","title":"줄 긋기","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"p6007_2","title":"\\n 을 글자로","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6008","title":"코드 그대로 보여주기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6008_1","title":"코드를 글자로","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6008_2","title":"변수 코드 보여주기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l01_07","title":"좋아하는 것 말하기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"c6009","title":"문자 하나 그대로","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6009_1","title":"단어 따라 말하기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6009_2","title":"인사하기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6013","title":"문자 2개 순서 바꾸기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6013_1","title":"세 단어 거꾸로","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l01_08","title":"이름을 불러 주는 프로그램","kind":"core","type":"도전","level":"도전","minutes":12}
      ],
      "exam": [
        {"id":"l01_t1","title":"자기소개 카드","kind":"exam","type":"승급시험","level":"입문","minutes":10},
        {"id":"l01_t2","title":"문제와 답 출력","kind":"exam","type":"승급시험","level":"입문","minutes":10}
      ]
    },
    {
      "id": "t2",
      "name": "Lv.2",
      "label": "변수 탐험가",
      "description": "변수에 값을 저장하고, 입력받은 문자열을 숫자로 바꿔 계산할 수 있다.",
      "topics": "변수 · int() · float() · split() · 산술 연산자",
      "problems": [
        {"id":"l02_01","title":"두 수의 합","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"c6010","title":"정수 하나 그대로","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6010_1","title":"앞의 0 없애기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6010_2","title":"두 번 출력","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6011","title":"실수 하나 그대로","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6011_1","title":"실수로 바꾸기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6012","title":"정수 2개, 줄마다","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l02_02","title":"사칙연산 한 번에","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6012_1","title":"두 줄 입력, 한 줄 출력","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6014","title":"실수 세 번","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6014_1","title":"단어 세 번","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6015","title":"공백 정수 2개, 줄마다","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6015_1","title":"공백으로 나눠 받기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6016","title":"공백 문자 2개 바꾸기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6016_1","title":"두 단어 자리 바꾸기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l02_03","title":"두 변수 값 바꾸기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6016_2","title":"세 단어 거꾸로 한 줄","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6023","title":"분만 꺼내기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6023_1","title":"초만 출력","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6023_2","title":"연도만 출력","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6024","title":"두 단어 붙이기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6024_1","title":"하이픈으로 잇기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6024_2","title":"뒤 단어를 앞으로","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l02_04","title":"실수의 정수 부분","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"c6025","title":"정수 2개 합","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6025_1","title":"두 줄 정수 합","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6025_2","title":"세 정수 합","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6026","title":"실수 2개 합 (줄마다)","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6026_1","title":"실수 두 개 합","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6032","title":"부호 바꾸기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6032_1","title":"부호 바꾸고 원래 수도","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l02_05","title":"초를 시·분·초로","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"c6034","title":"정수 2개 차","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6034_1","title":"거꾸로 빼기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6034_2","title":"세 수 빼기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6035","title":"실수 2개 곱","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6035_1","title":"직사각형 넓이","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6036","title":"단어 반복","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6036_1","title":"별 n개","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l02_06","title":"거듭제곱","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"p6036_2","title":"웃음소리","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6037","title":"문장 반복","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6037_1","title":"제목 상자","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6038","title":"정수 거듭제곱","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6038_1","title":"제곱","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6038_2","title":"2의 n제곱","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6039","title":"실수 거듭제곱","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l02_07","title":"세 수의 합과 평균","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6039_1","title":"제곱근","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6040","title":"나눈 몫","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6040_1","title":"분 → 시간","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6040_2","title":"사탕 나누기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6041","title":"나눈 나머지","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6041_1","title":"남는 사탕","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6041_2","title":"몇 시간 몇 분","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l02_08","title":"섭씨를 화씨로","kind":"core","type":"도전","level":"도전","minutes":12}
      ],
      "exam": [
        {"id":"l02_t1","title":"직사각형 계산","kind":"exam","type":"승급시험","level":"입문","minutes":10},
        {"id":"l02_t2","title":"나이 계산기","kind":"exam","type":"승급시험","level":"입문","minutes":10}
      ]
    },
    {
      "id": "t3",
      "name": "Lv.3",
      "label": "출력 마스터",
      "description": "sep, end, f-string, 서식 지정을 사용해 원하는 모양으로 출력할 수 있다.",
      "topics": "sep · end · f-string · 소수점 서식 · 정렬 서식 · 천 단위 쉼표",
      "problems": [
        {"id":"l03_01","title":"날짜 형식으로 출력","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"c6017","title":"문장 세 번","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6017_1","title":"문장 두 번, 사이에 /","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6018","title":"시각 그대로","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6018_1","title":"시와 분 붙이기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l03_02","title":"f-string 소개 문장","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"p6018_2","title":"날짜 점찍기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6019","title":"날짜 순서 바꾸기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6019_1","title":"- 를 / 로","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6019_2","title":"월/일 → 일.월","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l03_03","title":"소수 둘째 자리까지","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"c6020","title":"주민번호 - 빼기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6020_1","title":"전화번호 이어 쓰기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6027","title":"16진수 소문자","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6027_1","title":"8진수로 출력","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l03_04","title":"글자 정렬하기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6027_2","title":"2진수로 출력","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6028","title":"16진수 대문자","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6028_1","title":"16진수 두 자리","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6029","title":"16진수 → 8진수","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l03_05","title":"한 줄로 이어 출력","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"p6029_1","title":"8진수 → 10진수","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6029_2","title":"2진수 → 10진수","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6042","title":"소수 둘째 자리","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6042_1","title":"소수 첫째 자리","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l03_06","title":"디지털 시계","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6042_2","title":"소수 셋째 자리","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6043","title":"실수 나누기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6043_1","title":"나누기 두 자리","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6044","title":"여섯 가지 계산","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l03_07","title":"정답률 출력","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6044_1","title":"세 가지 계산","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6044_2","title":"몫·나머지·나누기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6045","title":"세 정수 합과 평균","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6045_1","title":"네 수의 합과 평균","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l03_08","title":"영수증 만들기","kind":"core","type":"도전","level":"도전","minutes":15}
      ],
      "exam": [
        {"id":"l03_t1","title":"성적 한 줄 출력","kind":"exam","type":"승급시험","level":"입문","minutes":10},
        {"id":"l03_t2","title":"가격표 줄 맞추기","kind":"exam","type":"승급시험","level":"기초","minutes":10}
      ]
    },
    {
      "id": "t4",
      "name": "Lv.4",
      "label": "조건문 도전자",
      "description": "비교·논리 연산자와 if / elif / else 를 사용해 상황에 따라 다르게 동작하는 프로그램을 만들 수 있다.",
      "topics": "if · elif · else · 비교 연산자 · 논리 연산자 and/or/not · % 연산",
      "problems": [
        {"id":"l04_01","title":"짝수일까 홀수일까","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"c6048","title":"작니?","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6048_1","title":"a가 더 크니?","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6049","title":"같니?","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6049_1","title":"같은 단어?","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6050","title":"작거나 같니?","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l04_02","title":"세 수 중 가장 큰 수","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6050_1","title":"크거나 같니?","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6051","title":"다르니?","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6051_1","title":"홀수니?","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6052","title":"참일까 거짓일까","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6052_1","title":"곱이 0이 아니니?","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6053","title":"참거짓 뒤집기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l04_03","title":"점수로 등급 매기기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6053_1","title":"10보다 크지 않니?","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6054","title":"둘 다 참 (and)","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6054_1","title":"1~10 사이니?","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6055","title":"하나라도 참 (or)","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6055_1","title":"하나라도 0이니?","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l04_04","title":"윤년 판별기","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"c6056","title":"서로 다를 때 참","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6056_1","title":"부호가 다르니?","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6057","title":"서로 같을 때 참","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6057_1","title":"짝홀이 같니?","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6058","title":"둘 다 거짓일 때 참","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6058_1","title":"둘 다 3의 배수가 아니니?","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l04_05","title":"놀이공원 입장료","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"c6063","title":"큰 값 (3항 연산)","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6063_1","title":"작은 값 (3항 연산)","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6064","title":"가장 작은 값","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6064_1","title":"가장 큰 값","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6065","title":"짝수만 출력","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l04_06","title":"삼각형이 될까","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6065_1","title":"홀수만 출력","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6066","title":"even / odd","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6066_1","title":"짝수/홀수 말하기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6067","title":"네 가지로 분류","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6067_1","title":"양수·음수·0","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6067_2","title":"3의 배수 판별","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l04_07","title":"피즈버즈 한 판","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"c6068","title":"점수 → 등급","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6068_1","title":"나이별 요금","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6069","title":"등급 → 한마디","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6069_1","title":"신호등","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6070","title":"월 → 계절","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6070_1","title":"달의 날 수","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l04_08","title":"가위바위보 심판","kind":"core","type":"도전","level":"도전","minutes":15}
      ],
      "exam": [
        {"id":"l04_t1","title":"놀이기구 탑승 검사","kind":"exam","type":"승급시험","level":"입문","minutes":10},
        {"id":"l04_t2","title":"합격 판정","kind":"exam","type":"승급시험","level":"기초","minutes":10}
      ]
    },
    {
      "id": "t5",
      "name": "Lv.5",
      "label": "반복문 탐험가",
      "description": "for 와 while 반복문, range(), break 를 사용해 같은 작업을 반복할 수 있다.",
      "topics": "for · range() · while · 누적 합 · 중첩 반복 · break",
      "problems": [
        {"id":"l05_01","title":"1부터 n까지의 합","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"c6071","title":"0이 나올 때까지","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6071_1","title":"0 앞까지만","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6072","title":"카운트다운","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6072_1","title":"카운트다운 발사","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6073","title":"n−1부터 0까지","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l05_02","title":"구구단 n단","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"p6073_1","title":"두 칸씩 내려가기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6075","title":"0부터 n까지 (while)","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6075_1","title":"1부터 n까지","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6076","title":"0부터 n까지 (for)","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6076_1","title":"n부터 2n까지","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6077","title":"짝수 합","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l05_03","title":"별 피라미드","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6077_1","title":"홀수 합","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6077_2","title":"3의 배수 합","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6078","title":"q 가 나올 때까지","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6078_1","title":"end 가 나올 때까지","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6079","title":"언제 넘을까?","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6079_1","title":"두 배씩 키우기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l05_04","title":"각 자릿수의 합 (while)","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"c6080","title":"두 주사위 모든 경우","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6080_1","title":"작은 수 먼저","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6081","title":"16진수 구구단","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6081_1","title":"n단 구구단","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6082","title":"3·6·9 박수","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6082_1","title":"3의 배수는 짝","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l05_05","title":"짝수만 더하기","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"c6083","title":"빛 섞기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6083_1","title":"옷 조합","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6084","title":"소리 파일 크기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6084_1","title":"바이트 → MB","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6085","title":"그림 파일 크기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6085_1","title":"사진 용량","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l05_06","title":"카운트다운","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"c6086","title":"거기까지! 합","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6086_1","title":"마지막으로 더한 수","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6087","title":"3의 배수는 통과","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6087_1","title":"4의 배수 건너뛰기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6088","title":"등차수열 n번째","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6088_1","title":"등차수열 n개","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l05_07","title":"약수 모두 찾기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"c6089","title":"등비수열 n번째","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6089_1","title":"등비수열 n개","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6090","title":"곱하고 더하는 수열","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6090_1","title":"피보나치","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6091","title":"셋이 다시 만나는 날","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6091_1","title":"다시 만나는 날","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l05_08","title":"소수 판별기","kind":"core","type":"도전","level":"도전","minutes":15}
      ],
      "exam": [
        {"id":"l05_t1","title":"3 또는 5의 배수의 합","kind":"exam","type":"승급시험","level":"입문","minutes":10},
        {"id":"l05_t2","title":"콜라츠 추측","kind":"exam","type":"승급시험","level":"기초","minutes":10}
      ]
    },
    {
      "id": "t6",
      "name": "Lv.6",
      "label": "리스트 사용자",
      "description": "리스트를 만들고, 인덱스·반복·내장 함수·리스트 컴프리헨션으로 데이터를 다룰 수 있다.",
      "topics": "리스트 · 인덱스 · sum/max/len · append · 리스트 컴프리헨션 · 2차원 리스트",
      "problems": [
        {"id":"l06_01","title":"합계와 평균","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"c6092","title":"번호 부른 횟수","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6092_1","title":"7은 몇 번?","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l06_02","title":"최댓값과 처음 위치","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"c6093","title":"거꾸로 부르기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6093_1","title":"거꾸로 부르기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l06_03","title":"짝수만 골라내기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"c6094","title":"가장 빠른 번호","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6094_1","title":"가장 큰 번호","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l06_04","title":"중복 없이 순서대로","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6094_2","title":"합과 평균","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6095","title":"5×5 판에 흰 돌","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l06_05","title":"거꾸로 출력","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"p6095_1","title":"3×3 판에 돌 놓기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6096","title":"십자 뒤집기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l06_06","title":"두 번째로 큰 수","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6096_1","title":"한 줄 뒤집기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6097","title":"막대 놓기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l06_07","title":"앞에서 k개, 뒤에서 k개","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6097_1","title":"가로 막대 놓기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6098","title":"부지런한 개미","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6098_1","title":"줄마다 합","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l06_08","title":"표의 행 합계 (2차원 리스트)","kind":"core","type":"도전","level":"도전","minutes":15}
      ],
      "exam": [
        {"id":"l06_t1","title":"평균보다 큰 수","kind":"exam","type":"승급시험","level":"입문","minutes":10},
        {"id":"l06_t2","title":"리스트 회전","kind":"exam","type":"승급시험","level":"기초","minutes":10}
      ]
    },
    {
      "id": "t7",
      "name": "Lv.7",
      "label": "딕셔너리 관리자",
      "description": "키-값 구조의 딕셔너리로 데이터를 저장·조회·집계·정렬할 수 있다.",
      "topics": "딕셔너리 · get() · in · items() · 빈도 세기 · sorted() key",
      "problems": [
        {"id":"l07_01","title":"과일 가격표","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"l07_02","title":"단어 빈도 세기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l07_03","title":"반장 선거 개표","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l07_04","title":"성적순으로 정렬","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l07_05","title":"학생 정보 고치기","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"l07_06","title":"평균 이상인 과목","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l07_07","title":"두 창고 재고 합치기","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l07_08","title":"명령어 전화번호부","kind":"core","type":"도전","level":"도전","minutes":15}
      ],
      "exam": [
        {"id":"l07_t1","title":"문구점 계산대","kind":"exam","type":"승급시험","level":"입문","minutes":10},
        {"id":"l07_t2","title":"가장 많이 나온 단어","kind":"exam","type":"승급시험","level":"기초","minutes":10}
      ]
    },
    {
      "id": "t8",
      "name": "Lv.8",
      "label": "문자열 전문가",
      "description": "인덱싱·슬라이싱과 문자열 메서드로 텍스트를 가공·분석할 수 있다.",
      "topics": "upper/lower · len() · 슬라이싱 [::-1] · replace() · split/join · ord/chr",
      "problems": [
        {"id":"l08_01","title":"대문자, 소문자, 길이","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"c6021","title":"다섯 글자 한 줄씩","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6021_1","title":"세 글자 한 줄씩","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l08_02","title":"회문 판별","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6021_2","title":"세 글자 거꾸로","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6022","title":"연월일 나누기","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l08_03","title":"모음 개수 세기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6022_1","title":"시분초 나누기","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6030","title":"문자 → 코드","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l08_04","title":"단어 순서 뒤집기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6030_1","title":"숫자 글자의 코드","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6030_2","title":"두 글자 거리","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6031","title":"코드 → 문자","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"l08_05","title":"이메일 나누기","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"p6031_1","title":"코드 두 개를 글자로","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"p6031_2","title":"암호 해독","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l08_06","title":"단어 첫 글자만 대문자","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"c6033","title":"다음 글자","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6033_1","title":"앞 글자","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l08_07","title":"글자 종류 세기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"p6033_2","title":"두 칸 뒤 글자","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"c6074","title":"a부터 그 글자까지","kind":"practice","type":"연습","level":"연습","minutes":4},
        {"id":"p6074_1","title":"대문자 알파벳","kind":"practice","type":"연습","level":"연습","minutes":3},
        {"id":"l08_08","title":"시저 암호 만들기","kind":"core","type":"도전","level":"도전","minutes":15}
      ],
      "exam": [
        {"id":"l08_t1","title":"전화번호 형식 맞추기","kind":"exam","type":"승급시험","level":"기초","minutes":10},
        {"id":"l08_t2","title":"가장 긴 단어를 대문자로","kind":"exam","type":"승급시험","level":"입문","minutes":10}
      ]
    },
    {
      "id": "t9",
      "name": "Lv.9",
      "label": "함수 설계자",
      "description": "def 로 함수를 정의하고 매개변수·반환값·기본값·재귀를 활용할 수 있다.",
      "topics": "def · 매개변수 · return · 기본값 매개변수 · 여러 값 반환 · 재귀",
      "problems": [
        {"id":"l09_01","title":"직사각형 넓이 함수","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"l09_02","title":"BMI 계산 함수","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l09_03","title":"기본값이 있는 인사 함수","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l09_04","title":"몫과 나머지를 한 번에","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l09_05","title":"절댓값 함수","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"l09_06","title":"몇 개든 더하는 함수","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l09_07","title":"소수 찾기 함수","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l09_08","title":"재귀로 팩토리얼","kind":"core","type":"도전","level":"도전","minutes":15}
      ],
      "exam": [
        {"id":"l09_t1","title":"윤년 세기 함수","kind":"exam","type":"승급시험","level":"기초","minutes":10},
        {"id":"l09_t2","title":"기본값이 있는 거듭제곱 함수","kind":"exam","type":"승급시험","level":"기초","minutes":10}
      ]
    },
    {
      "id": "t10",
      "name": "Lv.10",
      "label": "파일 처리 마스터",
      "description": "with open() 으로 텍스트 파일을 읽고 쓰며, 파일 데이터를 가공할 수 있다.",
      "topics": "open() · with · 읽기 모드 r · 쓰기 모드 w · readlines() · strip() · CSV",
      "problems": [
        {"id":"l10_01","title":"메모 파일 줄 수 세기","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"l10_02","title":"점수 파일 평균","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l10_03","title":"구구단 파일 저장","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l10_04","title":"CSV 성적표 읽기","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l10_05","title":"가장 긴 단어 찾기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l10_06","title":"일기 이어 쓰기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l10_07","title":"합계를 파일로 저장","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l10_08","title":"파일에서 단어 찾기","kind":"core","type":"도전","level":"도전","minutes":15}
      ],
      "exam": [
        {"id":"l10_t1","title":"합격자 명단 만들기","kind":"exam","type":"승급시험","level":"기초","minutes":10},
        {"id":"l10_t2","title":"줄 번호와 단어 수","kind":"exam","type":"승급시험","level":"기초","minutes":10}
      ]
    },
    {
      "id": "t11",
      "name": "Lv.11",
      "label": "모듈 활용가",
      "description": "import 로 표준 라이브러리(math, datetime, collections)를 불러와 활용할 수 있다.",
      "topics": "import · math · datetime · timedelta · collections.Counter",
      "problems": [
        {"id":"l11_01","title":"원의 넓이와 둘레","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"l11_02","title":"최대공약수와 최소공배수","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l11_03","title":"무슨 요일일까","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l11_04","title":"가장 많이 쓰인 글자","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l11_05","title":"빗변의 길이","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"l11_06","title":"모둠 나누기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l11_07","title":"평균과 중앙값","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l11_08","title":"D-Day 계산기","kind":"core","type":"도전","level":"도전","minutes":15}
      ],
      "exam": [
        {"id":"l11_t1","title":"두 점 사이의 거리","kind":"exam","type":"승급시험","level":"입문","minutes":10},
        {"id":"l11_t2","title":"만 나이 계산","kind":"exam","type":"승급시험","level":"기초","minutes":10}
      ]
    },
    {
      "id": "t12",
      "name": "Lv.12",
      "label": "디버깅 전문가",
      "description": "오류 메시지를 읽고 문법·자료형·논리 오류를 찾아 고치며, try-except 로 예외를 처리할 수 있다.",
      "topics": "SyntaxError · TypeError · 논리 오류 · try-except · ValueError · ZeroDivisionError",
      "problems": [
        {"id":"l12_01","title":"문법 오류 고치기","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"l12_02","title":"자료형 오류 고치기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l12_03","title":"논리 오류 고치기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l12_04","title":"안전한 나눗셈","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l12_05","title":"인덱스 오류 고치기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l12_06","title":"들여쓰기 버그 고치기","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l12_07","title":"이름 오류 고치기","kind":"core","type":"실습","level":"맛보기","minutes":5},
        {"id":"l12_08","title":"버그 세 마리 잡기","kind":"core","type":"도전","level":"도전","minutes":15}
      ],
      "exam": [
        {"id":"l12_t1","title":"버그 세 개 고치기","kind":"exam","type":"승급시험","level":"기초","minutes":10},
        {"id":"l12_t2","title":"안전하게 꺼내기","kind":"exam","type":"승급시험","level":"기초","minutes":10}
      ]
    },
    {
      "id": "t13",
      "name": "Lv.13",
      "label": "문제 해결자",
      "description": "문제를 분석해 알고리즘(유클리드 호제법, 정렬, 탐색, 그리디)을 설계하고 구현할 수 있다.",
      "topics": "알고리즘 · 유클리드 호제법 · 피보나치 · 버블 정렬 · 이진 탐색 · 그리디",
      "problems": [
        {"id":"l13_01","title":"유클리드 호제법","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l13_02","title":"피보나치 수","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l13_03","title":"버블 정렬 구현","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l13_04","title":"이진 탐색","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l13_05","title":"가장 작은 값과 위치","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l13_06","title":"10진수를 2진수로","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l13_07","title":"에라토스테네스의 체","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l13_08","title":"거스름돈 (그리디)","kind":"core","type":"도전","level":"도전","minutes":15}
      ],
      "exam": [
        {"id":"l13_t1","title":"선택 정렬 (내림차순)","kind":"exam","type":"승급시험","level":"기초","minutes":10},
        {"id":"l13_t2","title":"계단 오르기","kind":"exam","type":"승급시험","level":"기초","minutes":10}
      ]
    },
    {
      "id": "t14",
      "name": "Lv.14",
      "label": "프로젝트 개발자",
      "description": "지금까지 배운 문법을 조합해 요구사항이 있는 작은 프로그램을 설계하고 완성할 수 있다.",
      "topics": "요구사항 분석 · 명령어 처리 · 함수 분리 · 자료구조 선택 · 예외 상황 처리",
      "problems": [
        {"id":"l14_01","title":"미니 프로젝트 1: 계산기","kind":"core","type":"프로젝트","level":"응용","minutes":30},
        {"id":"l14_02","title":"미니 프로젝트 2: 숫자 맞추기 게임","kind":"core","type":"프로젝트","level":"응용","minutes":30},
        {"id":"l14_03","title":"미니 프로젝트 3: 할 일 관리","kind":"core","type":"프로젝트","level":"응용","minutes":30},
        {"id":"l14_04","title":"미니 프로젝트 4: 용돈 기입장","kind":"core","type":"프로젝트","level":"응용","minutes":30},
        {"id":"l14_05","title":"미니 프로젝트: BMI 건강 체크","kind":"core","type":"프로젝트","level":"응용","minutes":30},
        {"id":"l14_06","title":"미니 프로젝트: 구구단 생성기","kind":"core","type":"프로젝트","level":"응용","minutes":30},
        {"id":"l14_07","title":"미니 프로젝트: 퀴즈 게임","kind":"core","type":"프로젝트","level":"응용","minutes":30},
        {"id":"l14_08","title":"미니 프로젝트 5: 성적 관리 프로그램","kind":"core","type":"도전","level":"심화","minutes":20}
      ],
      "exam": [
        {"id":"l14_t1","title":"자판기 프로그램","kind":"exam","type":"승급시험","level":"기초","minutes":10},
        {"id":"l14_t2","title":"출석부 프로그램","kind":"exam","type":"승급시험","level":"기초","minutes":10}
      ]
    },
    {
      "id": "t15",
      "name": "Lv.15",
      "label": "Python Junior Developer",
      "description": "클래스, 예외 처리, 자료구조를 종합해 읽기 좋고 튼튼한 프로그램을 작성할 수 있다.",
      "topics": "class · __init__ · 메서드 · 예외 처리 · 데이터 분석 · 2차원 리스트 · zip()",
      "problems": [
        {"id":"l15_01","title":"은행 계좌 클래스","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l15_02","title":"입력값 검증하기","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l15_03","title":"서버 로그 분석","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l15_04","title":"행렬 90도 회전","kind":"core","type":"실습","level":"응용","minutes":15},
        {"id":"l15_05","title":"학생 클래스","kind":"core","type":"실습","level":"입문","minutes":8},
        {"id":"l15_06","title":"동물 클래스 상속","kind":"core","type":"실습","level":"기초","minutes":12},
        {"id":"l15_07","title":"괄호 짝 검사","kind":"core","type":"실습","level":"응용","minutes":15},
        {"id":"l15_08","title":"졸업 프로젝트: 텍스트 RPG 전투","kind":"core","type":"도전","level":"심화","minutes":20}
      ],
      "exam": [
        {"id":"l15_t1","title":"직사각형 클래스","kind":"exam","type":"승급시험","level":"기초","minutes":10},
        {"id":"l15_t2","title":"재고 관리 시스템","kind":"exam","type":"승급시험","level":"응용","minutes":10}
      ]
    }
  ];

  function pointsOf(problem) {
    return problem.kind === "practice" ? PRACTICE_POINTS : POINTS[problem.level];
  }
  var maxPoints = 0;
  var requiredPoints = 0;
  var problems = [];
  tracks.forEach(function (track, index) {
    track.number = index + 1;
    // 단계 구간은 꼭 거쳐야 하는 점수(핵심 문제 + 승급 시험)를 이어 붙여 정합니다. 연습 점수는 덤이라 구간에 넣지 않습니다.
    track.startPoints = requiredPoints;
    var all = track.problems.concat(track.exam);
    track.requiredPoints = all.reduce(function (sum, problem) { return sum + (problem.kind === "practice" ? 0 : pointsOf(problem)); }, 0);
    track.totalPoints = all.reduce(function (sum, problem) { return sum + pointsOf(problem); }, 0);
    requiredPoints += track.requiredPoints;
    maxPoints += track.totalPoints;
    all.forEach(function (problem) {
      problem.points = pointsOf(problem);
      problem.trackId = track.id;
      problems.push(problem);
    });
  });

  // 누적 점수가 속한 레벨(1부터). 레벨별 필수 점수를 이어 붙인 구간으로 계산하며 잘못된 값은 0입니다.
  function stageForPoints(points) {
    if (typeof points !== "number" || !Number.isFinite(points) || points < 0) return 0;
    for (var i = tracks.length - 1; i >= 0; i--) if (points >= tracks[i].startPoints) return i + 1;
    return 0;
  }
  function solvedSet(completedIds) {
    var set = {};
    (Array.isArray(completedIds) ? completedIds : []).forEach(function (id) { if (typeof id === "string") set[id] = true; });
    return set;
  }
  function isCore(problem) { return problem.kind === "core"; }
  // solved/total 은 핵심 문제 기준이고, 연습 문제와 점수는 따로 셉니다.
  function progress(completedIds) {
    var solved = solvedSet(completedIds);
    var cores = problems.filter(isCore);
    var practice = problems.filter(function (problem) { return problem.kind === "practice"; });
    var solvedProblems = problems.filter(function (problem) { return solved[problem.id]; });
    return {
      solved: cores.filter(function (problem) { return solved[problem.id]; }).length,
      total: cores.length,
      practiceSolved: practice.filter(function (problem) { return solved[problem.id]; }).length,
      practiceTotal: practice.length,
      solvedPoints: solvedProblems.reduce(function (sum, problem) { return sum + problem.points; }, 0),
      tracks: tracks.map(function (track) {
        var coreProblems = track.problems.filter(isCore);
        return { id: track.id, name: track.name, label: track.label, total: coreProblems.length,
          solved: coreProblems.filter(function (problem) { return solved[problem.id]; }).length };
      }),
    };
  }
  // fromStage 레벨부터 아직 풀지 않은 핵심 문제를 순서대로 limit개 돌려줍니다.
  function nextProblems(completedIds, limit, fromStage) {
    var solved = solvedSet(completedIds);
    var start = Math.max(0, (fromStage || 1) - 1);
    var found = [];
    for (var i = start; i < tracks.length && found.length < limit; i++) {
      for (var j = 0; j < tracks[i].problems.length && found.length < limit; j++) {
        var problem = tracks[i].problems[j];
        if (isCore(problem) && !solved[problem.id]) found.push({ problem: problem, track: tracks[i] });
      }
    }
    return found;
  }

  var api = { POINTS: POINTS, LEVELS: LEVELS, PRACTICE_POINTS: PRACTICE_POINTS, tracks: tracks, problems: problems, maxPoints: maxPoints,
    stageForPoints: stageForPoints, progress: progress, nextProblems: nextProblems };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PcoStudio = api;
})(typeof window !== "undefined" ? window : globalThis);
