# AI Log 03 — Backend MVC Skeleton

## Date
2026-05-14

## Tool
ChatGPT

## Purpose
Use AI to generate the initial Express MVC folder structure for AI Study Hub.

## Prompt
[paste prompt bạn đã hỏi]

## AI Output
[paste output quan trọng, có thể rút gọn nếu quá dài]

## What we accepted
- Used the suggested folder structure: routes, controllers, services, models.
- Used `.env.example` to document environment variables.

## What we changed
- Replaced Firebase Storage with Supabase Storage.
- Changed MySQL syntax to PostgreSQL syntax.

## What we rejected
- Did not use any frontend direct Supabase database access.

## Reason
The project design requires frontend → Express backend → PostgreSQL/Supabase Storage.