# Presenting Quizzent

## Suggested resume entry

**Quizzent — Real-time quiz competition platform**

React · TypeScript · Node.js · Express · PostgreSQL · Socket.IO

- Built organiser publishing, guest admission, live readiness, timed MCQ attempts and shared-rank leaderboards, with a 50-competitor room cap.
- Used PostgreSQL transactions, row locks and uniqueness constraints to protect concurrent admission, immutable answers, idempotent retries and result publication.
- Added server-side sessions, ownership checks, superadmin reauthentication, account restrictions and request budgets; verified with 81 server checks and an automated browser/accessibility journey.

If adding performance evidence, say **“Locally load-tested 50 simultaneous competitors with no scenario errors.”** The latest local deployment-preparation run measured answer-submission p95 at 25 ms. Do not describe this as hosted capacity or an uptime guarantee. The hosted browser-HTTP/Socket.IO test on 2026-11-23 also completed at 50 competitors with no scenario errors and answer p95 of 1,086 ms. Say exactly which environment and client transport were tested; earlier Node HTTP runs missed deadlines at 50 competitors. This is a demo workload, not a capacity guarantee.

## A short interview walkthrough

1. Explain the rules: only online/ready guests count toward starting, every question has a server-controlled deadline, and an accepted answer cannot change.
2. Create a draft, add a question, publish it, and explain why publishing freezes content. Open a room and join in a second browser context.
3. Show the organiser's participant number and optional invitation reference. Explain why a nickname is not identity verification.
4. Mark the guest ready and show the five-second warning. Submit an answer, refresh, and show that the saved attempt/order survives.
5. Leave one question unanswered. Explain how the database deadline, not the browser countdown, decides the timeout. Show final results and the guest's own review.
6. Explain one race condition and its test. Example: two last-slot joins produce one admission and one rejection, rather than exceeding capacity.

Use disposable accounts and rooms, keep admin credentials private, and open a free sleeping demo before the interview. Retain the local demo and screenshots as a fallback if provider quotas or cold starts interfere.

## Questions worth being able to answer

| Question | Explain in your own words |
| --- | --- |
| Why PostgreSQL? | Related data, transactions, constraints and locks enforce rules across concurrent requests. A transaction saves all related changes together or none. |
| Why Socket.IO and HTTP? | Sockets provide lobby presence/readiness; HTTP handles saved edits, admission, answers and results. Neither client transport is trusted to decide identity or scoring. |
| What makes a retry safe? | A request ID identifies the accepted answer. Retrying the same ID/choice returns progress without inserting another answer. Conflicting reuse is rejected. |
| Why keep the server small? | One Node process meets the initial scope. In-memory readiness and rate budgets make multi-instance deployment unsupported without shared state. |
| What about a stolen cookie? | It is a bearer credential until expiry/revocation. HttpOnly limits script reads; it does not protect a compromised device. Sensitive admin changes also require the current password. |
| Why does the database sleep matter? | Background queries can keep serverless compute running. The worker now wakes on committed room changes and polls only while a competition is active. |
| What are the limitations? | No verified guest identity, MFA, password reset, distributed rate limits or proven multi-room hosted capacity. Free-hosting restarts can cancel a live quiz. |

## Evidence to keep current

- The README's screenshots are captured from the running app with disposable data.
- `npm run test:server`, `npm run test:browser` and `npm run test:load` are runnable checks, not just claims in a document.
- [MVP hardening](mvp-hardening.md) records the original local measurements and security boundaries.
- [Deployment](deployment.md) records hosted checks, failed earlier measurements, backup/restore evidence and remaining operational checks.
- Live demo: https://quizzent-076x.onrender.com. Replace the footer's temporary GitHub destination when the developer portfolio is deployed.
