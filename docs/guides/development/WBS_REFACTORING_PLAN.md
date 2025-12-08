# WBS Timeline 리팩토링 계획

## 개요

WbsTimeline.tsx 컴포넌트 최적화를 위한 단계별 리팩토링 계획입니다.

**목표**: 912줄 → 550줄 (40% 감소)

---

## Phase 1: 헬퍼 함수 및 타임라인 계산 로직 분리 ✅ 완료 (v1.1.13)

**완료 일자**: 2025-11-21
**버전**: v1.1.13

### 작업 내용

1. **`utils/wbsHelpers.ts` 생성** (~90줄)
   - `getTypeColor()` - PSTA 타입별 색상 (Tag용)
   - `getTypeColorHex()` - 타입별 Hex 색상 (Border용)
   - `getTypeColorHexLight()` - 타입별 옅은 색상 (30% 투명도)
   - `getTypeLabel()` - 타입별 레이블 (P/S/T/A)
   - `getStatusColor()` - 상태별 색상
   - `getStatusLabel()` - 상태별 레이블 (한글)
   - `formatDateRange()` - 날짜 범위 포맷팅 (M/D~M/D)

2. **`utils/timelineCalculator.ts` 생성** (~180줄)
   - `calculateTimelineBar()` - 타임라인 바 위치/너비 계산 및 렌더링
   - 정확한 셀 내 오프셋 계산 로직
   - JSX 렌더링 로직 (항목명, 담당자, 상태, 진행률, 기간)

3. **`WbsTimeline.tsx` 업데이트**
   - 헬퍼 함수 import 추가
   - 중복 코드 제거 (~214줄 감소)
   - `renderTimelineRow`에서 `calculateTimelineBar()` 호출

### 결과

- **Before**: 912줄
- **After**: 698줄
- **감소량**: 214줄 (23.5%)

---

## Phase 2: ViewMode 설정 통합 및 날짜 헤더 로직 분리 ✅ 완료 (v1.1.16)

**완료 일자**: 2025-11-24
**버전**: v1.1.16

### 작업 내용

#### 1. **`utils/viewModeConfig.ts` 생성** (~180줄)
   - `ViewMode` 타입 정의 및 export
   - `TimelineCell` 인터페이스 정의
   - `ViewModeConfig` 인터페이스 정의:
     - `cellMinWidth`: 셀 최소 너비
     - `navigationStep`: 네비게이션 스텝 (type, multiplier)
     - `gridGenerator`: 타임라인 그리드 생성 함수
     - `label`: ViewMode 한글 레이블
   - `VIEW_MODE_CONFIGS`: 6개 ViewMode별 설정 객체 (week, biweek, month, quarter, year, fiveyear)
   - `navigateTimelineDate()`: ViewMode에 따른 날짜 네비게이션 함수

#### 2. **`components/WbsTimelineHeader.tsx` 생성** (~80줄)
   - 날짜 헤더 렌더링 전용 컴포넌트
   - Props: `timelineGrid`, `cellMinWidth`
   - 오늘 날짜 하이라이트 처리
   - 주말 색상 처리
   - cell type별 레이블 포맷팅 (day/month/bimonth)

#### 3. **`WbsTimeline.tsx` 리팩토링**
   - ViewMode 타입을 viewModeConfig에서 import
   - `timelineGrid` useMemo: config의 gridGenerator 사용으로 변경 (68줄 감소)
   - `cellMinWidth` useMemo: config 참조로 간소화 (8줄 감소)
   - `navigateTimeline()`: navigateTimelineDate 함수 사용 (14줄 감소)
   - 날짜 헤더 렌더링: WbsTimelineHeader 컴포넌트로 교체 (57줄 감소)

### 결과

- **Before**: 700줄 (Phase 1 완료 후)
- **After**: 553줄
- **감소량**: 147줄 (21.0%)
- **누적 감소**: Phase 1 (214줄) + Phase 2 (147줄) = 361줄 (39.6%)

---

## Phase 3: 스타일 상수화 및 커스텀 훅 ✅ 완료 (v1.1.17)

**완료 일자**: 2025-11-24
**버전**: v1.1.17

### 작업 내용

#### 1. **`constants/wbsStyles.ts` 생성** (~140줄)
   - 반복되는 스타일 객체를 상수로 정의
   - **스타일 상수**:
     - `ROW_BASE_STYLE`: 행 기본 스타일 (minHeight, padding, lineHeight, transition)
     - `getTreeRowStyle()`: 트리 행 스타일 함수 (level, isHovered 파라미터)
     - `getEmptyRowStyle()`: 빈 행 스타일 함수
     - `getTimelineRowStyle()`: 타임라인 행 스타일 함수
     - `TYPE_TAG_STYLE`: PSTA 타입 태그 스타일
     - `ITEM_NAME_STYLE`: 항목명 스타일
     - `CONTAINER_STYLE`: 컨테이너 스타일
     - `SCROLL_AREA_STYLE`: 스크롤 영역 스타일
     - `FLEX_CONTAINER_STYLE`: 플렉스 컨테이너 스타일
     - `HEADER_CONTAINER_STYLE`: 헤더 영역 스타일
     - `RESIZE_HANDLE_STYLE`: 리사이즈 핸들 스타일
     - `RESIZE_HANDLE_HOVER_STYLE`: 리사이즈 핸들 호버 스타일
     - `CENTER_CONTENT_STYLE`: 로딩/빈 상태 중앙 정렬 스타일

