# toshop-list-recommendations

[토마토 장바구니](https://github.com/su100/toshop-list) 앱의 상세 화면 상품 추천 데이터.

## 서빙 URL

```
https://cdn.jsdelivr.net/gh/su100/toshop-list-recommendations@main/recommendations.json
```

jsDelivr CDN 이 전 세계 edge 에서 캐시. GitHub Pages 불필요.

## 수정 흐름

1. `recommendations.json` 편집
2. commit + push
3. 즉시 반영 필요하면 purge 요청:
   ```
   https://purge.jsdelivr.net/gh/su100/toshop-list-recommendations@main/recommendations.json
   ```
   브라우저로 열면 purge 완료 메시지. 안 하면 최대 12시간 캐시 유지.

## 스키마

```jsonc
{
  "version": 1,                                      // 스키마 버전. 깨짐 방지용
  "updatedAt": "YYYY-MM-DD",                         // 참조용
  "notice": "쿠팡 파트너스 활동의 일환으로...",       // 상세 화면 상단에 노출될 고지 문구
  "items": {
    "<항목명 완전일치 키>": [
      {
        "title": "상품 이름",                        // 노출용
        "image": "https://.../thumb.jpg",            // 썸네일 URL
        "price": "2,900원",                          // 문자열(단위 포함 자유)
        "link": "https://link.coupang.com/a/XXX"     // 쿠팡 파트너스 어필리에이트 URL
      }
    ]
  }
}
```

### 매핑 규칙 (앱 측)

- 사용자가 입력한 항목명 ↔ `items` 의 키 **완전 일치** 비교
- 매칭 안 되면 추천 섹션 자체 숨김 (고지 밴드도 숨김)
- 공백·대소문자 처리는 앱에서 trim + lowercase 정규화

### 운영 규칙

- `notice` 문구는 **공정위 표시광고법·쿠팡 파트너스 정책** 상 필수. 삭제 금지
- 상품당 2~5개 노출 권장 (너무 많으면 선택 피로)
- 품절·링크 만료 발견 시 즉시 교체 or 제거
- 자주 사용되는 품목 위주로 유지 (매핑 안 되면 자연스럽게 "추천 없음")

## 로드맵

- v1: 수동 매핑 (지금 단계)
- v2: 백엔드 전환 — 맥미니 + 쿠팡 파트너스 API 자동 검색. CDN URL 교체만으로 앱 코드 변경 없이 전환 가능.
