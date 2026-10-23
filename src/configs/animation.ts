import type { TurningMode } from '@/types/slides'

export const ANIMATION_DEFAULT_DURATION = 1000
export const ANIMATION_DEFAULT_TRIGGER = 'click'
export const ANIMATION_CLASS_PREFIX = 'animate__'

export const ENTER_ANIMATIONS = [
  {
    type: 'bounce',
    name: '튀기',
    children: [
      { name: '튀며 나타나기', value: 'bounceIn' },
      { name: '오른쪽으로 튀며 나타나기', value: 'bounceInLeft' },
      { name: '왼쪽으로 튀며 나타나기', value: 'bounceInRight' },
      { name: '위로 튀어 오르며 나타나기', value: 'bounceInUp' },
      { name: '아래로 튀며 나타나기', value: 'bounceInDown' },
    ],
  },
  {
    type: 'fade',
    name: '서서히 나타나기',
    children: [
      { name: '떠오르며 나타나기', value: 'fadeIn' },
      { name: '아래로 내려오며 나타나기', value: 'fadeInDown' },
      { name: '아래로 길게 내려오며 나타나기', value: 'fadeInDownBig' },
      { name: '오른쪽으로 떠오르며 나타나기', value: 'fadeInLeft' },
      { name: '오른쪽으로 길게 떠오르며 나타나기', value: 'fadeInLeftBig' },
      { name: '왼쪽으로 떠오르며 나타나기', value: 'fadeInRight' },
      { name: '왼쪽으로 길게 떠오르며 나타나기', value: 'fadeInRightBig' },
      { name: '위로 떠오르며 나타나기', value: 'fadeInUp' },
      { name: '위로 길게 떠오르며 나타나기', value: 'fadeInUpBig' },
      { name: '왼쪽 위에서 떠오르며 나타나기', value: 'fadeInTopLeft' },
      { name: '오른쪽 위에서 떠오르며 나타나기', value: 'fadeInTopRight' },
      { name: '왼쪽 아래에서 떠오르며 나타나기', value: 'fadeInBottomLeft' },
      { name: '오른쪽 아래에서 떠오르며 나타나기', value: 'fadeInBottomRight' },
    ],
  },
  {
    type: 'rotate',
    name: '회전',
    children: [
      { name: '회전하며 나타나기', value: 'rotateIn' },
      { name: '왼쪽 아래를 돌며 나타나기', value: 'rotateInDownLeft' },
      { name: '오른쪽 아래를 돌며 나타나기', value: 'rotateInDownRight' },
      { name: '왼쪽 위를 돌며 나타나기', value: 'rotateInUpLeft' },
      { name: '오른쪽 위를 돌며 나타나기', value: 'rotateInUpRight' },
    ],
  },
  {
    type: 'zoom',
    name: '확대/축소',
    children: [
      { name: '확대하며 나타나기', value: 'zoomIn' },
      { name: '아래로 확대하며 나타나기', value: 'zoomInDown' },
      { name: '왼쪽에서 확대하며 나타나기', value: 'zoomInLeft' },
      { name: '오른쪽에서 확대하며 나타나기', value: 'zoomInRight' },
      { name: '위로 확대하며 나타나기', value: 'zoomInUp' },
    ],
  },
  {
    type: 'slide',
    name: '밀려 들어오기',
    children: [
      { name: '아래로 밀려 들어오기', value: 'slideInDown' },
      { name: '오른쪽에서 밀려 들어오기', value: 'slideInLeft' },
      { name: '왼쪽에서 밀려 들어오기', value: 'slideInRight' },
      { name: '위로 밀려 들어오기', value: 'slideInUp' },
    ],
  },
  {
    type: 'flip',
    name: '뒤집기',
    children: [
      { name: 'X축으로 뒤집으며 나타나기', value: 'flipInX' },
      { name: 'Y축으로 뒤집으며 나타나기', value: 'flipInY' },
    ],
  },
  {
    type: 'back',
    name: '확대하며 밀려 들어오기',
    children: [
      { name: '아래로 확대하며 밀려 들어오기', value: 'backInDown' },
      { name: '왼쪽에서 확대하며 밀려 들어오기', value: 'backInLeft' },
      { name: '오른쪽에서 확대하며 밀려 들어오기', value: 'backInRight' },
      { name: '위로 확대하며 밀려 들어오기', value: 'backInUp' },
    ],
  },
  {
    type: 'lightSpeed',
    name: '날아오기',
    children: [
      { name: '오른쪽에서 날아오기', value: 'lightSpeedInRight' },
      { name: '왼쪽에서 날아오기', value: 'lightSpeedInLeft' },
    ],
  },
]

