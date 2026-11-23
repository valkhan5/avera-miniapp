# Avera Mini App — запуск и обслуживание

## Что где
| Часть | Где | Адрес |
|---|---|---|
| База, вход менеджеров, фото | Supabase, проект `avera` (eu-central-1) | https://supabase.com/dashboard/project/xikburtaymnlogolmenx |
| API мини-приложения | Edge Function `api` | `https://xikburtaymnlogolmenx.supabase.co/functions/v1/api` |
| Бот (webhook) | Edge Function `bot` | `…/functions/v1/bot` |
| Действия админки | Edge Function `admin` | `…/functions/v1/admin` |
| Мини-приложение | Cloudflare Pages `avera-miniapp` | `https://avera-miniapp.pages.dev` |
| Админка | Cloudflare Pages `avera-admin` | `https://avera-admin.pages.dev` |
| Код | GitHub `valkhan5/avera-miniapp` | ветка `feat/miniapp` |

## Секреты
Единственный обязательный секрет — `TELEGRAM_BOT_TOKEN` (Supabase → Edge Functions → Secrets).
Секрет webhook вычисляется из токена. Необязательные: `MINIAPP_URL` (если адрес мини-приложения не `https://avera-miniapp.pages.dev`), `TELEGRAM_WEBHOOK_SECRET`.
После смены токена: админка → Настройки → «Подключить бота».

## Первый запуск
1. Supabase → Edge Functions → Secrets → `TELEGRAM_BOT_TOKEN`.
2. Supabase → Authentication → Users → Add user (почта из списка менеджеров, Auto Confirm).
   Рекомендуется: Authentication → Sign In / Providers → выключить «Allow new users to sign up».
3. Cloudflare → Workers & Pages → Create application → вкладка **Pages** (не Workers; внизу экрана ссылка «Looking to deploy Pages? Get started») → Import an existing Git repository → `valkhan5/avera-miniapp`. Два проекта из одного репозитория:
   - `avera-miniapp`: production branch `feat/miniapp`, framework preset None, build `npm ci && npm run build:miniapp`, output `apps/miniapp/dist`, root directory пустой;
   - `avera-admin`: то же, build `npm ci && npm run build:admin`, output `apps/admin/dist`.
   Если по ошибке создан Worker (адрес `*.workers.dev`, сборка `npx wrangler deploy` падает) — удалить его: Worker → Settings → Delete.
4. @BotFather → Bot Settings → Configure Mini App → URL мини-приложения.
5. Админка → Настройки → «Подключить бота»; бот — администратор группы менеджеров; в группе `/bind <код>`; «Тестовое сообщение в группу».
6. Сбросить ссылку-приглашение группы.

## Менеджеры
Доступ к данным есть только у почт из списка «Настройки → Менеджеры» (таблица `managers`).
Новый менеджер: добавить почту в список и создать ему пользователя в Supabase → Authentication → Users.

## Обновление кода
- Сайты пересобираются сами после push в рабочую ветку.
- База: новые файлы в `supabase/migrations/` применяются в Supabase (SQL Editor или Supabase CLI).
- Функции: `npx supabase functions deploy api bot admin --no-verify-jwt --project-ref xikburtaymnlogolmenx`.

## Проверки
- `npm test` — 87 автотестов (цены, метки, статусы, база, функции, игра, админка).
- `node scripts/e2e-miniapp.mjs all` — сценарии мини-приложения в браузере (режим `?mock=1`).
- `node scripts/screens.mjs` — скриншоты экранов.
