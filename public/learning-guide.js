(function (root) {
const studio = typeof module === 'object' && module.exports ? require('./studio-catalog.js') : root.PcoStudio;
const docs = page => `https://docs.python.org/ko/3/tutorial/${page}`;

// 스튜디오 트랙(1~10단계)과 같은 순서입니다. 단계는 누적 학습 점수가 속한 트랙으로 정합니다.
const curriculum = [
  {
    title: '처음 만나는 파이썬', focus: '코드를 실행하고 출력·변수·입력의 기본 흐름을 익혀요.',
    goals: ['print로 원하는 모양의 글자를 출력하기', '변수에 값을 저장하고 input으로 받은 값을 사용하기', '오류 메시지의 줄 번호와 종류 읽기'],
    practice: { title: '나를 소개하는 첫 프로그램', task: '이름과 나이를 입력받아 소개하는 문장을 출력하는 프로그램을 만들어 보세요. 스튜디오 1단계 문제 중 하나를 골라 풀어도 좋아요.', checks: ['입력값을 바꿔도 문장이 올바르게 나오나요?', '출력 모양(띄어쓰기, 따옴표)을 문제 설명과 비교했나요?'] },
    reading: { title: 'Python 공식 자습서 · 간략한 소개', url: docs('introduction.html') },
  },
  {
    title: '숫자와 친해지기', focus: '입력받은 숫자로 계산하며 연산자와 친해져요.',
    goals: ['산술 연산자(+ - * // % **)의 결과 예상하기', 'input으로 받은 글자를 int나 float로 바꾸기', 'f-string으로 소수 자릿수와 단위를 맞춰 출력하기'],
    practice: { title: '동전 거스름돈 계산기', task: '금액을 입력받아 500원·100원·50원·10원 동전이 각각 몇 개 필요한지 구해 보세요.', checks: ['금액이 0이거나 딱 나누어떨어지는 경우도 맞나요?', '// 와 % 가 각각 무엇을 구하는지 설명할 수 있나요?'] },
    reading: { title: 'Python 공식 자습서 · 숫자', url: docs('introduction.html#numbers') },
  },
  {
    title: '갈림길에서 선택하기', focus: '조건에 따라 다른 동작을 고르는 법을 배워요.',
    goals: ['비교 연산자와 논리 연산자의 결과 예상하기', 'if / elif / else로 경우 나누기', '경계값(바로 아래·경계·바로 위)을 직접 시험하기'],
    practice: { title: '점수별 등급 판정기', task: '점수를 입력받아 구간별 등급을 출력하고, 각 구간의 경계값을 모두 시험해 보세요.', checks: ['모든 점수 범위에 맞는 등급이 나오나요?', '경계 바로 아래·경계·바로 위를 확인했나요?'] },
    reading: { title: 'Python 공식 자습서 · if 문', url: docs('controlflow.html#if-statements') },
  },
  {
    title: '반복으로 일 줄이기', focus: '같은 일을 규칙으로 반복시켜 코드를 줄여요.',
    goals: ['for와 range의 시작값·끝값 설명하기', '누적 변수를 반복문 밖에서 초기화하기', 'while의 종료 조건 만들기'],
    practice: { title: '약수 개수 세기', task: '정수 n을 입력받아 n의 약수가 모두 몇 개인지 반복문으로 세어 보세요.', checks: ['1, 소수, 큰 수를 각각 시험했나요?', '반복이 끝나는 이유를 설명할 수 있나요?'] },
    reading: { title: 'Python 공식 자습서 · for와 range', url: docs('controlflow.html#for-statements') },
  },
  {
    title: '글자 다루기', focus: '문자열을 자르고 바꾸고 세어요.',
    goals: ['인덱싱과 슬라이싱의 범위 확인하기', 'split·join·strip·upper의 역할 구분하기', '글자별 개수를 딕셔너리로 세기'],
    practice: { title: '문장 속 모음 세기', task: '영어 문장을 입력받아 모음(a, e, i, o, u)이 몇 번 나오는지 세어 보세요.', checks: ['공백이나 모음이 하나도 없는 문장도 처리되나요?', '대문자를 다루려면 무엇을 바꿔야 할지 설명할 수 있나요?'] },
    reading: { title: 'Python 공식 자습서 · 텍스트', url: docs('introduction.html#text') },
  },
  {
    title: '여러 값을 담는 리스트', focus: '값을 모아 정렬하고 찾고 가공해요.',
    goals: ['인덱스와 슬라이스로 값 꺼내기', 'append·sort·sorted의 차이 설명하기', '리스트 컴프리헨션으로 조건에 맞는 값 모으기'],
    practice: { title: '점수 목록 요약', task: '점수 목록에서 합계, 평균, 최댓값, 두 번째로 큰 값을 구해 보세요.', checks: ['값이 한 개이거나 같은 점수가 여러 개인 경우를 시험했나요?', '원래 리스트를 바꾸는 코드와 바꾸지 않는 코드를 구분했나요?'] },
    reading: { title: 'Python 공식 자습서 · 리스트', url: docs('datastructures.html#more-on-lists') },
  },
  {
    title: '이름표로 정리하기', focus: '튜플·딕셔너리·집합으로 데이터를 정리해요.',
    goals: ['딕셔너리로 키와 값 저장·조회하기(없는 키 처리 포함)', '집합으로 중복 제거와 교집합 구하기', '튜플 언패킹으로 여러 값을 한 번에 받기'],
    practice: { title: '단어 등장 횟수표', task: '여러 단어가 주어지면 단어별 등장 횟수를 딕셔너리로 세고, 많이 나온 순서로 출력해 보세요.', checks: ['처음 나온 단어와 반복된 단어가 모두 정확히 세어지나요?', '횟수가 같을 때의 출력 순서를 정했나요?'] },
    reading: { title: 'Python 공식 자습서 · 딕셔너리', url: docs('datastructures.html#dictionaries') },
  },
  {
    title: '함수로 나누어 만들기', focus: '코드를 함수로 나누고 다시 쓰는 법을 익혀요.',
    goals: ['def, 매개변수, return의 역할 구분하기', '기본값 매개변수 사용하기', '재귀 함수의 종료 조건 설명하기'],
    practice: { title: '재사용 가능한 계산 함수', task: '가격과 개수를 받아 총금액을 돌려주는 함수를 만들고, 서로 다른 입력으로 세 번 호출해 보세요.', checks: ['함수 안의 print와 return을 구분했나요?', '개수가 0인 경우에도 예상대로 동작하나요?'] },
    reading: { title: 'Python 공식 자습서 · 함수 정의하기', url: docs('controlflow.html#defining-functions') },
  },
  {
    title: '표와 규칙 다루기', focus: '2차원 자료와 규칙을 코드로 옮겨 시뮬레이션해요.',
    goals: ['2차원 리스트의 행과 열 인덱스 다루기', '이웃 칸을 경계 검사와 함께 확인하기', '상태가 바뀌는 규칙을 단계별로 시뮬레이션하기'],
    practice: { title: '이웃 칸 숫자 세기', task: '#과 .로 이루어진 표에서 각 칸 주변 8칸에 있는 #의 개수를 구해 출력해 보세요.', checks: ['표의 모서리 칸에서도 오류 없이 동작하나요?', '행과 열을 바꿔 쓰지 않았는지 작은 표로 확인했나요?'] },
    reading: { title: 'Python 공식 자습서 · 중첩 리스트', url: docs('datastructures.html#nested-list-comprehensions') },
  },
  {
    title: '문제 해결의 다음 레벨', focus: '자료구조와 알고리즘으로 한 걸음 더 나아가요.',
    goals: ['이분 탐색과 누적 합으로 반복 계산 줄이기', '스택·큐·너비 우선 탐색으로 순서가 중요한 문제 풀기', '작은 문제의 답을 저장해 푸는 동적 계획법 이해하기'],
    practice: { title: '나만의 알고리즘 노트', task: '해결한 도전·심화 문제 하나를 골라 풀이 아이디어와 반복 횟수가 입력 크기에 따라 어떻게 늘어나는지 정리해 보세요.', checks: ['더 쉬운 방법과 비교해 무엇이 빨라졌는지 설명할 수 있나요?', '다른 사람이 노트만 보고 같은 풀이를 떠올릴 수 있나요?'] },
    reading: { title: 'Python 공식 자습서 · 자료 구조', url: docs('datastructures.html') },
  },
].map((entry, index) => {
  const track = studio.tracks[index];
  return {
    stage: index + 1, ...entry,
    studio: { trackId: track.id, topics: track.topics, problemCount: track.problems.length, startPoints: track.startPoints, totalPoints: track.totalPoints },
  };
});

function getLearningGuide(stage) {
  const mapped = Number.isInteger(stage) && stage >= 1 && stage <= curriculum.length;
  const current = mapped ? curriculum[stage - 1] : null;
  const next = mapped && stage < curriculum.length ? curriculum[stage] : null;
  return structuredClone({
    status: !mapped ? 'unmapped' : next ? 'next-stage' : 'last-stage',
    current, next, practice: (next || current)?.practice || null,
    roadmap: curriculum.map(entry => ({ stage: entry.stage, title: entry.title })),
    recommendationNote: '스튜디오 10단계 로드맵에 따른 권장 학습 가이드입니다. 누적 학습 점수가 속한 트랙을 현재 단계로 안내하며, 개인 오답이나 취약점을 분석한 결과는 아닙니다.',
    promotionNote: '단계는 누적 점수를 트랙별 만점 합계에 견줘 안내하는 값이며 별도의 승급 심사는 없습니다. 아래 과제는 권장 연습이며 완료만으로 점수가 변경되지 않습니다.',
  });
}

const api = { getLearningGuide, stageForPoints: studio.stageForPoints };
if (typeof module === 'object' && module.exports) module.exports = api;
else root.PcoLearningGuide = api;
})(typeof window !== 'undefined' ? window : globalThis);
