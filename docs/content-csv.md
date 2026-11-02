# 콘텐츠 CSV 임시 열 구성 (기획서 §6.2 '미정' → PoC 임시안, 업무 보드 #12에서 확정 필요)

- `data/content/lines.csv`: `id,kind,key,text` — kind = intro·first5·clone_tap·deduction·unit·mom·promo·cert·session_end·closing. 줄 추가만으로 수량 확장.
- `data/content/events.csv`: `id,type,text,choice_a,result_a,choice_b,result_b,series,next` — type = tap(한 번 탭)·choice(2지선다). result = 보상 초수(초당 수입 × 초, A10 범위 30~120). series/next = 연작 id와 다음 사건 id.
- `data/content/news.csv`: `id,text` — `{n}` `{job}` `{city}` 자리 표시 지원.
- `data/content/uniques.csv`: `id,name,condition,hint1,hint2,passive,value,prop` — passive = job(배치 건물 수입)·tap·payday.
- `data/content/scenes.csv`: `id,name,text` — 숨은 장면, 도시마다 같은 목록을 도시 이름과 함께 배치.
