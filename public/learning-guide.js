(function (root) {
const studio = typeof module === 'object' && module.exports ? require('./studio-catalog.js') : root.PcoStudio;
const docs = page => `https://docs.python.org/ko/3/${page}`;

// 스튜디오 레벨(Lv.1~15)과 같은 순서입니다. 단계는 누적 학습 점수가 속한 레벨로 정합니다.
const curriculum = [
  {
    focus: '코드를 실행하고 print와 input의 기본 흐름을 익혀요.',
    goals: ['print로 원하는 모양의 글자를 출력하기', '따옴표와 주석을 알맞게 쓰기', 'input으로 받은 값을 사용하고 오류 메시지의 줄 번호 읽기'],
    practice: { title: '나를 소개하는 첫 프로그램', task: '이름과 좋아하는 과목을 입력받아 소개하는 문장을 출력하는 프로그램을 만들어 보세요. 스튜디오 Lv.1 문제 중 하나를 골라 풀어도 좋아요.', checks: ['입력값을 바꿔도 문장이 올바르게 나오나요?', '출력 모양(띄어쓰기, 따옴표)을 문제 설명과 비교했나요?'] },
    reading: { title: 'Python 공식 자습서 · 간략한 소개', url: docs('tutorial/introduction.html') },
  },
  {
    focus: '변수에 값을 담고, 입력받은 글자를 숫자로 바꿔 계산해요.',
    goals: ['변수에 값을 저장하고 다시 꺼내 쓰기', 'input으로 받은 글자를 int나 float로 바꾸기', '산술 연산자(+ - * / // % **)의 결과 예상하기'],
    practice: { title: '세 과목 평균 계산기', task: '세 과목 점수를 입력받아 합계와 평균을 출력하는 프로그램을 만들어 보세요.', checks: ['입력을 숫자로 바꾸지 않으면 어떤 오류가 나는지 설명할 수 있나요?', '/ 와 // 의 결과가 어떻게 다른지 직접 확인했나요?'] },
    reading: { title: 'Python 공식 자습서 · 숫자', url: docs('tutorial/introduction.html#numbers') },
  },
  {
    focus: 'sep·end·f-string으로 원하는 모양으로 출력해요.',
    goals: ['sep과 end로 구분 기호와 줄 바꿈 바꾸기', 'f-string으로 변수를 문장 속에 넣기', '소수 자릿수·정렬·천 단위 쉼표 서식 지정하기'],
    practice: { title: '영수증 출력기', task: '상품명, 가격, 수량을 입력받아 천 단위 쉼표가 들어간 영수증을 출력해 보세요.', checks: ['금액이 1,000보다 작거나 아주 커도 쉼표가 올바른가요?', '줄 수와 띄어쓰기가 출력 예시와 같은가요?'] },
    reading: { title: 'Python 공식 자습서 · 더 멋진 출력 포매팅', url: docs('tutorial/inputoutput.html#fancier-output-formatting') },
  },
  {
    focus: '조건에 따라 다른 동작을 고르는 법을 배워요.',
    goals: ['비교 연산자와 논리 연산자의 결과 예상하기', 'if / elif / else로 경우 나누기', '경계값(바로 아래·경계·바로 위)을 직접 시험하기'],
    practice: { title: '점수별 등급 판정기', task: '점수를 입력받아 구간별 등급을 출력하고, 각 구간의 경계값을 모두 시험해 보세요.', checks: ['모든 점수 범위에 맞는 등급이 나오나요?', '경계 바로 아래·경계·바로 위를 확인했나요?'] },
    reading: { title: 'Python 공식 자습서 · if 문', url: docs('tutorial/controlflow.html#if-statements') },
  },
  {
    focus: '같은 일을 규칙으로 반복시켜 코드를 줄여요.',
    goals: ['for와 range의 시작값·끝값 설명하기', '누적 변수를 반복문 밖에서 초기화하기', 'while의 종료 조건과 break 만들기'],
    practice: { title: '약수 개수 세기', task: '정수 n을 입력받아 n의 약수가 모두 몇 개인지 반복문으로 세어 보세요.', checks: ['1, 소수, 큰 수를 각각 시험했나요?', '반복이 끝나는 이유를 설명할 수 있나요?'] },
    reading: { title: 'Python 공식 자습서 · for와 range', url: docs('tutorial/controlflow.html#for-statements') },
  },
  {
    focus: '값을 모아 정렬하고 찾고 가공해요.',
    goals: ['인덱스와 슬라이스로 값 꺼내기', 'append·sort·sorted의 차이 설명하기', '리스트 컴프리헨션으로 조건에 맞는 값 모으기'],
    practice: { title: '점수 목록 요약', task: '점수 목록에서 합계, 평균, 최댓값, 두 번째로 큰 값을 구해 보세요.', checks: ['값이 한 개이거나 같은 점수가 여러 개인 경우를 시험했나요?', '원래 리스트를 바꾸는 코드와 바꾸지 않는 코드를 구분했나요?'] },
    reading: { title: 'Python 공식 자습서 · 리스트', url: docs('tutorial/datastructures.html#more-on-lists') },
  },
  {
    focus: '키와 값으로 데이터를 저장하고 조회하고 집계해요.',
    goals: ['딕셔너리로 키와 값 저장·조회하기(없는 키 처리 포함)', 'items()로 키와 값을 함께 반복하기', 'sorted의 key로 값 기준 정렬하기'],
    practice: { title: '단어 등장 횟수표', task: '여러 단어가 주어지면 단어별 등장 횟수를 딕셔너리로 세고, 많이 나온 순서로 출력해 보세요.', checks: ['처음 나온 단어와 반복된 단어가 모두 정확히 세어지나요?', '횟수가 같을 때의 출력 순서를 정했나요?'] },
    reading: { title: 'Python 공식 자습서 · 딕셔너리', url: docs('tutorial/datastructures.html#dictionaries') },
  },
  {
    focus: '인덱싱·슬라이싱과 문자열 메서드로 글자를 다뤄요.',
    goals: ['인덱싱과 슬라이싱의 범위 확인하기', 'split·join·replace·upper의 역할 구분하기', 'ord와 chr로 글자와 숫자 바꾸기'],
    practice: { title: '문장 속 모음 세기', task: '영어 문장을 입력받아 모음(a, e, i, o, u)이 몇 번 나오는지 세어 보세요.', checks: ['공백이나 모음이 하나도 없는 문장도 처리되나요?', '대문자를 다루려면 무엇을 바꿔야 할지 설명할 수 있나요?'] },
    reading: { title: 'Python 공식 자습서 · 텍스트', url: docs('tutorial/introduction.html#text') },
  },
  {
    focus: '코드를 함수로 나누고 다시 쓰는 법을 익혀요.',
    goals: ['def, 매개변수, return의 역할 구분하기', '기본값 매개변수 사용하기', '재귀 함수의 종료 조건 설명하기'],
    practice: { title: '재사용 가능한 계산 함수', task: '가격과 개수를 받아 총금액을 돌려주는 함수를 만들고, 서로 다른 입력으로 세 번 호출해 보세요.', checks: ['함수 안의 print와 return을 구분했나요?', '개수가 0인 경우에도 예상대로 동작하나요?'] },
    reading: { title: 'Python 공식 자습서 · 함수 정의하기', url: docs('tutorial/controlflow.html#defining-functions') },
  },
  {
    focus: 'with open()으로 파일을 읽고 쓰며 데이터를 가공해요.',
    goals: ['with open()으로 파일을 안전하게 열고 닫기', 'readlines와 strip으로 줄 단위 데이터 다루기', '쓰기(w)와 이어 쓰기(a) 모드의 차이 설명하기'],
    practice: { title: '점수 파일 평균 구하기', task: '한 줄에 점수 하나가 적힌 파일을 읽어 평균을 출력해 보세요.', checks: ['빈 줄이 섞여 있어도 오류 없이 처리되나요?', 'with가 파일을 대신 닫아 주는 이유를 설명할 수 있나요?'] },
    reading: { title: 'Python 공식 자습서 · 파일 읽고 쓰기', url: docs('tutorial/inputoutput.html#reading-and-writing-files') },
  },
  {
    focus: 'import로 표준 라이브러리를 불러와 필요한 기능을 가져다 써요.',
    goals: ['import와 from … import의 차이 구분하기', 'math와 datetime으로 계산과 날짜 다루기', 'collections.Counter로 개수 세기'],
    practice: { title: 'D-Day 계산기', task: '목표 날짜를 입력받아 오늘부터 며칠 남았는지 출력해 보세요.', checks: ['이미 지난 날짜도 의도한 대로 처리되나요?', '필요한 기능이 어느 모듈에 있는지 공식 문서에서 찾았나요?'] },
    reading: { title: 'Python 공식 자습서 · 모듈', url: docs('tutorial/modules.html') },
  },
  {
    focus: '오류 메시지를 읽고 원인을 찾아 고치며 예외를 처리해요.',
    goals: ['오류 메시지에서 줄 번호와 오류 종류 읽기', '문법·자료형·논리 오류를 구분해 고치기', 'try-except로 예외 처리하기'],
    practice: { title: '안전한 나눗셈', task: '두 수를 입력받아 나누되, 0으로 나누거나 숫자가 아닌 값을 넣으면 안내 문장을 출력하는 프로그램을 만들어 보세요.', checks: ['except에 잡을 오류의 종류를 구체적으로 적었나요?', '정상 입력과 잘못된 입력을 모두 시험했나요?'] },
    reading: { title: 'Python 공식 자습서 · 오류와 예외', url: docs('tutorial/errors.html') },
  },
  {
    focus: '문제를 분석해 알고리즘으로 설계하고 구현해요.',
    goals: ['유클리드 호제법·피보나치처럼 규칙을 코드로 옮기기', '정렬과 이진 탐색이 동작하는 순서 설명하기', '그리디(탐욕) 방법으로 거스름돈 구하기'],
    practice: { title: '이진 탐색 구현', task: '정렬된 리스트에서 값을 이진 탐색으로 찾아 위치를 출력해 보세요. 없으면 -1을 출력해요.', checks: ['값이 맨 앞·맨 뒤·없는 경우를 모두 시험했나요?', '순서대로 찾는 방법보다 비교 횟수가 얼마나 줄어드는지 설명할 수 있나요?'] },
    reading: { title: 'Python 표준 라이브러리 · bisect', url: docs('library/bisect.html') },
  },
  {
    focus: '배운 문법을 조합해 요구사항이 있는 작은 프로그램을 완성해요.',
    goals: ['요구사항을 입력·처리·출력으로 나누어 생각하기', '함수로 기능을 나누고 알맞은 자료구조 고르기', '빈 입력·잘못된 명령 같은 예외 상황 미리 처리하기'],
    practice: { title: '할 일 관리 프로그램', task: '추가·완료·목록 명령을 처리하는 할 일 관리 프로그램을 만들어 보세요.', checks: ['잘못된 명령을 입력해도 프로그램이 멈추지 않나요?', '기능마다 함수가 나뉘어 있나요?'] },
    reading: { title: 'Python 공식 자습서 · 차례', url: docs('tutorial/index.html') },
  },
  {
    focus: '클래스·예외 처리·자료구조를 종합해 읽기 좋고 튼튼한 프로그램을 작성해요.',
    goals: ['class와 __init__, 메서드로 데이터와 기능 묶기', '입력 검증과 예외 처리로 프로그램을 튼튼하게 만들기', '2차원 리스트와 zip으로 표 데이터 분석하기'],
    practice: { title: '은행 계좌 클래스', task: '입금·출금·잔액 확인 기능이 있고, 잔액보다 많이 출금하면 오류로 알리는 계좌 클래스를 만들어 보세요.', checks: ['잔액이 모자랄 때 예외로 알리나요?', '같은 클래스로 서로 다른 계좌 두 개를 만들어 확인했나요?'] },
    reading: { title: 'Python 공식 자습서 · 클래스', url: docs('tutorial/classes.html') },
  },
].map((entry, index) => {
  const track = studio.tracks[index];
  return {
    stage: index + 1, title: track.label, ...entry,
    studio: {
      trackId: track.id, topics: track.topics, problemCount: track.problems.filter(problem => problem.kind === 'core').length,
      startPoints: track.startPoints, requiredPoints: track.requiredPoints, totalPoints: track.totalPoints,
    },
  };
});
if (curriculum.length !== studio.tracks.length) throw new Error('학습 가이드와 스튜디오 레벨 수가 달라요.');

function getLearningGuide(stage) {
  const mapped = Number.isInteger(stage) && stage >= 1 && stage <= curriculum.length;
  const current = mapped ? curriculum[stage - 1] : null;
  const next = mapped && stage < curriculum.length ? curriculum[stage] : null;
  return structuredClone({
    status: !mapped ? 'unmapped' : next ? 'next-stage' : 'last-stage',
    current, next, practice: (next || current)?.practice || null,
    roadmap: curriculum.map(entry => ({ stage: entry.stage, title: entry.title })),
    recommendationNote: `스튜디오 ${curriculum.length}레벨 로드맵에 따른 권장 학습 가이드입니다. 누적 학습 점수가 속한 레벨을 현재 단계로 안내하며, 개인 오답이나 취약점을 분석한 결과는 아닙니다.`,
    promotionNote: '실제 레벨 승급은 파코 스튜디오의 승급 시험과 진단평가로 정해집니다. 이 가이드의 단계는 누적 점수를 레벨별 필수 점수(핵심 문제 + 승급 시험)에 견줘 안내하는 값이며, 아래 과제는 권장 연습이라 완료만으로 점수가 변경되지 않습니다.',
  });
}

const api = { getLearningGuide, stageForPoints: studio.stageForPoints };
if (typeof module === 'object' && module.exports) module.exports = api;
else root.PcoLearningGuide = api;
})(typeof window !== 'undefined' ? window : globalThis);
