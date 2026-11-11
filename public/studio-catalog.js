// 파코 스튜디오(new.html) 문제 목록의 공개 요약입니다. 정답·설명·테스트는 포함하지 않습니다.
// new.html의 curriculum과 같은 내용인지 tests/studio-catalog.test.js가 확인하므로 문제를 바꾸면 이 파일도 함께 고치세요.
(function (root) {
  var POINTS = { 맛보기: 5, 입문: 10, 기초: 20, 응용: 30, 도전: 50, 심화: 80 };
  var LEVELS = ["맛보기", "입문", "기초", "응용", "도전", "심화"];
  var tracks = [
    {
      "id": "t1",
      "name": "1단계",
      "label": "처음 만나는 파이썬",
      "description": "코딩이 처음이어도 괜찮아요. 한 줄부터 시작해요.",
      "topics": "출력 · 변수 · 입력",
      "problems": [
        {
          "id": "hello",
          "title": "안녕, 파이썬!",
          "level": "맛보기",
          "topic": "출력",
          "minutes": 5
        },
        {
          "id": "t1_self_intro",
          "title": "세 줄 자기소개",
          "level": "맛보기",
          "topic": "여러 줄 출력",
          "minutes": 4
        },
        {
          "id": "t1_quotes",
          "title": "따옴표가 들어간 문장",
          "level": "맛보기",
          "topic": "따옴표 출력",
          "minutes": 5
        },
        {
          "id": "t1_sep_end",
          "title": "구분 기호와 줄 바꿈 바꾸기",
          "level": "맛보기",
          "topic": "sep와 end",
          "minutes": 6
        },
        {
          "id": "t1_snack_total",
          "title": "분식집 계산서",
          "level": "맛보기",
          "topic": "변수와 계산",
          "minutes": 6
        },
        {
          "id": "t1_greeting_name",
          "title": "이름을 불러주세요",
          "level": "입문",
          "topic": "input 입력",
          "minutes": 6
        },
        {
          "id": "t1_banner",
          "title": "간판 만들기",
          "level": "입문",
          "topic": "문자열 연산",
          "minutes": 8
        },
        {
          "id": "t1_swap_cups",
          "title": "컵 속 음료 바꾸기",
          "level": "입문",
          "topic": "변수 바꾸기",
          "minutes": 8
        },
        {
          "id": "t1_next_year",
          "title": "내년에는 몇 살?",
          "level": "입문",
          "topic": "f-string",
          "minutes": 10
        },
        {
          "id": "t1_date_formats",
          "title": "날짜 모양 바꾸기",
          "level": "기초",
          "topic": "split과 sep",
          "minutes": 12
        }
      ]
    },
    {
      "id": "t2",
      "name": "2단계",
      "label": "숫자와 친해지기",
      "description": "입력받은 숫자로 계산하며 연산자와 친해져요.",
      "topics": "산술 연산 · 형 변환 · 출력 형식",
      "problems": [
        {
          "id": "t2_pocket_money",
          "title": "오늘 쓰고 남은 용돈",
          "level": "맛보기",
          "topic": "뺄셈",
          "minutes": 4
        },
        {
          "id": "t2_paper_fold",
          "title": "종이접기 겹겹이",
          "level": "맛보기",
          "topic": "거듭제곱",
          "minutes": 5
        },
        {
          "id": "sum",
          "title": "두 숫자의 합",
          "level": "입문",
          "topic": "변수와 입력",
          "minutes": 8
        },
        {
          "id": "t2_candy_share",
          "title": "사탕 똑같이 나누기",
          "level": "입문",
          "topic": "몫과 나머지",
          "minutes": 8
        },
        {
          "id": "t2_temperature_gap",
          "title": "두 도시의 기온 차이",
          "level": "입문",
          "topic": "절댓값",
          "minutes": 8
        },
        {
          "id": "t2_average_score",
          "title": "세 과목 평균 점수",
          "level": "입문",
          "topic": "평균과 f-string",
          "minutes": 10
        },
        {
          "id": "t2_celsius_to_fahrenheit",
          "title": "섭씨를 화씨로 바꿔요",
          "level": "입문",
          "topic": "공식과 소수",
          "minutes": 10
        },
        {
          "id": "t2_seconds_clock",
          "title": "초를 시·분·초로",
          "level": "기초",
          "topic": "시간 단위 변환",
          "minutes": 12
        },
        {
          "id": "t2_coin_change",
          "title": "동전으로 거스름돈 주기",
          "level": "기초",
          "topic": "나머지 연산",
          "minutes": 15
        },
        {
          "id": "t2_digit_play",
          "title": "세 자리 수 숫자놀이",
          "level": "기초",
          "topic": "자릿수 분리",
          "minutes": 15
        }
      ]
    },
    {
      "id": "t3",
      "name": "3단계",
      "label": "갈림길에서 선택하기",
      "description": "조건에 따라 다른 길을 고르는 법을 배워요.",
      "topics": "비교 · if/elif/else · 논리 연산",
      "problems": [
        {
          "id": "t3_vending",
          "title": "자판기 음료수 살 수 있을까?",
          "level": "맛보기",
          "topic": "비교 연산",
          "minutes": 5
        },
        {
          "id": "even",
          "title": "홀수일까, 짝수일까?",
          "level": "입문",
          "topic": "조건문",
          "minutes": 10
        },
        {
          "id": "t3_thermometer",
          "title": "영상일까, 영하일까?",
          "level": "입문",
          "topic": "if/elif",
          "minutes": 8
        },
        {
          "id": "t3_grade",
          "title": "점수로 등급 매기기",
          "level": "입문",
          "topic": "구간 나누기",
          "minutes": 10
        },
        {
          "id": "t3_ride",
          "title": "놀이기구 탈 수 있을까?",
          "level": "기초",
          "topic": "and/or",
          "minutes": 12
        },
        {
          "id": "t3_rps",
          "title": "가위바위보 승부",
          "level": "기초",
          "topic": "중첩 조건",
          "minutes": 12
        },
        {
          "id": "t3_calendar_days",
          "title": "이번 달은 며칠까지?",
          "level": "기초",
          "topic": "윤년 규칙",
          "minutes": 15
        },
        {
          "id": "t3_taxi",
          "title": "택시 요금 계산기",
          "level": "기초",
          "topic": "구간별 요금",
          "minutes": 15
        },
        {
          "id": "t3_triangle",
          "title": "어떤 삼각형일까?",
          "level": "응용",
          "topic": "조건 조합",
          "minutes": 20
        },
        {
          "id": "t3_quadratic",
          "title": "방정식의 해는 몇 개?",
          "level": "응용",
          "topic": "경계 처리",
          "minutes": 20
        }
      ]
    },
    {
      "id": "t4",
      "name": "4단계",
      "label": "반복으로 일 줄이기",
      "description": "같은 일을 규칙으로 반복시키며 코드를 줄여요.",
      "topics": "for · while · 누적",
      "problems": [
        {
          "id": "t4_times_row",
          "title": "구구단 한 줄 외우기",
          "level": "입문",
          "topic": "for와 range",
          "minutes": 8
        },
        {
          "id": "t4_countdown",
          "title": "로켓 발사 카운트다운",
          "level": "입문",
          "topic": "while 반복",
          "minutes": 8
        },
        {
          "id": "total",
          "title": "1부터 N까지",
          "level": "기초",
          "topic": "반복문",
          "minutes": 10
        },
        {
          "id": "t4_even_sum",
          "title": "짝수 사물함의 열쇠 합",
          "level": "기초",
          "topic": "범위 안 누적",
          "minutes": 10
        },
        {
          "id": "t4_warm_days",
          "title": "영상인 날은 며칠?",
          "level": "기초",
          "topic": "입력 반복",
          "minutes": 12
        },
        {
          "id": "t4_star_mountain",
          "title": "별로 쌓는 산봉우리",
          "level": "기초",
          "topic": "문자열 반복 출력",
          "minutes": 12
        },
        {
          "id": "t4_pizza_share",
          "title": "똑같이 나눠 먹는 방법",
          "level": "응용",
          "topic": "약수 세기",
          "minutes": 15
        },
        {
          "id": "t4_plant_growth",
          "title": "무럭무럭 자라는 화분",
          "level": "응용",
          "topic": "피보나치 수열",
          "minutes": 18
        },
        {
          "id": "t4_tile_size",
          "title": "가장 큰 정사각형 타일",
          "level": "응용",
          "topic": "최대공약수",
          "minutes": 20
        },
        {
          "id": "t4_hailstone",
          "title": "우박 숫자의 여행",
          "level": "도전",
          "topic": "규칙 반복",
          "minutes": 25
        }
      ]
    },
    {
      "id": "t5",
      "name": "5단계",
      "label": "글자 다루기",
      "description": "문자열을 자르고 바꾸고 세어봐요.",
      "topics": "인덱싱 · 슬라이싱 · 문자열 메서드",
      "problems": [
        {
          "id": "t5_name_tag",
          "title": "이름표 만들기",
          "level": "입문",
          "topic": "인덱싱",
          "minutes": 8
        },
        {
          "id": "t5_nickname_case",
          "title": "닉네임 대문자 · 소문자",
          "level": "입문",
          "topic": "대소문자",
          "minutes": 8
        },
        {
          "id": "palindrome",
          "title": "거꾸로 읽어도 똑같아",
          "level": "기초",
          "topic": "문자열",
          "minutes": 12
        },
        {
          "id": "t5_mask_number",
          "title": "뒷자리만 보여주세요",
          "level": "기초",
          "topic": "슬라이싱",
          "minutes": 10
        },
        {
          "id": "t5_count_vowels",
          "title": "모음은 몇 개일까?",
          "level": "기초",
          "topic": "글자 세기",
          "minutes": 12
        },
        {
          "id": "t5_word_count",
          "title": "공백이 많은 문장의 단어 수",
          "level": "응용",
          "topic": "split",
          "minutes": 14
        },
        {
          "id": "t5_top_letter",
          "title": "가장 많이 나온 글자",
          "level": "응용",
          "topic": "딕셔너리 카운팅",
          "minutes": 16
        },
        {
          "id": "t5_caesar_shift",
          "title": "비밀 편지 암호화",
          "level": "응용",
          "topic": "글자 이동",
          "minutes": 18
        },
        {
          "id": "t5_run_length",
          "title": "같은 글자는 한 번에 줄여요",
          "level": "응용",
          "topic": "연속 글자 압축",
          "minutes": 20
        },
        {
          "id": "t5_common_prefix",
          "title": "모두가 같이 시작하는 글자",
          "level": "도전",
          "topic": "공통 접두사",
          "minutes": 25
        }
      ]
    },
    {
      "id": "t6",
      "name": "6단계",
      "label": "여러 값을 담는 리스트",
      "description": "값을 모아 정렬하고 찾고 가공해요.",
      "topics": "리스트 · 정렬 · 컴프리헨션",
      "problems": [
        {
          "id": "t6_walk_steps",
          "title": "일주일 걸음 수 기록",
          "level": "입문",
          "topic": "리스트 합계",
          "minutes": 8
        },
        {
          "id": "maximum",
          "title": "가장 큰 숫자 찾기",
          "level": "기초",
          "topic": "리스트",
          "minutes": 12
        },
        {
          "id": "t6_above_average",
          "title": "평균보다 높은 점수",
          "level": "기초",
          "topic": "평균과 비교",
          "minutes": 12
        },
        {
          "id": "t6_even_squares",
          "title": "짝수 번호 제곱 카드",
          "level": "기초",
          "topic": "리스트 컴프리헨션",
          "minutes": 12
        },
        {
          "id": "t6_second_largest",
          "title": "은메달은 누구?",
          "level": "응용",
          "topic": "정렬과 중복",
          "minutes": 15
        },
        {
          "id": "t6_first_seen_unique",
          "title": "중복 신청 정리하기",
          "level": "응용",
          "topic": "중복 제거",
          "minutes": 15
        },
        {
          "id": "t6_rotate_conveyor",
          "title": "회전 초밥 레일",
          "level": "응용",
          "topic": "리스트 회전",
          "minutes": 18
        },
        {
          "id": "t6_window_sums",
          "title": "연속 며칠 기온 합",
          "level": "응용",
          "topic": "구간 합",
          "minutes": 20
        },
        {
          "id": "t6_best_streak",
          "title": "최고의 연속 라운드",
          "level": "도전",
          "topic": "최대 구간 합",
          "minutes": 25
        },
        {
          "id": "t6_merge_sorted",
          "title": "두 줄 합쳐 줄 세우기",
          "level": "도전",
          "topic": "정렬 병합",
          "minutes": 25
        }
      ]
    },
    {
      "id": "t7",
      "name": "7단계",
      "label": "이름표로 정리하기",
      "description": "튜플·딕셔너리·집합으로 데이터를 정리해요.",
      "topics": "튜플 · 딕셔너리 · 집합",
      "problems": [
        {
          "id": "t7_hot_cold_day",
          "title": "가장 더운 날, 가장 추운 날",
          "level": "기초",
          "topic": "튜플",
          "minutes": 12
        },
        {
          "id": "t7_score_lookup",
          "title": "이름으로 점수 찾기",
          "level": "기초",
          "topic": "딕셔너리",
          "minutes": 12
        },
        {
          "id": "t7_friend_groups",
          "title": "두 친구 모임의 공통점",
          "level": "기초",
          "topic": "집합 연산",
          "minutes": 12
        },
        {
          "id": "t7_first_repeat_card",
          "title": "처음으로 두 번 찍힌 카드",
          "level": "응용",
          "topic": "집합 탐색",
          "minutes": 15
        },
        {
          "id": "t7_group_by_team",
          "title": "수련회 조 편성표",
          "level": "응용",
          "topic": "딕셔너리 그룹",
          "minutes": 18
        },
        {
          "id": "t7_song_top_words",
          "title": "가사 속 인기 낱말",
          "level": "응용",
          "topic": "빈도수 정렬",
          "minutes": 20
        },
        {
          "id": "t7_stock_commands",
          "title": "문구점 재고 관리",
          "level": "응용",
          "topic": "딕셔너리 명령",
          "minutes": 22
        },
        {
          "id": "pair",
          "title": "목표 합을 만드는 두 수",
          "level": "도전",
          "topic": "딕셔너리",
          "minutes": 20
        },
        {
          "id": "t7_anagram_groups",
          "title": "글자만 바꾼 낱말 모으기",
          "level": "도전",
          "topic": "애너그램",
          "minutes": 25
        },
        {
          "id": "t7_longest_streak",
          "title": "이어지는 번호 카드 최대 길이",
          "level": "도전",
          "topic": "집합 활용",
          "minutes": 28
        }
      ]
    },
    {
      "id": "t8",
      "name": "8단계",
      "label": "함수로 나누어 만들기",
      "description": "코드를 함수로 나누고 다시 쓰는 법을 익혀요.",
      "topics": "함수 · 매개변수 · 재귀",
      "problems": [
        {
          "id": "t8_cube_box",
          "title": "정육면체 상자의 부피",
          "level": "입문",
          "topic": "함수 만들기",
          "minutes": 8
        },
        {
          "id": "t8_cafe_tax",
          "title": "카페 주문 금액 계산기",
          "level": "기초",
          "topic": "기본값 매개변수",
          "minutes": 10
        },
        {
          "id": "t8_temp_range",
          "title": "일주일 기온의 최저와 최고",
          "level": "기초",
          "topic": "값 두 개 반환",
          "minutes": 12
        },
        {
          "id": "t8_magic_twice",
          "title": "마법 주문을 두 번 외우면",
          "level": "기초",
          "topic": "함수를 인자로",
          "minutes": 14
        },
        {
          "id": "t8_locker_primes",
          "title": "소수 사물함 찾기",
          "level": "응용",
          "topic": "소수 판별 함수",
          "minutes": 18
        },
        {
          "id": "t8_magic_card",
          "title": "마술 카드의 숫자 합",
          "level": "응용",
          "topic": "재귀 함수",
          "minutes": 20
        },
        {
          "id": "t8_signal_binary",
          "title": "전등 신호를 이진수로",
          "level": "응용",
          "topic": "재귀와 문자열",
          "minutes": 20
        },
        {
          "id": "t8_secret_lock",
          "title": "비밀 금고의 경우의 수",
          "level": "도전",
          "topic": "빠른 거듭제곱",
          "minutes": 25
        },
        {
          "id": "t8_hanoi_plates",
          "title": "하노이의 접시 탑",
          "level": "도전",
          "topic": "재귀 분할",
          "minutes": 30
        },
        {
          "id": "t8_frog_stairs",
          "title": "개구리의 징검다리 계단",
          "level": "심화",
          "topic": "메모이제이션",
          "minutes": 35
        }
      ]
    },
    {
      "id": "t9",
      "name": "9단계",
      "label": "표와 규칙 다루기",
      "description": "2차원 자료와 규칙을 코드로 옮겨 시뮬레이션해요.",
      "topics": "2차원 리스트 · 패턴 · 시뮬레이션",
      "problems": [
        {
          "id": "t9_sticker_sums",
          "title": "칭찬 스티커 합계표",
          "level": "기초",
          "topic": "행·열 합",
          "minutes": 12
        },
        {
          "id": "t9_garden_rotate",
          "title": "화분 배치도 돌리기",
          "level": "응용",
          "topic": "표 회전",
          "minutes": 15
        },
        {
          "id": "t9_gem_diamond",
          "title": "보석 모양 카드",
          "level": "응용",
          "topic": "패턴 출력",
          "minutes": 15
        },
        {
          "id": "t9_rain_cloud_map",
          "title": "비구름 근처 칸 세기",
          "level": "응용",
          "topic": "이웃 칸 세기",
          "minutes": 20
        },
        {
          "id": "t9_snail_board",
          "title": "달팽이 놀이판",
          "level": "도전",
          "topic": "나선형 채우기",
          "minutes": 25
        },
        {
          "id": "t9_germ_dish",
          "title": "세균 배양 한 세대",
          "level": "도전",
          "topic": "상태 갱신",
          "minutes": 28
        },
        {
          "id": "t9_cleaner_robot",
          "title": "청소 로봇의 하루",
          "level": "도전",
          "topic": "이동 시뮬레이션",
          "minutes": 28
        },
        {
          "id": "t9_bingo_three_lines",
          "title": "세 줄 빙고 게임",
          "level": "도전",
          "topic": "빙고 판정",
          "minutes": 30
        },
        {
          "id": "t9_island_count",
          "title": "섬 지도에서 섬 세기",
          "level": "심화",
          "topic": "영역 세기",
          "minutes": 35
        },
        {
          "id": "t9_maze_escape",
          "title": "놀이공원 미로 탈출",
          "level": "심화",
          "topic": "최단 경로",
          "minutes": 40
        }
      ]
    },
    {
      "id": "t10",
      "name": "10단계",
      "label": "문제 해결의 다음 레벨",
      "description": "자료구조와 알고리즘으로 한 걸음 더 나아가요.",
      "topics": "탐색 · 스택 · 누적합 · 동적 계획법",
      "problems": [
        {
          "id": "t10_library_shelf",
          "title": "도서관 청구번호 찾기",
          "level": "응용",
          "topic": "이분 탐색",
          "minutes": 18
        },
        {
          "id": "brackets",
          "title": "괄호의 짝 맞추기",
          "level": "도전",
          "topic": "스택",
          "minutes": 20
        },
        {
          "id": "t10_step_totals",
          "title": "걸음 수 구간 합계",
          "level": "도전",
          "topic": "누적 합",
          "minutes": 22
        },
        {
          "id": "t10_bomb_game",
          "title": "폭탄 돌리기 게임",
          "level": "도전",
          "topic": "큐 시뮬레이션",
          "minutes": 25
        },
        {
          "id": "t10_canoe_pairs",
          "title": "카누 짝꿍 고르기",
          "level": "도전",
          "topic": "투 포인터",
          "minutes": 25
        },
        {
          "id": "unique",
          "title": "겹치지 않는 가장 긴 구간",
          "level": "심화",
          "topic": "슬라이딩 윈도우",
          "minutes": 30
        },
        {
          "id": "t10_change_coins",
          "title": "최소 동전으로 거스름돈",
          "level": "심화",
          "topic": "동적 계획법",
          "minutes": 35
        },
        {
          "id": "t10_hiking_climb",
          "title": "점점 높아지는 산책로",
          "level": "심화",
          "topic": "최장 증가 부분수열",
          "minutes": 35
        },
        {
          "id": "t10_camping_pack",
          "title": "캠핑 배낭 꾸리기",
          "level": "심화",
          "topic": "0/1 배낭 문제",
          "minutes": 40
        },
        {
          "id": "t10_friend_bridge",
          "title": "친구의 친구의 친구…",
          "level": "심화",
          "topic": "너비 우선 탐색",
          "minutes": 40
        }
      ]
    }
  ];

  var maxPoints = 0;
  tracks.forEach(function (track) {
    track.startPoints = maxPoints;
    track.totalPoints = track.problems.reduce(function (sum, problem) { return sum + POINTS[problem.level]; }, 0);
    maxPoints += track.totalPoints;
  });
  var problems = [];
  tracks.forEach(function (track) {
    track.problems.forEach(function (problem) {
      problem.points = POINTS[problem.level];
      problem.trackId = track.id;
      problems.push(problem);
    });
  });

  // 누적 점수가 속한 트랙(1부터). 트랙별 점수 합계를 이어 붙인 구간으로 계산하며 잘못된 값은 0입니다.
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
  function progress(completedIds) {
    var solved = solvedSet(completedIds);
    var solvedProblems = problems.filter(function (problem) { return solved[problem.id]; });
    return {
      solved: solvedProblems.length,
      total: problems.length,
      solvedPoints: solvedProblems.reduce(function (sum, problem) { return sum + problem.points; }, 0),
      tracks: tracks.map(function (track) {
        return { id: track.id, name: track.name, label: track.label, total: track.problems.length,
          solved: track.problems.filter(function (problem) { return solved[problem.id]; }).length };
      }),
    };
  }
  // fromStage 트랙부터 아직 풀지 않은 문제를 순서대로 limit개 돌려줍니다.
  function nextProblems(completedIds, limit, fromStage) {
    var solved = solvedSet(completedIds);
    var start = Math.max(0, (fromStage || 1) - 1);
    var found = [];
    for (var i = start; i < tracks.length && found.length < limit; i++) {
      for (var j = 0; j < tracks[i].problems.length && found.length < limit; j++) {
        if (!solved[tracks[i].problems[j].id]) found.push({ problem: tracks[i].problems[j], track: tracks[i] });
      }
    }
    return found;
  }

  var api = { POINTS: POINTS, LEVELS: LEVELS, tracks: tracks, problems: problems, maxPoints: maxPoints,
    stageForPoints: stageForPoints, progress: progress, nextProblems: nextProblems };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PcoStudio = api;
})(typeof window !== "undefined" ? window : globalThis);
