# Bundled agent skills

Skills vendored into `.claude/skills/`. The SessionStart hook
(`.claude/hooks/session-start.sh`) copies every directory here that contains a
`SKILL.md` into `~/.claude/skills`, so they load in any folder, not just this
repo. Set `SKILLS_SKIP_GLOBAL_INSTALL=1` to opt out.

## Design skills

Installed earlier from the UI/UX Pro Max bundle: `ui-ux-pro-max`, `design`,
`design-system`, `ui-styling`, `brand`, `banner-design`, `slides`.

## Swift / Apple platform skills

Sourced from the [Swift Agent Skills](https://github.com/twostraws/Swift-Agent-Skills)
index by Paul Hudson. That repository is a curated list of links, not a skill
itself; the entries below were cloned from the individual projects it links to.
Being listed there is not an endorsement — each skill is third-party code.

All are MIT licensed except where noted, and each skill directory carries its
upstream `LICENSE`.

| Skill | Source | Author |
|---|---|---|
| `app-intents` | [n0an/App-Intents-Agent-Skill](https://github.com/n0an/App-Intents-Agent-Skill) | Anton Novoselov |
| `app-store-aso` | [timbroddin/app-store-aso-skill](https://github.com/timbroddin/app-store-aso-skill) | Tim Broddin |
| `app-store-changelog` | [Dimillian/Skills](https://github.com/Dimillian/Skills) | Thomas Ricouard |
| `appkit-accessibility-auditor` | [rgmez/apple-accessibility-skills](https://github.com/rgmez/apple-accessibility-skills) | Roberto Gomez Munoz |
| `appstore-review` | [3paws-ai/mobile-ai-skills](https://github.com/3paws-ai/mobile-ai-skills) | Dann Beauregard |
| `asc-ad-hoc-distribution` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-analytics-reports` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-app-create-ui` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-apple-ads` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-aso-audit` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-build-lifecycle` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-cli-usage` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-crash-triage` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-id-resolver` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-localize-metadata` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-metadata-sync` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-notarization` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-ppp-pricing` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-release-flow` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-revenuecat-catalog-sync` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-screenshot-resize` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-shots-pipeline` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-signing-setup` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-submission-health` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-subscription-localization` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-testflight-orchestration` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-wall-submit` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-whats-new-writer` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-workflow` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `asc-xcode-build` | [rudrankriyam/app-store-connect-cli-skills](https://github.com/rudrankriyam/app-store-connect-cli-skills) | Rudrank Riyam |
| `background-execution` | [n0an/Background-Execution-Agent-Skill](https://github.com/n0an/Background-Execution-Agent-Skill) | Anton Novoselov |
| `core-data-expert` | [AvdLee/Core-Data-Agent-Skill](https://github.com/AvdLee/Core-Data-Agent-Skill) | Antoine van der Lee |
| `figma-to-swiftui` | [daetojemax/figma-to-swiftui-skill](https://github.com/daetojemax/figma-to-swiftui-skill) | Ermolaev Maxim |
| `ios-accessibility` | [dadederk/iOS-Accessibility-Agent-Skill](https://github.com/dadederk/iOS-Accessibility-Agent-Skill) | Daniel Devesa |
| `ios-code-audit` | [jazzychad/ios-code-audit](https://github.com/jazzychad/ios-code-audit) | Chad Etzel |
| `ios-simulator-skill` | [conorluddy/ios-simulator-skill](https://github.com/conorluddy/ios-simulator-skill) | Conor Luddy |
| `observability` | [n0an/Observability-Agent-Skill](https://github.com/n0an/Observability-Agent-Skill) | Anton Novoselov |
| `swift-accessibility-skill` | [PasqualeVittoriosi/swift-accessibility-skill](https://github.com/PasqualeVittoriosi/swift-accessibility-skill) | Pasquale Vittoriosi |
| `swift-api-design-guidelines-skill` | [Erikote04/Swift-API-Design-Guidelines-Agent-Skill](https://github.com/Erikote04/Swift-API-Design-Guidelines-Agent-Skill) | Erik Sebastian de Erice |
| `swift-architecture-skill` | [efremidze/swift-architecture-skill](https://github.com/efremidze/swift-architecture-skill) | Lasha Efremidze |
| `swift-concurrency` | [AvdLee/Swift-Concurrency-Agent-Skill](https://github.com/AvdLee/Swift-Concurrency-Agent-Skill) | Antoine van der Lee |
| `swift-concurrency-expert` | [Dimillian/Skills](https://github.com/Dimillian/Skills) | Thomas Ricouard |
| `swift-concurrency-pro` | [twostraws/Swift-Concurrency-Agent-Skill](https://github.com/twostraws/Swift-Concurrency-Agent-Skill) | Paul Hudson |
| `swift-focusengine-pro` | [mhaviv/Swift-FocusEngine-Agent-Skill](https://github.com/mhaviv/Swift-FocusEngine-Agent-Skill) | Michael Haviv |
| `swift-format-style` | [n0an/Swift-FormatStyle-Agent-Skill](https://github.com/n0an/Swift-FormatStyle-Agent-Skill) | Anton Novoselov |
| `swift-security-expert` | [ivan-magda/swift-security-skill](https://github.com/ivan-magda/swift-security-skill) | Ivan Magda |
| `swift-testing` | [bocato/swift-testing-agent-skill](https://github.com/bocato/swift-testing-agent-skill) | Eduardo Bocato |
| `swift-testing-expert` | [AvdLee/Swift-Testing-Agent-Skill](https://github.com/AvdLee/Swift-Testing-Agent-Skill) | Antoine van der Lee |
| `swift-testing-pro` | [twostraws/Swift-Testing-Agent-Skill](https://github.com/twostraws/Swift-Testing-Agent-Skill) | Paul Hudson |
| `swiftdata-expert-skill` | [vanab/swiftdata-agent-skill](https://github.com/vanab/swiftdata-agent-skill) | Kudrin Dmitry |
| `swiftdata-pro` | [twostraws/SwiftData-Agent-Skill](https://github.com/twostraws/SwiftData-Agent-Skill) | Paul Hudson |
| `swiftdata-testing` | [akshaypimprikar/ios-swiftdata-testing-agent-skill](https://github.com/akshaypimprikar/ios-swiftdata-testing-agent-skill) | Akshay Pimprikar |
| `swiftui-accessibility-auditor` | [rgmez/apple-accessibility-skills](https://github.com/rgmez/apple-accessibility-skills) | Roberto Gomez Munoz |
| `swiftui-design-principles` | [arjitj2/swiftui-design-principles](https://github.com/arjitj2/swiftui-design-principles) | Arjit Jaiswal |
| `swiftui-performance-audit` | [Dimillian/Skills](https://github.com/Dimillian/Skills) | Thomas Ricouard |
| `swiftui-pro` | [twostraws/SwiftUI-Agent-Skill](https://github.com/twostraws/SwiftUI-Agent-Skill) | Paul Hudson |
| `swiftui-ui-patterns` | [Dimillian/Skills](https://github.com/Dimillian/Skills) | Thomas Ricouard |
| `swiftui-view-refactor` | [Dimillian/Skills](https://github.com/Dimillian/Skills) | Thomas Ricouard |
| `uikit-accessibility-auditor` | [rgmez/apple-accessibility-skills](https://github.com/rgmez/apple-accessibility-skills) | Roberto Gomez Munoz |
| `widgets` | [n0an/Widgets-Agent-Skill](https://github.com/n0an/Widgets-Agent-Skill) | Anton Novoselov |
| `writing-for-interfaces` | [andrewgleave/skills](https://github.com/andrewgleave/skills) | Andrew Gleave |

### Licensing exception

`figma-to-swiftui` (daetojemax/figma-to-swiftui-skill) ships **no licence file**
upstream, so it is vendored without a redistribution grant. See
`.claude/skills/figma-to-swiftui/NOTICE.md`. Delete that directory if this
matters for your use — the hook enumerates skills dynamically.

### Not installed

Three index entries are reference material rather than skills, so they were
skipped: `twostraws/SwiftAgents` (an AGENTS.md file),
`artemnovichkov/xcode-26-system-prompts`, and `Techopolis/awesome-ios-ai`.
For the multi-skill repos `Dimillian/Skills`, `andrewgleave/skills` and
`3paws-ai/mobile-ai-skills`, only the skills the index actually lists were
installed, not every skill in those repos.