export const EXIT_ANIMATIONS = [
  {
    type: 'bounce',
    name: '튀기',
    children: [
      { name: '튀며 사라지기', value: 'bounceOut' },
      { name: '왼쪽으로 튀며 사라지기', value: 'bounceOutLeft' },
      { name: '오른쪽으로 튀며 사라지기', value: 'bounceOutRight' },
      { name: '위로 튀어 오르며 사라지기', value: 'bounceOutUp' },
      { name: '아래로 튀며 사라지기', value: 'bounceOutDown' },
    ],
  },
  {
    type: 'fade',
    name: '서서히 나타나기',
    children: [
      { name: '떠오르며 사라지기', value: 'fadeOut' },
      { name: '아래로 내려가며 사라지기', value: 'fadeOutDown' },
      { name: '아래로 길게 내려가며 사라지기', value: 'fadeOutDownBig' },
      { name: '왼쪽으로 떠오르며 사라지기', value: 'fadeOutLeft' },
      { name: '왼쪽으로 길게 떠오르며 사라지기', value: 'fadeOutLeftBig' },
      { name: '오른쪽으로 떠오르며 사라지기', value: 'fadeOutRight' },
      { name: '오른쪽으로 길게 떠오르며 사라지기', value: 'fadeOutRightBig' },
      { name: '위로 떠오르며 사라지기', value: 'fadeOutUp' },
      { name: '위로 길게 떠오르며 사라지기', value: 'fadeOutUpBig' },
      { name: '왼쪽 위로 떠오르며 사라지기', value: 'fadeOutTopLeft' },
      { name: '오른쪽 위로 떠오르며 사라지기', value: 'fadeOutTopRight' },
      { name: '왼쪽 아래로 떠오르며 사라지기', value: 'fadeOutBottomLeft' },
      { name: '오른쪽 아래로 떠오르며 사라지기', value: 'fadeOutBottomRight' },
    ],
  },
  {
    type: 'rotate',
    name: '회전',
    children: [
      { name: '회전하며 사라지기', value: 'rotateOut' },
      { name: '왼쪽 아래를 돌며 사라지기', value: 'rotateOutDownLeft' },
      { name: '오른쪽 아래를 돌며 사라지기', value: 'rotateOutDownRight' },
      { name: '왼쪽 위를 돌며 사라지기', value: 'rotateOutUpLeft' },
      { name: '오른쪽 위를 돌며 사라지기', value: 'rotateOutUpRight' },
    ],
  },
  {
    type: 'zoom',
    name: '확대/축소',
    children: [
      { name: '축소하며 사라지기', value: 'zoomOut' },
      { name: '아래로 축소하며 사라지기', value: 'zoomOutDown' },
      { name: '왼쪽으로 축소하며 사라지기', value: 'zoomOutLeft' },
      { name: '오른쪽으로 축소하며 사라지기', value: 'zoomOutRight' },
      { name: '위로 축소하며 사라지기', value: 'zoomOutUp' },
    ],
  },
  {
    type: 'slide',
    name: '밀려 나가기',
    children: [
      { name: '아래로 밀려 나가기', value: 'slideOutDown' },
      { name: '왼쪽으로 밀려 나가기', value: 'slideOutLeft' },
      { name: '오른쪽으로 밀려 나가기', value: 'slideOutRight' },
      { name: '위로 밀려 나가기', value: 'slideOutUp' },
    ],
  },
  {
    type: 'flip',
    name: '뒤집기',
    children: [
      { name: 'X축으로 뒤집으며 사라지기', value: 'flipOutX' },
      { name: 'Y축으로 뒤집으며 사라지기', value: 'flipOutY' },
    ],
  },
  {
    type: 'back',
    name: '축소하며 밀려 나가기',
    children: [
      { name: '아래로 축소하며 밀려 나가기', value: 'backOutDown' },
      { name: '왼쪽으로 축소하며 밀려 나가기', value: 'backOutLeft' },
      { name: '오른쪽으로 축소하며 밀려 나가기', value: 'backOutRight' },
      { name: '위로 축소하며 밀려 나가기', value: 'backOutUp' },
    ],
  },
  {
    type: 'lightSpeed',
    name: '날아가기',
    children: [
      { name: '오른쪽으로 날아가기', value: 'lightSpeedOutRight' },
      { name: '왼쪽으로 날아가기', value: 'lightSpeedOutLeft' },
    ],
  },
]

export const ATTENTION_ANIMATIONS = [
  {
    type: 'shake',
    name: '흔들림',
    children: [
      { name: '좌우로 흔들기', value: 'shakeX' },
      { name: '상하로 흔들기', value: 'shakeY' },
      { name: '고개 젓기', value: 'headShake' },
      { name: '흔들기', value: 'swing' },
      { name: '흔들림', value: 'wobble' },
      { name: '떨기', value: 'tada' },
      { name: '젤리', value: 'jello' },
    ],
  },
  {
    type: 'other',
    name: '기타',
    children: [
      { name: '튀기', value: 'bounce' },
      { name: '깜빡이기', value: 'flash' },
      { name: '맥박', value: 'pulse' },
      { name: '고무줄', value: 'rubberBand' },
      { name: '심장 박동(빠르게)', value: 'heartBeat' },
    ],
  },
]

interface SlideAnimation {
  label: string
  value: TurningMode
}

export const SLIDE_ANIMATIONS: SlideAnimation[] = [
  { label: '없음', value: 'no' },
  { label: '무작위', value: 'random' },
  { label: '좌우로 밀기', value: 'slideX' },
  { label: '상하로 밀기', value: 'slideY' },
  { label: '좌우로 밀기(3D)', value: 'slideX3D' },
  { label: '상하로 밀기(3D)', value: 'slideY3D' },
  { label: '페이드', value: 'fade' },
  { label: '회전', value: 'rotate' },
  { label: '상하로 펼치기', value: 'scaleY' },
  { label: '좌우로 펼치기', value: 'scaleX' },
  { label: '확대', value: 'scale' },
  { label: '축소', value: 'scaleReverse' },
]