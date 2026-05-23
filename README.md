# Company Info Finder (Node.js)

מערכת פשוטה ב-Node.js שבה מזינים שם חברה ומקבלים:

- תחום פעילות
- מידע כללי (תיאור, מיקום, כמות עובדים אם זמין)
- כתבות אחרונות על החברה

## הרצה

```bash
npm install
npm run dev
```

ואז לפתוח בדפדפן: `http://localhost:3000`

## API

### `POST /api/company-info`

Body:

```json
{
  "companyName": "Stripe"
}
```

Response (דוגמה):

```json
{
  "query": "Stripe",
  "company": {
    "name": "Stripe, Inc.",
    "industry": "Software / Technology",
    "headquarters": "San Francisco, California",
    "employeeCount": "8000",
    "description": "..."
  },
  "recentNews": [],
  "sources": [],
  "generatedAt": "2026-01-01T00:00:00.000Z"
}
```
