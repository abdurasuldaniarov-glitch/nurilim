# Медресе — Документтерди башкаруу системасы (demo frontend)

## Иштетүү
`index.html` файлын браузерде ачыңыз. Камера үчүн HTTPS же localhost керек:
`python3 -m http.server 8000` → http://localhost:8000

## Демо кирүү
- Колдонуучу (көрүүчү): `user` / `user123`
- Администратор: `admin` / `admin123`
- Admin Access Code (өзгөртүү/өчүрүү/калыбына келтирүү): `ADMIN-2026`
(Бардыгы кодто SHA-256 хэш катары, ачык текст эмес.)

## Структура
- `index.html` — беттер жана модалдар
- `style.css` — дизайн, dark mode, responsive
- `script.js` — CONFIG → API катмары (localStorage + IndexedDB) → UI
- `assets/` — логотип

## Backend кошуу (PHP/Node + MySQL/PostgreSQL)
`script.js` ичиндеги `API` объектин `fetch('/api/...')` менен алмаштырыңыз.
Серверде: сессия/JWT, bcrypt/argon2, ролдорду жана Admin кодду серверде текшерүү,
файлдарды /students/<аты>/ структурасында сактоо.
⚠️ Frontend текшерүү коопсуздук эмес — бул демо.
