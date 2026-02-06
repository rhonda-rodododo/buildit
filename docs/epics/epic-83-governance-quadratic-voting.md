# Epic 83: Governance Quadratic Voting Protocol

**Status**: Not Started
**Priority**: P2 - Governance Enhancement
**Effort**: 12-18 hours
**Platforms**: All (protocol + web primary, propagate to iOS/Android)
**Dependencies**: None

---

## Context

The governance module supports multiple voting systems (simple, ranked-choice, D'Hondt, consensus) but quadratic voting is incomplete. The protocol schema needs extension to support the quadratic vote format (`Record<optionId, tokenAllocation>` instead of `string | string[]`), and the UI needs a token allocation interface.

**Source**: `clients/web/src/modules/governance/proposalManager.ts:390`

---

## Tasks

### Protocol Schema Extension (3-4h)

#### Quadratic Vote Format
- [ ] Add `quadratic` vote type to `protocol/schemas/modules/governance/`
- [ ] Define `QuadraticBallot` schema: `{ allocations: Record<optionId, number>, totalTokens: number }`
- [ ] Add validation rules: sum of sqrt(allocations) <= totalTokens
- [ ] Add test vectors for quadratic vote tallying
- [ ] Run `bun run codegen` to generate types

### Web Implementation (4-6h)

#### Token Allocation UI
- [ ] Create token allocation interface (slider or input per option)
- [ ] Display remaining token budget
- [ ] Show cost curve (quadratic: cost = votes^2)
- [ ] Real-time results preview
- [ ] Validate allocation before submission

#### Quadratic Tallying
- [ ] Implement quadratic vote tallying algorithm
- [ ] Handle tie-breaking rules
- [ ] Display results with effective vote counts
- [ ] Show token distribution visualization

### Cross-Platform (4-6h)

#### iOS Quadratic Voting
- [ ] Implement token allocation UI in SwiftUI
- [ ] Wire to governance module
- [ ] Handle codegen types

#### Android Quadratic Voting
- [ ] Implement token allocation UI in Compose
- [ ] Wire to governance module
- [ ] Handle codegen types

### Documentation (1-2h)
- [ ] Document quadratic voting in protocol spec
- [ ] Add explanation for users (what is quadratic voting, when to use it)
- [ ] Update governance module docs

---

## Acceptance Criteria

- [ ] Protocol schema supports quadratic vote format
- [ ] Token allocation UI works on web, iOS, and Android
- [ ] Quadratic tallying produces correct results (verified by test vectors)
- [ ] Users can create proposals with quadratic voting type
- [ ] Budget constraint enforced (can't overspend tokens)
- [ ] Results display effective vote counts, not raw token allocations

---

## Technical Notes

- Quadratic voting: cost of N votes for one option = N^2 tokens
- Each voter gets equal token budget (configurable per proposal)
- Prevents tyranny of the majority by making concentrated votes expensive
- Reference: RadicalxChange quadratic voting specification

---

**Git Commit Format**: `feat(governance): implement quadratic voting (Epic 83)`
**Git Tag**: `v0.83.0-quadratic-voting`
