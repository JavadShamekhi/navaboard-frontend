# NavaBoard Frontend (Vite + React + TypeScript + Tailwind)

```bash
npm install
npm run dev
```

با `VITE_USE_MOCKS=true` (پیش‌فرض در `.env`) بدون بک‌اند کار می‌کند. کد OTP در حالت mock همیشه `123456` است.

## وصل شدن به بک‌اند واقعی
1. `.env` → `VITE_USE_MOCKS=false`
2. `vite.config.ts` → `target` پروکسی `/api` را روی آدرس بک‌اند بگذار (پیش‌فرض `http://127.0.0.1:8000`).
3. مرورگر را روی یک میزبان ثابت باز کن (همیشه `localhost` یا همیشه `127.0.0.1`) تا کوکی‌ها قاطی نشوند.
4. اگر ۴۰۳ گرفتی، چک‌لیست CSRF بخش ۷ راهنما را برو (Origin و `CSRF_TRUSTED_ORIGINS` بک‌اند).

## ساختار
- `src/api/` همه‌ی endpointهای Swagger. `client.ts` شامل CSRF، refresh تک‌پروازی و یک‌بار retry بعد از 401 است.
- `src/types/` تایپ‌ها (حدسی از روی راهنما؛ با `schema.yml` تطبیق بده).
- `src/mocks/` MSW. بعد از اتصال به بک‌اند واقعی فقط خاموشش کن.
- `src/pages/`, `src/components/` صفحات و کامپوننت‌ها.

## پیاده‌سازی‌شده
ورود OTP، بازیابی نشست، خروج، فضای کاری/برد، ستون و کارت، drag-and-drop کارت با optimistic update و rollback، مودال کارت (توضیحات، چک‌لیست، کامنت).

## مانده
عضوها و نقش‌ها، برچسب و مسئول روی کارت، تاریخ موعد، پیوست فایل، اعلان‌ها (polling)، جست‌وجو، جابه‌جایی ستون‌ها با drag. wrapper همه‌ی این‌ها در `src/api/` آماده است.
