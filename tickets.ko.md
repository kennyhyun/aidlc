## 기본 정보

우리 jira ticket url 은 이렇네

https://whitech.atlassian.net/browse/REI-15158


.zshrc 나 .profile 에

export JIRA_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="your-api-token"

처럼 토큰을 설정해 둘거야.

그럼 토큰과 curl 커맨드를 이용해 필요한 정보를 얻어서 나를 도와주면 좋겠어.

먼저 토큰이 사용가능한지 알아보고, 뭐가 정의되어있지 않다면, 

1. source ~/.zshrc 을 실행해 보고 그래도 없으면
2. source ~/.profile 도 실행 해 보고 그래도 없으면
3. 그래도 없으면 어떻게 토큰 발급 받을 수 있는지, 어떻게 정의 하는지 설명해 줘

## 정보 취득/요약

- 먼저 로컬 docs/tickets/xxx/REI-xxx_ 문서들이 있는지 확인해 보고 있으면 이걸 먼저 확인하자.
- API를 통해 정보를 취합해서
  - docs/tickets/epic/REI-xxx_a_story_name/readme.md
  - docs/tickets/story/REI-xxx_a_story_name/readme.md
  - docs/tickets/task/REI-xxx_a_story_name/readme.md
  등을 작성해 줘
- API결과는 docs/task/a_story_name/.files 에 일단 모두 저장하고, 검색할때는 adf-to-text.sh로 텍스트로 변환후 grep 등으로 필요한 거만 찾아서 보는게 좋겠어.
- json 결과 파싱은 jq를 이용하면 좋겠네.
- 일단 summary(타이틀)과 description까지는 모든 child items에대해 취합해 줘.
- subtask의 경우는 부모 타크스 폴더에 티켓넘버로 폴더를 만들고 거기에 정보를 취합 해 줘
- epic의 경우는 child items를 상위폴더에 만들지만, 에픽디렉토리에는 티켓넘버로 심링크를 걸어줘.
- readme는 영어로 작성해야 해.
- Readme에는 하위문서의 readme를 정리해서, 종합적으로 할일에 대해 간단명료하게 정리해 줬으면 좋겠어

내가 한글로 물어봤다면 readme.ko.md 로 한글 문서를 먼저 만들어도 되겠어.

### 다이어그램

모든 티켓에 이미지를 하나씩 넣어주면 한눈에 스코프를 확인 할 수 있어 좋을거 같아.

먼저 mermaid 파일을 만들고 draw.sh 를 호출해서 mermaid 를 jpeg 으로 변환하면 좋겠네

백엔드 작업이 메인이라면, sequenceDiagram 을 우선적으로 사용하면 좋겠다.

## 상태 분석

- docs/epic/a_story_name/status.md 를 만들어주면 좋겠어.
- 각 child item에 대해, 티켓번호, 타입, summary, 상태와 등을 list 형태로 구분없이 넣어주고
  - 하위 항목은 readme.md 로 링크를 넣어도 좋을거 같아.

## 타스크 시작

- 브랜치이름을 추천해주고, checkout 명령어를 준비해 줘. 예를들면 이런식으로
  git fetch && git checkout -b task/REI-xxx-decide-to-trigger-local-rendering origin/develop
- 티켓에서 정리한 정보를 바탕으로, 계획을 세우자. 토론을 통해 문제가 없을지 확인하고 확정하자.
  코드베이스는 너무 커서, 필요할 때 필요한 부분만 찾는게 좋을거 같은데.
- plan.md 를 티켓폴더에 추가하고 필요한 서브타스크를 열거하자
- plan이 어느정도 윤곽이 잡히면 readme.md 를 맞춰서 갱신하자
- 갱신한 reame 내용에 맞게, Jira API로 티켓의 description을 업데이트하자.
- API로 서브타스크 티켓생성을 하자

### readme 파일이 커버할 범위

티켓의 description과 동일하다고 보면 되는데,

코드예시나 소스파일명은 바뀔 수 있으니 안넣는게 좋고,
관련 티켓 정보는 이미 다른 필드카 커버할테니 넣지 말고,
Implementation Note 로 할일을 설명만 간단히 list 형태로 넣으면 좋겠어

### 티켓 생성시 참고

할일 리스트나 success criteria 는 taskList로 넣으면 좋겠어

sample:

```json
          "type": "taskList",
          "attrs": {"localId": "success-criteria"},
          "content": [
            {
              "type": "taskItem",
              "attrs": {"localId": "success-1", "state": "TODO"},
              "content": [
                {"type": "text", "text": "API accepts "},
                {"type": "text", "text": "supportsLocalRendering", "marks": [{"type": "code"}]},
                {"type": "text", "text": " parameter"}
              ]
            },
```
