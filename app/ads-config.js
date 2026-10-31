/* 앱(안드로이드) 빌드에만 들어가는 보상형 광고 설정. 웹사이트에는 포함되지 않는다.
   testing:true 이면 구글 테스트 광고만 나온다. 실제 광고 단위 ID를 넣고 출시할 때 false로 바꾼다. */
window.ARCADE_ADS = {
  testing: true,
  units: {
    revive:  'ca-app-pub-6892267130022389/8788396285',   // 이어하기
    double:  'ca-app-pub-6892267130022389/8529823092',   // 별사탕 2배
    mission: 'ca-app-pub-6892267130022389/5567336578'    // 미션 보상 2배
  }
};
