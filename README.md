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
        "title": "상품 이름",                        // 쿠팡 링크 태그의 img alt 그대로
        "image": "https://img5c.coupangcdn.com/...", // 쿠팡 링크 태그의 img src
        "link": "https://link.coupang.com/a/XXX",    // 쿠팡 링크 태그의 a href
        "imageWidth": 120,                           // 선택 — 비율 유지용. 쿠팡이 알려주는 값 그대로
        "imageHeight": 240                           // 선택
      }
    ]
  }
}
```

### 상품 데이터 추출 흐름

쿠팡 파트너스에서 상품 선택 → 링크 태그 코드 예시:

```html
<a href="https://link.coupang.com/a/hBmkURHmoe"
   target="_blank"
   referrerpolicy="unsafe-url">
  <img src="https://img5c.coupangcdn.com/image/affiliate/banner/XXX@2x.jpg"
       alt="세타필 모이스춰라이징 로션, 591ml, 1개"
       width="120" height="240">
</a>
```

여기서 네 값만 추출해 JSON 에 입력:

| HTML 속성 | JSON 필드 |
|---|---|
| `a href` | `link` |
| `img src` | `image` |
| `img alt` | `title` |
| `img width`/`height` | `imageWidth`/`imageHeight` (선택) |

가격은 변동 심해서 **의도적으로 저장 안 함**. 앱에서도 가격 미노출. 사용자가 쿠팡 사이트에서 최신 가격 확인하도록.

### 자동 추가 스크립트

HTML 복붙 → JSON 자동 반영. 수동 편집 불필요.

```bash
# 품목명을 인자, HTML 을 stdin 으로
node scripts/add-product.mjs "샴푸" <<'EOF'
<a href="https://link.coupang.com/a/XXX" target="_blank" referrerpolicy="unsafe-url"><img src="https://img...coupangcdn.com/.../YYY@2x.jpg" alt="상품명, 500ml, 1개" width="120" height="240"></a>
EOF
```

또는 클립보드 → 바로 반영:
```bash
pbpaste | node scripts/add-product.mjs "샴푸"
```

동작:
- 품목 키가 없으면 새로 생성, 있으면 배열에 append
- 같은 `link` 가 이미 있으면 교체 (중복 방지)
- `updatedAt` 자동 갱신
- git/CDN purge 는 스크립트가 안 함 — 리뷰 후 수동 commit/push

### 매핑 규칙 (앱 측)

- 사용자가 입력한 항목명 ↔ `items` 의 키 **완전 일치** 비교
- 매칭 안 되면 추천 섹션 자체 숨김 (고지 밴드도 숨김)
- 공백·대소문자 처리는 앱에서 trim + lowercase 정규화

### 운영 규칙

- `notice` 문구는 **공정위 표시광고법·쿠팡 파트너스 정책** 상 필수. 삭제 금지
- 상품당 2~5개 노출 권장 (너무 많으면 선택 피로, 2열 그리드 UI 라 짝수 권장)
- 품절·링크 만료 발견 시 즉시 교체 or 제거
- 자주 사용되는 품목 위주로 유지 (매핑 안 되면 자연스럽게 "추천 없음")

### 앱 측 UI (참고)

```
상세 화면 (스크롤)
┌──────────────────────────┐
│ 품목명 · 메모 · 체크 등     │
├──────────────────────────┤
│ ⓘ 쿠팡 파트너스 활동의 ... │ ← notice 밴드
├──────────────────────────┤
│ ┌─────┐ ┌─────┐          │
│ │ img │ │ img │  (광고)   │ ← 2열 그리드 카드
│ │title│ │title│          │
│ └─────┘ └─────┘          │
└──────────────────────────┘
```

카드 탭 시 `Linking.openURL(link)` 로 쿠팡 앱 (설치되어 있으면) 또는 브라우저가 열림.

## 로드맵

- v1: 수동 매핑 (지금 단계)
- v2: 백엔드 전환 — 맥미니 + 쿠팡 파트너스 API 자동 검색. CDN URL 교체만으로 앱 코드 변경 없이 전환 가능.