#### 2. **`hooks/useColumnResize.ts` 생성** (~90줄)
   - 컬럼 리사이즈 로직을 재사용 가능한 훅으로 분리
   - **인터페이스**:
     - `UseColumnResizeOptions`: initialWidth, minWidth, maxWidth
     - `UseColumnResizeReturn`: width, isResizing, startResize
   - **기능**:
     - 마우스 이벤트 핸들링 (mousemove, mouseup)
     - 커서 및 선택 스타일 자동 관리
     - 최소/최대 너비 제한
     - 자동 클린업

#### 3. **`WbsTimeline.tsx` 리팩토링**
   - 스타일 상수 import 및 적용:
     - `renderTreeRow`: 인라인 스타일 → `getTreeRowStyle()` (9줄 감소)
     - `renderEmptyRow`: 인라인 스타일 → `getEmptyRowStyle()` (5줄 감소)
     - `renderTimelineRow`: 인라인 스타일 → `getTimelineRowStyle()` (7줄 감소)
     - Loading/Empty 상태: `CENTER_CONTENT_STYLE` (6줄 감소)
     - Container: `CONTAINER_STYLE`, `SCROLL_AREA_STYLE`, `FLEX_CONTAINER_STYLE` (3줄 감소)
     - 리사이즈 핸들: `RESIZE_HANDLE_STYLE`, `RESIZE_HANDLE_HOVER_STYLE` (8줄 감소)
   - 커스텀 훅 적용:
     - `useColumnResize` 훅 사용으로 state 2개 제거 (2줄 감소)
     - 리사이즈 useEffect 전체 제거 (28줄 감소)
     - `startResize` 함수로 통합 (1줄로 변경)

### 결과

- **Before**: 553줄 (Phase 2 완료 후)
- **After**: 509줄
- **감소량**: 44줄 (8.0%)
- **총 누적 감소**: 912줄 → 509줄 (**403줄 감소, 44.2%**)

### 최종 아키텍처

**WbsTimeline.tsx (509줄)**
- 설정 기반 ViewMode 관리
- 컴포넌트 분리로 관심사 분리
- 스타일 상수화로 중복 제거
- 커스텀 훅으로 로직 재사용

**분리된 파일들**
- `utils/wbsHelpers.ts` (90줄) - Phase 1
- `utils/timelineCalculator.tsx` (178줄) - Phase 1
- `utils/viewModeConfig.ts` (180줄) - Phase 2
- `components/WbsTimelineHeader.tsx` (80줄) - Phase 2
- `constants/wbsStyles.ts` (140줄) - Phase 3
- `hooks/useColumnResize.ts` (90줄) - Phase 3

---

## 타입 정의 분리 (선택 사항)

**파일**: `types/wbsTimeline.ts`

```typescript
export type ViewMode = 'week' | 'biweek' | 'month' | 'quarter' | 'year' | 'fiveyear';

export interface TimelineCell {
  date: Date;
  type: 'day' | 'month' | 'bimonth';
}

export interface WbsTimelineProps {
  userTeamId?: string;
  expandedTypes: Set<ItemType>;
  hideUnassignedIds: string[];
  hideEmptyTeams: boolean;
  selectedClientIds: string[];
  selectedProjectIds: string[];
  searchKeyword: string;
  onItemClick: (item: Item) => void;
}
```

---

## 최종 예상 결과

| Phase | 감소량 | 총 라인 수 |
|-------|--------|------------|
| Phase 0 (원본) | - | 912줄 |
| Phase 1 ✅ | -214줄 | 698줄 |
| Phase 2 | -150줄 | ~548줄 |
| Phase 3 | -50줄 | ~498줄 |

**총 감소**: 414줄 (45%)

---

## 추가 고려 사항

### 성능 최적화

1. **React.memo 적용**
   - `WbsTimelineHeader`, 추출된 컴포넌트에 memo 적용
   - 불필요한 리렌더링 방지

2. **useCallback 사용**
   - `renderTreeRow`, `renderTimelineRow` 등 렌더 함수에 useCallback 적용
   - 의존성 배열 최적화

3. **가상 스크롤 (Virtual Scrolling) 검토**
   - 대량의 항목 처리 시 성능 개선
   - react-window 또는 react-virtual 라이브러리 고려

### 테스트 추가

1. **단위 테스트**
   - `wbsHelpers.ts` 함수들에 대한 테스트
   - `timelineCalculator.ts` 로직 테스트

2. **통합 테스트**
   - WbsTimeline 컴포넌트 렌더링 테스트
   - ViewMode 전환 테스트
   - 리사이즈 기능 테스트

---

## 참고

- **Phase 1 완료**: 2025-11-21
- **다음 단계**: Phase 2 작업 시작 시 본 문서 업데이트
- **관련 파일**:
  - `/app/psta/frontend/src/components/WbsTimeline.tsx` (698줄)
  - `/app/psta/frontend/src/utils/wbsHelpers.ts` (90줄)
  - `/app/psta/frontend/src/utils/timelineCalculator.ts` (180줄)
